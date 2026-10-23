import {canonical} from '../core/experiment.js';
import {dataRandom,sha256} from './synthetic-data.js';
export const csvVersion='csv-1',maxCsvBytes=262144;
export function parseCsv(text){
  if(typeof text!=='string'||new TextEncoder().encode(text).length>maxCsvBytes)throw Error('Choose a UTF-8 CSV file up to 256 KiB.');
  text=text.replace(/^\uFEFF/,'');if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffd]/.test(text))throw Error('CSV must be valid UTF-8 text without control characters.');
  const records=[];let row=[],cell='',quoted=false,closed=false;
  const field=()=>{if(cell.length>80)throw Error('CSV cells must be at most 80 characters.');if(row.length>=12)throw Error('Use 2–12 columns in each CSV record.');row.push(cell.trim());cell='';closed=false;};
  const record=()=>{field();if(row.length!==1||row[0]!=='')records.push(row);if(records.length>401)throw Error('Use 80–400 data records.');row=[];};
  for(let i=0;i<text.length;i++){if(cell.length>80)throw Error('CSV cells must be at most 80 characters.');const ch=text[i];if(quoted){if(ch==='"'){if(text[i+1]==='"'){cell+='"';i++;}else {quoted=false;closed=true;}}else cell+=ch;continue;}
    if(ch==='"'){if(cell||closed)throw Error('A CSV quote must start a field.');quoted=true;}
    else if(ch===',')field();else if(ch==='\r'||ch==='\n'){record();if(ch==='\r'&&text[i+1]==='\n')i++;}
    else {if(closed)throw Error('Unexpected text after a closing CSV quote.');cell+=ch;}
  }
  if(quoted)throw Error('CSV has an unclosed quoted field.');if(cell||row.length||closed)record();
  const headers=records.shift();if(!headers||headers.length<2||headers.length>12||headers.some(h=>!h)||new Set(headers).size!==headers.length)throw Error('Use 2–12 unique, nonempty column headers.');
  if(records.length<80||records.length>400)throw Error('Use 80–400 data records.');
  records.forEach((r,i)=>{if(r.length!==headers.length)throw Error(`CSV record ${i+2} has ${r.length} fields; expected ${headers.length}.`);});return {headers,rows:records};
}
function strictKeys(o,keys){if(!o||typeof o!=='object'||Array.isArray(o)||Object.keys(o).length!==keys.length||keys.some(k=>!Object.hasOwn(o,k)))throw Error('Invalid imported-data descriptor fields.');}
function shuffle(ids,seed){const out=[...ids],rng=dataRandom(seed);for(let i=out.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
const number=(value,record,column)=>{if(!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value)||!Number.isFinite(Number(value))||Math.abs(Number(value))>1e6)throw Error(`Record ${record}, ${column}: use a finite number between −1,000,000 and 1,000,000.`);return Number(value);};
const median=values=>{const a=[...values].sort((a,b)=>a-b),i=Math.floor(a.length/2);return a.length%2?a[i]:(a[i-1]+a[i])/2;};
export function importCsv(descriptor){
  strictKeys(descriptor,['version','name','csv','task','features','target','types','missing','seed']);
  const r=structuredClone(descriptor);if(r.version!==csvVersion)throw Error('This CSV importer version is unavailable.');
  if(typeof r.name!=='string'||!r.name.trim()||r.name.length>80||/[\r\n\u0000-\u001f]/.test(r.name))throw Error('Use a file name from 1 to 80 characters.');
  if(!['classification','regression','clustering','pca'].includes(r.task)||!['reject','impute'].includes(r.missing)||!Number.isInteger(r.seed)||r.seed<0||r.seed>4294967295)throw Error('Choose a supported task, missing-value policy, and unsigned 32-bit split seed.');
  const {headers,rows}=parseCsv(r.csv),supervised=['classification','regression'].includes(r.task),regression=r.task==='regression',ids=rows.map((_,i)=>i),validColumn=i=>Number.isInteger(i)&&i>=0&&i<headers.length;
  if(!Array.isArray(r.features)||r.features.length<1||r.features.length>(regression?1:2)||new Set(r.features).size!==r.features.length||r.features.some(i=>!validColumn(i))||!Array.isArray(r.types)||r.types.length!==r.features.length||r.types.some(t=>!['numeric','binary'].includes(t)))throw Error('Choose one input for regression, or one/two inputs for classification, K-means or PCA.');
  if(supervised?(!validColumn(r.target)||r.features.includes(r.target)):r.target!==null)throw Error('Choose a separate target column for a supervised task; unlabeled tasks use no target.');
  let targetLabels=null,y;
  if(supervised){const targets=rows.map((row,i)=>{if(!row[r.target])throw Error(`Record ${i+2}: target values cannot be missing.`);return row[r.target];});
    if(regression)y=targets.map((v,i)=>number(v,i+2,headers[r.target]));else {targetLabels=[...new Set(targets)].sort();if(targetLabels.length!==2)throw Error('Classification requires exactly two target labels.');y=targets.map(v=>targetLabels.indexOf(v));if([0,1].some(k=>y.filter(v=>v===k).length<5))throw Error('Each target class needs at least five observations for stratified splits.');}
  }
  let partitions;if(!supervised)partitions={fit:ids};else {partitions={train:[],validation:[],test:[]};const groups=regression?[ids]:[ids.filter(i=>y[i]===0),ids.filter(i=>y[i]===1)];groups.forEach((group,k)=>{const order=shuffle(group,(r.seed^Math.imul(k+1,0x9e3779b9))>>>0),n=Math.floor(group.length*.6),v=Math.floor(group.length*.2);partitions.train.push(...order.slice(0,n));partitions.validation.push(...order.slice(n,n+v));partitions.test.push(...order.slice(n+v));});for(const a of Object.values(partitions))a.sort((a,b)=>a-b);}
  const fitIds=partitions.train||partitions.fit,facts=[],X=ids.map(()=>[]);
  r.features.forEach((column,j)=>{const type=r.types[j],observed=fitIds.map(i=>rows[i][column]).filter(v=>v!==''),missingCount=rows.filter(row=>row[column]==='').length;
    if(!observed.length)throw Error(`${headers[column]} has no observed values in the fitting partition.`);if(missingCount&&r.missing==='reject')throw Error(`${headers[column]} has missing values. Choose Fill from fitting rows or select another column.`);
    let fillValue,categories=null;if(type==='numeric')fillValue=median(observed.map(v=>number(v,'fit',headers[column])));else {categories=[...new Set(observed)].sort();if(categories.length>2)throw Error(`${headers[column]} has more than two fitting categories. These visual lessons support binary categories only.`);fillValue=[...categories].sort((a,b)=>observed.filter(v=>v===b).length-observed.filter(v=>v===a).length||categories.indexOf(a)-categories.indexOf(b))[0];}
    let unknownCount=0;for(const i of ids){let value=rows[i][column]||fillValue;if(type==='binary'){if(!categories.includes(value)){value=fillValue;unknownCount++;}X[i][j]=categories.indexOf(value);}else X[i][j]=typeof value==='number'?value:number(value,i+2,headers[column]);}
    facts.push({column:headers[column],sourceIndex:column,type,fillValue,categories,missingCount,unknownCount});
  });
  if(!regression&&r.features.length===1)X.forEach(row=>row.push(0));
  if(regression){const mean=fitIds.reduce((s,i)=>s+X[i][0],0)/fitIds.length;if(fitIds.reduce((s,i)=>s+(X[i][0]-mean)**2,0)<=Number.EPSILON)throw Error('Regression training inputs need sufficient variation to define a unique slope.');}
  const data={schemaVersion:'1.0.0',id:regression?'line-noise':r.task==='classification'?'two-blobs':r.task==='clustering'?'three-clusters':'tilted-cloud',name:`CSV · ${r.name}`,kind:'imported-array',featureNames:r.features.map(i=>headers[i]),X,...(supervised?{y}:{}),rowIds:ids,partitions,imported:r,preparation:{version:csvVersion,fitRowIds:[...fitIds],features:facts,targetLabels,targetColumn:supervised?headers[r.target]:null,unknownCategoryRule:'replace with fitting-mode category',splitRule:supervised?(regression?'seeded 60/20/20':'seeded stratified per-class 60/20/20'):'all unlabeled rows fit'}};
  return {...data,revision:sha256(canonical(data))};
}
