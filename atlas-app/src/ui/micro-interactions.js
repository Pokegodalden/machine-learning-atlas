import {algorithmArt} from './algorithm-art.js';
const ns='http://www.w3.org/2000/svg',bookmarkKey='mla:bookmarks:v1';
const bookmarkIcon='<svg viewBox="0 0 20 24" aria-hidden="true"><path d="M4 3H16V21L10 17L4 21Z" pathLength="100"/></svg>';
export function createMicroInteractions({main,readLesson,catalog,esc,fmt}){
 let cleanups=[],ghost=null,ghostTimer=null,saveTimer=null,guess=null,lessonId=null;
 const entries=new Map(catalog.entries.map(e=>[e.id,e]));
 function listen(node,event,fn,options){node.addEventListener(event,fn,options);cleanups.push(()=>node.removeEventListener(event,fn,options));}
 function bookmarks(){const raw=localStorage.getItem(bookmarkKey);if(!raw)return [];const parsed=JSON.parse(raw);if(!Array.isArray(parsed)||parsed.some(id=>typeof id!=='string'))throw Error('Saved ideas could not be read.');return [...new Set(parsed)].filter(id=>entries.has(id));}
 function confirm(button){if(!button)return;if(!button.querySelector('svg'))button.insertAdjacentHTML('afterbegin',bookmarkIcon);button.classList.remove('just-saved');void button.offsetWidth;button.classList.add('just-saved');clearTimeout(saveTimer);saveTimer=setTimeout(()=>button.classList.remove('just-saved'),1600);}
 function mountBookmark(id){
  const heading=main.querySelector('h1');if(!heading||!entries.has(id))return;
  const row=document.createElement('div');row.className='idea-title';heading.before(row);row.append(heading);
  const button=document.createElement('button');button.type='button';button.className='bookmark-idea';button.id='bookmark-idea';row.append(button);
  const status=document.createElement('p');status.className='bookmark-status';status.setAttribute('role','status');row.after(status);
  function paint(){try{const saved=bookmarks().includes(id);button.innerHTML=bookmarkIcon+`<span>${saved?'Saved':'Save idea'}</span>`;button.setAttribute('aria-pressed',String(saved));button.setAttribute('aria-label',(saved?'Remove saved idea: ':'Save idea: ')+entries.get(id).name);}catch{button.innerHTML=bookmarkIcon+'<span>Save idea</span>';button.setAttribute('aria-pressed','false');status.textContent='Saved ideas are unavailable in this browser.';}}
  paint();listen(button,'click',()=>{try{const ids=bookmarks(),saved=ids.includes(id),next=saved?ids.filter(x=>x!==id):[...ids,id];localStorage.setItem(bookmarkKey,JSON.stringify(next));paint();status.textContent=saved?'Idea removed from Saved.':'Idea saved. Find it in Saved.';if(!saved)confirm(button);}catch{status.textContent='Could not save this idea. Browser storage may be unavailable.';}});
 }
 function library(){
  const intro=main.querySelector('.library-intro');if(!intro)return;const section=document.createElement('section');section.className='saved-ideas';section.setAttribute('aria-label','Saved ideas');intro.after(section);
  function paint(){try{const ids=bookmarks();section.innerHTML='<h2>Your saved ideas</h2>'+(ids.length?'<div class="saved-idea-list">'+ids.map(id=>`<article><a href="#/${['linear-regression','knn','logistic-regression','decision-tree','random-forest','svm','kmeans','pca','mlp','q-learning'].includes(id)?'lesson':'algorithm'}/${id}">${esc(entries.get(id).name)} <span aria-hidden="true">↗</span></a><button type="button" data-remove-idea="${esc(id)}" aria-label="Remove ${esc(entries.get(id).name)} from saved ideas">×</button></article>`).join('')+'</div>':'<p class="small muted">Use “Save idea” on a lesson or algorithm to keep its place here.</p>');}catch{section.innerHTML='<h2>Your saved ideas</h2><p role="status">Saved ideas could not be read in this browser.</p>';}}
  paint();listen(section,'click',e=>{const b=e.target.closest('[data-remove-idea]');if(!b)return;try{const ids=bookmarks().filter(id=>id!==b.dataset.removeIdea);localStorage.setItem(bookmarkKey,JSON.stringify(ids));paint();section.tabIndex=-1;section.focus({preventScroll:true});}catch{section.insertAdjacentHTML('beforeend','<p role="status">Could not remove this idea.</p>');}});
 }
 function relationships(id){
  const from=entries.get(id);if(!from)return;
  for(const link of main.querySelectorAll('.detail-side a[href^="#/algorithm/"]')){
   const target=entries.get(link.getAttribute('href').split('/').pop());if(!target)continue;
   const row=document.createElement('div');row.className='relationship-row';link.before(row);row.append(link);
   const button=document.createElement('button');button.type='button';button.className='relationship-toggle';button.setAttribute('aria-label','Preview connection to '+target.name);button.setAttribute('aria-expanded','false');button.textContent='↔';
   const preview=document.createElement('div');preview.className='relationship-preview';preview.id='relationship-'+target.id;preview.hidden=true;button.setAttribute('aria-controls',preview.id);
   preview.innerHTML=`<div class="relationship-art">${algorithmArt(id)}<span aria-hidden="true">→</span>${algorithmArt(target.id)}</div><strong>${esc(from.name)} → ${esc(target.name)}</strong><p>${esc(target.intuition)}</p><span class="preview-hint">Schematic connection · Open the linked explanation</span>`;row.append(button,preview);
   let pinned=false;const show=value=>{preview.hidden=!value;button.setAttribute('aria-expanded',String(value));};
   listen(row,'pointerenter',e=>{if(e.pointerType==='mouse')show(true);});listen(row,'pointerleave',()=>{if(!pinned&&!row.contains(document.activeElement))show(false);});listen(row,'focusin',()=>show(true));listen(row,'focusout',()=>queueMicrotask(()=>{if(row.isConnected&&!pinned&&!row.contains(document.activeElement))show(false);}));listen(button,'click',()=>{pinned=!pinned;show(pinned);});listen(row,'keydown',e=>{if(e.key==='Escape'){pinned=false;show(false);button.focus({preventScroll:true});show(false);}});
  }
 }
 function quantity(){
  const plot=main.querySelector('#lesson-plot');if(!plot)return;
  const activate=key=>{if(key)plot.dataset.activeQuantity=key;else delete plot.dataset.activeQuantity;main.querySelectorAll('[data-control-quantity]').forEach(c=>c.classList.toggle('edition-quantity-active',c.dataset.controlQuantity===key));};
  const keyFor=e=>e.target.closest('[data-quantity]')?.dataset.quantity||e.target.closest('[data-control-quantity]')?.dataset.controlQuantity;
  listen(main,'pointerover',e=>{const key=keyFor(e);if(key)activate(key);});listen(main,'pointerout',e=>{if(!keyFor(e))return;const next=e.relatedTarget;if(next&&main.contains(next)&&(next.closest('[data-quantity]')||next.closest('[data-control-quantity]')))return;const focus=document.activeElement;activate(focus?.closest('[data-quantity]')?.dataset.quantity||focus?.closest('[data-control-quantity]')?.dataset.controlQuantity);});
  listen(main,'focusin',e=>{const key=keyFor(e);if(key)activate(key);});
 }
 function coordinates(svg){const v=svg.viewBox.baseVal,xmin=+svg.dataset.xmin,xmax=+svg.dataset.xmax,ymin=+svg.dataset.ymin,ymax=+svg.dataset.ymax;if(![xmin,xmax,ymin,ymax].every(Number.isFinite))return null;return {xmin,xmax,ymin,ymax,w:v.width,h:v.height,px:x=>48+(x-xmin)/(xmax-xmin)*(v.width-70),py:y=>v.height-41-(y-ymin)/(ymax-ymin)*(v.height-65)};}
 function overlay(){
  if(lessonId!=='linear-regression')return;const plot=main.querySelector('#lesson-plot'),svg=plot?.querySelector('svg'),c=svg&&coordinates(svg);if(!c)return;
  let markup='';
  if(ghost)markup+=`<path class="ghost-line" d="M${c.px(c.xmin)} ${c.py(ghost.slope*c.xmin+ghost.intercept)}L${c.px(c.xmax)} ${c.py(ghost.slope*c.xmax+ghost.intercept)}"><title>Previous displayed line</title></path>`;
  if(guess){const x=c.px(guess.x),y=c.py(guess.value);markup+=`<path class="guess-marker" d="M${x} ${y-7}L${x+7} ${y}L${x} ${y+7}L${x-7} ${y}Z"/>`;if(guess.revealed){const answer=guess.answer,ay=c.py(answer);markup+=`<line class="guess-gap" x1="${x}" x2="${x}" y1="${y}" y2="${ay}"/><circle class="guess-answer" cx="${x}" cy="${ay}" r="5"/>`;}}
  let g=svg.querySelector('.v22-overlay');if(!markup){g?.remove();return;}if(!g){g=document.createElementNS(ns,'g');g.classList.add('v22-overlay');g.setAttribute('aria-hidden','true');g.setAttribute('clip-path','url(#clip-line)');svg.append(g);}if(g._markup!==markup){g._markup=markup;g.innerHTML=markup;}
 }
 function mountGuess(){
  const surface=main.querySelector('.plot-surface'),panel=document.createElement('details');panel.className='guess-panel';panel.innerHTML='<summary>Make a guess <span>Where will the line predict?</span></summary><div class="guess-body"><p class="guess-question"></p><label for="guess-value">Your predicted y</label><div class="guess-inputs"><input id="guess-value" type="number" step="any"><input id="guess-range" type="range" step="any" aria-label="Place your prediction marker"><button type="button" class="reveal-guess">Reveal prediction</button></div><p class="guess-result" role="status">Place the gold diamond on the chart or adjust its value.</p><button type="button" class="guess-again" hidden>Try again</button></div>';surface.after(panel);
  const number=panel.querySelector('#guess-value'),range=panel.querySelector('#guess-range'),result=panel.querySelector('.guess-result');
  function begin(){if(!surface.querySelector('.candidate-line'))main.querySelector('[data-beat="1"]')?.click();const data=readLesson(lessonId),svg=surface.querySelector('svg'),c=coordinates(svg),rows=[...data.dataset.partitions.train,...data.dataset.partitions.validation],row=rows.includes(data.selectedRow)?data.selectedRow:rows[0];guess={row,x:data.dataset.X[row][0],value:Number(((c.ymin+c.ymax)/2).toFixed(3)),signature:signature(data),revealed:false};surface.classList.add('guess-active');panel.querySelector('.guess-question').textContent=`At x = ${fmt(guess.x,3)}, where do you expect the displayed line to predict?`;for(const input of [range,number]){input.min=c.ymin;input.max=c.ymax;input.value=guess.value;}number.disabled=range.disabled=false;panel.querySelector('.reveal-guess').hidden=false;panel.querySelector('.guess-again').hidden=true;result.textContent='Place the gold diamond on the chart or adjust its value.';overlay();}
  function set(value){if(!guess&&panel.open)begin();if(!guess||guess.revealed||!Number.isFinite(value))return;guess.value=Number(Math.min(+range.max,Math.max(+range.min,value)).toFixed(3));number.value=range.value=guess.value;overlay();}
  listen(panel,'toggle',()=>{if(panel.open){if(!guess)begin();}else{guess=null;surface.classList.remove('guess-active');overlay();}});listen(range,'input',()=>set(range.valueAsNumber));listen(number,'input',()=>{if(Number.isFinite(number.valueAsNumber))set(number.valueAsNumber);});
  listen(main,'click',e=>{if(!guess||guess.revealed||!e.target.closest('#lesson-plot svg'))return;const svg=surface.querySelector('svg'),c=coordinates(svg),matrix=svg.getScreenCTM();if(!matrix)return;const point=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());if(point.x<48||point.x>c.w-22||point.y<24||point.y>c.h-41)return;e.preventDefault();e.stopImmediatePropagation();set(c.ymin+(c.h-41-point.y)/(c.h-65)*(c.ymax-c.ymin));},true);
  listen(panel.querySelector('.reveal-guess'),'click',()=>{if(!guess)return;const data=readLesson(lessonId);guess.answer=data.parameters.slope*guess.x+data.parameters.intercept;guess.revealed=true;surface.classList.remove('guess-active');number.disabled=range.disabled=true;panel.querySelector('.reveal-guess').hidden=true;panel.querySelector('.guess-again').hidden=false;result.textContent=`Your guess: ${fmt(guess.value,3)}. Displayed line: ${fmt(guess.answer,3)}. Absolute gap: ${fmt(Math.abs(guess.value-guess.answer),3)}. Cyan circle = line prediction; gold diamond = your guess.`;overlay();});listen(panel.querySelector('.guess-again'),'click',begin);
 }
 const signature=data=>JSON.stringify([data.dataset.revision,data.parameters.slope,data.parameters.intercept,data.selectedRow]);
 function lesson(id){
  lessonId=id;mountBookmark(id);quantity();listen(main,'atlas:saved',e=>confirm(e.detail.button));
  if(id==='linear-regression'){
   mountGuess();listen(main,'input',e=>{const input=e.target;if(!input.matches('[data-param-number="slope"],[data-param-number="intercept"],[data-param-range="slope"],[data-param-range="intercept"]'))return;if(!ghost)ghost={...readLesson(id).parameters};clearTimeout(ghostTimer);ghostTimer=setTimeout(()=>{ghost=null;overlay();},2100);},true);
   listen(main,'pointerdown',e=>{if(!e.target.closest('[data-dial="intercept"]'))return;if(!ghost)ghost={...readLesson(id).parameters};clearTimeout(ghostTimer);ghostTimer=setTimeout(()=>{ghost=null;overlay();},2100);},true);
   listen(main,'pointermove',e=>{if(!ghost||!e.buttons||!e.target.closest('[data-dial="intercept"]'))return;clearTimeout(ghostTimer);ghostTimer=setTimeout(()=>{ghost=null;overlay();},2100);},true);
   listen(main,'keydown',e=>{if(!e.target.closest('[data-dial="intercept"]')||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;if(!ghost)ghost={...readLesson(id).parameters};clearTimeout(ghostTimer);ghostTimer=setTimeout(()=>{ghost=null;overlay();},2100);},true);
  }
  refresh();
 }
 function refresh(){
  if(!lessonId)return;
  const data=readLesson(lessonId);for(const input of main.querySelectorAll('[data-param-number]')){const lo=+input.min,hi=+input.max,value=data.parameters[input.dataset.paramNumber],range=input.closest('.control').querySelector('[data-param-range]'),log=range?.dataset.log==='true';if(Number.isFinite(value)&&hi>lo)input.parentElement.style.setProperty('--scrub-level',Math.max(0,Math.min(100,100*(log?(Math.log10(value)-Math.log10(lo))/(Math.log10(hi)-Math.log10(lo)):(value-lo)/(hi-lo)))));}
  if(lessonId==='linear-regression'){const panel=main.querySelector('.guess-panel');if(panel){if(guess&&guess.signature!==signature(data)){guess=null;panel.open=false;main.querySelector('.plot-surface').classList.remove('guess-active');panel.querySelector('.guess-result').textContent='The selected observation or line changed. Make another guess.';}}overlay();}
 }
 function page(section,id){if(section==='algorithm'){mountBookmark(id);relationships(id);}else if(section==='library')library();}
 function disconnect(){cleanups.forEach(fn=>fn());cleanups=[];clearTimeout(ghostTimer);clearTimeout(saveTimer);ghost=null;guess=null;lessonId=null;}
 return {lesson,refresh,page,disconnect};
}
