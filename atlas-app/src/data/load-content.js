export async function loadContent(){
  const get=async file=>{const response=await fetch(new URL('../../content/'+file,import.meta.url));if(!response.ok)throw new Error(`Could not load ${file}.`);return response.json();};
  const [catalog,taxonomy,plan,manifest,implementation]=await Promise.all(['catalog.json','taxonomy.json','demonstration-plan.json','dataset-manifest.json','lesson-implementation.json'].map(get));
  if([catalog,taxonomy,plan,manifest,implementation].some(x=>x.schemaVersion!=='1.0.0'))throw new Error('This content version is unsupported.');
  const pairs=await Promise.all(manifest.datasets.map(async item=>{const dataset=await get('datasets/'+item.id+'.json');if(dataset.id!==item.id)throw new Error('Dataset identity mismatch.');return [item.id,{...dataset,revision:item.sha256}];}));
  return {catalog,taxonomy,plan,implementation,datasets:Object.fromEntries(pairs)};
}
