import {canonical} from './experiment.js';

export const activities=[
 {id:'tree-depth',title:'When does a deeper tree help?',route:'lesson/decision-tree',model:'decision-tree',variable:'max-depth',source:'parameter',question:'As depth changes, will validation accuracy rise, fall, or stay similar?',instruction:'Record a current baseline. Change only Maximum depth, fit again, then record the changed run. Compare training and validation accuracy before calling the tree better.',reflection:'Did training and validation move together? Use the measured gap to explain whether the deeper tree generalized better.',metrics:[['train.accuracy','Training accuracy'],['validation.accuracy','Validation accuracy']]},
 {id:'knn-neighbors',title:'How local should a neighborhood be?',route:'lesson/knn',model:'knn',variable:'n-neighbors',source:'parameter',question:'With a different k, will validation accuracy rise, fall, or stay similar?',instruction:'Change only Neighbors · k after recording your baseline. Keep weights and the data fixed, evaluate again, and inspect a point near a decision boundary.',reflection:'How did the neighborhood and decision regions change? Connect that geometry to the measured validation result.',metrics:[['train.accuracy','Training accuracy'],['validation.accuracy','Validation accuracy']]},
 {id:'data-noise',title:'What survives a noisier problem?',route:'compare',model:null,variable:'noise',source:'recipe',question:'With different noise, will the first model’s validation accuracy rise, fall, or stay similar?',instruction:'Use Shape the data and Apply data to establish a generated baseline. Run both models. After recording it, change only Noise standard deviation, Apply, and run both again. Keep the data seed, split, models, scaling and other recipe values fixed.',reflection:'Which model changed more? Explain using both measured validation accuracies. These runs describe one seeded problem, not a universal robustness ranking.',metrics:[['validation.accuracy','Validation accuracy']]},
 {id:'cluster-outliers',title:'How much can outliers move a grouping?',route:'lesson/kmeans',model:'kmeans',variable:'outliers',source:'recipe',question:'With a different outlier fraction, will silhouette rise, fall, or stay similar?',instruction:'Use Shape the data and Apply data for a generated baseline. Fit it, record it, change only Outlier fraction, Apply, and fit again. Keep k, restarts, initialization, data seed and other recipe values fixed.',reflection:'Inspect the centers and isolated points. What do inertia and silhouette reveal, and how does a changed cloud limit the comparison?',metrics:[['fit.inertia','Inertia'],['fit.silhouette','Mean silhouette']]},
 {id:'pca-dimensions',title:'What is lost in one dimension?',route:'lesson/pca',model:'pca',variable:'n-components',source:'parameter',question:'After changing retained dimensions, will reconstruction error rise, fall, or stay similar?',instruction:'Record a fitted baseline, change only Retained components, and fit again. Keep the input cloud and whitening fixed. Inspect a point and its reconstructed location.',reflection:'Use retained variance and reconstruction error to explain the cost of dropping a dimension. A nearly one-dimensional cloud may behave differently from a round one.',metrics:[['fit.retainedVarianceRatio','Retained variance fraction'],['fit.meanSquaredReconstructionError','Mean squared reconstruction error']]}
];
const at=(o,path)=>path.split('.').reduce((v,k)=>v?.[k],o);
const without=(o,key)=>Object.fromEntries(Object.entries(o).filter(([k])=>k!==key));
export function activityEvidence(def,{dataset,outputs}){
 if(!def||!dataset||!Array.isArray(outputs)||outputs.length!==(def.id==='data-noise'?2:1))throw Error('Complete the current run'+(def.id==='data-noise'?'s in both panels':'')+' before recording evidence.');
 if(def.source==='recipe'&&!dataset.generator)throw Error('Use Shape the data and Apply data for a generated baseline first.');
 if(def.model&&outputs[0].modelId!==def.model)throw Error('Open the matching lesson for this activity.');
 for(const o of outputs){if(o.request.datasetRevision!==dataset.revision||o.request.datasetId!==dataset.id)throw Error('Evidence must use the active dataset revision.');for(const [path] of def.metrics){const v=at(o.metrics,path);if(v!==null&&!Number.isFinite(v))throw Error('The current run does not provide the required task metrics.');}}
 return structuredClone({dataset:{id:dataset.id,revision:dataset.revision,generator:dataset.generator||null,partitions:dataset.partitions},runs:outputs.map(o=>({modelId:o.modelId,runId:o.runId,request:o.request,parameters:o.parameters,metrics:o.metrics}))});
}
export function checkActivityChange(def,before,after){
 if(before.dataset.id!==after.dataset.id||before.runs.length!==after.runs.length||canonical(before.dataset.partitions)!==canonical(after.dataset.partitions))throw Error('Keep the same dataset identity, row counts and split. Start over for a different problem.');
 if(def.source==='parameter'&&before.dataset.revision!==after.dataset.revision)throw Error('Keep the data fixed; change only '+def.variable+'.');
 if(def.source==='recipe'){
  const a=before.dataset.generator,b=after.dataset.generator;if(!a||!b||a.version!==b.version||canonical(without(a.recipe,def.variable))!==canonical(without(b.recipe,def.variable)))throw Error('Keep the seed and every recipe value except '+def.variable+' fixed.');
  if(a.recipe[def.variable]===b.recipe[def.variable]||before.dataset.revision===after.dataset.revision)throw Error('Change '+def.variable+', Apply data, then run again.');
 }
 for(let i=0;i<before.runs.length;i++){
  const a=before.runs[i],b=after.runs[i],r=structuredClone(a.request),s=structuredClone(b.request);
  if(def.source==='parameter'){
   if(a.parameters[def.variable]===b.parameters[def.variable])throw Error('Change '+def.variable+' and run again.');
   if(canonical(without(a.parameters,def.variable))!==canonical(without(b.parameters,def.variable)))throw Error('Change only '+def.variable+'; restore the other model controls.');
   delete r.parameters[def.variable];delete s.parameters[def.variable];
  }else{delete r.datasetRevision;delete s.datasetRevision;}
  if(canonical(r)!==canonical(s)||def.source==='recipe'&&canonical(a.parameters)!==canonical(b.parameters))throw Error('Keep models, parameters, seed, preprocessing and evaluation fixed. Change only '+def.variable+'.');
 }
 return true;
}
export class GuidedActivity{
 constructor(id){this.definition=activities.find(a=>a.id===id);if(!this.definition)throw Error('Unknown guided activity.');this.reset();}
 reset(){this.prediction=null;this.baseline=null;this.changed=null;this.reflection='';}
 predict(value){if(this.baseline)throw Error('Start over to revise a prediction after recording a baseline.');if(!['higher','lower','similar'].includes(value))throw Error('Choose a prediction first.');this.prediction=value;}
 recordBaseline(input){if(!this.prediction)throw Error('Record your prediction first.');if(this.baseline)throw Error('A baseline is already recorded. Start over to replace it.');this.baseline=activityEvidence(this.definition,input);}
 recordChanged(input){if(!this.baseline)throw Error('Record a baseline first.');const next=activityEvidence(this.definition,input);checkActivityChange(this.definition,this.baseline,next);this.changed=next;this.reflection='';}
 reflect(value){if(!this.changed)throw Error('Record a changed run before reflecting.');if(typeof value!=='string'||value.trim().length<10||value.trim().length>2000)throw Error('Write a reflection from 10 to 2000 characters using the measured evidence.');this.reflection=value.trim();}
 get phase(){return this.reflection?'complete':this.changed?'reflect':this.baseline?'change':this.prediction?'baseline':'predict';}
 metrics(){if(!this.changed)return [];return this.baseline.runs.flatMap((r,i)=>this.definition.metrics.map(([path,label])=>{const a=at(r.metrics,path),b=at(this.changed.runs[i].metrics,path);return {modelId:r.modelId,panel:i+1,label,before:a,after:b,delta:a===null||b===null?null:b-a};}));}
 report(){if(!this.reflection)throw Error('Record a reflection before exporting the activity.');return structuredClone({format:'machine-learning-atlas-guided-record',schemaVersion:'1.0.0',activityId:this.definition.id,question:this.definition.question,variable:this.definition.variable,prediction:this.prediction,baseline:this.baseline,changed:this.changed,metrics:this.metrics(),reflection:this.reflection,note:'Recorded evidence from completed runs. This worksheet is not a current-fit export or an importable experiment. It contains no uploaded CSV source, target labels or reserved-row predictions. Use experiment exports to reproduce model configurations.'});}
}
