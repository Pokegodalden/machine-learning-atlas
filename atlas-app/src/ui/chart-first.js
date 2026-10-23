// Move the existing controls, retaining their bindings and unfinished tool drafts.
export function createChartFirst({main,redraw}){
  const states=new Map(),bound=new WeakSet();let observer=null,refresh=()=>{};
  function disclosure(id,label,nodes){
    const box=document.createElement('details');box.id=id;box.className='chart-disclosure';
    const summary=document.createElement('summary');summary.textContent=label;
    const body=document.createElement('div');body.className='chart-disclosure-body';
    box.append(summary,body);for(const node of nodes)if(node)body.append(node);return box;
  }
  function toolbar(anchor){
    const bar=document.createElement('div');bar.className='workspace-tools';bar.setAttribute('role','group');bar.setAttribute('aria-label','Experiment tools');anchor.before(bar);
    for(const [id,label] of [['lesson-guide','Guide'],['task-data-workbench','Shape data'],['data-workbench','Shape data'],['csv-workbench','Import CSV'],['guided-activity','Activity'],['experiment-tools','Save & export'],['compare-timing-study','Timing study']]){
      const panel=main.querySelector('#'+id);if(!panel)continue;
      const summary=panel.querySelector(':scope > summary');
      if(!summary.dataset.originalLabel)summary.dataset.originalLabel=summary.textContent.trim();
      summary.textContent=label;summary.title=summary.dataset.originalLabel;bar.append(panel);
    }
  }
  function remember(key){
    // Existing data/activity tools own their open state (including explicit
    // requests from the activity hub). Only remember the new layout sections.
    for(const box of main.querySelectorAll('details.chart-disclosure[id]')){
      const saved=states.get(key+'|'+box.id);if(saved!==undefined)box.open=saved;
      if(bound.has(box))continue;bound.add(box);
      box.addEventListener('toggle',()=>{if(!box.isConnected)return;states.set(key+'|'+box.id,box.open);if(box.open)redraw();});
    }
  }
  function lesson(key){
    observer?.disconnect();main.querySelector('.page').classList.add('chart-first');
    const layout=main.querySelector('.lesson-layout'),stage=main.querySelector('.stage-wrap');
    const guide=disclosure('lesson-guide','Lesson guide',[main.querySelector('.lesson-sidebar'),main.querySelector('.reflection')]);layout.before(guide);
    toolbar(layout);
    const description=main.querySelector('#scene-description'),playback=main.querySelector('.playback'),metrics=main.querySelector('#lesson-metrics');
    const diagnosticNodes=[];for(let node=description.nextElementSibling;node&&node!==playback;){const next=node.nextElementSibling;diagnosticNodes.push(node);node=next;}
    const diagnostics=disclosure('lesson-details','Inspect points & diagnostics',[...diagnosticNodes,metrics,main.querySelector('#lesson-run-timing')]);stage.append(diagnostics);
    const headline=document.createElement('div');headline.id='headline-metrics';headline.className='headline-metrics';headline.setAttribute('role','group');headline.setAttribute('aria-label','Key model metrics');main.querySelector('#lesson-equation').after(headline);
    const update=()=>{
      const items=[...metrics.querySelectorAll('.metric-item')];
      // Prefer unseen-row performance when a lesson has it. Retain the original
      // current/earlier-run labels so a summary never makes an old fit look current.
      const ordered=[...items.filter(n=>/validation/i.test(n.querySelector('.metric-label')?.textContent)),...items.filter(n=>!/validation/i.test(n.querySelector('.metric-label')?.textContent))];
      headline.replaceChildren(...ordered.slice(0,3).map(item=>{const copy=item.cloneNode(true);copy.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));copy.removeAttribute('id');for(const node of [copy,...copy.querySelectorAll('[class]')])for(const cls of [...node.classList])if(cls.startsWith('metric-'))node.classList.replace(cls,cls.replace('metric-','headline-'));return copy;}));
    };refresh=update;update();observer=new MutationObserver(update);observer.observe(metrics,{childList:true,subtree:true,characterData:true});
    const controls=main.querySelector('.controls-body'),actions=controls.querySelector('.panel-actions');
    const secondary=disclosure('parameter-actions','More actions & data facts',[...actions.querySelectorAll('button:not(.primary)'),main.querySelector('#settings-history-note'),main.querySelector('.setup-actions'),main.querySelector('.dataset-strip')]);controls.append(secondary);
    remember(key);
    const plot=main.querySelector('#lesson-plot');
    plot.addEventListener('click',event=>{if(event.target.closest('[data-point-index],[data-query],[data-training-row],[data-validation-row],[data-logistic-row],[data-forest-hit],[data-svm-hit],[data-km-hit],[data-pca-hit],[data-mlp-hit],[data-q-cell],[data-tree-hit]'))(main.querySelector('#studio-inspector')||diagnostics).open=true;});
    plot.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight'].includes(event.key))(main.querySelector('#studio-inspector')||diagnostics).open=true;});
  }
  function comparison(key){
    observer?.disconnect();main.querySelector('.page').classList.add('chart-first');
    toolbar(main.querySelector('.compare-shared'));
    const results=main.querySelector('.comparison-results'),summary=main.querySelector('#compare-summary,#cluster-summary');
    const nodes=[...results.children].filter(n=>n!==summary&&!n.matches('h2,.comparison-results-heading'));
    results.querySelector('h2,.comparison-results-heading')?.remove();
    const details=disclosure('comparison-details','Metrics, observations & experiment details',nodes);results.append(details);
    const cluster=key==='compare/clustering',prefix=cluster?'cluster':'compare';
    const headlines=[];
    for(const card of main.querySelectorAll('.compare-card')){
      const side=card.id.includes('-left-')?'left':'right',headline=document.createElement('div');headline.className='headline-metrics compare-headline';headline.setAttribute('role','group');headline.setAttribute('aria-label',cluster?'Fit-row metrics':'Validation metrics');card.querySelector('.compare-equation').after(headline);headlines.push([side,headline]);
      const nodes=[...card.children].filter(n=>n.matches('.compare-provenance,.run-timing,.settings-history-note,[id$="-confusion"]'));
      if(nodes.length)card.append(disclosure(card.id+'-details','Run details',nodes));
    }
    const update=()=>{for(const [side,headline] of headlines){headline.replaceChildren(...(cluster?[['inertia','Inertia · fit rows'],['silhouette','Silhouette · fit rows']]:[['accuracy','Validation accuracy'],['f1','Validation F1']]).map(([metric,label])=>{
      const item=document.createElement('div');item.className='headline-item';const name=document.createElement('span'),value=document.createElement('span');name.className='headline-label';name.textContent=label;value.className='headline-value';value.textContent=main.querySelector(`[data-${prefix}-metric="${side}-${metric}"]`)?.textContent||'—';item.append(name,value);return item;
    }));}};refresh=update;update();observer=new MutationObserver(update);observer.observe(details,{subtree:true,childList:true,characterData:true});
    for(const plot of main.querySelectorAll('.compare-plot')){
      plot.addEventListener('click',event=>{if(event.target.closest('[data-compare-row],[data-cluster-point]'))details.open=true;});
      plot.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight'].includes(event.key))details.open=true;});
    }
    remember(key);
  }
  function disconnect(){observer?.disconnect();observer=null;}
  return {lesson,comparison,disconnect,refresh:()=>refresh()};
}
