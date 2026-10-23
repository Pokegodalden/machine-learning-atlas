import {measureFit,measureReference,startFit} from './run-timing.js';
import {requestKey} from '../core/experiment.js';
export const squaredDistance=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2;
export function kmeansParameters(p){
  if(!p||Object.keys(p).some(k=>!['n-clusters','restarts','initialization'].includes(k))||!Number.isInteger(p['n-clusters'])||p['n-clusters']<2||p['n-clusters']>8||!Number.isInteger(p.restarts)||p.restarts<1||p.restarts>20||!['kmeans++','random'].includes(p.initialization))throw Error('Choose 2–8 clusters, 1–20 restarts, and kmeans++ or random initialization.');
  return {...p};
}
export function kmeansRandom(seed){let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
export const kmeansTrialSeed=(seed,index)=>((seed>>>0)+Math.imul(index,0x9e3779b9))>>>0;
export function assignKmeans(X,centers){const labels=[],squaredDistances=[],sizes=Array(centers.length).fill(0);for(const x of X){let chosen=0,d=squaredDistance(x,centers[0]);for(let j=1;j<centers.length;j++){const next=squaredDistance(x,centers[j]);if(next<d){d=next;chosen=j;}}labels.push(chosen);squaredDistances.push(d);sizes[chosen]++;}return {labels,squaredDistances,sizes,inertia:squaredDistances.reduce((s,v)=>s+v,0)};}
export function initializeKmeans(X,k,method,seed){const rng=kmeansRandom(seed),chosen=[];
  if(method==='random'){const pool=X.map((_,i)=>i);for(let j=0;j<k;j++){const pos=j+Math.floor(rng()*(pool.length-j));[pool[j],pool[pos]]=[pool[pos],pool[j]];chosen.push(pool[j]);}}
  else {chosen.push(Math.floor(rng()*X.length));while(chosen.length<k){const distances=X.map(x=>Math.min(...chosen.map(i=>squaredDistance(x,X[i])))),total=distances.reduce((s,v)=>s+v,0);let id;
    if(total===0)id=X.findIndex((_,i)=>!chosen.includes(i));else{const target=rng()*total;let sum=0;for(let i=0;i<X.length;i++){sum+=distances[i];if(sum>target){id=i;break;}}if(id===undefined)id=distances.findLastIndex(v=>v>0);}
    chosen.push(id);
  }}return {centers:chosen.map(i=>[...X[i]]),initialIndices:chosen};
}
export function runKmeansTrial(X,k,method,seed,maxIterations=100){
  const initial=initializeKmeans(X,k,method,seed);let centers=initial.centers,previous=null,updates=0,converged=false;
  const frames=[{index:0,phase:'initial',iteration:0,centers:structuredClone(centers),labels:null,inertia:null,sizes:Array(k).fill(0),emptyClusters:[]}];
  function record(phase,assignment,emptyClusters=[]){frames.push({index:frames.length,phase,iteration:updates,centers:structuredClone(centers),labels:[...assignment.labels],inertia:assignment.inertia,sizes:[...assignment.sizes],emptyClusters});}
  while(true){const assigned=assignKmeans(X,centers);record('assignment',assigned);
    if(previous&&assigned.labels.every((v,i)=>v===previous[i])){converged=true;break;}
    if(updates>=maxIterations)break;
    const sums=Array.from({length:k},()=>[0,0]);X.forEach((x,i)=>{sums[assigned.labels[i]][0]+=x[0];sums[assigned.labels[i]][1]+=x[1];});const emptyClusters=[];
    centers=centers.map((c,j)=>{if(!assigned.sizes[j]){emptyClusters.push(j);return [...c];}return sums[j].map(v=>v/assigned.sizes[j]);});
    const distances=X.map((x,i)=>squaredDistance(x,centers[assigned.labels[i]]));updates++;record('update',{...assigned,inertia:distances.reduce((s,v)=>s+v,0)},emptyClusters);previous=assigned.labels;
  }
  const final=assignKmeans(X,centers);return {centers,labels:final.labels,squaredDistances:final.squaredDistances,sizes:final.sizes,inertia:final.inertia,iterations:updates,converged,initialIndices:initial.initialIndices,frames};
}
export function silhouetteKmeans(X,labels){const groups=[...new Set(labels)];if(groups.length<2||groups.length>=X.length)return {score:null,reason:'Silhouette needs between 2 and n − 1 occupied clusters.'};
  const members=groups.map(g=>labels.flatMap((v,i)=>v===g?[i]:[]));let sum=0;
  for(let i=0;i<X.length;i++){const own=members[groups.indexOf(labels[i])];if(own.length===1)continue;const distances=X.map(x=>Math.sqrt(squaredDistance(X[i],x)));const a=own.reduce((s,j)=>s+distances[j],0)/(own.length-1);let b=Infinity;for(let g=0;g<groups.length;g++)if(groups[g]!==labels[i])b=Math.min(b,members[g].reduce((s,j)=>s+distances[j],0)/members[g].length);sum+=Math.max(a,b)===0?0:(b-a)/Math.max(a,b);}
  return {score:sum/X.length,reason:null};
}
export function fitKmeans(X,parameters,seed=7,onProgress=()=>{}){
  const p=kmeansParameters(parameters);if(!Array.isArray(X)||X.length<p['n-clusters']||X.length>1000||X.some(x=>!Array.isArray(x)||x.length!==2||x.some(v=>!Number.isFinite(v)||Math.abs(v)>1e100))||!Number.isInteger(seed)||seed<0||seed>4294967295)throw Error('K-means needs finite two-feature observations, at least k rows, and an unsigned 32-bit seed.');
  const trials=[];let best=null,bestTrial=0;onProgress({phase:'kmeans-trials',completed:0,total:p.restarts});
  for(let index=0;index<p.restarts;index++){const trialSeed=kmeansTrialSeed(seed,index),trial=runKmeansTrial(X,p['n-clusters'],p.initialization,trialSeed);trials.push({index,seed:trialSeed,initialIndices:trial.initialIndices,inertia:trial.inertia,iterations:trial.iterations,converged:trial.converged,occupiedClusters:trial.sizes.filter(n=>n>0).length});if(!best||trial.inertia<best.inertia){best=trial;bestTrial=index;}onProgress({phase:'kmeans-trials',completed:index+1,total:p.restarts});}
  return {...best,bestTrial,trials,parameters:p,seed};
}
export function evaluateKmeans(request,d,runId,onProgress=()=>{}){
  if(request.schemaVersion!=='1.0.0'||request.modelId!=='kmeans'||request.adapterVersion!=='lloyd-1'||request.datasetId!=='three-clusters'||d.id!==request.datasetId||d.revision!==request.datasetRevision||request.preprocessing!=='none'||request.evaluation!=='fit'||!Number.isInteger(runId)||runId<1)throw Error('Unsupported K-means experiment.');
  const ids=d.partitions?.fit;if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||ids.some(i=>!Number.isInteger(i)||i<0||i>=d.X.length))throw Error('Use valid, unique fitting row IDs.');
  const X=ids.map(i=>d.X[i]),fit=measureFit(()=>fitKmeans(X,request.parameters,request.modelSeed,onProgress)),silhouette=silhouetteKmeans(X,fit.labels);
  return {schemaVersion:'1.0.0',runId,configKey:requestKey(request),request:structuredClone(request),model:{kind:'kmeans',centers:fit.centers,parameters:fit.parameters,seed:fit.seed,fitRowIds:[...ids],tieRule:'lowest center index wins equal squared distances',emptyClusterRule:'retain previous center; record empty cluster in update frame'},preprocessing:{kind:'none',fitRowIds:[...ids]},predictions:{fit:ids.map((rowId,i)=>({rowId,cluster:fit.labels[i],squaredDistance:fit.squaredDistances[i]}))},metrics:{fit:{inertia:fit.inertia,silhouette:silhouette.score,silhouetteReason:silhouette.reason,clusterSizes:fit.sizes,occupiedClusters:fit.sizes.filter(n=>n>0).length,rowCount:ids.length}},checkpoints:fit.frames,trials:fit.trials.map(t=>({...t,initialRowIds:t.initialIndices.map(i=>ids[i])})),selectedTrial:fit.bestTrial,solver:{kind:'lloyd',iterations:fit.iterations,converged:fit.converged,maxIterations:100,selectionRule:'lowest final inertia; earliest trial wins an exact tie',randomGenerator:'mulberry32-uint32-v1',initialization:fit.parameters.initialization}};
}
