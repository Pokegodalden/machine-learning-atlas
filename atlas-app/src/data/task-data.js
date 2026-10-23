import {dataRandom,sha256,generatedFromDescriptor} from './synthetic-data.js';
import {canonical} from '../core/experiment.js';
export const taskGeneratorVersion='task-synthetic-1';
export const taskDefaults=task=>({task,samples:200,noise:task==='regression'?.3:.2,outliers:0,seed:42,...(task==='regression'?{slope:.8,intercept:.4}:{stretch:1,angle:task==='ellipse'?30:0,features:'both',...(task==='clusters'?{groups:3,separation:3}:{spread:2})})});
export function validateTaskRecipe(r){
  if(!r||!['regression','clusters','ellipse'].includes(r.task))throw Error('Choose a supported data task.');
  const keys=Object.keys(taskDefaults(r.task));if(Object.keys(r).length!==keys.length||keys.some(k=>!Object.hasOwn(r,k)))throw Error('Unsupported or missing task-data fields.');
  const specs={samples:[80,400,true],noise:[0,r.task==='regression'?2:1],outliers:[0,.25],seed:[0,4294967295,true],slope:[-2,2],intercept:[-2,2],stretch:[.25,3],angle:[-90,90],groups:[2,6,true],separation:[0,4],spread:[.25,3]};
  for(const k of keys){if(!specs[k])continue;const [lo,hi,whole]=specs[k];if(typeof r[k]!=='number'||!Number.isFinite(r[k])||r[k]<lo||r[k]>hi||whole&&!Number.isInteger(r[k]))throw Error(`Choose ${k} from ${lo} to ${hi}${whole?' using whole numbers':''}.`);}
  if(r.samples%20)throw Error('Choose 80–400 observations in steps of 20.');
  if(r.task!=='regression'&&!['both','first','second'].includes(r.features))throw Error('Choose one or both input features.');return structuredClone(r);
}
function shuffle(ids,rng){const a=[...ids];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function generateTaskData(input){
  const r=validateTaskRecipe(input),rng=dataRandom(r.seed),ids=Array.from({length:r.samples},(_,i)=>i),X=[],y=[],a=r.angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  for(const i of ids){const u=Math.max(rng(),2**-32),v=rng(),z=Math.sqrt(-2*Math.log(u)),nx=z*Math.cos(2*Math.PI*v),ny=z*Math.sin(2*Math.PI*v),x=rng()*6-3;
    if(r.task==='regression'){X.push([x]);y.push(r.slope*x+r.intercept+r.noise*ny);}
    else {const t=2*Math.PI*(i%r.groups)/r.groups,base=r.task==='clusters'?[r.separation*Math.cos(t)/2+r.noise*nx,r.separation*Math.sin(t)/2+r.noise*ny]:[r.spread*nx,r.noise*ny];base[1]*=r.stretch;X.push([c*base[0]-s*base[1],s*base[0]+c*base[1]]);}
  }
  const outlierCount=Math.round(r.samples*r.outliers),order=shuffle(ids,dataRandom((r.seed^0x27d4eb2f)>>>0)),out=dataRandom((r.seed^0x165667b1)>>>0);
  for(let k=0;k<outlierCount;k++){const i=order[k];if(r.task==='regression')y[i]+=(out()<.5?-1:1)*(3+out()*3);else X[i]=[(out()*10-5),(out()*10-5)];}
  for(const p of X){if(r.features==='first')p[1]=0;if(r.features==='second')p[0]=0;for(let j=0;j<p.length;j++)p[j]=Number(p[j].toFixed(10));}for(let i=0;i<y.length;i++)y[i]=Number(y[i].toFixed(10));
  const regression=r.task==='regression',split=shuffle(ids,dataRandom((r.seed^0xfd7046c5)>>>0)),partitions=regression?{train:split.slice(0,r.samples*.6).sort((a,b)=>a-b),validation:split.slice(r.samples*.6,r.samples*.8).sort((a,b)=>a-b),test:split.slice(r.samples*.8).sort((a,b)=>a-b)}:{fit:ids};
  const d={schemaVersion:'1.0.0',id:regression?'line-noise':r.task==='clusters'?'three-clusters':'tilted-cloud',name:regression?'Generated noisy line':r.task==='clusters'?'Generated unlabeled clusters':'Generated tilted cloud',kind:'synthetic-array',featureNames:regression?['x']:['x1','x2'],X,...(regression?{y,truth:{slope:r.slope,intercept:r.intercept}}:{}),rowIds:ids,partitions,generator:{version:taskGeneratorVersion,recipe:r},generation:{seed:r.seed,bitGenerator:'mulberry32-uint32-v1',coordinateRoundingDecimals:10,outlierCount,partitionRule:regression?'shuffled 60% train, 20% validation, 20% reserved final check':'all observations are unlabeled fitting rows'}};
  return {...d,revision:sha256(canonical(d))};
}
export function taskFromDescriptor(d){if(!d||typeof d!=='object'||Array.isArray(d)||Object.keys(d).length!==2||d.version!==taskGeneratorVersion||!Object.hasOwn(d,'recipe'))throw Error('This task generator version is unavailable.');return generateTaskData(d.recipe);}

export const resolveGenerated=d=>d?.version===taskGeneratorVersion?taskFromDescriptor(d):generatedFromDescriptor(d);
