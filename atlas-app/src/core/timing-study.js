import {canonical} from './experiment.js';
import {validateTiming} from '../engine/run-timing.js';
const median=a=>{const s=[...a].sort((a,b)=>a-b);return s[Math.floor(s.length/2)];};
export class TimingStudy{
  constructor({key,run,read,cancel,onChange=()=>{}}){Object.assign(this,{key,run,read,cancelRuns:cancel,onChange});this.active=null;this.state={status:'ready',key:null,trials:[],message:''};}
  sync(){if(this.state.key&&this.state.key!==this.key()&&this.state.status!=='requires-new-run'){const pending=!!this.active;this.active=null;this.state.status='requires-new-run';this.state.message='Settings changed. Run a new timing check.';if(pending)this.cancelRuns();this.onChange();}return this.state;}
  cancel(){if(!this.active)return;this.active=null;this.state.status='canceled';this.state.message='Timing check canceled; completed pairs remain partial evidence.';this.cancelRuns();this.onChange();}
  async start(){this.cancel();const token=Symbol(),key=this.key();this.active=token;this.state={status:'running',key,trials:[],message:''};this.onChange();
    try{for(let i=0;i<3;i++){const order=i%2?['right','left']:['left','right'],trial={index:i+1,order};for(const side of order){if(this.active!==token||this.key()!==key){this.sync();return false;}if(!await this.run(side))throw Error('A model did not complete. Correct its settings and run the timing check again.');if(this.active!==token||this.key()!==key){this.sync();return false;}const result=this.read(side);if(!result)throw Error('A current model result is required.');trial[side]={runId:result.runId,requestKey:result.configKey,timing:validateTiming(result.timing,true)};}this.state.trials.push(trial);this.onChange();}
      this.active=null;this.state.status='completed';this.onChange();return true;
    }catch(error){if(this.active!==token)return false;this.active=null;this.state.status='failed';this.state.message=error.message;this.cancelRuns();this.onChange();return false;}
  }
  summary(){const s=this.sync();if(s.status!=='completed')return null;return Object.fromEntries(['left','right'].map(side=>[side,Object.fromEntries(['fitMs','referenceMs','otherMs','workerRunMs','roundTripMs'].map(k=>{const a=s.trials.map(t=>t[side].timing[k]);return [k,{median:median(a),min:Math.min(...a),max:Math.max(...a)}];}))]));}
  record(){const summary=this.summary();return summary?structuredClone({version:'paired-timing-1',key:this.state.key,trials:this.state.trials,summary}):null;}
}
export function checkedTimingStudy(record,outputs){
  if(!record)return null;if(outputs.length!==2||record.version!=='paired-timing-1'||record.key!==canonical(outputs.map(o=>o.request))||!Array.isArray(record.trials)||record.trials.length!==3)throw Error('Timing check does not match these completed outputs.');
  record.trials.forEach((trial,i)=>{if(trial.index!==i+1||canonical(trial.order)!==canonical(i%2?['right','left']:['left','right']))throw Error('Timing check order is invalid.');for(const [j,side] of ['left','right'].entries()){if(trial[side]?.requestKey!==canonical(outputs[j].request)||!Number.isInteger(trial[side].runId)||trial[side].runId<1)throw Error('Timing check provenance is invalid.');validateTiming(trial[side].timing,true);}});
  // Recompute displayed statistics rather than trusting copied summary values.
  const copy=structuredClone(record);copy.summary=Object.fromEntries(['left','right'].map(side=>[side,Object.fromEntries(['fitMs','referenceMs','otherMs','workerRunMs','roundTripMs'].map(k=>{const a=copy.trials.map(t=>t[side].timing[k]);return [k,{median:median(a),min:Math.min(...a),max:Math.max(...a)}];}))]));return copy;
}
