import {measureFit,measureReference,startFit} from './run-timing.js';
import {requestKey} from '../core/experiment.js';
import {regressionSummary} from '../core/linear-explanation.js';
export function fitLinear(request,dataset,runId){
  if(request.schemaVersion!=='1.0.0'||!Number.isInteger(runId)||runId<1)throw new Error('Unsupported request version or run identifier.');
  if(request.modelId!=='linear-regression'||request.datasetId!==dataset.id||request.datasetRevision!==dataset.revision||request.adapterVersion!=='ols-1')throw new Error('Unsupported model or dataset revision.');
  if(request.evaluation!=='validation'||request.preprocessing!=='none'||!Number.isInteger(request.modelSeed))throw new Error('Unsupported experiment configuration.');
  if(Object.keys(request.parameters).length!==1||typeof request.parameters['fit-intercept']!=='boolean')throw new Error('Invalid fitting parameters.');
  const rows=dataset.partitions.train;if(rows.length<2||new Set(rows).size!==rows.length)throw new Error('Training requires distinct observations.');
  const validation=dataset.partitions.validation,test=dataset.partitions.test;
  if(!validation.length)throw new Error('Validation requires observations.');
  const used=new Set(rows);if(validation.some(i=>used.has(i))||test.some(i=>used.has(i)||validation.includes(i)))throw new Error('Dataset partitions overlap.');
  for(const i of [...rows,...validation])if(!Number.isInteger(i)||!dataset.X[i]||dataset.X[i].length!==1||!Number.isFinite(dataset.X[i][0])||!Number.isFinite(dataset.y[i]))throw new Error('Expected finite one-feature regression data.');
  const stopFit=startFit();
  const mean=(values)=>values.reduce((s,x)=>s+x,0)/values.length;
  const mx=mean(rows.map(i=>dataset.X[i][0])),my=mean(rows.map(i=>dataset.y[i]));
  const offset=request.parameters['fit-intercept'];
  const denominator=rows.reduce((s,i)=>s+(offset?dataset.X[i][0]-mx:dataset.X[i][0])**2,0);
  if(denominator<=Number.EPSILON)throw new Error('Training inputs do not define a unique slope.');
  const slope=rows.reduce((s,i)=>s+(offset?dataset.X[i][0]-mx:dataset.X[i][0])*(offset?dataset.y[i]-my:dataset.y[i]),0)/denominator;
  const intercept=offset?my-slope*mx:0;
  if(!Number.isFinite(slope)||!Number.isFinite(intercept))throw new Error('Fitting exceeded finite numeric precision.');
  stopFit();
  const predict=ids=>ids.map(i=>({rowId:i,value:slope*dataset.X[i][0]+intercept}));
  const metrics=ids=>regressionSummary(dataset,ids,{slope,intercept});
  return {schemaVersion:'1.0.0',runId,configKey:requestKey(request),request:structuredClone(request),model:{kind:'linear-regression',slope,intercept},preprocessing:{kind:'none'},predictions:{train:predict(rows),validation:predict(validation)},metrics:{train:metrics(rows),validation:metrics(validation)},checkpoints:[{index:0,kind:'fitted-model',model:{slope,intercept}}]};
}
