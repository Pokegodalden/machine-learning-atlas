import {SettingsHistory} from './settings-history.js';
import {importCsv} from '../data/csv-data.js';
import {mlpParameters,mlpDefaults,predictMlp} from '../engine/mlp.js';
import {Experiment,requestKey} from './experiment.js';
import {classificationMetrics,predictKnn} from '../engine/knn.js';
import {predictLogistic,thresholdLabel,logisticMetrics} from '../engine/logistic-regression.js';
import {predictTree,validateTreeParameters} from '../engine/decision-tree.js';
import {predictForest,validateForestParameters} from '../engine/random-forest.js';
import {predictSvm,svmTrainingParameters} from '../engine/svm.js';
import {generateDataset,generatedFromDescriptor} from '../data/synthetic-data.js';

export const comparisonModels=['knn','logistic-regression','decision-tree','random-forest','svm','mlp'];
export const comparisonDatasets=['two-blobs','two-moons'];
const versions={knn:'knn-1','logistic-regression':'logistic-newton-1','decision-tree':'cart-gini-1','random-forest':'forest-gini-1',svm:'svm-smo-1',mlp:'mlp-sgd-1'};
const initial=id=>id==='mlp'?mlpDefaults():id==='knn'?{'n-neighbors':5,weights:'uniform'}:id==='decision-tree'?{'max-depth':4,'min-leaf':3}:id==='random-forest'?{'n-estimators':50,'max-depth':4}:id==='svm'?{c:1,kernel:'linear',gamma:.5}:{c:1,threshold:.5};
const sameRows=(a,b)=>Array.isArray(a)&&a.length===b.length&&a.every((v,i)=>v===b[i]);
function validate(id,p){
  if(id==='mlp'){mlpParameters(p);return;}
  if(id==='svm'){svmTrainingParameters(p);return;}
  if(id==='random-forest'){validateForestParameters(p);return;}
  if(id==='decision-tree'){validateTreeParameters(p);return;}
  if(id==='knn'){
    if(Object.keys(p).length!==2||!Number.isInteger(p['n-neighbors'])||p['n-neighbors']<1||p['n-neighbors']>25||!['uniform','distance'].includes(p.weights))throw new Error('Choose k from 1 to 25 and a supported weighting.');
  }else if(Object.keys(p).length!==2||!Number.isFinite(p.c)||p.c<.001||p.c>100||!Number.isFinite(p.threshold)||p.threshold<0||p.threshold>1)throw new Error('Choose C from 0.001 to 100 and a threshold from 0 to 1.');
}
export function comparisonParameters(id,parameters){
  if(!comparisonModels.includes(id))throw new Error('This model is not available for comparison.');
  const expected=Object.keys(initial(id));if(!parameters||Array.isArray(parameters)||Object.keys(parameters).length!==expected.length||expected.some(k=>!Object.hasOwn(parameters,k)))throw Error('Invalid comparison parameter fields.');
  if(id==='svm'&&(!Number.isFinite(parameters.gamma)||parameters.gamma<.001||parameters.gamma>10))throw Error('Choose gamma from 0.001 to 10, including when the linear kernel is selected.');
  validate(id,parameters);return structuredClone(parameters);
}

