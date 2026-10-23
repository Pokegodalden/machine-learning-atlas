import {canonical} from '../core/experiment.js';

export const generatorVersion='synthetic-1';
export const dataDefaults=(pattern='moons')=>({pattern,samples:240,noise:.2,separation:pattern==='blobs'?2:.5,outliers:0,stretch:1,seed:42,features:'both'});
export function validateRecipe(value){
  const fields=Object.keys(dataDefaults());if(!value||Array.isArray(value)||Object.keys(value).length!==fields.length||fields.some(k=>!Object.hasOwn(value,k)))throw Error('The synthetic-data recipe has unsupported or missing fields.');
  if(!['blobs','moons'].includes(value.pattern)||!['both','first','second'].includes(value.features))throw Error('Choose a supported pattern and input features.');
  for(const [key,min,max,integer] of [['samples',80,400,true],['noise',0,1,false],['separation',0,4,false],['outliers',0,.25,false],['stretch',.25,3,false],['seed',0,4294967295,true]])if(typeof value[key]!=='number'||!Number.isFinite(value[key])||value[key]<min||value[key]>max||(integer&&!Number.isInteger(value[key])))throw Error(`Choose ${key} from ${min} to ${max}${integer?' using whole numbers':''}.`);
  if(value.samples%20!==0)throw Error('Choose a sample count from 80 to 400 in steps of 20.');
  return structuredClone(value);
}
export function dataRandom(seed){let a=seed>>>0;return ()=>{a=(a+0x6d2b79f5)>>>0;let t=Math.imul(a^(a>>>15),a|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
function shuffled(items,random){const copy=[...items];for(let i=copy.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[copy[i],copy[j]]=[copy[j],copy[i]];}return copy;}

// Synchronous UTF-8 SHA-256 allows a portable recipe to be verified before any
// active experiment changes. Numerical generators and model seeds are separate.
export function sha256(text){
  const bytes=new TextEncoder().encode(text),length=Math.ceil((bytes.length+9)/64)*64,data=new Uint8Array(length);data.set(bytes);data[bytes.length]=128;const view=new DataView(data.buffer);view.setUint32(length-8,Math.floor(bytes.length/536870912));view.setUint32(length-4,(bytes.length*8)>>>0);
  const k=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],w=new Uint32Array(64),rotr=(n,b)=>(n>>>b)|(n<<(32-b));
  for(let offset=0;offset<length;offset+=64){for(let i=0;i<16;i++)w[i]=view.getUint32(offset+i*4);for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2];w[i]=(w[i-16]+(rotr(a,7)^rotr(a,18)^(a>>>3))+w[i-7]+(rotr(b,17)^rotr(b,19)^(b>>>10)))>>>0;}let [a,b,c,d,e,f,g,z]=h;for(let i=0;i<64;i++){const t1=(z+(rotr(e,6)^rotr(e,11)^rotr(e,25))+((e&f)^(~e&g))+k[i]+w[i])>>>0,t2=((rotr(a,2)^rotr(a,13)^rotr(a,22))+((a&b)^(a&c)^(b&c)))>>>0;z=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}[a,b,c,d,e,f,g,z].forEach((value,i)=>h[i]=(h[i]+value)>>>0);}
  return h.map(v=>v.toString(16).padStart(8,'0')).join('');
}
export function generateDataset(input){
  const recipe=validateRecipe(input),{pattern,samples,noise,separation,outliers,stretch,seed,features}=recipe,half=samples/2,X=[],y=[],ids=Array.from({length:samples},(_,i)=>i);
  for(let label=0;label<2;label++){
    const random=dataRandom((seed^(label?0x85ebca6b:0xc2b2ae35))>>>0);
    for(let i=0;i<half;i++){const u=Math.max(random(),2**-32),v=random(),angle=random()*Math.PI,radius=Math.sqrt(-2*Math.log(u)),nx=radius*Math.cos(2*Math.PI*v),ny=radius*Math.sin(2*Math.PI*v);let point=pattern==='blobs'?[(label?1:-1)*separation/2+noise*nx,noise*ny]:[label?1-Math.cos(angle):Math.cos(angle),(label?1-separation-Math.sin(angle):Math.sin(angle))];if(pattern==='moons')point=point.map((x,j)=>x+noise*(j?ny:nx));X.push([point[0],point[1]*stretch]);y.push(label);}
  }
  const outlierCount=Math.round(samples*outliers),outlierIds=shuffled(ids,dataRandom((seed^0x27d4eb2f)>>>0)).slice(0,outlierCount),outlierRandom=dataRandom((seed^0x165667b1)>>>0),outlierPoints=ids.map(()=>[(outlierRandom()*7-3.5),(outlierRandom()*7-3.5)*stretch]);for(const id of outlierIds)X[id]=outlierPoints[id];
  for(const point of X){if(features==='first')point[1]=0;if(features==='second')point[0]=0;point[0]=Number(point[0].toFixed(10));point[1]=Number(point[1].toFixed(10));}
  const partitions={train:[],validation:[],test:[]};for(let label=0;label<2;label++){const order=shuffled(ids.filter(i=>y[i]===label),dataRandom((seed^(label?0xd3a2646c:0xfd7046c5))>>>0)),train=half*.6,val=half*.2;partitions.train.push(...order.slice(0,train));partitions.validation.push(...order.slice(train,train+val));partitions.test.push(...order.slice(train+val));}for(const rows of Object.values(partitions))rows.sort((a,b)=>a-b);
  const data={schemaVersion:'1.0.0',id:pattern==='blobs'?'two-blobs':'two-moons',name:`Generated ${pattern==='blobs'?'labeled blobs':'two moons'}`,kind:'synthetic-array',featureNames:['x1','x2'],X,y,rowIds:ids,partitions,generator:{version:generatorVersion,recipe},generation:{seed,bitGenerator:'mulberry32-uint32-v1',coordinateRoundingDecimals:10,outlierCount,partitionRule:'balanced per-class 60% train, 20% validation, 20% reserved final check'}};
  return {...data,revision:sha256(canonical(data))};
}
export function generatedFromDescriptor(descriptor){
  if(!descriptor||typeof descriptor!=='object'||Array.isArray(descriptor)||Object.keys(descriptor).length!==2||descriptor.version!==generatorVersion||!Object.hasOwn(descriptor,'recipe'))throw Error('This synthetic generator version is unavailable.');return generateDataset(descriptor.recipe);
}
