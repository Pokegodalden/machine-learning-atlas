let recorder=null;
export function startFit(){const r=recorder;if(!r||r.referenceDepth)return ()=>{};const start=r.now();let stopped=false;return ()=>{if(!stopped){r.fitMs+=r.now()-start;stopped=true;}};}
export function measureFit(fn){const stop=startFit();try{return fn();}finally{stop();}}
export function measureReference(fn){const r=recorder;if(!r)return fn();const outer=r.referenceDepth++===0,start=outer?r.now():0;try{return fn();}finally{r.referenceDepth--;if(outer)r.referenceMs+=r.now()-start;}}
export function measureRun(fn,now=()=>performance.now()){
  if(recorder)throw Error('A timing collector is already active.');const r={now,fitMs:0,referenceMs:0,referenceDepth:0},start=now();recorder=r;
  try{const result=fn(),workerRunMs=now()-start;return {...result,timing:{version:'timing-1',clock:'performance.now',fitMs:r.fitMs,referenceMs:r.referenceMs,otherMs:Math.max(0,workerRunMs-r.fitMs-r.referenceMs),workerRunMs}};}
  finally{recorder=null;}
}
export function validateTiming(t,roundTripRequired=false){
  const fields=['version','clock','fitMs','referenceMs','otherMs','workerRunMs'];if(!t||typeof t!=='object'||Array.isArray(t)||Object.keys(t).some(k=>!fields.includes(k)&&k!=='roundTripMs')||fields.some(k=>!Object.hasOwn(t,k))||t.version!=='timing-1'||t.clock!=='performance.now')throw Error('Unsupported timing record.');
  for(const k of [...fields.slice(2),...(Object.hasOwn(t,'roundTripMs')?['roundTripMs']:[])])if(typeof t[k]!=='number'||!Number.isFinite(t[k])||t[k]<0)throw Error('Timing durations must be finite and nonnegative.');
  if(Math.abs(t.fitMs+t.referenceMs+t.otherMs-t.workerRunMs)>Math.max(1e-6,t.workerRunMs*1e-9)||roundTripRequired&&!Object.hasOwn(t,'roundTripMs'))throw Error('Timing phases do not match the worker run.');return structuredClone(t);
}
export function elapsedLabel(ms){return !Number.isFinite(ms)?'—':ms<1?'<1 ms':ms<1000?`${ms.toFixed(1)} ms`:`${(ms/1000).toFixed(2)} s`;}
