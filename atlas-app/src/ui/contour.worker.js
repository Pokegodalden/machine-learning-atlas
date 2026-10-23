import {createContourLoop} from './contour-loop.js';
let loop;
self.onmessage=({data})=>{
 try{if(data.type==='init'){loop=createContourLoop(data.canvas,message=>self.postMessage(message));self.postMessage({type:'ready'});}else loop?.message(data);}
 catch(error){self.postMessage({type:'failed',message:error.message});}
};
