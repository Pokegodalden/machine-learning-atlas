import {validateParameters,defaults,parameterDefinitions} from './parameters.js';
const key='mla.setups.v1';
export function saveSetup(storage,entry,lesson,dataset,parameters){
  const setup={schemaVersion:'1.0.0',modelId:entry.id,datasetId:dataset.id,datasetRevision:dataset.revision,parameters:validateParameters(parameters,parameterDefinitions(entry,lesson,dataset)),savedAt:new Date().toISOString()};
  let stored={schemaVersion:'1.0.0',setups:{}};
  try{const parsed=JSON.parse(storage.getItem(key)||'null');if(parsed?.schemaVersion==='1.0.0'&&parsed.setups&&typeof parsed.setups==='object')stored=parsed;}catch{}
  stored.setups[entry.id]=setup;storage.setItem(key,JSON.stringify(stored));return setup;
}
export function loadSetup(storage,entry,lesson,dataset){
  const parsed=JSON.parse(storage.getItem(key)||'null');if(parsed===null)return null;
  if(parsed.schemaVersion!=='1.0.0'||!parsed.setups)throw new Error('The saved setup format is unsupported.');
  const setup=parsed.setups[entry.id];if(!setup)return null;
  if(setup.schemaVersion!=='1.0.0'||setup.modelId!==entry.id||setup.datasetId!==dataset.id||setup.datasetRevision!==dataset.revision)throw new Error('The saved setup uses a different dataset revision.');
  // Strict validation prevents malformed storage from changing a valid experiment.
  return validateParameters({...defaults(entry,lesson),...setup.parameters},parameterDefinitions(entry,lesson,dataset));
}
