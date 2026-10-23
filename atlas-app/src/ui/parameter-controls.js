import {mountNumberScrubbing} from './number-scrubbing.js';
import {bindSettingsGestures} from './settings-gestures.js';
import {sliderToValue} from '../core/parameters.js';
export function createControls({main,state,config,parameterDefinitions,esc,fmt,setBeat,redrawPlots,onParameterChange,onSettingsChange=()=>{},beginEdit=()=>{},endEdit=()=>{}}){
  function controlMarkup(id,p) {
    const value=config(id)[p.id], key=`control-${p.id}`;
    if(p.valueType==='boolean')return `<div class="control"><label class="toggle-label"><input id="${key}" type="checkbox" data-param="${p.id}" ${value?'checked':''}>${esc(p.label)}</label><p class="control-help">${esc(p.description)}</p></div>`;
    if(p.valueType==='string')return `<div class="control"><div class="control-head"><label for="${key}">${esc(p.label)}</label></div><select id="${key}" data-param="${p.id}">${p.choices.map(v=>`<option value="${esc(v)}" ${v===value?'selected':''}>${esc(v)}</option>`).join('')}</select><p class="control-help">${esc(p.description)}</p></div>`;
    const log=p.scale==='logarithmic',lo=log?Math.log10(p.minimum):p.minimum,hi=log?Math.log10(p.maximum):p.maximum;
    const sliderValue=log?Math.log10(value):value;
    const step=p.valueType==='integer'?1:log?0.01:(p.maximum-p.minimum)/200;
    const dial=id==='linear-regression'&&p.id==='intercept'||p.widget==='dial';
    return `<div class="control"><div class="control-head"><label for="${key}-number">${esc(p.label)}</label><input id="${key}-number" type="number" data-param-number="${p.id}" min="${p.minimum}" max="${p.maximum}" step="${p.valueType==='integer'?1:'any'}" value="${Number(Number(value).toFixed(5))}" aria-describedby="${key}-help ${key}-error"></div>${dial?`<div class="dial-row"><div class="dial" data-dial="${p.id}" role="slider" tabindex="0" aria-label="${esc(p.label)} dial" aria-valuemin="${p.minimum}" aria-valuemax="${p.maximum}" aria-valuenow="${value}"><span class="dial-needle" style="transform:rotate(${-135+(value-p.minimum)/(p.maximum-p.minimum)*270}deg)"></span></div><div class="dial-note">Turn to adjust.<br>Arrow keys or numeric input.</div></div>`:`<input id="${key}" type="range" data-param-range="${p.id}" data-log="${log}" min="${lo}" max="${hi}" step="${step}" value="${sliderValue}" aria-label="${esc(p.label)}"><div class="bounds"><span>${fmt(p.minimum,4)}</span><span>${fmt(p.maximum,4)}</span></div>`}<p class="control-help" id="${key}-help">${esc(p.description)}</p><div class="input-error" id="${key}-error" aria-live="polite"></div></div>`;
  }

  function bindControls(id) {
    const definitions=new Map(parameterDefinitions(id).map(p=>[p.id,p]));
    bindSettingsGestures(main.querySelector('.controls-panel'),()=>beginEdit(id),()=>endEdit(id));
    const commit=(key,value,origin)=>{
      const p=definitions.get(key);if(p.valueType==='integer')value=Math.round(value);
      const before=structuredClone(config(id));config(id)[key]=value;onSettingsChange(id,before,config(id));
      onParameterChange(id,p);
      if(id==='linear-regression'&&p.category==='exploration'){state.fitted=false;if(state.beat===0)state.beat=1;}
      else if(id==='linear-regression'&&p.category==='training')state.fitted=false;
      const number=main.querySelector(`[data-param-number="${key}"]`);if(number&&number!==origin)number.value=String(value);
      if(number){number.setAttribute('aria-invalid','false');document.getElementById(`control-${key}-error`).textContent='';}
      const range=main.querySelector(`[data-param-range="${key}"]`);if(range&&range!==origin)range.value=String(p.scale==='logarithmic'?Math.log10(value):value);
      const dial=main.querySelector(`[data-dial="${key}"]`);if(dial){dial.setAttribute('aria-valuenow',String(value));dial.querySelector('.dial-needle').style.transform=`rotate(${-135+(value-p.minimum)/(p.maximum-p.minimum)*270}deg)`;}
      if(id==='linear-regression')setBeat(id,state.beat);else redrawPlots();
    };
    main.querySelectorAll('[data-param-range]').forEach(el=>el.addEventListener('input',()=>{const key=el.dataset.paramRange;const value=sliderToValue(Number(el.value),definitions.get(key));commit(key,value,el);}));
    main.querySelectorAll('[data-param-number]').forEach(el=>el.addEventListener('input',()=>{
      const key=el.dataset.paramNumber,p=definitions.get(key),value=el.valueAsNumber;
      const valid=Number.isFinite(value)&&value>=p.minimum&&value<=p.maximum&&(p.valueType!=='integer'||Number.isInteger(value));
      el.setAttribute('aria-invalid',String(!valid));document.getElementById(`control-${key}-error`).textContent=valid?'':`Enter ${p.valueType==='integer'?'an integer':'a value'} from ${fmt(p.minimum,4)} to ${fmt(p.maximum,4)}.`;
      if(valid)commit(key,value,el);
    }));
    main.querySelectorAll('[data-param]').forEach(el=>el.addEventListener('change',()=>{const p=definitions.get(el.dataset.param);commit(p.id,p.valueType==='boolean'?el.checked:el.value,el);}));
    mountNumberScrubbing({main,definitions,begin:()=>beginEdit(id),end:()=>endEdit(id)});
    main.querySelectorAll('[data-dial]').forEach(el=>{
      const p=definitions.get(el.dataset.dial),step=p.valueType==='integer'?1:(p.maximum-p.minimum)/120;
      const set=value=>commit(p.id,Math.min(p.maximum,Math.max(p.minimum,Math.round(value*1000)/1000)),el);
      el.addEventListener('keydown',event=>{let value=config(id)[p.id];if(['ArrowUp','ArrowRight'].includes(event.key))value+=step;else if(['ArrowDown','ArrowLeft'].includes(event.key))value-=step;else if(event.key==='Home')value=p.minimum;else if(event.key==='End')value=p.maximum;else return;event.preventDefault();set(value);});
      const move=event=>{const r=el.getBoundingClientRect(),angle=Math.atan2(event.clientX-r.left-r.width/2,-(event.clientY-r.top-r.height/2))*180/Math.PI;set(p.minimum+(Math.max(-135,Math.min(135,angle))+135)/270*(p.maximum-p.minimum));};
      el.addEventListener('pointerdown',event=>{el.setPointerCapture(event.pointerId);el.dataset.dragging='yes';move(event);});
      el.addEventListener('pointermove',event=>{if(el.dataset.dragging==='yes')move(event);});
      el.addEventListener('pointerup',()=>{delete el.dataset.dragging;});
      el.addEventListener('pointercancel',()=>{delete el.dataset.dragging;});
    });
  }


return {controlMarkup,bindControls};
}
