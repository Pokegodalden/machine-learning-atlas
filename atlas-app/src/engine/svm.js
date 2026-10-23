import {measureFit,measureReference,startFit} from './run-timing.js';
import {requestKey} from '../core/experiment.js';
import {trainingScale} from './logistic-regression.js';
import {classificationMetrics} from './knn.js';

export function svmTrainingParameters(p){
  if(!p||Object.keys(p).some(k=>!['c','kernel','gamma'].includes(k))||!Number.isFinite(p.c)||p.c<.001||p.c>100||!['linear','rbf'].includes(p.kernel)||('gamma' in p&&(!Number.isFinite(p.gamma)||p.gamma<.001||p.gamma>10))||(p.kernel==='rbf'&&!Number.isFinite(p.gamma)))throw new Error('Choose C 0.001–100, a linear or RBF kernel, and RBF gamma 0.001–10.');
  return p.kernel==='linear'?{c:p.c,kernel:p.kernel}:{c:p.c,kernel:p.kernel,gamma:p.gamma};
}
export const svmKernel=(a,b,p)=>p.kernel==='linear'?a[0]*b[0]+a[1]*b[1]:Math.exp(-p.gamma*((a[0]-b[0])**2+(a[1]-b[1])**2));
export function predictSvm(model,raw){
  if(!Array.isArray(raw)||raw.length!==2||raw.some(x=>!Number.isFinite(x)))throw new Error('Use finite query coordinates.');
  const z=raw.map((v,j)=>(v-model.mean[j])/model.scale[j]);let score=model.intercept;
  for(const row of model.training)if(row.alpha!==0)score+=row.coefficient*svmKernel(row.z,z,model.parameters);
  return {score,label:score>0?1:0,z};
}
export function fitSvm(d,parameters,onProgress=()=>{},preprocessing='standardize-train'){
  const p=svmTrainingParameters(parameters),scaling=trainingScale(d,preprocessing),ids=d.partitions.train,n=ids.length,y=ids.map(i=>d.y[i]===1?1:-1);
  if(new Set(y).size!==2)throw new Error('SVM training needs both binary classes.');
  const Z=ids.map(i=>d.X[i].map((v,j)=>(v-scaling.mean[j])/scaling.scale[j])),K=Z.map(a=>Z.map(b=>svmKernel(a,b,p))),alpha=Array(n).fill(0),g=Array(n).fill(0),c=p.c,tolerance=1e-7,maxIterations=1000000,checkpoints=[];
  let iteration=0,upper=0,lower=0,gap=Infinity;
  function workingSet(){let i=-1,j=-1;upper=-Infinity;lower=Infinity;
    for(let k=0;k<n;k++){const h=y[k]-g[k];if((y[k]===1?alpha[k]<c:alpha[k]>0)&&h>upper){upper=h;i=k;}if((y[k]===1?alpha[k]>0:alpha[k]<c)&&h<lower){lower=h;j=k;}}
    gap=upper-lower;return [i,j];
  }
  function record(){const dual=alpha.reduce((s,a,i)=>s+a-.5*a*y[i]*g[i],0);checkpoints.push({index:checkpoints.length,kind:'dual-pair-updates',iteration,kktGap:Math.max(0,gap),dualObjective:dual});onProgress({phase:'optimizing-svm',iteration,kktGap:Math.max(0,gap)});}
  while(true){const [i,j]=workingSet();if(iteration===0||iteration%500===0||gap<=tolerance)record();if(gap<=tolerance)break;
    if(iteration>=maxIterations||i<0||j<0||i===j)throw new Error('The SVM did not reach its KKT tolerance. Retry with less extreme settings.');
    const boundI=y[i]===1?c-alpha[i]:alpha[i],boundJ=y[j]===1?alpha[j]:c-alpha[j],curvature=Math.max(0,K[i][i]+K[j][j]-2*K[i][j]);
    const step=Math.min(boundI,boundJ,curvature>1e-14?gap/curvature:Infinity);
    if(!(step>0)||!Number.isFinite(step))throw new Error('The SVM pair update lost numeric precision.');
    alpha[i]=Math.max(0,Math.min(c,alpha[i]+y[i]*step));alpha[j]=Math.max(0,Math.min(c,alpha[j]-y[j]*step));
    for(let k=0;k<n;k++)g[k]+=step*(K[k][i]-K[k][j]);iteration++;
    // Periodic direct recomputation bounds accumulated cache roundoff.
    if(iteration%5000===0)for(let k=0;k<n;k++)g[k]=alpha.reduce((s,a,j)=>s+a*y[j]*K[k][j],0);
  }
  for(let k=0;k<n;k++)g[k]=alpha.reduce((s,a,j)=>s+a*y[j]*K[k][j],0);workingSet();
  if(gap>tolerance*1.1)throw new Error('The recomputed SVM certificate exceeded tolerance.');
  const intercept=(upper+lower)/2,supportTolerance=1e-8,training=ids.map((rowId,i)=>({rowId,label:d.y[rowId],internalLabel:y[i],z:Z[i],alpha:alpha[i],coefficient:alpha[i]*y[i],support:alpha[i]>supportTolerance}));
  const weights=p.kernel==='linear'?[0,1].map(j=>training.reduce((s,r)=>s+r.coefficient*r.z[j],0)):null;
  const normSquared=alpha.reduce((s,a,i)=>s+a*y[i]*g[i],0),hinge=training.map((r,i)=>Math.max(0,1-y[i]*(g[i]+intercept))),primalObjective=.5*normSquared+c*hinge.reduce((s,v)=>s+v,0),dualObjective=alpha.reduce((s,a)=>s+a,0)-.5*normSquared;
  const model={kind:'svm',parameters:p,...scaling,intercept,weights,training,supportTolerance,supportRowIds:training.filter(r=>r.support).map(r=>r.rowId),labelMapping:{0:-1,1:1},decisionRule:'score > 0 chooses class 1; zero chooses class 0'};
  return {model,checkpoints,solver:{kind:'deterministic-most-violating-pair-smo',converged:true,iterations:iteration,tolerance,kktGap:Math.max(0,gap),equalityResidual:Math.abs(training.reduce((s,r)=>s+r.coefficient,0)),primalObjective,dualObjective,dualityGap:Math.max(0,primalObjective-dualObjective),interceptConvention:'midpoint of the final KKT intercept interval'}};
}
export function svmDomain(d){return [0,1].map(j=>{const values=[...d.partitions.train,...d.partitions.validation].map(i=>d.X[i][j]),lo=Math.min(...values),hi=Math.max(...values),pad=Math.max((hi-lo)*.12,.25);return [lo-pad,hi+pad];});}
export function svmGeometry(model,domain,resolution=48){
  const scores=[],labels=[],vertices=[];
  const point=(x,y)=>[domain[0][0]+x/resolution*(domain[0][1]-domain[0][0]),domain[1][0]+y/resolution*(domain[1][1]-domain[1][0])];
  for(let y=0;y<=resolution;y++)for(let x=0;x<=resolution;x++)vertices.push(predictSvm(model,point(x,y)).score);
  for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++){const score=predictSvm(model,point(x+.5,y+.5)).score;scores.push(score);labels.push(score>0?1:0);}
  // Marching triangles avoids ambiguous saddle cells. Intersections interpolate
  // actual decision scores; nonlinear contours remain sampled approximations.
  const contours=[-1,0,1].map(level=>({level,segments:[]}));
  for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++){
    const corners=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]];
    for(const triangle of [[0,1,2],[0,2,3]])for(const contour of contours){const cross=[];
      for(let k=0;k<3;k++){const a=corners[triangle[k]],b=corners[triangle[(k+1)%3]],sa=vertices[a[1]*(resolution+1)+a[0]],sb=vertices[b[1]*(resolution+1)+b[0]];
        if((sa<=contour.level&&sb>contour.level)||(sa>contour.level&&sb<=contour.level)){const t=(contour.level-sa)/(sb-sa);cross.push(point(a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])));}}
      if(cross.length===2)contour.segments.push(cross);
    }
  }
  return {domain,resolution,scores,labels,contours,sampling:'cell centers; contours interpolate vertex scores'};
}
export function evaluateSvm(request,d,runId,onProgress=()=>{}){
  if(request.schemaVersion!=='1.0.0'||request.modelId!=='svm'||request.adapterVersion!=='svm-smo-1'||request.datasetId!==d.id||request.datasetRevision!==d.revision||!['two-blobs','two-moons'].includes(d.id)||!['none','standardize-train'].includes(request.preprocessing)||request.evaluation!=='validation'||!Number.isInteger(request.modelSeed)||!Number.isInteger(runId)||runId<1)throw new Error('Unsupported SVM experiment.');
  const p=svmTrainingParameters(request.parameters);if(requestKey(p)!==requestKey(request.parameters))throw new Error('Linear fitting requests must exclude inactive gamma.');
  const all=[...d.partitions.train,...d.partitions.validation,...d.partitions.test];if(new Set(all).size!==all.length||!d.partitions.validation.length)throw new Error('Use distinct training, validation, and final-check partitions.');
  const {model,solver,checkpoints}=measureFit(()=>fitSvm(d,p,onProgress,request.preprocessing)),predictions={},metrics={};
  for(const split of ['train','validation']){predictions[split]=d.partitions[split].map(rowId=>{if(![0,1].includes(d.y[rowId]))throw new Error('Expected binary evaluation labels.');const prediction=predictSvm(model,d.X[rowId]);return {rowId,score:prediction.score,label:prediction.label};});metrics[split]=classificationMetrics(d.partitions[split].map(i=>d.y[i]),predictions[split].map(p=>p.label));}
  return {schemaVersion:'1.0.0',runId,configKey:requestKey(request),request:structuredClone(request),model,solver,checkpoints,preprocessing:{kind:request.preprocessing,mean:model.mean,scale:model.scale,ddof:0,fitRowIds:[...d.partitions.train]},predictions,metrics,geometry:svmGeometry(model,svmDomain(d))};
}
