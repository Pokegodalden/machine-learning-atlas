// Decorative scalar field only. Grid-edge IDs share crossings between cells,
// avoiding per-frame corner arrays, string keys, Maps and segment objects.
const levels=[-.11,-.02,.07,.16,.25,.34,.43,.52,.61,.71,.82,.94];
export function createContourRenderer(canvas){
 const ctx=canvas.getContext('2d',{alpha:true});if(!ctx)throw new Error('Canvas 2D unavailable');
 let width,height,columns,rows,field,vx,vy,edgeA,edgeB,ex,ey,degree,adjA,adjB,visited,chain,cells,edgeCount;
 function resize(w,h,ratio){
  width=w;height=h;canvas.width=Math.ceil(w*ratio);canvas.height=Math.ceil(h*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);
  columns=Math.min(64,Math.max(14,Math.ceil(w/32)));rows=Math.min(48,Math.max(10,Math.ceil(h/32)));
  const vertices=(columns+1)*(rows+1),horizontal=columns*(rows+1);edgeCount=horizontal+(columns+1)*rows;
  field=new Float32Array(vertices);vx=new Float64Array(vertices);vy=new Float64Array(vertices);
  edgeA=new Int32Array(edgeCount);edgeB=new Int32Array(edgeCount);ex=new Float64Array(edgeCount);ey=new Float64Array(edgeCount);
  degree=new Uint8Array(edgeCount);adjA=new Int32Array(edgeCount);adjB=new Int32Array(edgeCount);visited=new Uint8Array(edgeCount);chain=new Int32Array(edgeCount);cells=new Int32Array(columns*rows*4);
  for(let y=0;y<=rows;y++)for(let x=0;x<=columns;x++){const i=y*(columns+1)+x;vx[i]=x*w/columns;vy[i]=y*h/rows;}
  for(let y=0;y<=rows;y++)for(let x=0;x<columns;x++){const e=y*columns+x;edgeA[e]=y*(columns+1)+x;edgeB[e]=edgeA[e]+1;}
  for(let y=0;y<rows;y++)for(let x=0;x<=columns;x++){const e=horizontal+y*(columns+1)+x;edgeA[e]=y*(columns+1)+x;edgeB[e]=edgeA[e]+columns+1;}
  for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){const i=(y*columns+x)*4;cells[i]=y*columns+x;cells[i+1]=horizontal+y*(columns+1)+x+1;cells[i+2]=(y+1)*columns+x;cells[i+3]=horizontal+y*(columns+1)+x;}
 }
 function connect(a,b){if(degree[a]++===0)adjA[a]=b;else adjB[a]=b;if(degree[b]++===0)adjA[b]=a;else adjB[b]=a;}
 function trace(start){
  let n=0,current=start,previous=-1,closed=false;
  while(!visited[current]){visited[current]=1;chain[n++]=current;const next=adjA[current]===previous?(degree[current]===2?adjB[current]:-1):adjA[current];previous=current;if(next<0)break;if(next===start){closed=true;break;}current=next;}
  if(n<2)return;const first=chain[0],last=chain[n-1];
  if(closed&&n>2){ctx.moveTo((ex[last]+ex[first])/2,(ey[last]+ey[first])/2);for(let i=0;i<n;i++){const a=chain[i],b=chain[(i+1)%n];ctx.quadraticCurveTo(ex[a],ey[a],(ex[a]+ex[b])/2,(ey[a]+ey[b])/2);}ctx.closePath();}
  else{ctx.moveTo(ex[first],ey[first]);for(let i=1;i<n-1;i++){const a=chain[i],b=chain[i+1];ctx.quadraticCurveTo(ex[a],ey[a],(ex[a]+ex[b])/2,(ey[a]+ey[b])/2);}ctx.lineTo(ex[last],ey[last]);}
 }
 function draw(time,pointer,blend){
  ctx.clearRect(0,0,width,height);const unit=Math.min(width,height),phase=time*.09;
  // Basin trigonometry is shared by every vertex in the frame.
  const basins=[
   [width*(.18+.055*Math.sin(phase*.8)),height*(.22+.07*Math.cos(phase*.7))],
   [width*(.83+.055*Math.cos(phase*.6)),height*(.43+.10*Math.sin(phase*.8))],
   [width*(.51+.08*Math.sin(phase*.5)),height*(.87+.06*Math.cos(phase*.9))]
  ].map(([x,y],i)=>({x:x/unit,y:y/unit,c:Math.cos(phase*.35+i*1.1),s:Math.sin(phase*.35+i*1.1)}));
  for(let i=0;i<field.length;i++){
   const u=vx[i]/unit,v=vy[i]/unit;let value=.10*Math.sin(u*4+phase)*Math.cos(v*3-phase*.8)+.055*Math.cos(u*7+v*5+phase*1.1);
   for(let j=0;j<3;j++){const b=basins[j],a=u-b.x,d=v-b.y,rx=a*b.c+d*b.s,ry=-a*b.s+d*b.c;value+=(.9-j*.09)*Math.exp(-(rx*rx*(3+j)+ry*ry*(6-j))/.55);}
   if(blend>.002){const a=u-pointer.x/unit,b=v-pointer.y/unit;value-=.26*blend*Math.exp(-(a*a+b*b*1.4)*10);}
   field[i]=value;
  }
  for(let k=0;k<levels.length;k++){
   const level=levels[k];degree.fill(0);visited.fill(0);ctx.beginPath();
   for(let e=0;e<edgeCount;e++){const a=edgeA[e],b=edgeB[e],fa=field[a],fb=field[b];if((fa>=level)===(fb>=level))continue;const t=(level-fa)/(fb-fa);ex[e]=vx[a]+(vx[b]-vx[a])*t;ey[e]=vy[a]+(vy[b]-vy[a])*t;}
   for(let cell=0;cell<cells.length;cell+=4){
    let count=0,a=-1,b=-1,c=-1,d=-1;
    for(let j=0;j<4;j++){const e=cells[cell+j];if((field[edgeA[e]]>=level)===(field[edgeB[e]]>=level))continue;if(count===0)a=e;else if(count===1)b=e;else if(count===2)c=e;else d=e;count++;}
    if(count===2)connect(a,b);
    else if(count===4){const top=cells[cell],bottom=cells[cell+2],center=(field[edgeA[top]]+field[edgeB[top]]+field[edgeA[bottom]]+field[edgeB[bottom]])/4;if((field[edgeA[top]]>=level)===(center>=level)){connect(a,b);connect(c,d);}else{connect(a,d);connect(b,c);}}
   }
   for(let e=0;e<edgeCount;e++)if(degree[e]===1&&!visited[e])trace(e);
   for(let e=0;e<edgeCount;e++)if(degree[e]&&!visited[e])trace(e);
   ctx.lineWidth=k%3===0?.9:.65;ctx.strokeStyle=k===7?'rgba(229,205,131,.10)':k%3===0?'rgba(121,206,215,.15)':'rgba(121,206,215,.085)';ctx.globalAlpha=width<560?.72:1;ctx.stroke();
  }
 }
 return {resize,draw};
}
