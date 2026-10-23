import {mountPreviewInstrument} from './preview-instruments.js';
import {algorithmArt} from './algorithm-art.js';

// Every preview is schematic; opening its link runs the real lesson.
export function mountLessonSlideshow({hero,lessons,questions,esc}){
 const box=document.createElement('section');box.className='edition-hero-art lesson-slideshow';box.setAttribute('aria-label','Visual lesson previews');box.setAttribute('aria-roledescription','carousel');
 box.innerHTML=`<div class="lesson-slides">${lessons.map((l,i)=>`<a class="lesson-slide${i===0?' is-current':''}" href="#/lesson/${l.id}" data-slide="${i}" aria-label="${esc(l.name)} · Open interactive lesson" aria-hidden="${i!==0}" tabindex="${i===0?'0':'-1'}"><span class="kicker">${String(i+1).padStart(2,'0')} · ${esc(l.name)}</span>${algorithmArt(l.id)}<span class="edition-art-caption">${esc(questions[l.id])}<span aria-hidden="true">↗</span></span><span class="edition-schematic">Schematic preview · Open the interactive lesson</span></a>`).join('')}</div><div class="lesson-slide-controls"><button type="button" data-slide-action="previous" aria-label="Previous lesson preview">←</button><div class="slide-indicator-stack"><div class="slide-dots" role="group" aria-label="Choose a lesson preview">${lessons.map((l,i)=>`<button type="button" data-slide-to="${i}" aria-label="Show ${esc(l.name)}" ${i===0?'aria-current="true"':''}><span></span></button>`).join('')}</div><span class="slide-position">01 / ${lessons.length}</span></div><button type="button" data-slide-action="next" aria-label="Next lesson preview">→</button></div><span class="sr-only slide-announcement" aria-live="polite"></span>`;
 hero.append(box);
 const slides=[...box.querySelectorAll('.lesson-slide')],dots=[...box.querySelectorAll('[data-slide-to]')];
 let index=0,focused=false,manipulating=false,inView=true,timer=null,disposed=false,start=null,suppressClick=false,clickTimer=null;
 const listen=(node,event,fn)=>{node.addEventListener(event,fn);return ()=>node.removeEventListener(event,fn);};
 const cleanups=[];
 function schedule(){clearTimeout(timer);if(disposed||focused||manipulating||!inView||document.hidden)return;timer=setTimeout(()=>{show(index+1);},3000);}
 function sync(){box.dataset.rotating=String(!focused&&!manipulating&&inView&&!document.hidden);schedule();}
 let instrument;
 function show(next,manual=false){const old=slides[index],moveFocus=old.contains(document.activeElement);index=(next+slides.length)%slides.length;slides.forEach((s,i)=>{s.classList.toggle('is-current',i===index);s.setAttribute('aria-hidden',String(i!==index));s.inert=i!==index;s.tabIndex=i===index?0:-1;});dots.forEach((d,i)=>{if(i===index)d.setAttribute('aria-current','true');else d.removeAttribute('aria-current');});box.querySelector('.slide-position').textContent=String(index+1).padStart(2,'0')+' / '+slides.length;instrument?.select(index);if(manual)box.querySelector('.slide-announcement').textContent=lessons[index].name;if(manual&&moveFocus)slides[index].focus({preventScroll:true});sync();}
 slides.forEach((s,i)=>s.inert=i!==0);
 cleanups.push(listen(box,'click',event=>{const action=event.target.closest('[data-slide-action]')?.dataset.slideAction,dot=event.target.closest('[data-slide-to]');if(action==='previous')show(index-1,true);if(action==='next')show(index+1,true);if(dot)show(Number(dot.dataset.slideTo),true);}));
 // Keep a keyboard-focused lesson link stable until focus leaves it. Controls never stop autoplay.
 const syncFocus=()=>{if(disposed)return;focused=slides.some(s=>s===document.activeElement&&s.matches(':focus-visible'));sync();};
 cleanups.push(listen(box,'focusin',syncFocus),listen(box,'focusout',()=>queueMicrotask(syncFocus)));
 cleanups.push(listen(box,'keydown',event=>{if(event.target.matches('input,select,textarea'))return;if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();show(index+(event.key==='ArrowRight'?1:-1),true);}}));
 const viewport=box.querySelector('.lesson-slides');
 cleanups.push(listen(viewport,'pointerdown',e=>{if(e.button===0&&!e.target.closest('.algorithm-art'))start={x:e.clientX,y:e.clientY};}),listen(viewport,'pointerup',e=>{if(!start)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;start=null;if(Math.abs(dx)>45&&Math.abs(dy)<55){suppressClick=true;clearTimeout(clickTimer);clickTimer=setTimeout(()=>suppressClick=false,350);show(index+(dx<0?1:-1),true);}}),listen(viewport,'pointercancel',()=>start=null));
 const preventSwipeClick=e=>{if(suppressClick){e.preventDefault();e.stopPropagation();suppressClick=false;}};viewport.addEventListener('click',preventSwipeClick,true);cleanups.push(()=>viewport.removeEventListener('click',preventSwipeClick,true));
 cleanups.push(listen(document,'visibilitychange',sync));
 instrument=mountPreviewInstrument({box,slides,lessons,pause:value=>{manipulating=value;sync();}});
 const visibility=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;sync();},{threshold:.15});visibility.observe(box);sync();
 return ()=>{disposed=true;clearTimeout(timer);clearTimeout(clickTimer);visibility.disconnect();instrument.dispose();cleanups.forEach(fn=>fn());};
}

