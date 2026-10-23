import {readFile,mkdir,cp,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url)),canonical=resolve(root,'..'),dist=join(root,'dist');
const manifest=JSON.parse(await readFile(join(canonical,'app-data/dataset-manifest.json'),'utf8'));
await mkdir(join(dist,'content/datasets'),{recursive:true});
for(const item of manifest.datasets){const input=resolve(canonical,'app-data',item.file);const bytes=await readFile(input);if(createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw new Error(`Dataset checksum changed: ${item.id}`);await writeFile(join(dist,'content/datasets',item.id+'.json'),bytes);}
for(const name of ['catalog.json','taxonomy.json','demonstration-plan.json','dataset-manifest.json','lesson-implementation.json'])await cp(join(canonical,'app-data',name),join(dist,'content',name));
await cp(join(root,'src'),join(dist,'src'),{recursive:true});await cp(join(root,'public'),dist,{recursive:true});
await mkdir(join(dist,'assets'),{recursive:true});await cp(join(canonical,'brand/selected-logo.png'),join(dist,'assets/logo.png'));
const [catalog,plan,implementation,pkg]=await Promise.all([join(canonical,'app-data/catalog.json'),join(canonical,'app-data/demonstration-plan.json'),join(canonical,'app-data/lesson-implementation.json'),join(root,'package.json')].map(async file=>JSON.parse(await readFile(file,'utf8'))));
await writeFile(join(dist,'build-manifest.json'),JSON.stringify({schemaVersion:'1.0.0',appVersion:pkg.version,catalogEntries:catalog.entries.length,lessonLayouts:plan.lessons.length,implementedLessons:implementation.implementedLessonCount,liveComparison:implementation.comparison?.status==='implemented',comparisonModels:implementation.comparison?.modelIds||[],experimentLibrary:implementation.experimentLibrary?.status==='implemented',exportFormats:implementation.experimentLibrary?.exports||[],fixtures:manifest.datasets.length,networkAssets:0},null,2));
console.log('Built standalone app in dist; verified 7 dataset checksums.');
