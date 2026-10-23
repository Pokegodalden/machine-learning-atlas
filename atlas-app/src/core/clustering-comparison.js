import {Experiment,requestKey} from './experiment.js';
import {SettingsHistory} from './settings-history.js';
import {TaskDataContext} from './task-data-context.js';
import {kmeansParameters} from '../engine/kmeans.js';

const sides=['left','right'];
const same=(a,b)=>Array.isArray(a)&&a.length===b.length&&a.every((v,i)=>v===b[i]);
// Compare relationships between observations, never arbitrary cluster numbers.
export function groupingOverlap(left,right){
  if(!left.length||left.length!==right.length||!same(left.map(p=>p.rowId),right.map(p=>p.rowId)))throw Error('Groupings must contain identical ordered rows.');
  const rows=left.map((p,i)=>({rowId:p.rowId,left:p.cluster,right:right[i].cluster,changedNeighbors:0})),counts=[];
  let togetherBoth=0,separateBoth=0,leftOnly=0,rightOnly=0;
  for(let i=0;i<rows.length;i++){
    const a=rows[i];counts[a.left]??=[];counts[a.left][a.right]=(counts[a.left][a.right]||0)+1;
    for(let j=0;j<i;j++){const l=a.left===rows[j].left,r=a.right===rows[j].right;if(l&&r)togetherBoth++;else if(!l&&!r)separateBoth++;else{if(l)leftOnly++;else rightOnly++;a.changedNeighbors++;rows[j].changedNeighbors++;}}
  }
  const totalPairs=rows.length*(rows.length-1)/2;
  return {rows,counts,totalPairs,togetherBoth,separateBoth,leftOnly,rightOnly,agreement:totalPairs?(togetherBoth+separateBoth)/totalPairs:null};
}
export class ClusteringComparison{
  constructor(datasets,execute){
    this.data=new TaskDataContext(datasets);this.execute=execute;this.listeners=new Set();this.histories={left:new SettingsHistory(),right:new SettingsHistory()};
    this.sides=Object.fromEntries(sides.map((side,i)=>[side,{modelId:'kmeans',parameters:{'n-clusters':i?4:3,restarts:5,initialization:'kmeans++'},experiment:new Experiment()}]));
    for(const side of sides){this.sides[side].experiment.subscribe(()=>this.notify());this.sides[side].experiment.update(this.request(side));}
  }
  get datasetId(){return 'three-clusters';}
  get datasetOverride(){return this.data.overrides.kmeans||null;}
  dataset(){return this.data.dataset('kmeans');}
  subscribe(fn){this.listeners.add(fn);return ()=>this.listeners.delete(fn);}
  notify(){for(const fn of this.listeners)fn();}
  request(side){const d=this.dataset();return {schemaVersion:'1.0.0',modelId:'kmeans',datasetId:d.id,datasetRevision:d.revision,adapterVersion:'lloyd-1',modelSeed:7,preprocessing:'none',evaluation:'fit',parameters:kmeansParameters(this.sides[side].parameters)};}
  historyContext(){return 'kmeans|'+this.dataset().revision+'|none';}
  beginEdit(side){this.histories[side].begin(this.historyContext(),this.sides[side].parameters);}
  endEdit(side){this.histories[side].end();}
  canRestore(side){return this.histories[side].canRestore(this.historyContext());}
  resetHistory(){for(const h of Object.values(this.histories))h.clear();}
  setParameters(side,patch){const s=this.sides[side],p=kmeansParameters({...s.parameters,...patch});this.histories[side].record(this.historyContext(),s.parameters,p);s.parameters=p;s.experiment.update(this.request(side));}
  restorePrevious(side){const p=this.histories[side].restore(this.historyContext(),kmeansParameters);if(!p)return false;this.sides[side].parameters=p;this.sides[side].experiment.update(this.request(side));return true;}
  setData(generator=null,imported=null){this.data.restore('kmeans',generator,imported);this.resetHistory();for(const side of sides)this.sides[side].experiment.update(this.request(side));}
  setImportedData(imported){this.setData(null,imported);}
  current(side){const e=this.sides[side].experiment;return e.status==='completed'&&e.result?.configKey===requestKey(this.request(side));}
  async run(side,dataset=structuredClone(this.dataset())){
    const request=this.request(side);return this.sides[side].experiment.run(request,(snapshot,id)=>{
      // No targets, generating labels, CSV source or teaching metadata enter fitting.
      const input={id:dataset.id,revision:dataset.revision,X:dataset.X,rowIds:dataset.rowIds,partitions:{fit:dataset.partitions.fit}},job=this.execute(snapshot,input,id);
      return {cancel:job.cancel,promise:job.promise.then(output=>{
        const ids=dataset.partitions.fit,p=output.predictions?.fit;
        if(requestKey(output.request)!==requestKey(snapshot)||output.model.kind!=='kmeans'||output.preprocessing?.kind!=='none'||!same(output.preprocessing.fitRowIds,ids)||!same(output.model.fitRowIds,ids)||!same(p?.map(v=>v.rowId),ids)||p.some(v=>!Number.isInteger(v.cluster)||v.cluster<0||v.cluster>=snapshot.parameters['n-clusters']))throw Error('Result provenance does not match the shared unlabeled fitting rows.');
        return output;
      })};
    });
  }
  runBoth(){const d=structuredClone(this.dataset());return Promise.all(sides.map(side=>this.run(side,d)));}
  cancel(side){this.sides[side].experiment.cancel();}
  cancelAll(){for(const side of sides)this.cancel(side);}
  view(side){if(!this.current(side))return null;const result=this.sides[side].experiment.result;return {result,rows:result.predictions.fit,metrics:result.metrics.fit};}
  pair(){const left=this.view('left'),right=this.view('right');if(!left||!right||left.result.request.datasetRevision!==right.result.request.datasetRevision)return null;return {left,right,...groupingOverlap(left.rows,right.rows)};}
  restoreSettings(datasetId,models,{generator=null,imported=null}={}){
    if(datasetId!=='three-clusters'||!Array.isArray(models)||models.length!==2||models.some(m=>m.modelId!=='kmeans'))throw Error('Use two K-means settings on unlabeled data.');
    const checked=models.map(m=>kmeansParameters(m.parameters)),data=new TaskDataContext(this.data.datasets);data.restore('kmeans',generator,imported);
    this.cancelAll();this.resetHistory();this.data=data;
    sides.forEach((side,i)=>{this.sides[side].parameters=checked[i];this.sides[side].experiment.result=null;this.sides[side].experiment.update(this.request(side));});
  }
}
