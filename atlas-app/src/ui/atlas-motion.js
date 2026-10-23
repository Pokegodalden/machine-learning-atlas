import {paintMathArt} from './art-geometry.js';
// A single observer pair and one animation frame loop serve every route and icon.
export function createAtlasMotion(main){
 const reduced=matchMedia('(prefers-reduced-motion:reduce)'),icons=new Set(),reveals=new Set(),running=new Map(),entrances=new Map();let frame=null,scanFrame=null,disposed=false;
 const isMath=svg=>['linear-regression','pca'].includes(svg.dataset.artId);
 const isCarousel=svg=>!!svg.closest('.lesson-slideshow');
 function stop(svg,finish=true){running.delete(svg);svg.classList.remove('is-icon-playing');svg.dataset.iconRunning='false';if(finish&&isMath(svg)&&!isCarousel(svg))paintMathArt(svg,svg.dataset.artId,1);}
 function play(svg){
  if(disposed||reduced.matches||document.hidden||!svg?.isConnected||svg.closest('[hidden],.lesson-slide:not(.is-current)'))return;
  if(isCarousel(svg)&&isMath(svg))return; // Its accessible fit-progress control owns this animation.
  stop(svg,false);svg.classList.remove('is-icon-playing');void svg.getBoundingClientRect();svg.classList.add('is-icon-playing');svg.dataset.iconRunning='true';svg.dataset.iconPlays=String(Number(svg.dataset.iconPlays||0)+1);running.set(svg,{start:null,duration:isMath(svg)?1400:1100});
  if(isMath(svg))paintMathArt(svg,svg.dataset.artId,0);if(frame===null)frame=requestAnimationFrame(tick);
 }
 function tick(time){frame=null;for(const [svg,job] of running){if(!svg.isConnected||document.hidden||reduced.matches){stop(svg);continue;}if(job.start===null)job.start=time;const p=Math.min(1,(time-job.start)/job.duration);if(isMath(svg))paintMathArt(svg,svg.dataset.artId,1-(1-p)**3);if(p===1)stop(svg);}if(running.size)frame=requestAnimationFrame(tick);}
 const iconObserver=new IntersectionObserver(entries=>{for(const {target,isIntersecting} of entries){if(isIntersecting){if(target.dataset.iconEntered!=='true'){target.dataset.iconEntered='true';play(target);}}else stop(target);}},{threshold:.15});
 function reveal(node,instant=false){
  if(node.dataset.scrollReveal==='done')return;node.dataset.scrollReveal='done';node.classList.remove('scroll-waiting');revealObserver.unobserve(node);
  if(instant||reduced.matches)return;
  node.classList.add('scroll-entering');
  const animation=node.animate([{opacity:0,translate:'0 16px'},{opacity:1,translate:'0 0'}],{duration:620,easing:'cubic-bezier(.2,.7,.2,1)'});entrances.set(node,animation);animation.finished.catch(()=>{}).finally(()=>{entrances.delete(node);node.classList.remove('scroll-entering');});
 }
 const revealObserver=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting)reveal(entry.target);},{threshold:0,rootMargin:'0px 0px -12px 0px'});
 const revealSelector='h1,h2,h3,h4,.kicker,.hero p,.lesson-heading p,.compare-heading p,.library-intro,.detail-lead,.library-policy,.edition-reference-heading>div>p,.studio-section-heading>span,section,article,.edition-journey,.studio-lesson-index>a,.detail-block';
 function eligible(node){
  if(node.closest('.lesson-slides,.preview-instrument,.relationship-preview,.app-header,[hidden]'))return false;
  if(node.matches('.hero-float-heading,.hero-float-copy'))return false; // Existing page-entry animation is retained.
  if(node.matches('section,article')&&(node.querySelector('#lesson-plot,.compare-plot,.controls-panel,.catalog-grid,section')||node.matches('.hero,.studio-curriculum,.stage-wrap,.compare-card')))return false;
  if(node.matches('section')&&node.getBoundingClientRect().height>innerHeight*.85)return false;
  // One motion per visual block avoids multiplying nested translations.
  if(node.parentElement.closest('[data-scroll-reveal]'))return false;
  return true;
 }
 function scan(){
  scanFrame=null;if(disposed)return;
  for(const node of icons)if(!node.isConnected){iconObserver.unobserve(node);stop(node);icons.delete(node);}
  for(const node of reveals)if(!node.isConnected){revealObserver.unobserve(node);entrances.get(node)?.cancel();reveals.delete(node);}
  for(const svg of main.querySelectorAll('svg.algorithm-art,svg.mini-glyph')){
   if(icons.has(svg))continue;icons.add(svg);svg.dataset.iconMotion='ready';
   if(!isMath(svg))for(const path of svg.querySelectorAll(svg.matches('.mini-glyph:not(.algorithm-art)')?'path':'.art-gold')){path.classList.add('icon-trace');path.setAttribute('pathLength','100');}
   if(isCarousel(svg)){if(svg.closest('.is-current'))play(svg);}else iconObserver.observe(svg);
  }
  for(const node of main.querySelectorAll(revealSelector)){
   if(reveals.has(node)||!eligible(node))continue;reveals.add(node);node.dataset.scrollReveal='waiting';
   if(reduced.matches||node.getBoundingClientRect().bottom<0){reveal(node,true);continue;}
   node.classList.add('scroll-waiting');revealObserver.observe(node);
  }
 }
 function queueScan(){if(scanFrame===null)scanFrame=requestAnimationFrame(scan);}
 const mutations=new MutationObserver(queueScan);mutations.observe(main,{childList:true,subtree:true});
 function owner(event){return event.target.closest('.algorithm-card,.edition-journey,.studio-lesson-index>a,.relationship-row,.detail-heading');}
 function replay(event){const block=owner(event);if(!block||event.relatedTarget&&block.contains(event.relatedTarget))return;for(const svg of block.querySelectorAll('svg.algorithm-art,svg.mini-glyph'))play(svg);}
 function focus(event){for(let n=event.target;n&&n!==main;n=n.parentElement){if(n.dataset.scrollReveal==='waiting')reveal(n,true);entrances.get(n)?.finish();}replay(event);}
 const iconReplay=event=>{if(event.target.matches('svg'))play(event.target);};
 function visibility(){if(document.hidden){for(const svg of running.keys())stop(svg);cancelAnimationFrame(frame);frame=null;} }
 function preference(){if(reduced.matches){for(const svg of running.keys())stop(svg);for(const [node,animation] of entrances){animation.finish();entrances.delete(node);}for(const node of reveals)if(node.dataset.scrollReveal==='waiting')reveal(node,true);cancelAnimationFrame(frame);frame=null;}}
 main.addEventListener('pointerover',replay);main.addEventListener('focusin',focus);main.addEventListener('atlas:icon-replay',iconReplay);document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',preference);
 scan();
 return {scan:queueScan,dispose(){disposed=true;mutations.disconnect();iconObserver.disconnect();revealObserver.disconnect();cancelAnimationFrame(frame);cancelAnimationFrame(scanFrame);for(const svg of running.keys())stop(svg);for(const animation of entrances.values())animation.cancel();main.removeEventListener('pointerover',replay);main.removeEventListener('focusin',focus);main.removeEventListener('atlas:icon-replay',iconReplay);document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',preference);}};
}
