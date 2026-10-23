export function parameterDefinitions(entry,lesson,dataset=null) {
  const definitions=entry.parameters.map(p=>({...p,...Object.fromEntries(Object.entries(lesson?.parameterOverrides.find(o=>o.parameterId===p.id)||{}).filter(([k])=>k!=='parameterId'))}));
  if(entry.id==='linear-regression'&&dataset?.imported){
    const ids=dataset.partitions.train,n=ids.length,mx=ids.reduce((s,i)=>s+dataset.X[i][0],0)/n,my=ids.reduce((s,i)=>s+dataset.y[i],0)/n,xx=ids.reduce((s,i)=>s+(dataset.X[i][0]-mx)**2,0),w=ids.reduce((s,i)=>s+(dataset.X[i][0]-mx)*(dataset.y[i]-my),0)/xx,b=my-w*mx,rawXX=ids.reduce((s,i)=>s+dataset.X[i][0]**2,0),w0=rawXX>Number.EPSILON?ids.reduce((s,i)=>s+dataset.X[i][0]*dataset.y[i],0)/rawXX:0;
    for(const p of definitions)if(['slope','intercept'].includes(p.id)){const bound=Math.max(Math.abs(p.minimum),Math.abs(p.maximum),Math.ceil(2*Math.max(...(p.id==='slope'?[Math.abs(w),Math.abs(w0)]:[Math.abs(b)]))));p.minimum=-bound;p.maximum=bound;}
  }
  return definitions;
}
export function defaults(entry,lesson) {return Object.fromEntries(parameterDefinitions(entry,lesson).map(p=>[p.id,p.default]));}
export function validateParameters(values,definitions) {
  if(!values||typeof values!=='object'||Array.isArray(values))throw new Error('Parameters must be an object.');
  const keys=new Set(definitions.map(p=>p.id));
  for(const key of Object.keys(values))if(!keys.has(key))throw new Error(`Unknown parameter: ${key}`);
  for(const p of definitions){const v=values[p.id];
    if(p.valueType==='boolean'){if(typeof v!=='boolean')throw new Error(`${p.label} must be true or false.`);}
    else if(p.valueType==='string'){if(!p.choices.includes(v))throw new Error(`Choose a valid ${p.label}.`);}
    else if(typeof v!=='number'||!Number.isFinite(v)||v<p.minimum||v>p.maximum||(p.valueType==='integer'&&!Number.isInteger(v)))throw new Error(`${p.label} is outside its valid range.`);
  }
  return structuredClone(values);
}
export function sliderToValue(position,p){return p.valueType==='integer'?Math.round(p.scale==='logarithmic'?10**position:position):p.scale==='logarithmic'?10**position:position;}
