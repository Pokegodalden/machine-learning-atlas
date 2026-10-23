import {experimentShareUrl,readShareToken} from '../core/experiment-sharing.js';
import {saveExperiment} from '../core/experiment-library.js';
export function createSharedExperiments({D,main,esc,announce,onOpen}){
 async function copy(doc,output){
  const url=experimentShareUrl(doc,D,location.href);output.innerHTML='<label for="experiment-share-url">Experiment snapshot link</label><input id="experiment-share-url" readonly type="text"><p class="small muted"></p>';
  const input=output.querySelector('input');input.value=url;const note=output.querySelector('p');
  const local=['localhost','127.0.0.1','[::1]'].includes(location.hostname),scope=local?' This local address works on this computer; create a link from the published app for other devices.':'';
  try{await navigator.clipboard.writeText(url);note.textContent='Link copied. It includes the experiment name and settings; results are recomputed when the recipient runs it. Copy again after changing settings.'+scope;announce('Experiment link copied.');}
  catch{note.textContent='Select and copy this link. It includes the experiment name and settings.'+scope;input.focus();input.select();announce('Select and copy the experiment link.');}
 }
 function render(token){
  let doc;try{doc=readShareToken(token,D);}catch(error){main.innerHTML=`<div class="page library-page"><h1>This experiment cannot open</h1><p role="alert">${esc(error.message)}</p><a href="#/library">Import an experiment file instead</a></div>`;return;}
  const c=doc.configuration,names=c.models.map(m=>D.catalog.entries.find(e=>e.id===m.modelId)?.name||m.modelId);
  main.innerHTML=`<div class="page library-page shared-experiment"><div class="kicker">A reproducible experiment</div><h1>${esc(doc.name)}</h1><p class="library-intro">Review the shared settings, then open the experiment. No model has run and nothing has been saved.</p><dl><dt>Models</dt><dd>${esc(names.join(' + '))}</dd><dt>Dataset</dt><dd>${esc(c.dataset.id)}${c.dataset.generator?' · generated from a fixed recipe':' · built-in example'}</dd><dt>Dataset revision</dt><dd class="shared-revision">${esc(c.dataset.revision)}</dd><dt>Evaluation</dt><dd>${esc(c.models.map(m=>m.evaluation).join(' / '))} · model seed 7</dd></dl>${c.models.map((m,i)=>`<details><summary>${esc(names[i])} settings</summary><pre>${esc(JSON.stringify(m.parameters,null,2))}</pre></details>`).join('')}<div class="panel-actions"><button id="shared-open" class="primary">Open settings</button><button id="shared-save">Save experiment</button><a href="#/explore">Back to the atlas</a></div><p id="shared-message" role="status"></p><p class="small muted">Opening restores the validated dataset revision, parameters, seed and evaluation protocol. Run the model to compute results on this app.</p></div>`;
  main.querySelector('#shared-open').onclick=async()=>{try{await onOpen(doc,false);}catch(error){tell(error.message);}};
  const tell=text=>{main.querySelector('#shared-message').textContent=text;announce(text);};
  main.querySelector('#shared-save').onclick=()=>{try{saveExperiment(localStorage,doc,D);tell('Experiment saved. Open it from Saved when you are ready.');}catch(error){tell(error.message);}};
 }
 return {copy,render};
}
