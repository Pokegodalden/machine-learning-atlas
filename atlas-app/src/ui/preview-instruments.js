import {paintMathArt} from './art-geometry.js';
// Small schematic experiments; these controls never train a model.
const specs={
 'linear-regression':['Fit the line',0,100,100,'%'],knn:['Neighborhood radius',16,65,37,''],
 'logistic-regression':['Move the decision threshold',-25,25,0,''],
 'decision-tree':['Move the first split',35,100,70,''],
 'random-forest':['Inspect a tree',1,3,2,''],svm:['Margin width',8,40,24,''],
 kmeans:['Move the second center',125,185,159,''],pca:['Find the principal direction',0,100,100,'%'],
 mlp:['Inspect a hidden unit',1,4,2,''],'q-learning':['Trace the route',0,100,60,'%']
};
export function mountPreviewInstrument({box,slides,lessons,pause}){
 const area=document.createElement('div');area.className='preview-instrument';
 area.innerHTML='<label for="preview-quantity"><span class="preview-label"></span><output for="preview-quantity"></output></label><input id="preview-quantity" type="range" step="1"><span class="preview-hint">Drag the diagram or adjust the slider · schematic</span>';
 box.querySelector('.lesson-slide-controls').before(area);
 const input=area.querySelector('input'),label=area.querySelector('.preview-label'),output=area.querySelector('output'),values=new Map();let current=0,drag=null,suppress=false,disposed=false,tween=null,tweenStart=null;
 const reduced=matchMedia('(prefers-reduced-motion:reduce)');
 function stopTween(){cancelAnimationFrame(tween);tween=null;tweenStart=null;}
 const listeners=[],listen=(node,event,fn,options)=>{node.addEventListener(event,fn,options);listeners.push(()=>node.removeEventListener(event,fn,options));};
 function paint(){const id=lessons[current].id,spec=specs[id],value=Number(input.value),svg=slides[current].querySelector('svg');values.set(id,value);output.value=value+spec[4];input.setAttribute('aria-valuetext',label.textContent+': '+output.value);
  if(id==='linear-regression'||id==='pca')paintMathArt(svg,id,value/100);
  if(id==='knn')svg.querySelector('.art-neighborhood').setAttribute('r',value);
  if(id==='logistic-regression')svg.querySelector('[stroke-dasharray]').setAttribute('transform',`translate(0 ${value})`);
  if(id==='decision-tree')svg.querySelector('.art-axis').setAttribute('d',`M18 17H126V104H18ZM${value} 17V104M${value} 60H126`);
  if(id==='random-forest')svg.querySelectorAll('g[transform]').forEach((g,i)=>g.style.opacity=i===value-1?'1':'.25');
  if(id==='svm')svg.querySelector('.art-margin').setAttribute('d',`M${65-value} 105L${145-value} 14M${65+value} 105L${145+value} 14`);
  if(id==='kmeans'){svg.querySelectorAll('ellipse')[1].setAttribute('cx',value);svg.querySelector('.art-gold').setAttribute('d',`M40 37H56M48 29V45M${value-8} 79H${value+8}M${value} 71V87`);}
  if(id==='mlp'){const nodes=svg.querySelectorAll('circle');nodes.forEach((n,i)=>{n.style.opacity=i>=3&&i<7&&i!==value+2?'.25':'1';n.setAttribute('r',i===value+2?'5':i===7?'7':'3');});}
  if(id==='q-learning'){const path=svg.querySelector('.art-gold'),length=path.getTotalLength();path.style.strokeDasharray=length;path.style.strokeDashoffset=length*(1-value/100);}
 }
 function animateFit(time){if(disposed||document.hidden||!box.getBoundingClientRect().height)return;const svg=slides[current].querySelector('svg'),r=svg.getBoundingClientRect();if(r.bottom<0||r.top>innerHeight){input.value=100;paint();tween=null;return;}if(tweenStart===null)tweenStart=time;const t=Math.min(1,(time-tweenStart)/1400);input.value=Math.round((1-(1-t)**3)*100);paint();if(t<1)tween=requestAnimationFrame(animateFit);else tween=null;}
 function select(index){stopTween();current=index;const id=lessons[index].id,spec=specs[id];label.textContent=spec[0];input.min=spec[1];input.max=spec[2];input.value=values.get(id)??spec[3];input.setAttribute('aria-label',spec[0]+' · schematic preview');if((id==='linear-regression'||id==='pca')&&!reduced.matches){input.value=0;paint();tween=requestAnimationFrame(animateFit);}else paint();slides[current].querySelector('svg').dispatchEvent(new CustomEvent('atlas:icon-replay',{bubbles:true}));}
 const interrupt=()=>stopTween();
 listen(input,'keydown',interrupt);listen(input,'pointerdown',interrupt);listen(input,'focus',interrupt);
 listen(reduced,'change',()=>{stopTween();if(reduced.matches&&(lessons[current].id==='linear-regression'||lessons[current].id==='pca')){input.value=100;paint();}});
 listen(document,'visibilitychange',()=>{if(document.hidden)stopTween();});
 listen(input,'input',()=>{stopTween();paint();});listen(input,'focus',()=>pause(true));listen(input,'blur',()=>pause(false));
 listen(input,'pointerdown',()=>pause(true));listen(input,'pointerup',()=>pause(input.matches(':focus-visible')));listen(input,'pointercancel',()=>pause(false));
 for(const [i,slide] of slides.entries()){
  const svg=slide.querySelector('svg');
  listen(svg,'pointerdown',e=>{if(e.button!==0)return;stopTween();drag={i,x:e.clientX,value:Number(input.value),pointer:e.pointerId,moved:false};pause(true);});
  listen(svg,'pointermove',e=>{if(!drag||drag.i!==current||e.pointerId!==drag.pointer)return;const dx=e.clientX-drag.x;if(!drag.moved&&Math.abs(dx)<5)return;drag.moved=true;svg.setPointerCapture(e.pointerId);const spec=specs[lessons[current].id];input.value=Math.round(Math.max(spec[1],Math.min(spec[2],drag.value+dx/svg.getBoundingClientRect().width*(spec[2]-spec[1]))));paint();});
  const end=()=>{if(!drag)return;suppress=drag.moved;drag=null;pause(false);};listen(svg,'pointerup',end);listen(svg,'pointercancel',()=>{drag=null;pause(false);});listen(svg,'lostpointercapture',end);
  listen(slide,'click',e=>{if(suppress){e.preventDefault();e.stopPropagation();suppress=false;}},true);
 }
 const cancel=()=>{drag=null;pause(false);};listen(window,'pointerup',cancel);listen(window,'blur',cancel);
 select(0);
 return {select,dispose(){disposed=true;stopTween();listeners.forEach(fn=>fn());area.remove();}};
}
