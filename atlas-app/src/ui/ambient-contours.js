import {createContourLoop} from './contour-loop.js';
// Decorative landscape and cursor iterates. Neither reads nor changes model data.
export function mountAmbientContours(){
 if(document.querySelector('.ambient-contours'))return {dispose(){}};
 const newCanvas=()=>{const node=document.createElement('canvas');node.className='ambient-contours';node.setAttribute('aria-hidden','true');return node;};
 let canvas=newCanvas();document.body.prepend(canvas);
 const ns='http://www.w3.org/2000/svg',cursor=document.createElementNS(ns,'svg');cursor.classList.add('descent-cursor');cursor.setAttribute('aria-hidden','true');cursor.setAttribute('focusable','false');
 cursor.innerHTML='<g class="descent-trace"><path class="descent-connection"/><circle class="descent-step" r="3.1"/><circle class="descent-step" r="3.5"/><circle class="descent-step" r="3.9"/></g>';document.body.append(cursor);
 const reduced=matchMedia('(prefers-reduced-motion:reduce)'),trace=cursor.querySelector('g'),nodes=[...cursor.querySelectorAll('circle')],path=cursor.querySelector('path');
 let worker=null,loop=null,startup=null,width=0,height=0,ratio=1,raf=null,lastTime=null,clock=0,disposed=false,suspended=false,pressed=false,epoch=0,pointerSent=0;
 let pointer={x:0,y:0,inside:false,time:-Infinity},position={x:0,y:0};
 const listeners=[],listen=(node,event,fn,options)=>{node.addEventListener(event,fn,options);listeners.push(()=>node.removeEventListener(event,fn,options));};
 const mode=()=>document.hidden||suspended?'paused':reduced.matches?'still':'animated';
 const send=data=>{if(worker)worker.postMessage(data);else loop?.message(data);};
 function receive(data){if(disposed)return;if(data.type==='state'&&data.epoch===epoch){canvas.dataset.motion=data.mode;canvas.dataset.frames=String(data.frames);canvas.dataset.renderMs=String(data.cost);}}
 function viewport(){return {type:'resize',width,height,ratio};}
 function fallback(){
  if(disposed)return;clearTimeout(startup);worker?.terminate();worker=null;loop?.message({type:'dispose'});loop=null;
  // A transferred canvas cannot regain a main-thread context; replace it on failure.
  const replacement=newCanvas();canvas.replaceWith(replacement);canvas=replacement;canvas.dataset.renderer='main';
  try{loop=createContourLoop(canvas,receive);send(viewport());send({type:'motion',mode:mode(),epoch});}
  catch{canvas.remove();stopCursor();}
 }
 function startRenderer(){
  if(typeof Worker==='undefined'||typeof canvas.transferControlToOffscreen!=='function'){fallback();return;}
  try{
   worker=new Worker(new URL('./contour.worker.js',import.meta.url),{type:'module'});canvas.dataset.renderer='worker';
   const activeWorker=worker;
   worker.onmessage=({data})=>{if(worker!==activeWorker)return;if(data.type==='failed'){fallback();return;}if(data.type==='ready'){clearTimeout(startup);return;}receive(data);};
   worker.onerror=event=>{event.preventDefault();if(worker===activeWorker)fallback();};worker.onmessageerror=()=>{if(worker===activeWorker)fallback();};
   const surface=canvas.transferControlToOffscreen();worker.postMessage({type:'init',canvas:surface},[surface]);
   startup=setTimeout(fallback,4000);send(viewport());send({type:'motion',mode:mode(),epoch});
  }catch{fallback();}
 }
 function moving(now){return pointer.inside&&!pressed&&now-pointer.time<1300;}
 // Three successive steps in a positive-definite, rotated quadratic well at the cursor.
 function gradientStep(p,target,rate,angle){const c=Math.cos(angle),s=Math.sin(angle),dx=p.x-target.x,dy=p.y-target.y,a=c*dx+s*dy,b=-s*dx+c*dy;return {x:p.x-rate*(c*a-.42*s*b),y:p.y-rate*(s*a+.42*c*b)};}
 function stopCursor(){cancelAnimationFrame(raf);raf=null;lastTime=null;trace.style.opacity='0';cursor.dataset.active='false';}
 function scheduleCursor(){if(raf===null&&!disposed&&mode()==='animated')raf=requestAnimationFrame(pointerFrame);}
 function pointerFrame(now){
  raf=null;if(disposed||mode()!=='animated')return;
  const dt=lastTime===null?1/60:Math.min(.05,(now-lastTime)/1000);lastTime=now;clock+=dt;const active=moving(now);
  // Coalesce high-frequency pointer events before sending them to the worker.
  if(now-pointerSent>=1000/30||!active){send({type:'pointer',pointer:{x:pointer.x,y:pointer.y,active}});pointerSent=now;}
  if(!active){stopCursor();return;}
  const angle=clock*.22+.5;position=gradientStep(position,pointer,1-Math.exp(-dt*11),angle);const p1=gradientStep(position,pointer,.55,angle),p2=gradientStep(p1,pointer,.55,angle),points=[position,p1,p2];
  for(let i=0;i<3;i++){nodes[i].setAttribute('cx',points[i].x.toFixed(2));nodes[i].setAttribute('cy',points[i].y.toFixed(2));}
  path.setAttribute('d',points.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(''));
  trace.style.opacity=String(Math.max(0,Math.min(1,(1300-(now-pointer.time))/550))*.92);cursor.dataset.active='true';scheduleCursor();
 }
 function resize(){
  width=Math.max(1,innerWidth);height=Math.max(1,innerHeight);ratio=Math.min(devicePixelRatio||1,1.5,Math.sqrt(2400000/(width*height)));cursor.setAttribute('viewBox',`0 0 ${width} ${height}`);
  pointer.x=Math.min(width,Math.max(0,pointer.x));pointer.y=Math.min(height,Math.max(0,pointer.y));if(worker||loop)send(viewport());
 }
 function sync(){stopCursor();pointer.inside=false;epoch++;send({type:'motion',mode:mode(),epoch});}
 const leave=()=>{pointer.inside=false;stopCursor();send({type:'pointer',pointer:{x:pointer.x,y:pointer.y,active:false}});};
 listen(window,'pointermove',event=>{if(reduced.matches||event.pointerType==='touch'||pressed)return;const first=!pointer.inside;pointer={x:event.clientX,y:event.clientY,inside:true,time:performance.now()};if(first)position={x:pointer.x-64,y:pointer.y+32};scheduleCursor();},{passive:true});
 listen(document.documentElement,'pointerleave',leave);listen(window,'blur',leave);listen(window,'pointerdown',()=>{pressed=true;leave();},{passive:true});listen(window,'pointerup',()=>pressed=false,{passive:true});listen(window,'pointercancel',()=>{pressed=false;leave();},{passive:true});
 listen(window,'resize',resize,{passive:true});listen(document,'visibilitychange',sync);listen(reduced,'change',sync);listen(window,'pagehide',()=>{suspended=true;sync();});listen(window,'pageshow',()=>{suspended=false;sync();});
 resize();startRenderer();
 return {dispose(){disposed=true;stopCursor();clearTimeout(startup);send({type:'dispose'});worker?.terminate();listeners.forEach(fn=>fn());canvas.remove();cursor.remove();}};
}
