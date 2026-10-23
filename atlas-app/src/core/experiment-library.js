import {groupingOverlap} from './clustering-comparison.js';
import {kmeansParameters} from '../engine/kmeans.js';
import {validateTiming} from '../engine/run-timing.js';
import {checkedTimingStudy} from './timing-study.js';
import {importCsv} from '../data/csv-data.js';
import {parameterDefinitions,validateParameters} from './parameters.js';
import {modelCapabilities} from '../engine/model-registry.js';
import {comparisonDatasets,comparisonParameters} from './comparison.js';
import {logisticMetrics,thresholdLabel} from '../engine/logistic-regression.js';
import {mlpWork} from '../engine/mlp.js';
import {resolveGenerated as generatedFromDescriptor,taskGeneratorVersion} from '../data/task-data.js';
import {taskModels} from './task-data-context.js';

export const libraryKey='mla.experiments.v1',maxExperiments=50,maxImportBytes=1048576;
const format='machine-learning-atlas-experiment';
const object=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
function keys(value,required,label,optional=[]){if(!object(value)||Object.keys(value).some(k=>!required.includes(k)&&!optional.includes(k))||required.some(k=>!Object.hasOwn(value,k)))throw Error(`Invalid ${label} fields.`);}
export function experimentName(value){if(typeof value!=='string'||!value.trim()||value.trim().length>90||/[\r\n\u0000-\u001f]/.test(value))throw Error('Use an experiment name from 1 to 90 characters on one line.');return value.trim();}
function protocol(id){return {modelSeed:7,preprocessing:id==='pca'?'center-fit':['knn','logistic-regression','svm','mlp'].includes(id)?'standardize-train':'none',evaluation:id==='q-learning'?'greedy-policy':['kmeans','pca'].includes(id)?'fit':'validation'};}
export function makeExperiment(D,{name,kind='lesson',datasetId,models,level='beginner',chapter=0,generator=null,imported=null,scaling='standardize-train'}){
  if(generator&&imported)throw Error('Choose a single dataset source.');const d=imported?importCsv(imported):generator?generatedFromDescriptor(generator):D.datasets[datasetId];
  const doc={format,schemaVersion:'1.0.0',appVersion:D.implementation.appVersion,name:experimentName(name),configuration:{kind,dataset:{id:datasetId,revision:d?.revision,...(generator?{generator:structuredClone(generator)}:{}),...(imported?{imported:structuredClone(imported)}:{})},models:models.map(m=>({modelId:m.modelId,adapterVersion:modelCapabilities.find(c=>c.id===m.modelId)?.version,...protocol(m.modelId),...(kind==='comparison'&&['knn','logistic-regression','svm','mlp'].includes(m.modelId)?{preprocessing:scaling}:{}),parameters:structuredClone(m.parameters)})),presentation:{level,chapter},...(kind==='comparison'&&scaling!=='standardize-train'?{comparisonScaling:scaling}:{})}};
  return validateExperiment(doc,D);
}
export function validateExperiment(doc,D){
  keys(doc,['format','schemaVersion','appVersion','name','configuration'],'experiment document');
  if(doc.format!==format||doc.schemaVersion!=='1.0.0')throw Error('The experiment file format is unsupported.');
  if(typeof doc.appVersion!=='string'||!/^\d+\.\d+\.\d+$/.test(doc.appVersion))throw Error('Invalid app version.');
  const name=experimentName(doc.name),c=doc.configuration;keys(c,['kind','dataset','models','presentation'],'configuration',['comparisonScaling']);
  if(!['lesson','comparison','clustering-comparison'].includes(c.kind))throw Error('Unsupported experiment kind.');
  keys(c.dataset,['id','revision'],'dataset',['generator','imported']);const d=experimentDataset(D,c.dataset);if(!d||d.id!==c.dataset.id||d.revision!==c.dataset.revision)throw Error('This dataset or revision is unavailable. Keep the file for a matching app version.');
  const scaling=c.comparisonScaling??'standardize-train';if(!['none','standardize-train'].includes(scaling)||c.kind!=='comparison'&&Object.hasOwn(c,'comparisonScaling'))throw Error('Unsupported scaling for this experiment.');
  if(c.dataset.generator){const id=c.models?.[0]?.modelId;if(c.kind==='comparison'&&c.dataset.generator.version!=='synthetic-1'||c.kind!=='comparison'&&(!taskModels[id]||c.dataset.generator.version!==taskGeneratorVersion||taskModels[id].task!==d.generator.recipe.task))throw Error('This generated task is incompatible with the selected lesson or comparison.');}
  if(c.dataset.imported){const id=c.models?.[0]?.modelId,task=c.kind==='comparison'?'classification':({'linear-regression':'regression',kmeans:'clustering',pca:'pca'}[id]);if(!task||d.imported.task!==task)throw Error('This CSV task is incompatible with the selected lesson or comparison.');}
  keys(c.presentation,['level','chapter'],'presentation');if(!['beginner','advanced'].includes(c.presentation.level)||!Number.isInteger(c.presentation.chapter)||c.presentation.chapter<0||c.presentation.chapter>3)throw Error('Invalid explanation level or chapter.');
  if(!Array.isArray(c.models)||c.models.length!==(c.kind==='lesson'?1:2))throw Error('Incorrect number of models for this experiment.');
  if(c.kind==='clustering-comparison'&&(d.id!=='three-clusters'||c.models.some(m=>m.modelId!=='kmeans')))throw Error('Clustering comparison requires two K-means settings.');
  if(c.kind==='comparison'&&!comparisonDatasets.includes(d.id))throw Error('This dataset is unavailable for comparison.');
  for(const m of c.models){
    keys(m,['modelId','adapterVersion','modelSeed','preprocessing','evaluation','parameters'],'model');const cap=modelCapabilities.find(cap=>cap.id===m.modelId);
    if(!cap?.version||m.adapterVersion!==cap.version)throw Error('This model adapter version is unavailable.');
    if(!cap.datasetIds.includes(d.id))throw Error('The model does not support this dataset.');
    const expected=protocol(m.modelId);if(c.kind==='comparison'&&['knn','logistic-regression','svm','mlp'].includes(m.modelId))expected.preprocessing=scaling;if(m.modelSeed!==expected.modelSeed||m.preprocessing!==expected.preprocessing||m.evaluation!==expected.evaluation)throw Error('The saved seed, preprocessing, or evaluation protocol is unsupported.');
    if(c.kind==='clustering-comparison')kmeansParameters(m.parameters);
    else if(c.kind==='comparison')comparisonParameters(m.modelId,m.parameters);
    else{const entry=D.catalog.entries.find(e=>e.id===m.modelId),lesson=D.plan.lessons.find(l=>l.catalogEntryId===m.modelId);if(!lesson||(m.modelId==='mlp'&&d.id==='two-blobs'))throw Error('This dataset is unavailable in the selected lesson.');validateParameters(m.parameters,parameterDefinitions(entry,lesson,d));}
    if(m.modelId==='mlp'){const work=mlpWork(m.parameters,d.partitions.train.length);if(work.visits>work.limit)throw Error('This network exceeds the 100 million training-work limit. Reduce its width, depth, or epochs before saving.');}
  }
  if(new TextEncoder().encode(JSON.stringify(doc)).length>maxImportBytes)throw Error('Experiment files must be at most 1 MiB.');return {...structuredClone(doc),name};
}
export function experimentDataset(D,descriptor){if(Object.hasOwn(descriptor,'generator')&&Object.hasOwn(descriptor,'imported'))throw Error('Choose a single dataset source.');return Object.hasOwn(descriptor,'imported')?importCsv(descriptor.imported):Object.hasOwn(descriptor,'generator')?generatedFromDescriptor(descriptor.generator):D.datasets[descriptor.id];}
export function parseExperiment(text,D){if(typeof text!=='string'||new TextEncoder().encode(text).length>maxImportBytes)throw Error('Experiment files must be at most 1 MiB.');let doc;try{doc=JSON.parse(text);}catch{throw Error('The experiment file is not valid JSON.');}return validateExperiment(doc,D);}
export function readLibrary(storage){
  let raw;try{raw=storage.getItem(libraryKey);}catch{throw Error('Browser storage is unavailable. You can still export an experiment file.');}
  if(raw===null)return [];
  let saved;try{saved=JSON.parse(raw);}catch{throw Error('Saved library data is unreadable. Download a backup before repairing browser storage.');}
  keys(saved,['schemaVersion','entries'],'library');if(saved.schemaVersion!=='1.0.0'||!Array.isArray(saved.entries)||saved.entries.length>maxExperiments)throw Error('The saved experiment library format is unsupported.');
  const ids=new Set();for(const e of saved.entries){keys(e,['id','savedAt','document'],'library entry');if(typeof e.id!=='string'||!e.id||e.id.length>100||ids.has(e.id)||typeof e.savedAt!=='string'||!Number.isFinite(Date.parse(e.savedAt))||!object(e.document))throw Error('The saved experiment library contains an invalid entry.');ids.add(e.id);}
  return structuredClone(saved.entries);
}
function writeLibrary(storage,entries){const text=JSON.stringify({schemaVersion:'1.0.0',entries});if(new TextEncoder().encode(text).length>1048576)throw Error('The library is full. Export or remove an older experiment.');try{storage.setItem(libraryKey,text);}catch{throw Error('Could not save to browser storage. Export an experiment file instead.');}}
export function saveExperiment(storage,doc,D,id=null){
  const document=validateExperiment(doc,D),entries=readLibrary(storage),index=id===null?-1:entries.findIndex(e=>e.id===id);
  if(id!==null&&index<0)throw Error('This saved experiment no longer exists.');if(index<0&&entries.length>=maxExperiments)throw Error('The library holds up to 50 experiments. Export or remove one before saving another.');
  const entry={id:id||globalThis.crypto.randomUUID(),savedAt:new Date().toISOString(),document};if(index<0)entries.unshift(entry);else entries[index]=entry;writeLibrary(storage,entries);return structuredClone(entry);
}
export function removeExperiment(storage,id){const entries=readLibrary(storage),removed=entries.find(e=>e.id===id);if(!removed)throw Error('This saved experiment no longer exists.');writeLibrary(storage,entries.filter(e=>e.id!==id));return removed;}
export function restoreRemoved(storage,entry){const entries=readLibrary(storage);if(entries.length>=maxExperiments||entries.some(e=>e.id===entry.id))throw Error('The experiment cannot be restored to this library.');writeLibrary(storage,[structuredClone(entry),...entries]);}

