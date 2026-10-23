import {createMicroInteractions} from './micro-interactions.js';
import {mountLessonSlideshow,mountAtlasGraph} from './explore-interactions.js';
import {algorithmArt} from './algorithm-art.js';

const questions={
 'linear-regression':'How does fitting a line reduce the vertical prediction errors?',
 knn:'When does a larger neighborhood change the answer?',
 'logistic-regression':'Which points change class when you move the threshold?',
 'decision-tree':'When does another split help on unseen observations?',
 'random-forest':'Where do individual trees disagree with their average?',
 svm:'Can a straight margin separate these groups?',
 kmeans:'Where should the centers sit to shorten the distances?',
 pca:'Which direction preserves the most variation?',
 mlp:'Can hidden units learn a boundary a straight line cannot?',
 'q-learning':'Will the learned greedy policy reach the goal?'
};
const journeys=[
 {id:'predict',name:'How do models make predictions?',verb:'From observations to decisions',description:'Fit a line. Draw a boundary. Discover when complexity helps.',lessons:['linear-regression','knn','logistic-regression','decision-tree','random-forest','svm','mlp'],art:'linear-regression'},
 {id:'structure',name:'How do models represent data?',verb:'Distances, regions & representations',description:'Explore neighborhoods, partitions, clusters, projections and hidden units.',lessons:['knn','decision-tree','random-forest','svm','kmeans','pca','mlp'],art:'pca'},
 {id:'learn',name:'How does a model learn?',verb:'Objectives, updates & experience',description:'Follow fitted coefficients, solver steps, ensemble votes and rewards.',lessons:['linear-regression','logistic-regression','decision-tree','random-forest','kmeans','mlp','q-learning'],art:'mlp'}
];

