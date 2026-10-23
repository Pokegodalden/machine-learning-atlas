import {measureRun} from './run-timing.js';
import {runAdapter} from './model-registry.js';
self.onmessage=event=>{
  const {request,dataset,runId}=event.data;
  try{self.postMessage({type:'completed',runId,result:measureRun(()=>runAdapter(request,dataset,runId,progress=>self.postMessage({type:'progress',runId,progress})))});}catch(error){self.postMessage({type:'failed',runId,error:error.message});}
};
