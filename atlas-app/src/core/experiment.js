// Semantic identity excludes presentation and manual exploration coefficients.
export function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';return JSON.stringify(value);}
export function requestKey(request){return canonical(request);}
export class Experiment {
  constructor(){this.status='ready';this.result=null;this.error=null;this.active=null;this.serial=0;this.listeners=new Set();}
  subscribe(fn){this.listeners.add(fn);return ()=>this.listeners.delete(fn);}
  notify(){for(const fn of this.listeners)fn(this);}
  update(request){this.currentKey=requestKey(request);if(this.active&&this.active.key!==this.currentKey){this.active.stop?.();this.active=null;}this.status=this.active?'running':this.result?(this.result.configKey===this.currentKey?'completed':'requires-new-run'):'ready';this.error=null;this.notify();}
  async run(request,execute){
    this.active?.stop?.();const ticket={id:++this.serial,key:requestKey(request),stop:null};this.active=ticket;this.currentKey=ticket.key;this.status='running';this.error=null;this.notify();
    try{const job=execute(structuredClone(request),ticket.id);ticket.stop=job.cancel;const output=await job.promise;
      if(this.active!==ticket||this.currentKey!==ticket.key)return false;
      if(output.schemaVersion!=='1.0.0'||output.runId!==ticket.id||output.configKey!==ticket.key||!output.model)throw new Error('The model returned an incompatible result.');
      this.result=structuredClone(output);this.active=null;this.status='completed';this.notify();return true;
    }catch(error){if(this.active!==ticket)return false;this.active=null;this.status='failed';this.error=error.message||'Model run failed.';this.notify();return false;}
  }
  cancel(){if(!this.active)return;this.active.stop?.();this.active=null;this.status='canceled';this.error=null;this.notify();}
}
