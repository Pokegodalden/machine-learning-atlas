import {measureFit,measureReference,startFit} from './run-timing.js';
import {requestKey} from '../core/experiment.js';
import {classificationMetrics} from './knn.js';
export const sigmoid=s=>s>=0?1/(1+Math.exp(-s)):Math.exp(s)/(1+Math.exp(s));
export const softplus=s=>Math.max(s,0)+Math.log1p(Math.exp(-Math.abs(s)));
export function thresholdLabel(p,t){if(!Number.isFinite(p)||p<0||p>1||!Number.isFinite(t)||t<0||t>1)throw new Error('Use probabilities and thresholds between 0 and 1.');return t===0?1:t===1?0:p>=t?1:0;}
export function trainingScale(dataset,kind='standardize-train'){
  if(!['none','standardize-train'].includes(kind))throw Error('Unsupported feature scaling.');
  const train=dataset.partitions.train;if(!train.length||new Set(train).size!==train.length)throw new Error('Training rows must be distinct.');
  for(const i of train)if(!Number.isInteger(i)||dataset.X[i]?.length!==2||dataset.X[i].some(x=>!Number.isFinite(x))||![0,1].includes(dataset.y[i]))throw new Error('Expected finite two-feature binary training data.');
  if(kind==='none')return {mean:[0,0],scale:[1,1]};
  const mean=[0,1].map(j=>train.reduce((s,i)=>s+dataset.X[i][j],0)/train.length),scale=[0,1].map(j=>Math.sqrt(train.reduce((s,i)=>s+(dataset.X[i][j]-mean[j])**2,0)/train.length)||1);
  if([...mean,...scale].some(x=>!Number.isFinite(x)))throw new Error('Scaling exceeded finite numeric precision.');return {mean,scale};
}
export function predictLogistic(model,raw){
  if(!Array.isArray(raw)||raw.length!==2||raw.some(x=>!Number.isFinite(x)))throw new Error('Use finite query coordinates.');
  const z=raw.map((x,j)=>(x-model.mean[j])/model.scale[j]),contributions=z.map((x,j)=>x*model.weights[j]),score=contributions[0]+contributions[1]+model.intercept;
  return {z,contributions,score,probability:sigmoid(score)};
}
export function objectiveDerivatives(A,y,theta,c){
  let objective=(theta[0]**2+theta[1]**2)/(2*c);const gradient=[theta[0]/c,theta[1]/c,0],hessian=[[1/c,0,0],[0,1/c,0],[0,0,0]];
  A.forEach((row,i)=>{const score=row.reduce((s,x,j)=>s+x*theta[j],0),p=sigmoid(score),r=p-y[i],v=p*(1-p);objective+=softplus(score)-y[i]*score;for(let j=0;j<3;j++){gradient[j]+=row[j]*r;for(let k=0;k<3;k++)hessian[j][k]+=row[j]*row[k]*v;}});
  return {objective,gradient,hessian,gradientInfinityNorm:Math.max(...gradient.map(Math.abs))};
}
function solve3(matrix,vector){
  const a=matrix.map((row,i)=>[...row,vector[i]]);
  for(let col=0;col<3;col++){let pivot=col;for(let r=col+1;r<3;r++)if(Math.abs(a[r][col])>Math.abs(a[pivot][col]))pivot=r;
    [a[col],a[pivot]]=[a[pivot],a[col]];if(Math.abs(a[col][col])<1e-14)throw new Error('The logistic Hessian is singular.');
    const divisor=a[col][col];for(let j=col;j<4;j++)a[col][j]/=divisor;
    for(let r=0;r<3;r++)if(r!==col){const f=a[r][col];for(let j=col;j<4;j++)a[r][j]-=f*a[col][j];}
  }return a.map(row=>row[3]);
}
export function evaluateLogistic(request,dataset,runId){
  const c=request.parameters?.c;
  if(request.schemaVersion!=='1.0.0'||request.modelId!=='logistic-regression'||request.adapterVersion!=='logistic-newton-1'||request.datasetId!==dataset.id||request.datasetRevision!==dataset.revision||!['two-blobs','two-moons','xor-corners'].includes(dataset.id)||!['none','standardize-train'].includes(request.preprocessing)||request.evaluation!=='validation'||!Number.isInteger(request.modelSeed)||!Number.isInteger(runId)||runId<1||!Number.isFinite(c)||c<.001||c>100||Object.keys(request.parameters).length!==1)throw new Error('Unsupported logistic regression request.');
  const all=[...dataset.partitions.train,...dataset.partitions.validation,...dataset.partitions.test];if(new Set(all).size!==all.length||!dataset.partitions.validation.length)throw new Error('Use distinct train, validation, and final-check partitions.');
  const stopFit=startFit();
  const scaling=trainingScale(dataset,request.preprocessing),rows=dataset.partitions.train,y=rows.map(i=>dataset.y[i]);if(new Set(y).size!==2)throw new Error('Training requires both classes.');
  const A=rows.map(i=>[...dataset.X[i].map((x,j)=>(x-scaling.mean[j])/scaling.scale[j]),1]);let theta=[0,0,0],derivatives=objectiveDerivatives(A,y,theta,c);const checkpoints=[];
  for(let iteration=0;iteration<=80;iteration++){
    checkpoints.push({index:iteration,kind:'newton-iteration',weights:theta.slice(0,2),intercept:theta[2],objective:derivatives.objective,gradientInfinityNorm:derivatives.gradientInfinityNorm});
    if(derivatives.gradientInfinityNorm<=1e-9)break;if(iteration===80)throw new Error('Logistic fitting did not converge within 80 Newton steps.');
    const direction=solve3(derivatives.hessian,derivatives.gradient),descent=derivatives.gradient.reduce((s,g,j)=>s+g*direction[j],0);let step=1,next,nextDerivatives;
    for(let attempt=0;attempt<45;attempt++){next=theta.map((v,j)=>v-step*direction[j]);nextDerivatives=objectiveDerivatives(A,y,next,c);if(Number.isFinite(nextDerivatives.objective)&&nextDerivatives.objective<=derivatives.objective-1e-4*step*descent+1e-13)break;step*=.5;}
    if(!nextDerivatives||!Number.isFinite(nextDerivatives.objective)||nextDerivatives.objective>derivatives.objective+1e-11)throw new Error('The solver could not find a stable descent step.');theta=next;derivatives=nextDerivatives;
  }
  stopFit();
  const model={kind:'logistic-regression',weights:theta.slice(0,2),intercept:theta[2],c,...scaling},predictions={};
  for(const split of ['train','validation'])predictions[split]=dataset.partitions[split].map(i=>{if(![0,1].includes(dataset.y[i]))throw new Error('Expected binary evaluation labels.');const p=predictLogistic(model,dataset.X[i]);return {rowId:i,score:p.score,probability:p.probability};});
  const result={schemaVersion:'1.0.0',runId,configKey:requestKey(request),request:structuredClone(request),model,preprocessing:{kind:request.preprocessing,...scaling,ddof:0,fitRowIds:[...rows]},predictions,checkpoints,solver:{kind:'damped-newton',converged:true,tolerance:1e-9,objectiveConvention:'sum(softplus(s_i)-y_i*s_i) + (w1^2+w2^2)/(2*C); intercept unpenalized'}};
  result.metrics=logisticMetrics(result,dataset,.5);return result;
}
export function logisticMetrics(result,dataset,threshold){
  if(result.request.datasetId!==dataset.id||result.request.datasetRevision!==dataset.revision)throw new Error('Evaluation dataset differs from the fitted result.');
  return Object.fromEntries(['train','validation'].map(split=>{const values=result.predictions[split],actual=values.map(p=>dataset.y[p.rowId]);return [split,{...classificationMetrics(actual,values.map(p=>thresholdLabel(p.probability,threshold))),logLoss:values.reduce((s,p,i)=>s+(softplus(p.score)-actual[i]*p.score),0)/values.length,threshold}];}));
}
export function boundarySegment(model,threshold,extent){
  if(threshold<=0||threshold>=1)return null;const [a,b]=model.weights,c=Math.log(threshold)-Math.log1p(-threshold)-model.intercept,points=[];
  const add=(x,y)=>{if(Number.isFinite(x)&&Number.isFinite(y)&&Math.abs(x)<=extent+1e-9&&Math.abs(y)<=extent+1e-9&&!points.some(p=>Math.hypot(p[0]-x,p[1]-y)<1e-8))points.push([x,y]);};
  if(Math.abs(b)>1e-14)for(const x of [-extent,extent])add(x,(c-a*x)/b);if(Math.abs(a)>1e-14)for(const y of [-extent,extent])add((c-b*y)/a,y);return points.length>=2?points.slice(0,2):null;
}