// Exports contain accepted, compatible completed outputs. Imported files only
// supply validated configurations: claimed metrics are never imported as fits.
export function resultOutput(D,result,parameters,datasetOverride=null){
  const d=datasetOverride||D.datasets[result.request.datasetId],id=result.model.kind,rows=[];if(!d||d.id!==result.request.datasetId||d.revision!==result.request.datasetRevision)throw Error('Export data differs from the fitted dataset revision.');
  for(const [split,predictions] of Object.entries(result.predictions||{}))for(const p of predictions){if(!['train','validation','fit'].includes(split)||!d.partitions[split]?.includes(p.rowId))throw Error('Prediction rows do not match the declared partition.');rows.push({split,...structuredClone(p),...(d.y?{actual:d.y[p.rowId]}:{}),...(id==='logistic-regression'?{label:thresholdLabel(p.probability,parameters.threshold)}:{})});}
  if(id==='q-learning'){for(const h of result.history)rows.push({phase:'training',...h});for(const t of result.evaluation.trajectory)rows.push({phase:'greedy-evaluation',...t});}
  return {modelId:id,runId:result.runId,request:structuredClone(result.request),parameters:structuredClone(parameters),...(result.timing?{timing:validateTiming(result.timing,true)}:{}),...(d.preparation?{inputPreparation:structuredClone(d.preparation)}:{}),metrics:id==='logistic-regression'?logisticMetrics(result,d,parameters.threshold):structuredClone(result.metrics),rows,solver:structuredClone(result.solver??null),...(id==='q-learning'?{evaluation:structuredClone(result.evaluation),environmentReference:structuredClone(result.environmentReference)}:{})};
}
export function resultsDocument(experiment,outputs,timingStudy=null){if(!outputs.length)throw Error('Complete a current run before exporting results.');return {format:'machine-learning-atlas-results',schemaVersion:'1.0.0',exportedAt:new Date().toISOString(),experiment:structuredClone(experiment),note:experiment.configuration.dataset.imported?'Output rows exclude the reserved final-check partition. The experiment configuration embeds the uploaded CSV source to reproduce inputs and splits.':'Computed outputs from completed current runs. Reopen the separate experiment configuration file to reproduce them. Final-check data is not evaluated or exported.',outputs:structuredClone(outputs),...(experiment.configuration.kind==='clustering-comparison'?{groupingComparison:groupingOverlap(outputs[0].rows,outputs[1].rows)}:{}),...(timingStudy?{timingStudy:checkedTimingStudy(timingStudy,outputs)}:{})};}
export function rowsCsv(outputs){
  const rows=outputs.flatMap((o,index)=>o.rows.map(row=>({panel:outputs.length===2?(index===0?'first':'second'):'lesson',modelId:o.modelId,...row})));if(!rows.length)throw Error('No completed output rows are available.');
  const columns=[...new Set(rows.flatMap(row=>Object.keys(row)))];
  const cell=value=>{let s=value===undefined||value===null?'':typeof value==='object'?JSON.stringify(value):String(value);if(typeof value==='string'&&/^[=+\-@\t\r]/.test(s))s="'"+s;return /[",\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;};
  return '\uFEFF'+[columns.map(cell).join(','),...rows.map(row=>columns.map(k=>cell(row[k])).join(','))].join('\r\n')+'\r\n';
}