const graphTypes=[
 {id:'supervised',name:'Supervised',caption:'Supplied answers',description:'Learn a mapping from inputs to supplied targets.'},
 {id:'unsupervised',name:'Unsupervised',caption:'Hidden structure',description:'Describe structure in inputs without supplied targets.'},
 {id:'reinforcement',name:'Reinforcement',caption:'Rewards',description:'Learn decisions from interaction and rewards.'},
 {id:'semi-supervised',name:'Semi-supervised',caption:'A few answers',description:'Use labeled and unlabeled observations together.'},
 {id:'self-supervised',name:'Self-supervised',caption:'Data supplies targets',description:'Construct a learning target from the data itself.'}
];

export function mountAtlasGraph({map,root,catalog,esc}){
 const shell=document.createElement('section');shell.className='atlas-network';shell.setAttribute('aria-label','Explore learning signals');map.before(shell);shell.append(map);
 map.setAttribute('aria-label','Interactive learning signal map');map.removeAttribute('viewBox');
 const helper=document.createElement('p');helper.className='atlas-network-help';helper.id='atlas-network-help';helper.textContent='Select a type to filter the atlas. Drag nodes to arrange them. Use arrow keys to explore.';map.setAttribute('aria-describedby',helper.id);
 const panel=document.createElement('div');panel.className='atlas-map-insight';panel.innerHTML='<div class="atlas-map-copy"></div><div class="atlas-map-actions"><button type="button" data-map-action="all">All learning types</button><button type="button" data-map-action="reset">Reset arrangement</button></div>';
 shell.append(helper,panel);
 let width=0,height=0,points=[],drag=null,dragged=false,clickTimer=null,preview=null,disposed=false;
 const tagged=id=>catalog.entries.filter(e=>e.learningTypes.includes(id));
 const selected=()=>root.querySelector('.type-button[aria-pressed=true]')?.dataset.learning||'all';
 const sidebar=id=>root.querySelector(`.type-button[data-learning="${id}"]`);
 function describe(id){const type=graphTypes.find(t=>t.id===id),entries=type?tagged(id):catalog.entries;const markup=type?`<div class="kicker">${esc(type.name)} · ${entries.length} tagged entries</div><p>${esc(type.description)}</p><div class="atlas-map-examples">${entries.slice(0,3).map(e=>`<a href="#/algorithm/${e.id}">${esc(e.name)} <span aria-hidden="true">↗</span></a>`).join('')}</div>`:'<div class="kicker">Five learning signals · 80 entries</div><p>Explore how models obtain a learning signal. Types overlap; their counts are not additive.</p>';const node=panel.querySelector('.atlas-map-copy');if(node.innerHTML!==markup)node.innerHTML=markup;panel.querySelector('[data-map-action=all]').disabled=selected()==='all';}
 function paint(){const active=selected(),highlight=preview||active;for(const type of graphTypes){const node=map.querySelector(`[data-learning="${type.id}"]`);node.setAttribute('aria-pressed',String(active===type.id));node.classList.toggle('is-preview',highlight===type.id);map.querySelector(`[data-map-link="${type.id}"]`).classList.toggle('is-preview',highlight===type.id);}describe(highlight);}
 function position(){points.forEach((p,i)=>{const type=graphTypes[i];map.querySelector(`[data-learning="${type.id}"]`).setAttribute('transform',`translate(${p.x} ${p.y})`);map.querySelector(`[data-map-link="${type.id}"]`).setAttribute('d',`M${width/2} ${height<350?height/2:143}L${p.x} ${p.y}`);});}
 function render(force=false){if(disposed)return;const next=Math.max(260,Math.min(915,shell.clientWidth));if(!force&&Math.abs(next-width)<1)return;const focused=map.contains(document.activeElement)?document.activeElement.dataset.learning:null;width=next;height=width<500?410:width<760?300:307.5;
  const positions=width<500?[[.25,62],[.75,62],[.25,230],[.75,230],[.5,361]]:[[.17,62],[.5,62],[.83,62],[.29,height-60],[.71,height-60]];points=positions.map(([x,y])=>({x:x*width,y}));
  map.setAttribute('viewBox',`0 0 ${width} ${height}`);map.style.height=height+'px';const hubY=height<350?height/2:143;
  map.innerHTML=`<g class="atlas-connections">${graphTypes.map(t=>`<path data-map-link="${t.id}"/>`).join('')}</g><g class="atlas-map-hub"><circle cx="${width/2}" cy="${hubY}" r="6"/><circle class="atlas-hub-ring" cx="${width/2}" cy="${hubY}" r="15"/><text x="${width/2}" y="${hubY+33}" text-anchor="middle">Learning signal</text></g>${graphTypes.map(t=>`<g class="atlas-map-node" role="button" tabindex="0" data-learning="${t.id}" aria-label="Filter ${esc(t.name)}, ${tagged(t.id).length} entries" aria-pressed="${selected()===t.id}"><rect class="atlas-node-hit" x="${width<500?-65:-77}" y="-37" width="${width<500?130:154}" height="77" rx="8"/><circle class="map-dot" cy="-4" r="5"/><text class="atlas-node-title" y="-18" text-anchor="middle">${esc(t.name)}</text><text class="atlas-node-caption" y="17" text-anchor="middle">${esc(t.caption)}</text><text class="atlas-node-count" y="33" text-anchor="middle">${tagged(t.id).length} entries</text></g>`).join('')}`;
  position();paint();if(focused)map.querySelector(`[data-learning="${focused}"]`)?.focus({preventScroll:true});
 }
 const nodeFrom=e=>e.target.closest?.('[data-learning]');
 function filter(id){const value=selected()===id?'all':id;preview=null;sidebar(value).click();paint();}
 const click=e=>{const node=nodeFrom(e);if(!node)return;if(dragged){dragged=false;return;}filter(node.dataset.learning);};
 const over=e=>{const n=nodeFrom(e);if(n){preview=n.dataset.learning;paint();}};
 const leave=()=>{if(!drag){preview=null;paint();}};
 const down=e=>{const node=nodeFrom(e);if(!node||e.button!==0)return;const i=graphTypes.findIndex(t=>t.id===node.dataset.learning);drag={i,x:e.clientX,y:e.clientY,original:{...points[i]},moved:false};};
 const move=e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(!drag.moved&&Math.hypot(dx,dy)<6)return;drag.moved=true;if(!map.hasPointerCapture(e.pointerId))map.setPointerCapture(e.pointerId);map.classList.add('is-dragging');const r=map.getBoundingClientRect();points[drag.i]={x:Math.max(67,Math.min(width-67,drag.original.x+dx*width/r.width)),y:Math.max(41,Math.min(height-43,drag.original.y+dy*height/r.height))};position();};
 const up=e=>{if(!drag)return;dragged=drag.moved;drag=null;map.classList.remove('is-dragging');if(map.hasPointerCapture(e.pointerId))map.releasePointerCapture(e.pointerId);clearTimeout(clickTimer);clickTimer=setTimeout(()=>dragged=false,350);};
 const key=e=>{const node=nodeFrom(e);if(!node)return;const i=graphTypes.findIndex(t=>t.id===node.dataset.learning);if(e.key==='Enter'||e.key===' '){e.preventDefault();filter(node.dataset.learning);}else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?4:(i+(['ArrowRight','ArrowDown'].includes(e.key)?1:4))%5;map.querySelector(`[data-learning="${graphTypes[next].id}"]`).focus();}};
 const sidebarClick=e=>{if(e.target.closest('.type-button')){preview=null;paint();}};
 const action=e=>{const a=e.target.closest('[data-map-action]')?.dataset.mapAction;if(a==='reset')render(true);if(a==='all'){preview=null;sidebar('all').click();paint();}};
 map.addEventListener('click',click);map.addEventListener('pointerover',over);map.addEventListener('pointerleave',leave);map.addEventListener('focusin',over);map.addEventListener('focusout',leave);map.addEventListener('pointerdown',down);map.addEventListener('pointermove',move);map.addEventListener('pointerup',up);map.addEventListener('pointercancel',up);map.addEventListener('keydown',key);root.addEventListener('click',sidebarClick);panel.addEventListener('click',action);
 const resize=new ResizeObserver(()=>render());resize.observe(shell);render();
 return ()=>{disposed=true;clearTimeout(clickTimer);resize.disconnect();root.removeEventListener('click',sidebarClick);};
}
