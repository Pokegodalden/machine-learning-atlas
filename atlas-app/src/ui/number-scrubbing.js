// Native number inputs remain editable; horizontal dragging is an optional shortcut.
export function mountNumberScrubbing({main,definitions,begin,end}){
 for(const input of main.querySelectorAll('[data-param-number]')){
  const p=definitions.get(input.dataset.paramNumber),wrap=document.createElement('span');wrap.className='scrub-number';
  input.before(wrap);wrap.append(input);wrap.insertAdjacentHTML('beforeend','<svg class="scrub-meter" viewBox="0 0 24 24" aria-hidden="true"><path class="scrub-track" d="M5 19A10 10 0 1 1 19 19"/><path class="scrub-level" d="M5 19A10 10 0 1 1 19 19" pathLength="100"/></svg>');
  input.title='Drag horizontally to adjust, or click to type. Shift-drag for fine adjustments.';
  const log=p.scale==='logarithmic',lo=log?Math.log10(p.minimum):p.minimum,hi=log?Math.log10(p.maximum):p.maximum;
  const update=()=>{const v=input.valueAsNumber;if(!Number.isFinite(v)||log&&v<=0)return;wrap.style.setProperty('--scrub-level',Math.max(0,Math.min(100,100*((log?Math.log10(v):v)-lo)/(hi-lo))));};update();input.addEventListener('input',update);
  // Other controls and fitted coefficients can update this input without emitting input.
  const onFocus=()=>update();input.addEventListener('focus',onFocus);
  let drag=null;
  input.addEventListener('pointerdown',e=>{if(e.button!==0||!Number.isFinite(input.valueAsNumber))return;drag={x:e.clientX,start:log?Math.log10(input.valueAsNumber):input.valueAsNumber,id:e.pointerId,moved:false};});
  input.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const delta=e.clientX-drag.x;if(!drag.moved&&Math.abs(delta)<5)return;if(!drag.moved){begin();drag.moved=true;input.setPointerCapture(e.pointerId);wrap.classList.add('is-scrubbing');}e.preventDefault();const position=Math.max(lo,Math.min(hi,drag.start+delta*(hi-lo)/240*(e.shiftKey?.1:1)));let value=log?10**position:position;value=p.valueType==='integer'?Math.round(value):Number(value.toPrecision(6));input.value=String(Math.max(p.minimum,Math.min(p.maximum,value)));input.dispatchEvent(new Event('input',{bubbles:true}));});
  const finish=()=>{if(drag?.moved){end();wrap.classList.remove('is-scrubbing');}drag=null;};input.addEventListener('pointerup',finish);input.addEventListener('pointercancel',finish);input.addEventListener('lostpointercapture',finish);input.addEventListener('blur',finish);
  input.addEventListener('click',e=>{if(wrap.classList.contains('is-scrubbing'))e.preventDefault();});
 }
}
