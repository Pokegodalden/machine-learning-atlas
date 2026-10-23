import {measureFit,measureReference,startFit} from './run-timing.js';
import {requestKey} from '../core/experiment.js';
import {classificationMetrics} from './knn.js';

export function validateTreeParameters(p){
  if(!p||Object.keys(p).length!==2||!Number.isInteger(p['max-depth'])||p['max-depth']<1||p['max-depth']>16||!Number.isInteger(p['min-leaf'])||p['min-leaf']<1||p['min-leaf']>30)throw new Error('Choose integer maximum depth 1–16 and minimum leaf size 1–30.');
}
export const gini=counts=>{const n=counts[0]+counts[1];return n?2*counts[0]*counts[1]/(n*n):0;};
export function fitTree(d,parameters,options={}){
  validateTreeParameters(parameters);const rows=options.rows||d.partitions.train;
  if(!rows.length||(!options.bootstrap&&new Set(rows).size!==rows.length))throw new Error('Use distinct nonempty training rows.');
  if(options.rows&&rows.some(i=>!d.partitions.train.includes(i)))throw new Error('Bootstrap draws must come only from training rows.');
  for(const i of rows)if(!Number.isInteger(i)||d.X[i]?.length!==2||d.X[i].some(x=>!Number.isFinite(x))||![0,1].includes(d.y[i]))throw new Error('Expected finite two-feature binary training observations.');
  const nodes=[];
  function build(ids,depth){
    const counts=[0,0];ids.forEach(i=>counts[d.y[i]]++);
    const node={id:nodes.length,depth,rowIds:[...ids],counts,sampleCount:ids.length,impurity:gini(counts),label:counts[1]>counts[0]?1:0,class1Fraction:counts[1]/ids.length,left:null,right:null,feature:null,threshold:null,gain:0,stopReason:null};nodes.push(node);
    if(!counts[0]||!counts[1])node.stopReason='pure';
    else if(depth>=parameters['max-depth'])node.stopReason='max-depth';
    else if(ids.length<2*parameters['min-leaf'])node.stopReason='min-leaf';
    if(node.stopReason)return node.id;
    let best=null;
    const featureOrder=options.featureOrder?options.featureOrder():[0,1];
    if(options.featureOrder){node.sampledFeatures=featureOrder.slice(0,1);node.evaluatedFeatures=[];}
    for(const feature of featureOrder){
      if(options.featureOrder)node.evaluatedFeatures.push(feature);
      const ordered=[...ids].sort((a,b)=>d.X[a][feature]-d.X[b][feature]||a-b),left=[0,0],right=[...counts];
      for(let at=0;at<ordered.length-1;at++){
        const i=ordered[at];left[d.y[i]]++;right[d.y[i]]--;
        const a=d.X[i][feature],b=d.X[ordered[at+1]][feature],nl=at+1,nr=ordered.length-nl;
        if(a===b||nl<parameters['min-leaf']||nr<parameters['min-leaf'])continue;
        // Minimize weighted Gini via a rational score. Exact score ties retain
        // the lower feature index, then lower threshold (iteration order).
        const numerator=left[0]*left[1]*nr+right[0]*right[1]*nl,denominator=nl*nr;
        if(!best||numerator*best.denominator<best.numerator*denominator){let threshold=a/2+b/2;if(threshold>=b)threshold=a;best={feature,threshold,numerator,denominator};}
      }
      if(options.featureOrder&&best)break;
    }
    if(!best){node.stopReason='no-valid-split';return node.id;}
    node.feature=best.feature;node.threshold=best.threshold;
    node.gain=node.impurity-2*best.numerator/(best.denominator*ids.length);
    node.left=build(ids.filter(i=>d.X[i][best.feature]<=best.threshold),depth+1);
    node.right=build(ids.filter(i=>d.X[i][best.feature]>best.threshold),depth+1);
    return node.id;
  }
  build(rows,0);
  return {kind:'decision-tree',criterion:'gini',parameters:{...parameters},root:0,nodes,leafCount:nodes.filter(n=>n.left===null).length,depth:Math.max(...nodes.map(n=>n.depth)),tieRule:'split: lower feature then lower threshold; class: 0; <= goes left',randomness:'none; modelSeed recorded for experiment provenance'};
}
export function predictTree(model,raw){
  if(!Array.isArray(raw)||raw.length!==2||raw.some(v=>!Number.isFinite(v)))throw new Error('Query coordinates must be finite numbers.');
  let node=model.nodes[model.root];const path=[];
  while(true){path.push(node.id);if(node.left===null)return {label:node.label,class1Fraction:node.class1Fraction,leafId:node.id,path};node=model.nodes[raw[node.feature]<=node.threshold?node.left:node.right];}
}
export function treeRegions(model,domain,maxDepth=Infinity){
  const regions=[],splits=[];
  function visit(id,bounds){const node=model.nodes[id];if(node.left===null||node.depth>=maxDepth){regions.push({nodeId:id,bounds,label:node.label});return;}
    splits.push({nodeId:id,feature:node.feature,threshold:node.threshold,bounds:structuredClone(bounds)});
    const left=structuredClone(bounds),right=structuredClone(bounds);left[node.feature][1]=Math.min(left[node.feature][1],node.threshold);right[node.feature][0]=Math.max(right[node.feature][0],node.threshold);visit(node.left,left);visit(node.right,right);
  }
  visit(model.root,structuredClone(domain));return {regions,splits};
}
export function evaluateTree(request,d,runId){
  if(request.schemaVersion!=='1.0.0'||request.modelId!=='decision-tree'||request.adapterVersion!=='cart-gini-1'||request.datasetId!==d.id||request.datasetRevision!==d.revision||!['two-blobs','two-moons'].includes(d.id)||request.preprocessing!=='none'||request.evaluation!=='validation'||!Number.isInteger(request.modelSeed)||!Number.isInteger(runId)||runId<1)throw new Error('Unsupported decision-tree experiment.');
  const all=[...d.partitions.train,...d.partitions.validation,...d.partitions.test];if(new Set(all).size!==all.length||!d.partitions.validation.length)throw new Error('Use distinct training, validation, and final-check partitions.');
  const model=measureFit(()=>fitTree(d,request.parameters)),predictions={},metrics={};
  for(const split of ['train','validation']){predictions[split]=d.partitions[split].map(rowId=>{if(![0,1].includes(d.y[rowId]))throw new Error('Expected binary evaluation labels.');return {rowId,...predictTree(model,d.X[rowId])};});metrics[split]=classificationMetrics(d.partitions[split].map(i=>d.y[i]),predictions[split].map(p=>p.label));}
  return {schemaVersion:'1.0.0',runId,configKey:requestKey(request),request:structuredClone(request),model,preprocessing:{kind:'none',fitRowIds:[...d.partitions.train]},predictions,metrics,checkpoints:model.nodes.filter(n=>n.left!==null).map((n,index)=>({index,kind:'fitted-split',nodeId:n.id,feature:n.feature,threshold:n.threshold,depth:n.depth}))};
}
