import {createContourRenderer} from './contour-renderer.js';
// Worker and compatibility path share geometry and a deadline-based 30 Hz clock.
export function createContourLoop(canvas,notify){
 const renderer=createContourRenderer(canvas),period=1000/30,hasRaf=typeof requestAnimationFrame==='function';
 let timer=null,mode='paused',clock=0,last=null,deadline=0,frames=0,blend=0,lastReport=0,disposed=false;
 let pointer={x:0,y:0,active:false},pointerTime=-Infinity,epoch=0;
 function report(cost=0){lastReport=performance.now();notify({type:'state',mode,frames,epoch,cost});}
 function paint(now){const dt=last===null?0:Math.min(.15,(now-last)/1000);last=now;clock+=dt;const active=pointer.active&&now-pointerTime<1300;blend+=(Number(active)-blend)*(1-Math.exp(-dt*4));const start=performance.now();renderer.draw(clock,pointer,blend);frames++;return performance.now()-start;}
 function cancel(){if(hasRaf)cancelAnimationFrame(timer);else clearTimeout(timer);timer=null;}
 function schedule(){if(mode!=='animated'||disposed)return;timer=hasRaf?requestAnimationFrame(tick):setTimeout(()=>tick(performance.now()),Math.max(0,deadline-performance.now()));}
 function tick(now){timer=null;if(mode!=='animated'||disposed)return;if(now+.75<deadline){schedule();return;}const cost=paint(now);if(now-lastReport>=100)report(cost);deadline+=period;if(deadline<now-period)deadline=now+period;schedule();}
 function message(data){
  if(disposed)return;
  if(data.type==='resize'){renderer.resize(data.width,data.height,data.ratio);const cost=paint(performance.now());report(cost);}
  else if(data.type==='pointer'){pointer=data.pointer;pointerTime=performance.now();}
  else if(data.type==='motion'){
   cancel();epoch=data.epoch;mode=data.mode;last=null;pointer.active=false;
   if(mode==='still'){blend=0;pointer.active=false;paint(performance.now());}
   report();if(mode==='animated'){deadline=performance.now()+period;schedule();}
  }
  else if(data.type==='dispose'){disposed=true;cancel();}
 }
 return {message};
}
