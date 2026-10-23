import {validateTiming} from './run-timing.js';
export function executeInWorker(request,dataset,runId,onProgress=()=>{}){
  const started=performance.now();
  const worker=new Worker(new URL('./model.worker.js',import.meta.url),{type:'module'});let rejectJob;
  const promise=new Promise((resolve,reject)=>{
    rejectJob=reject;
    worker.onmessage=({data})=>{if(data.runId!==runId)return;if(data.type==='progress'){onProgress(data.progress);return;}const roundTripMs=performance.now()-started;worker.terminate();if(data.type==='completed'){try{data.result.timing=validateTiming({...data.result.timing,roundTripMs},true);resolve(data.result);}catch(error){reject(error);}}else reject(new Error(data.error||'The model did not complete.'));};
    worker.onerror=event=>{worker.terminate();reject(new Error(event.message||'The model worker failed.'));};
    worker.onmessageerror=()=>{worker.terminate();reject(new Error('The worker result could not be read.'));};
    worker.postMessage({request,dataset,runId});
  });
  return {promise,cancel:()=>{worker.terminate();rejectJob(new Error('Run canceled.'));}};
}
