import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {explainObservation,regressionSummary,visibleRows,interpolateLine} from '../src/core/linear-explanation.js';
import {fitLinear} from '../src/engine/linear-regression.js';
import {animateLine} from '../src/lessons/linear-lesson.js';
const read=url=>JSON.parse(readFileSync(new URL(url,import.meta.url),'utf8'));
const dataset=read('../../datasets/line-noise.json'),manifest=read('../../app-data/dataset-manifest.json');
dataset.revision=manifest.datasets.find(x=>x.id===dataset.id).sha256;
const reference=read('./fixtures/linear-reference.json');
const request={schemaVersion:'1.0.0',modelId:'linear-regression',datasetId:dataset.id,datasetRevision:dataset.revision,adapterVersion:'ols-1',modelSeed:7,preprocessing:'none',evaluation:'validation',parameters:{'fit-intercept':true}};
test('Both fits and all 256 predictions match independent NumPy least squares',()=>{
 for(const offset of [true,false]){const expected=reference.fits[String(offset)],actual=fitLinear({...request,parameters:{'fit-intercept':offset}},dataset,1);const near=(a,b)=>assert.ok(Math.abs(a-b)<reference.absoluteTolerance,`${a} != ${b}`);near(actual.model.slope,expected.slope);near(actual.model.intercept,expected.intercept);
  for(const split of ['train','validation']){for(const metric of ['mae','mse','rmse'])near(actual.metrics[split][metric],expected.metrics[split][metric]);assert.deepEqual(actual.predictions[split].map(p=>p.rowId),expected.predictions[split].map(p=>p.rowId));actual.predictions[split].forEach((p,i)=>near(p.value,expected.predictions[split][i].value));}
 }
});
test('Positive and negative residuals match the point equation and squared contribution',()=>{
 const fixture={X:[[2],[2]],y:[7,3],partitions:{train:[0],validation:[1],test:[]}},model={slope:2,intercept:1};
 assert.deepEqual(explainObservation(fixture,0,model),{rowId:0,x:2,observed:7,predicted:5,residual:2,squaredError:4,absoluteError:2,split:'training'});
 assert.equal(explainObservation(fixture,1,model).residual,-2);assert.equal(explainObservation(fixture,1,model).squaredError,4);assert.equal(explainObservation(fixture,1,model).split,'validation');
});
test('Training point contributions add to the displayed mean loss',()=>{const model={slope:1.1,intercept:-0.3};const contribution=dataset.partitions.train.reduce((s,i)=>s+explainObservation(dataset,i,model).squaredError/dataset.partitions.train.length,0);assert.ok(Math.abs(contribution-regressionSummary(dataset,dataset.partitions.train,model).mse)<1e-12);});
test('Training and validation filters never expose final-check observations',()=>{for(const split of ['training','validation','both']){const rows=visibleRows(dataset,split);assert.ok(rows.every(i=>!dataset.partitions.test.includes(i)));}assert.equal(visibleRows(dataset,'training').length,96);assert.equal(visibleRows(dataset,'validation').length,32);assert.equal(visibleRows(dataset,'both').length,128);});
test('Changing generator reference data cannot change the learned coefficients',()=>{const changed=structuredClone(dataset);changed.truth={slope:10000,intercept:-3000};assert.deepEqual(fitLinear(request,dataset,1).model,fitLinear(request,changed,1).model);});
test('Geometric interpolation connects endpoints without claiming optimization steps',()=>{const a={slope:0,intercept:-1},b={slope:2,intercept:1};assert.deepEqual(interpolateLine(a,b,0),a);assert.deepEqual(interpolateLine(a,b,0.5),{slope:1,intercept:0});assert.deepEqual(interpolateLine(a,b,1),b);assert.deepEqual(interpolateLine(a,b,2),b);});
test('Reduced-motion fitting renders the exact endpoint without scheduling animation',async()=>{const prior=globalThis.requestAnimationFrame;globalThis.requestAnimationFrame=()=>{throw Error('Animation must not be scheduled');};try{const frames=[],target={slope:0.8,intercept:0.4};const job=animateLine({from:{slope:0,intercept:0},to:target,reducedMotion:true,onFrame:p=>frames.push(p)});assert.equal(await job.promise,true);assert.deepEqual(frames,[target]);}finally{globalThis.requestAnimationFrame=prior;}});
test('A stopped visual transition resolves without publishing its endpoint',async()=>{const raf=globalThis.requestAnimationFrame,caf=globalThis.cancelAnimationFrame;const pending=new Map();let id=0;globalThis.requestAnimationFrame=fn=>{pending.set(++id,fn);return id;};globalThis.cancelAnimationFrame=key=>pending.delete(key);try{const frames=[],job=animateLine({from:{slope:0,intercept:0},to:{slope:1,intercept:1},onFrame:p=>frames.push(p)});job.cancel();assert.equal(await job.promise,false);assert.equal(pending.size,0);assert.equal(frames.length,0);}finally{globalThis.requestAnimationFrame=raf;globalThis.cancelAnimationFrame=caf;}});
