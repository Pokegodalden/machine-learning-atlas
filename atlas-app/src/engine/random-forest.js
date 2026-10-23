import {measureFit,measureReference,startFit} from './run-timing.js';
import {requestKey} from '../core/experiment.js';
import {fitTree,predictTree,evaluateTree} from './decision-tree.js';
import {classificationMetrics} from './knn.js';

// Mulberry32 with explicit uint32 state and rejection sampling for bounded ints.
export function forestRandom(seed){let state=seed>>>0;
  const uint=()=>{state=(state+0x6D2B79F5)>>>0;let t=Math.imul(state^(state>>>15),1|state);t=(t+Math.imul(t^(t>>>7),61|t))^t;return (t^(t>>>14))>>>0;};
  return {uint,int(n){const limit=4294967296-4294967296%n;let value;do{value=uint();}while(value>=limit);return value%n;}};
}
export function validateForestParameters(p){if(!p||Object.keys(p).length!==2||!Number.isInteger(p['n-estimators'])||p['n-estimators']<5||p['n-estimators']>200||!Number.isInteger(p['max-depth'])||p['max-depth']<1||p['max-depth']>16)throw new Error('Choose integer tree count 5–200 and maximum depth 1–16.');}
export function fitForest(d,parameters,seed=7,onProgress=()=>{}){
  validateForestParameters(parameters);if(!Number.isInteger(seed)||seed<0||seed>4294967295)throw new Error('Use an unsigned 32-bit model seed.');
  const train=d.partitions.train;if(!train.length||new Set(train).size!==train.length)throw new Error('Use distinct nonempty training rows.');
  const master=forestRandom(seed),trees=[];
  for(let index=0;index<parameters['n-estimators'];index++){
    const sampleSeed=master.uint(),featureSeed=master.uint(),sampling=forestRandom(sampleSeed),features=forestRandom(featureSeed);
    const bootstrapRowIds=Array.from({length:train.length},()=>train[sampling.int(train.length)]);
    const tree=fitTree(d,{'max-depth':parameters['max-depth'],'min-leaf':3},{rows:bootstrapRowIds,bootstrap:true,featureOrder:()=>{const first=features.int(2);return [first,1-first];}}),unique=new Set(bootstrapRowIds);
    trees.push({...tree,index,sampleSeed,featureSeed,bootstrapRowIds,uniqueTrainingCount:unique.size,outOfBagRowIds:train.filter(i=>!unique.has(i)),randomness:'seeded bootstrap draws and per-node feature sampling',tieRule:'sampled feature first; lower threshold within feature; class 0; <= goes left'});
    onProgress({phase:'fitting-trees',completed:index+1,total:parameters['n-estimators']});
  }
  return {kind:'random-forest',parameters:{...parameters},trees,seed,criterion:'gini',minimumLeaf:3,maxFeatures:1,bootstrapSize:train.length,randomGenerator:'mulberry32-uint32-rejection-v1',featurePolicy:'one sampled feature per split; try other feature only if no valid split',aggregation:'mean of all tree class-1 leaf fractions; > 0.5 chooses 1, ties choose 0'};
}
export function predictForest(model,raw){
  const perTree=model.trees.map((tree,index)=>({treeIndex:index,...predictTree(tree,raw)})),probability=perTree.reduce((s,p)=>s+p.class1Fraction,0)/perTree.length;
  return {label:probability>.5?1:0,probability,perTree};
}
export function forestDomain(d){return [0,1].map(j=>{const values=[...d.partitions.train,...d.partitions.validation].map(i=>d.X[i][j]),lo=Math.min(...values),hi=Math.max(...values),pad=Math.max((hi-lo)*.12,.25);return [lo-pad,hi+pad];});}
export function forestMap(model,domain,resolution=48){const labels=[],probabilities=[];
  for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++){const p=predictForest(model,[domain[0][0]+(x+.5)*(domain[0][1]-domain[0][0])/resolution,domain[1][0]+(y+.5)*(domain[1][1]-domain[1][0])/resolution]);labels.push(p.label);probabilities.push(p.probability);}
  return {domain,resolution,labels,probabilities,sampling:'cell-centers'};
}
export function evaluateForest(request,d,runId,onProgress=()=>{}){
  if(request.schemaVersion!=='1.0.0'||request.modelId!=='random-forest'||request.adapterVersion!=='forest-gini-1'||request.datasetId!==d.id||request.datasetRevision!==d.revision||!['two-moons','two-blobs'].includes(d.id)||request.preprocessing!=='none'||request.evaluation!=='validation'||!Number.isInteger(runId)||runId<1)throw new Error('Unsupported random-forest experiment.');
  const all=[...d.partitions.train,...d.partitions.validation,...d.partitions.test];if(new Set(all).size!==all.length||!d.partitions.validation.length)throw new Error('Use distinct training, validation, and final-check partitions.');
  const model=measureFit(()=>fitForest(d,request.parameters,request.modelSeed,onProgress)),predictions={},metrics={};
  for(const split of ['train','validation']){predictions[split]=d.partitions[split].map(rowId=>{if(![0,1].includes(d.y[rowId]))throw new Error('Expected binary evaluation labels.');const p=predictForest(model,d.X[rowId]);return {rowId,label:p.label,probability:p.probability,treeProbabilities:p.perTree.map(t=>t.class1Fraction)};});metrics[split]=classificationMetrics(d.partitions[split].map(i=>d.y[i]),predictions[split].map(p=>p.label));}
  const totals={train:Array(d.partitions.train.length).fill(0),validation:Array(d.partitions.validation.length).fill(0)},checkpoints=[];
  for(let index=0;index<model.trees.length;index++){
    const checkpoint={index,kind:'fitted-tree',treeCount:index+1};
    for(const split of ['train','validation']){predictions[split].forEach((p,i)=>totals[split][i]+=p.treeProbabilities[index]);checkpoint[split+'Accuracy']=classificationMetrics(d.partitions[split].map(i=>d.y[i]),totals[split].map(p=>p/(index+1)>.5?1:0)).accuracy;}
    checkpoints.push(checkpoint);
  }
  const baselineRequest={...request,modelId:'decision-tree',adapterVersion:'cart-gini-1',parameters:{'max-depth':request.parameters['max-depth'],'min-leaf':3}};
  return {schemaVersion:'1.0.0',runId,configKey:requestKey(request),request:structuredClone(request),model,preprocessing:{kind:'none',fitRowIds:[...d.partitions.train]},predictions,metrics,checkpoints,singleTree:measureReference(()=>evaluateTree(baselineRequest,d,runId)),decisionMap:forestMap(model,forestDomain(d))};
}