export function createAtlasEdition({main,redraw,readLesson,readComparison,esc,fmt,catalog}){
 let observer=null,activeLesson=null,activeComparison=false,comparisonPrefix='compare';
 const focusViews=new Map(),compareViews=new Map(),records=new Map();let exploreCleanups=[];
 const $=s=>main.querySelector(s);
 const micro=createMicroInteractions({main,readLesson,catalog,esc,fmt});
 const text=(node,value)=>{if(node&&node.textContent!==value)node.textContent=value;};
 function observe(nodes){observer?.disconnect();observer=new MutationObserver(refresh);for(const n of nodes.filter(Boolean))observer.observe(n,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-current']});}
 function explore(){
  disconnect();const hero=$('.hero'),map=$('.atlas-map');
  const reference=document.createElement('div');reference.className='edition-reference-heading';reference.innerHTML='<div><div class="kicker">The reference atlas</div><h2>Look up an algorithm.</h2><p>80 entries · Search by name, task, or model family.</p></div>';
  $('#catalog').before(reference);map.setAttribute('aria-label','Filter the reference atlas by learning signal');reference.append(map);
  exploreCleanups.push(mountLessonSlideshow({hero,lessons:[...main.querySelectorAll('.studio-lesson-index>a')].map(a=>({id:a.getAttribute('href').split('/').pop(),name:a.querySelector('span:last-child').textContent})),questions,esc}));
  exploreCleanups.push(mountAtlasGraph({map,root:main,catalog,esc}));
  hero.querySelector('h1').innerHTML='Every model<br>has a way of seeing.';
  hero.querySelector('p').textContent='Explore the mathematics of machine learning. Make a prediction, change one quantity, and follow the evidence.';
  hero.querySelector('h1').classList.add('hero-float-heading');hero.querySelector('p').classList.add('hero-float-copy');
  const curriculum=$('.studio-curriculum');curriculum.querySelector('h2').textContent='Choose a question to follow.';curriculum.querySelector('.kicker').textContent='Three learning journeys';curriculum.querySelector('.studio-section-heading>span').innerHTML='10 interactive lessons · <a href="#/activities">Guided experiments ↗</a>';
  const paths=document.createElement('div');paths.className='edition-journeys';paths.setAttribute('aria-label','Choose a learning journey');paths.innerHTML=journeys.map((j,i)=>`<button class="edition-journey" data-journey="${j.id}" aria-pressed="false"><span class="kicker">0${i+1} · ${esc(j.verb)}</span>${algorithmArt(j.art)}<strong>${esc(j.name)}</strong><span>${esc(j.description)}</span><span class="edition-journey-count">${j.lessons.length} visual ${j.lessons.length===1?'lesson':'lessons'} <span aria-hidden="true">→</span></span></button>`).join('');
  const reset=document.createElement('button');reset.className='edition-all-lessons';reset.textContent='Show all 10 lessons';reset.hidden=true;
  const status=document.createElement('p');status.className='edition-journey-status';status.id='edition-journey-status';status.setAttribute('role','status');status.textContent='All ten interactive lessons · Journeys overlap · Illustrations are schematic';
  const index=$('.studio-lesson-index');index.before(paths,reset,status);
  for(const a of index.querySelectorAll('a')){const id=a.getAttribute('href').split('/').pop();a.dataset.lessonId=id;a.querySelector('svg').outerHTML=algorithmArt(id);const prompt=document.createElement('span');prompt.className='edition-lesson-question';prompt.textContent=questions[id];a.append(prompt);}
  function choose(id){const journey=journeys.find(j=>j.id===id);for(const b of paths.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.journey===id));for(const a of index.querySelectorAll('a'))a.hidden=!!journey&&!journey.lessons.includes(a.dataset.lessonId);reset.hidden=!journey;status.textContent=journey?`${journey.name} · ${journey.lessons.length} ${journey.lessons.length===1?'lesson':'lessons'} · Choose a lesson below`:'All ten interactive lessons · Journeys overlap · Illustrations are schematic';}
  paths.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>choose(b.getAttribute('aria-pressed')==='true'?null:b.dataset.journey)));reset.addEventListener('click',()=>{choose(null);paths.querySelector('button').focus({preventScroll:true});});
 }
 function lesson(id){
  disconnect();activeLesson=id;const stage=$('.stage-wrap'),page=$('.page');
  page.classList.toggle('lesson-focus',!!focusViews.get(id));
  const goal=document.createElement('div');goal.className='edition-challenge';goal.id='edition-challenge';goal.innerHTML=`<div><span class="kicker">The question</span><p>${esc(questions[id])}</p></div><button id="edition-focus" aria-pressed="${!!focusViews.get(id)}">${focusViews.get(id)?'Exit focus':'Focus view'}</button>`;stage.querySelector('.plot-surface').before(goal);
  $('#edition-focus').addEventListener('click',()=>{const on=!page.classList.contains('lesson-focus');page.classList.toggle('lesson-focus',on);focusViews.set(id,on);$('#edition-focus').setAttribute('aria-pressed',String(on));text($('#edition-focus'),on?'Exit focus':'Focus view');redraw();if(on)goal.scrollIntoView({block:'start',behavior:'instant'});});
  const metadata=document.createElement('span');metadata.className='edition-dataset-meta';metadata.id='edition-dataset-meta';stage.querySelector('.stage-head>span').append(metadata);
  const evidence=document.createElement('p');evidence.className='edition-evidence';evidence.id='edition-evidence';evidence.setAttribute('role','status');$('#headline-metrics').after(evidence);
  for(const control of main.querySelectorAll('.controls-panel .control')){
   const input=control.querySelector('[data-param-number],[data-param]'),key=input?.dataset.paramNumber||input?.dataset.param;
   if(key)control.dataset.controlQuantity=key;
   if(key==='slope')control.classList.add('edition-slope');if(key==='intercept')control.classList.add('edition-intercept');
   const range=control.querySelector('[data-param-range]');if(range){const ticks=document.createElement('div');ticks.className='edition-scale';const lo=Number(range.min),hi=Number(range.max),mid=(hi+lo)/2;const value=v=>range.dataset.log==='true'?10**v:v;const precision=v=>Math.abs(v)>0&&Math.abs(v)<.001?v.toExponential(1):fmt(v,3);ticks.innerHTML=[lo,mid,hi].map(v=>`<span>${esc(precision(value(v)))}</span>`).join('');ticks.setAttribute('aria-hidden','true');range.after(ticks);control.querySelector('.bounds').classList.add('sr-only');if(range.dataset.log==='true'){const note=document.createElement('span');note.className='edition-scale-note';note.textContent='Equal steps multiply the value · log scale';ticks.after(note);}}
  }
  $('.controls-panel').addEventListener('focusin',event=>{const control=event.target.closest('[data-control-quantity]');if(!control)return;for(const c of main.querySelectorAll('.edition-quantity-active'))c.classList.remove('edition-quantity-active');control.classList.add('edition-quantity-active');$('#lesson-plot').dataset.activeQuantity=control.dataset.controlQuantity;});
  micro.lesson(id);
  observe([$('#scene-description'),$('.chapter-list'),$('#lesson-metrics'),$('#lesson-plot')]);refresh();
 }
 function metric(result){const m=result?.metrics;if(!m)return null;
  if(m.validation&&Number.isFinite(m.validation.rmse))return {label:'Validation RMSE',value:m.validation.rmse};
  if(m.validation&&Number.isFinite(m.validation.accuracy))return {label:'Validation accuracy',value:m.validation.accuracy,percentage:true};
  if(m.fit&&Number.isFinite(m.fit.inertia))return {label:'Inertia · fitting rows',value:m.fit.inertia};
  if(m.fit&&Number.isFinite(m.fit.rootMeanSquaredReconstructionDistance))return {label:'RMS reconstruction distance',value:m.fit.rootMeanSquaredReconstructionDistance};
  if(m.evaluation&&Number.isFinite(m.evaluation.totalReturn))return {label:'Greedy evaluation return',value:m.evaluation.totalReturn};return null;
 }
 function refreshLesson(){
  const node=$('#edition-evidence');if(!node||!activeLesson)return;const data=readLesson(activeLesson),r=data.result,d=data.dataset;
  const origin=d.imported?'CSV input':d.generator?.recipe?'Generated data':'Frozen example';text($('#edition-dataset-meta'),`${origin} · ${d.X?d.X.length+' observations':d.rows+' × '+d.columns+' grid'}`);
  const state=data.status==='running'?'running':data.current?'current':data.status==='failed'?'failed':data.status==='canceled'?'canceled':r?'earlier':'ready';$('#run-status').dataset.resultState=state;
  if(!data.current){text(node,state==='running'?'Computing from the current settings. The previous result stays separate.':state==='failed'?'The run failed. Inspect the message and adjust the settings before retrying.':state==='canceled'?'Run canceled. No new completed result is reported.':r?'Earlier result retained. Run again to measure the current settings.':'Explore the geometry, then run the model to record a measured result.');return;}
  const measured=metric(r);if(measured&&data.threshold!==undefined)measured.label+=` at threshold ${fmt(data.threshold,2)}`;if(!measured){text(node,'Current completed run · Inspect diagnostics for the full result.');return;}
  const protocol={...r.request};delete protocol.parameters;if(data.threshold!==undefined)protocol.evaluationThreshold=data.threshold;const key=JSON.stringify(protocol),identity=r.configKey+'|'+r.runId;let rec=records.get(key);
  if(!rec||r.runId>rec.latest.runId){rec={latest:{...measured,runId:r.runId,identity},previous:rec?.latest};records.set(key,rec);}
  const value=v=>measured.percentage?fmt(v*100,2)+'%':fmt(v,4);
  let message=`${measured.label}: ${value(measured.value)}. Current completed fit.`;
  if(rec.latest.identity===identity&&rec.previous){const delta=measured.value-rec.previous.value;message=`${measured.label}: ${value(rec.previous.value)} → ${value(measured.value)} (${delta>=0?'+':'−'}${fmt(Math.abs(delta)*(measured.percentage?100:1),4)}${measured.percentage?' percentage points':''}). Compared with your previous completed fit on the same data and protocol.`;}
  if(activeLesson==='kmeans')message+=' Lower inertia alone does not establish a better grouping.';
  if(activeLesson==='q-learning')message+=r.metrics.evaluation.success?' The greedy policy reached the goal.':' The greedy policy did not reach the goal.';
  text(node,message);
 }
 function comparison(key){
  disconnect();activeComparison=true;comparisonPrefix=key==='compare/clustering'?'cluster':'compare';const page=$('.page'),grid=$('.comparison-grid');
  const strip=document.createElement('section');strip.className='edition-comparison-summary';strip.setAttribute('aria-label','Current comparison summary');strip.innerHTML='<div class="edition-pair-values"><div id="edition-value-left"></div><div id="edition-value-right"></div></div><p id="edition-pair-delta" role="status"></p><div class="edition-compare-switch" role="group" aria-label="Comparison view"><button data-compare-view="left">A · First</button><button data-compare-view="right">B · Second</button><button data-compare-view="both">Both · stacked</button></div>';
  grid.before(strip);
  function choose(mode){const top=grid.getBoundingClientRect().top;page.dataset.compareView=mode;compareViews.set(key,mode);strip.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.compareView===mode)));redraw();window.scrollBy({top:grid.getBoundingClientRect().top-top,behavior:'instant'});}
  strip.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>choose(b.dataset.compareView)));page.dataset.compareView=compareViews.get(key)||'left';strip.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.compareView===page.dataset.compareView)));
  observe([$('#comparison-details'),$('#compare-summary'),$('#cluster-summary')]);refresh();
 }
 function refreshComparison(){
  if(!$('#edition-pair-delta'))return;const data=readComparison(),cluster=comparisonPrefix==='cluster',key=cluster?'inertia':'accuracy',label=cluster?'Inertia · fit rows':'Validation accuracy';
  for(const side of ['left','right']){const view=data.sides[side],node=$('#edition-value-'+side),value=view.current&&Number.isFinite(view.metrics?.[key])?fmt(view.metrics[key]*(cluster?1:100),cluster?3:2)+(cluster?'':'%'):'Awaiting current run';const markup=`<span>${side==='left'?'A':'B'} · ${esc(view.name)}</span><strong>${esc(value)}</strong><span>${label}</span>`;if(node.innerHTML!==markup)node.innerHTML=markup;}
  const a=data.sides.left,b=data.sides.right,delta=b.metrics?.[key]-a.metrics?.[key];text($('#edition-pair-delta'),a.current&&b.current&&Number.isFinite(delta)?`B − A: ${delta>=0?'+':'−'}${fmt(Math.abs(delta)*(cluster?1:100),3)}${cluster?' squared coordinate units · Lower inertia alone does not establish a better grouping.':' percentage points · Same validation rows.'}`:'Run both with current settings to compare measured results.');
 }
 function refresh(){micro.refresh();if(activeLesson){refreshLesson();const svg=$('#lesson-plot>svg'),plot=$('#lesson-plot');if(svg){const v=svg.viewBox.baseVal,compact=$('.lesson-focus')&&matchMedia('(max-width:820px)').matches;svg.style.width=compact?Math.min(plot.clientWidth,Math.min(innerHeight*.38,300)*v.width/v.height)+'px':'100%';svg.style.height='auto';svg.style.marginInline='auto';}}if(activeComparison)refreshComparison();}
 function disconnect(){micro.disconnect();exploreCleanups.forEach(fn=>fn());exploreCleanups=[];observer?.disconnect();observer=null;activeLesson=null;activeComparison=false;}
 return {explore,lesson,comparison,refresh,disconnect,page:micro.page};
}
