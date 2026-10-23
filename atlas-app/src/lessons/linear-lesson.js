import {explainObservation,regressionSummary,visibleRows,interpolateLine} from '../core/linear-explanation.js';
export function createLinearLesson({state,getDataset,config,experiment,redraw,fmt,esc,announce}){
  state.linearView ||= {split:'both',residuals:'selected',showTruth:false};
  const descriptions=[
    'Each observation pairs an input x with a noisy response y. Filled points train the model; hollow points evaluate it.',
    'Change the slope or intercept, then select a point. Its vertical gap from the line is the residual; squaring that gap gives its loss contribution.',
    'Fit line chooses coefficients that minimize mean squared error on the current training observations. The validation points do not choose the coefficients.',
    'Compare the training and validation errors. Reveal the generating relationship to see why fitting noisy observations gives a slightly different line.'
  ];
  function markup(){return `<div class="linear-tools" aria-label="Point plot settings"><label>Observations<select id="observation-split"><option value="both">Training + validation</option><option value="training">Training only</option><option value="validation">Validation only</option></select></label><label>Residuals<select id="residual-mode"><option value="selected">Selected point</option><option value="all">All visible points</option><option value="none">Hide</option></select></label></div><section class="point-inspector" aria-label="Selected observation"><div class="inspector-heading"><label for="selected-observation">Follow one observation</label><div class="point-navigation"><button id="previous-point" aria-label="Previous observation">←</button><select id="selected-observation"></select><button id="next-point" aria-label="Next observation">→</button></div></div><div id="point-calculation" aria-live="polite"></div></section><div class="lesson-loss" id="loss-equation"></div><div class="truth-row"><label><input id="show-truth" type="checkbox">Reveal generating relationship</label><span id="truth-caption"></span></div><section class="residual-panel" id="residual-panel" aria-label="Residual diagnostic"><div class="kicker">Residuals against input</div><div id="residual-plot"></div><p class="small muted">Above zero: observed y is higher than predicted. Below zero: lower than predicted.</p></section><div id="linear-advanced"></div>`;}
  function selected(){const rows=visibleRows(getDataset(),state.linearView.split);if(!rows.includes(state.selectedPoint))state.selectedPoint=rows[0];return explainObservation(getDataset(),state.selectedPoint,config('linear-regression'));}
  function select(row){state.selectedPoint=row;redraw();const p=selected();announce(`Observation ${row+1}, ${p.split}. Residual ${fmt(p.residual)}. Squared error ${fmt(p.squaredError)}.`);}
  function bind(){
    const split=document.getElementById('observation-split');if(!split)return;
    split.value=state.linearView.split;split.addEventListener('change',()=>{state.linearView.split=split.value;selected();redraw();});
    const residuals=document.getElementById('residual-mode');residuals.value=state.linearView.residuals;residuals.addEventListener('change',()=>{state.linearView.residuals=residuals.value;redraw();});
    document.getElementById('selected-observation').addEventListener('change',e=>select(Number(e.target.value)));
    for(const [id,direction] of [['previous-point',-1],['next-point',1]])document.getElementById(id).addEventListener('click',()=>{const rows=visibleRows(getDataset(),state.linearView.split),i=rows.indexOf(state.selectedPoint);select(rows[(i+direction+rows.length)%rows.length]);});
    document.getElementById('show-truth').addEventListener('change',e=>{state.linearView.showTruth=e.target.checked;redraw();});
  }
  function refresh(){
    if(!document.getElementById('point-calculation'))return;
    document.getElementById('point-calculation').setAttribute('aria-busy',String(!!state.linearMotion));
    const p=selected(),model=config('linear-regression'),rows=visibleRows(getDataset(),state.linearView.split),selectEl=document.getElementById('selected-observation');
    if(selectEl.dataset.split!==state.linearView.split){selectEl.innerHTML=rows.map(i=>`<option value="${i}">Observation ${i+1} · ${getDataset().partitions.train.includes(i)?'train':'validation'}</option>`).join('');selectEl.dataset.split=state.linearView.split;}
    selectEl.value=String(p.rowId);
    const number=(v,css='')=>`<span class="${css}">${fmt(v,4)}</span>`;
    document.getElementById('point-calculation').innerHTML=`<div class="point-facts"><span>Input xᵢ <strong class="cyan">${fmt(p.x,4)}</strong></span><span>Observed yᵢ <strong class="cyan">${fmt(p.observed,4)}</strong></span><span>${p.split==='training'?'Used in training loss':'Validation only · excluded from training loss'}</span></div>${state.beat>=1?`<div class="point-equations"><div>ŷᵢ = ${number(model.slope,'yellow')} × ${number(p.x,'cyan')} ${model.intercept<0?'−':'+'} ${number(Math.abs(model.intercept),'green')} = ${number(p.predicted,'yellow')}</div><div>rᵢ = yᵢ − ŷᵢ = ${number(p.observed,'cyan')} − (${number(p.predicted,'yellow')}) = ${number(p.residual,'red')}</div><div>rᵢ² = (${number(p.residual,'red')})² = ${number(p.squaredError,'red')}</div></div><p class="point-meaning">${p.residual>=0?'The line predicts below this observation.':'The line predicts above this observation.'} ${p.split==='training'?`This point adds ${fmt(p.squaredError/getDataset().partitions.train.length,5)} to the mean training loss.`:'This point helps evaluate the line and does not contribute to its training loss.'}</p>`:'<p class="point-meaning">Move to the candidate-line chapter to predict this response.</p>'}`;
    const training=regressionSummary(getDataset(),getDataset().partitions.train,model);
    document.getElementById('loss-equation').innerHTML=state.beat>=1?`<span>L = (1 / ${training.rowCount}) Σᵢ∈train rᵢ² = <strong>${fmt(training.mse,4)}</strong></span><span class="small muted">Only training observations enter the fitting objective.</span>`:'';
    const truth=document.getElementById('show-truth');truth.checked=state.linearView.showTruth&&!!getDataset().truth;truth.disabled=state.beat!==3||!getDataset().truth;
    document.getElementById('truth-caption').textContent=!getDataset().truth?'CSV input has no known generating relationship.':state.beat===3?(state.linearView.showTruth?`Reference: y = ${fmt(getDataset().truth.slope)}x + ${fmt(getDataset().truth.intercept)} before noise. Excluded from fitting.`:'Reveal after inspecting the errors.'):'Available in Inspect errors.';
    document.getElementById('residual-panel').hidden=state.beat!==3;
    document.getElementById('scene-description').textContent=state.linearMotion?'The fit is already computed. This movement interpolates between lines to show the change; it is not an optimizer trajectory.':getDataset().imported&&state.beat===3?'Inspect training and validation errors on your CSV rows. No generating relationship is assumed.':descriptions[state.beat];
    const advanced=document.getElementById('linear-advanced');
    if(state.level==='advanced'){
      const train=getDataset().partitions.train,n=train.length,mx=train.reduce((s,i)=>s+getDataset().X[i][0],0)/n,my=train.reduce((s,i)=>s+getDataset().y[i],0)/n;
      advanced.innerHTML=`<details class="derivation" open><summary>The least-squares solution</summary><div class="derivation-equation">${model['fit-intercept']?'w* = Σ(xᵢ − x̄)(yᵢ − ȳ) / Σ(xᵢ − x̄)²<br>b* = ȳ − w*x̄':'w* = Σ xᵢyᵢ / Σ xᵢ²<br>b* = 0'}</div><p>Training means: x̄ = ${fmt(mx,4)}, ȳ = ${fmt(my,4)}. The design matrix has full column rank for this fixture, so the solution is unique.</p><p>With an intercept, fitted training residuals sum to zero up to numerical precision. Their average need not be zero on validation data. A different noisy sample can change the fitted coefficients; a good fit does not reveal the generator exactly.</p><p>Assumptions: the response is approximately linear over the observed range. A straight line cannot capture arbitrary curves, and extrapolation beyond these inputs is uncertain.</p><a class="text-link small" href="https://scikit-learn.org/stable/modules/generated/sklearn.linear_model.LinearRegression.html" target="_blank" rel="noopener noreferrer">Least-squares reference ↗</a></details>`;
    }else advanced.innerHTML='';
  }
  return {markup,bind,refresh,selected,select};
}
export function animateLine({from,to,reducedMotion=false,onFrame,duration=650}){
  let frame=null,resolve,finished=false;const promise=new Promise(r=>resolve=r);
  if(reducedMotion){onFrame({...to});finished=true;resolve(true);}
  else{let start=null;const tick=time=>{if(start===null)start=time;const t=Math.min(1,(time-start)/duration),eased=t*t*(3-2*t);onFrame(interpolateLine(from,to,eased));if(t<1)frame=requestAnimationFrame(tick);else{finished=true;resolve(true);}};frame=requestAnimationFrame(tick);}
  return {promise,cancel:()=>{if(finished)return;cancelAnimationFrame(frame);finished=true;resolve(false);}};
}
