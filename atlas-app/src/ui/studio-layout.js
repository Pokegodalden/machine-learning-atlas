// v2.0 composes the existing lesson DOM, so workers and control bindings retain
// their numerical behavior. Data tools keep their own drafts and open state.
export function createStudioLayout({main,redraw}){
 const openStates=new Map();let chapterObserver=null;
 const $=selector=>main.querySelector(selector);
 function section(id,label,nodes,className=''){
  const box=document.createElement('details');box.id=id;box.className='studio-disclosure '+className;
  const summary=document.createElement('summary');summary.textContent=label;
  const body=document.createElement('div');body.className='studio-disclosure-body';box.append(summary,body);
  for(const node of nodes)if(node)body.append(node);return box;
 }
 function remember(key){
  for(const box of main.querySelectorAll('details[id^="studio-"]')){
   const stored=openStates.get(key+'|'+box.id);if(stored!==undefined)box.open=stored;
   box.addEventListener('toggle',()=>{if(!box.isConnected)return;openStates.set(key+'|'+box.id,box.open);if(box.open)redraw();});
  }
 }
 function tools(dataNodes,viewNodes=[]){
  const bar=$('.workspace-tools');
  const data=section('studio-data','Data',[...dataNodes,$('#task-data-workbench'),$('#data-workbench'),$('#csv-workbench')],'studio-tool');bar.prepend(data);
  if(viewNodes.length){const view=section('studio-view','View',viewNodes,'studio-tool');data.after(view);}
  const guide=$('#lesson-guide>summary');if(guide)guide.textContent='Related lessons';
 }
 function lesson(key){
  disconnect();const page=$('.page'),layout=$('.lesson-layout'),stage=$('.stage-wrap');page.classList.add('studio-lesson');
  const sidebar=$('.lesson-sidebar'),guideBody=$('#lesson-guide>.chart-disclosure-body');
  const story=document.createElement('nav');story.className='studio-story';story.setAttribute('aria-label','Lesson chapters');
  const chapters=sidebar.querySelector('.chapter-list');story.append(chapters);$('.workspace-tools').before(story);
  guideBody.append(sidebar.querySelector('.related'));sidebar.remove();
  const context=document.createElement('aside');context.id='studio-context';context.className='studio-context';context.setAttribute('aria-label','Current teaching step and observation inspection');
  context.innerHTML='<div class="kicker">The idea</div><h2 id="studio-step-title"></h2>';
  context.append($('#scene-description'));layout.append(context);
  const reflection=section('studio-reflect','Pause & explain',[$('.reflection')]);context.append(reflection);
  const inspection=$('#lesson-details .point-inspector,#lesson-details .q-inspector,#lesson-details .knn-vote-panel');
  if(inspection){const inspector=section('studio-inspector','Inspect an observation',[$('#lesson-details .knn-query-fields'),inspection]);reflection.before(inspector);}
  const dataNodes=[];
  for(const node of [...stage.children]){if(node.matches('.plot-surface'))break;if(!node.matches('.stage-head'))dataNodes.push(node);}
  const viewNodes=[...main.querySelectorAll('#lesson-details .knn-view-controls,#lesson-details .linear-tools,#lesson-details .truth-row')];
  tools([...dataNodes,$('.dataset-strip')],viewNodes);
  const controls=$('.controls-panel');controls.classList.add('studio-instruments');
  const equation=$('#lesson-equation'),runbar=document.createElement('div');runbar.className='studio-equation-row';runbar.id='studio-equation-row';equation.before(runbar);runbar.append(equation);
  const actions=controls.querySelector('.panel-actions');runbar.append(actions);const cancel=$('#cancel-run');if(cancel)actions.append(cancel);
  runbar.after(controls);
  const caption=controls.querySelector('.panel-caption');caption.textContent=key==='lesson/linear-regression'?'Manual coefficients change the candidate line. Fit estimates them from the training rows.':'Training settings shape the next fit. View controls only change how you inspect it.';
  controls.querySelector('h2').textContent=key==='lesson/linear-regression'?'Explore the coefficients':'Training settings';
  $('#parameter-actions>summary').textContent='Reset, restore & saved setups';
  const updateChapter=()=>{const current=chapters.querySelector('[aria-current="step"]');$('#studio-step-title').textContent=current?.querySelector('span:last-child')?.textContent||'Explore the model';};
  updateChapter();chapterObserver=new MutationObserver(updateChapter);chapterObserver.observe(chapters,{subtree:true,attributes:true,attributeFilter:['aria-current']});
  remember(key);
 }
 function comparison(key){
  disconnect();$('.page').classList.add('studio-comparison');const shared=$('.compare-shared');
  const data=shared.firstElementChild,facts=shared.querySelector('.shared-facts'),label=document.createElement('div');label.className='studio-shared-caption';
  const selected=data.querySelector('select'),name=data.querySelector('#cluster-data-name');
  const heading=document.createElement('span');heading.className='kicker';heading.textContent='One dataset. Two experiments.';
  const value=document.createElement('strong');value.textContent=selected?.selectedOptions[0]?.textContent||name?.textContent||'Shared observations';label.append(heading,value);shared.prepend(label);
  tools([data,facts]);remember(key);
 }
 function disconnect(){chapterObserver?.disconnect();chapterObserver=null;}
 return {lesson,comparison,disconnect};
}
