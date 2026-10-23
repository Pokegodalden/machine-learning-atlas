import {measureFit,measureReference,startFit} from './run-timing.js';
import {requestKey} from '../core/experiment.js';
export function prepareKnn(dataset,parameters,preprocessing='standardize-train'){
  if(!['none','standardize-train'].includes(preprocessing))throw Error('Unsupported feature scaling.');
  const k=parameters['n-neighbors'],weights=parameters.weights,train=dataset.partitions.train;
  if(!Number.isInteger(k)||k<1||k>25||k>train.length)throw new Error('Choose an integer neighbor count from 1 to min(25, training count).');
  if(!['uniform','distance'].includes(weights)||Object.keys(parameters).some(key=>!['n-neighbors','weights'].includes(key)))throw new Error('Choose uniform or distance weighting.');
  if(!train.length||new Set(train).size!==train.length)throw new Error('Training rows must be distinct.');
  for(const i of train)if(!Number.isInteger(i)||!dataset.X[i]||dataset.X[i].length!==2||dataset.X[i].some(x=>!Number.isFinite(x))||![0,1].includes(dataset.y[i]))throw new Error('Expected finite two-feature inputs and binary training labels.');
  const mean=preprocessing==='none'?[0,0]:[0,1].map(j=>train.reduce((s,i)=>s+dataset.X[i][j],0)/train.length);
  const scale=preprocessing==='none'?[1,1]:[0,1].map(j=>Math.sqrt(train.reduce((s,i)=>s+(dataset.X[i][j]-mean[j])**2,0)/train.length)||1);
  return {kind:'knn',k,weights,mean,scale,training:train.map(i=>({rowId:i,label:dataset.y[i],z:dataset.X[i].map((x,j)=>(x-mean[j])/scale[j])}))};
}
export function predictAtZ(model,z){
  if(!Array.isArray(z)||z.length!==2||z.some(x=>!Number.isFinite(x)))throw new Error('Query coordinates must be finite numbers.');
  const selected=model.training.map(row=>({...row,distance:Math.hypot(row.z[0]-z[0],row.z[1]-z[1])})).sort((a,b)=>a.distance-b.distance||a.rowId-b.rowId).slice(0,model.k);
  const zeroDistanceOnly=model.weights==='distance'&&selected.some(n=>n.distance===0),scores=[0,0];
  const neighbors=selected.map((n,i)=>{const weight=model.weights==='uniform'?1:zeroDistanceOnly?(n.distance===0?1:0):1/n.distance;scores[n.label]+=weight;return {...n,rank:i+1,weight};});
  const total=scores[0]+scores[1];if(!Number.isFinite(total)||!total)throw new Error('Query distances exceeded numeric precision.');
  return {label:scores[1]>scores[0]?1:0,scores,class1VoteShare:scores[1]/total,zeroDistanceOnly,neighbors:neighbors.map(n=>({...n,contribution:n.weight/total})),z:[...z]};
}
export function predictKnn(model,query){return predictAtZ(model,query.map((x,j)=>(x-model.mean[j])/model.scale[j]));}
export function classificationMetrics(actual,predictions){
  if(!actual.length||actual.length!==predictions.length)throw new Error('Evaluation rows must match predictions.');
  const confusion=[[0,0],[0,0]];actual.forEach((label,i)=>{if(![0,1].includes(label)||![0,1].includes(predictions[i]))throw new Error('Expected binary labels.');confusion[label][predictions[i]]++;});
  const [[tn,fp],[fn,tp]]=confusion,precision=tp+fp?tp/(tp+fp):0,recall=tp+fn?tp/(tp+fn):0;
  return {accuracy:(tp+tn)/actual.length,precision,recall,f1:precision+recall?2*precision*recall/(precision+recall):0,confusion,rowCount:actual.length,zeroDivision:0};
}
export function knnExtent(dataset,model){
  const rows=[...dataset.partitions.train,...dataset.partitions.validation];
  return Math.max(2,...rows.flatMap(i=>dataset.X[i].map((x,j)=>Math.abs((x-model.mean[j])/model.scale[j]))))*1.12;
}
export function decisionGrid(model,extent,resolution=48){
  const labels=[];for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++)labels.push(predictAtZ(model,[-extent+(x+.5)*2*extent/resolution,-extent+(y+.5)*2*extent/resolution]).label);
  return {extent,resolution,labels,sampling:'cell-centers'};
}
export function evaluateKnn(request,dataset,runId){
  if(request.schemaVersion!=='1.0.0'||request.modelId!=='knn'||request.adapterVersion!=='knn-1'||request.datasetId!==dataset.id||request.datasetRevision!==dataset.revision||!['two-blobs','two-moons'].includes(dataset.id)||!Number.isInteger(runId)||runId<1||!Number.isInteger(request.modelSeed)||!['none','standardize-train'].includes(request.preprocessing)||request.evaluation!=='validation')throw new Error('Unsupported k-nearest-neighbors experiment.');
  const partitions=dataset.partitions,all=[...partitions.train,...partitions.validation,...partitions.test];
  if(new Set(all).size!==all.length||!partitions.validation.length)throw new Error('Use distinct training, validation, and final-check partitions.');
  const model=measureFit(()=>prepareKnn(dataset,request.parameters,request.preprocessing)),predictions={},metrics={};
  for(const split of ['train','validation']){const rows=partitions[split];for(const i of rows)if(!dataset.X[i]||dataset.X[i].length!==2||dataset.X[i].some(x=>!Number.isFinite(x)))throw new Error('Expected finite two-feature evaluation data.');predictions[split]=rows.map(i=>{const p=predictKnn(model,dataset.X[i]);return {rowId:i,label:p.label,class1VoteShare:p.class1VoteShare};});metrics[split]=classificationMetrics(rows.map(i=>dataset.y[i]),predictions[split].map(p=>p.label));}
  return {schemaVersion:'1.0.0',runId,configKey:requestKey(request),request:structuredClone(request),model,preprocessing:{kind:request.preprocessing,mean:model.mean,scale:model.scale,ddof:0,fitRowIds:[...partitions.train]},predictions,metrics,decisionMap:decisionGrid(model,knnExtent(dataset,model)),checkpoints:[{index:0,kind:'stored-training-set',rowIds:[...partitions.train]}]};
}