// Each panel owns its lifecycle; a shared request snapshot fixes data for a pair.
export class Comparison {
  constructor(datasets,execute){
    this.datasets=datasets;this.execute=execute;this.datasetId='two-moons';this.datasetOverride=null;this.scaling='standardize-train';this.listeners=new Set();
    this.histories={left:new SettingsHistory(),right:new SettingsHistory()};
    this.sides={left:{modelId:'knn',parameters:initial('knn'),experiment:new Experiment()},right:{modelId:'logistic-regression',parameters:initial('logistic-regression'),experiment:new Experiment()}};
    for(const side of ['left','right']){this.sides[side].experiment.subscribe(()=>this.notify());this.sides[side].experiment.update(this.request(side));}
  }
  subscribe(fn){this.listeners.add(fn);return ()=>this.listeners.delete(fn);}
  notify(){for(const fn of this.listeners)fn();}
  dataset(){return this.datasetOverride||this.datasets[this.datasetId];}
  request(side){
    const s=this.sides[side],d=this.dataset();validate(s.modelId,s.parameters);
    return {schemaVersion:'1.0.0',modelId:s.modelId,datasetId:d.id,datasetRevision:d.revision,adapterVersion:versions[s.modelId],modelSeed:7,preprocessing:['decision-tree','random-forest'].includes(s.modelId)?'none':this.scaling,evaluation:'validation',parameters:s.modelId==='mlp'?mlpParameters(s.parameters):s.modelId==='svm'?svmTrainingParameters(s.parameters):s.modelId==='logistic-regression'?{c:s.parameters.c}:{...s.parameters}};
  }
  setDataset(id){if(!comparisonDatasets.includes(id))throw new Error('Choose a dataset supported by both classifiers.');this.datasetId=id;this.datasetOverride=null;this.scaling='standardize-train';this.syncHistories();for(const side of ['left','right'])this.sides[side].experiment.update(this.request(side));}
  setGeneratedData(recipe,scaling='standardize-train'){
    if(!['none','standardize-train'].includes(scaling))throw Error('Choose original units or training-only standardization.');const dataset=generateDataset(recipe);
    this.datasetId=dataset.id;this.datasetOverride=dataset;this.scaling=scaling;this.syncHistories();for(const side of ['left','right'])this.sides[side].experiment.update(this.request(side));
  }
  setImportedData(descriptor,scaling='standardize-train'){
    const dataset=importCsv(descriptor);if(descriptor.task!=='classification'||!['none','standardize-train'].includes(scaling))throw Error('Use a classification CSV and supported classifier scaling.');
    this.datasetId=dataset.id;this.datasetOverride=dataset;this.scaling=scaling;this.syncHistories();for(const side of ['left','right'])this.sides[side].experiment.update(this.request(side));
  }
  setScaling(scaling){if(!['none','standardize-train'].includes(scaling))throw Error('Unsupported feature scaling.');this.scaling=scaling;this.syncHistories();for(const side of ['left','right'])this.sides[side].experiment.update(this.request(side));}
  setModel(side,id){if(!comparisonModels.includes(id))throw new Error('This model is not available for comparison.');const s=this.sides[side];if(s.modelId===id)return;s.modelId=id;s.parameters=initial(id);this.syncHistories();s.experiment.update(this.request(side));}
  setParameters(side,patch){const s=this.sides[side],p={...s.parameters,...patch};validate(s.modelId,p);this.histories[side].record(this.historyContext(side),s.parameters,p);s.parameters=p;s.experiment.update(this.request(side));}
  syncHistories(){for(const side of ['left','right'])this.histories[side].sync(this.historyContext(side));}
  historyContext(side){return this.sides[side].modelId+'|'+this.dataset().revision+'|'+this.scaling;}
  beginEdit(side){this.histories[side].begin(this.historyContext(side),this.sides[side].parameters);}
  endEdit(side){this.histories[side].end();}
  canRestore(side){return this.histories[side].canRestore(this.historyContext(side));}
  resetHistory(){for(const history of Object.values(this.histories))history.clear();}
  restorePrevious(side){const s=this.sides[side],p=this.histories[side].restore(this.historyContext(side),value=>comparisonParameters(s.modelId,value));if(!p)return false;s.parameters=p;s.experiment.update(this.request(side));return true;}
  current(side){const e=this.sides[side].experiment;return e.status==='completed'&&e.result?.configKey===requestKey(this.request(side));}
  async run(side,datasetSnapshot=structuredClone(this.dataset())){
    const request=this.request(side);
    return this.sides[side].experiment.run(request,(snapshot,id)=>{
      const input=datasetSnapshot.imported?{id:datasetSnapshot.id,revision:datasetSnapshot.revision,X:datasetSnapshot.X,y:datasetSnapshot.y,rowIds:datasetSnapshot.rowIds,partitions:datasetSnapshot.partitions}:datasetSnapshot;const job=this.execute(snapshot,input,id);
      return {cancel:job.cancel,promise:job.promise.then(output=>{
        if(requestKey(output.request)!==requestKey(snapshot)||output.model.kind!==snapshot.modelId||!sameRows(output.preprocessing?.fitRowIds,datasetSnapshot.partitions.train)||!['train','validation'].every(split=>sameRows(output.predictions?.[split]?.map(p=>p.rowId),datasetSnapshot.partitions[split])))throw new Error('Result provenance does not match the shared training and validation rows.');
        return output;
      })};
    });
  }
  runBoth(){const d=structuredClone(this.dataset());return Promise.all(['left','right'].map(side=>this.run(side,d)));}
  cancel(side){this.sides[side].experiment.cancel();}
  cancelAll(){for(const side of ['left','right'])this.cancel(side);}
  restoreSettings(datasetId,models,{generator=null,imported=null,scaling='standardize-train'}={}){
    if(!comparisonDatasets.includes(datasetId)||!Array.isArray(models)||models.length!==2)throw Error('Invalid comparison settings.');
    if(generator&&imported)throw Error('Choose a single dataset source.');
    const checked=models.map(m=>({modelId:m.modelId,parameters:comparisonParameters(m.modelId,m.parameters)})),generated=imported?importCsv(imported):generator?generatedFromDescriptor(generator):null;
    if(!['none','standardize-train'].includes(scaling)||generated&&generated.id!==datasetId||imported&&imported.task!=='classification')throw Error('Invalid comparison data configuration.');
    this.resetHistory();this.cancelAll();this.datasetId=datasetId;this.datasetOverride=generated;this.scaling=scaling;
    for(const [i,side] of ['left','right'].entries()){Object.assign(this.sides[side],checked[i]);this.sides[side].experiment.result=null;}
    for(const side of ['left','right'])this.sides[side].experiment.update(this.request(side));
  }
  view(side){
    if(!this.current(side))return null;
    const s=this.sides[side],r=s.experiment.result,d=this.dataset();
    const rows=r.predictions.validation.map(p=>({...p,label:s.modelId==='logistic-regression'?thresholdLabel(p.probability,s.parameters.threshold):p.label}));
    const metrics=s.modelId==='logistic-regression'?logisticMetrics(r,d,s.parameters.threshold).validation:classificationMetrics(rows.map(p=>d.y[p.rowId]),rows.map(p=>p.label));
    if(s.modelId==='mlp')metrics.logLoss=r.metrics.validation.logLoss;
    return {rows,metrics,result:r,threshold:s.modelId==='logistic-regression'?s.parameters.threshold:null};
  }
  pair(){
    const left=this.view('left'),right=this.view('right');if(!left||!right)return null;
    if(left.result.request.datasetRevision!==right.result.request.datasetRevision||left.result.request.datasetId!==right.result.request.datasetId||!sameRows(left.rows.map(p=>p.rowId),right.rows.map(p=>p.rowId)))return null;
    const d=this.dataset(),rows=left.rows.map((l,i)=>{const r=right.rows[i],actual=d.y[l.rowId];return {rowId:l.rowId,actual,left:l.label,right:r.label,disagree:l.label!==r.label};});
    return {left,right,rows,disagreements:rows.filter(p=>p.disagree).map(p=>p.rowId),leftOnlyCorrect:rows.filter(p=>p.left===p.actual&&p.right!==p.actual).length,rightOnlyCorrect:rows.filter(p=>p.right===p.actual&&p.left!==p.actual).length,bothCorrect:rows.filter(p=>p.left===p.actual&&p.right===p.actual).length,bothWrong:rows.filter(p=>p.left!==p.actual&&p.right!==p.actual).length};
  }
}

// Domain and samples depend on train/validation inputs only, in original units.
export function comparisonDomain(d){return [0,1].map(j=>{const values=[...d.partitions.train,...d.partitions.validation].map(i=>d.X[i][j]),lo=Math.min(...values),hi=Math.max(...values),pad=Math.max((hi-lo)*.12,.25);return [lo-pad,hi+pad];});}
export function comparisonMap(view,domain,resolution=48){
  const {model}=view.result,labels=[];
  for(let y=0;y<resolution;y++)for(let x=0;x<resolution;x++){
    const raw=[domain[0][0]+(x+.5)*(domain[0][1]-domain[0][0])/resolution,domain[1][0]+(y+.5)*(domain[1][1]-domain[1][0])/resolution];
    labels.push(model.kind==='mlp'?predictMlp(model,raw).label:model.kind==='knn'?predictKnn(model,raw).label:model.kind==='decision-tree'?predictTree(model,raw).label:model.kind==='random-forest'?predictForest(model,raw).label:model.kind==='svm'?predictSvm(model,raw).label:thresholdLabel(predictLogistic(model,raw).probability,view.threshold));
  }
  return {domain,resolution,labels,sampling:'cell-centers'};
}
