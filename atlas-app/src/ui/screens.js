import {createSharedExperiments} from './shared-experiment.js';
import {algorithmArt} from './algorithm-art.js';
import {createAtlasMotion} from './atlas-motion.js';
import {logisticMetrics} from '../engine/logistic-regression.js';
import {createAtlasEdition} from './atlas-edition.js';
import {createStudioLayout} from './studio-layout.js';
import {captureLessonView,mountLessonPanel,restoreLessonView} from './lesson-view.js';
import {createChartFirst} from './chart-first.js';
import {createGuidedActivities} from './guided-activities.js';
import {createClusteringComparisonScreen} from './clustering-comparison-screen.js';
import {mountRunTiming,timingMarkup} from './run-timing.js';
import {SettingsHistory} from '../core/settings-history.js';
import {createCsvWorkbench} from './csv-workbench.js';
import {TaskDataContext,taskModels} from '../core/task-data-context.js';
import {createTaskDataWorkbench} from './task-data-workbench.js';
import {experimentDataset} from '../core/experiment-library.js';
import {createExperimentNotebook} from './experiment-notebook.js';
import {validateExperiment,resultOutput} from '../core/experiment-library.js';
import {createQlearningLesson} from '../lessons/q-learning-lesson.js';
import {createMlpLesson} from '../lessons/mlp-lesson.js';
import {createPcaLesson} from '../lessons/pca-lesson.js';
import {createKmeansLesson} from '../lessons/kmeans-lesson.js';
import {createSvmLesson} from '../lessons/svm-lesson.js';
import {createForestLesson} from '../lessons/forest-lesson.js';
import {createTreeLesson} from '../lessons/tree-lesson.js';
import {createComparisonScreen} from './comparison-screen.js';
import {createLogisticLesson} from '../lessons/logistic-lesson.js';
import {createKnnLesson} from '../lessons/knn-lesson.js';
import {createLinearLesson,animateLine} from '../lessons/linear-lesson.js';
import {defaults,validateParameters,parameterDefinitions as definitions} from '../core/parameters.js';
import {Experiment,requestKey} from '../core/experiment.js';
import {saveSetup,loadSetup} from '../core/persistence.js';
import {executeInWorker} from '../engine/worker-client.js';
import {createControls} from './parameter-controls.js';
import {createScenes} from '../scenes/stage.js';
export function startApp(D) {
  const main = document.getElementById('main');
  const atlasMotion=createAtlasMotion(main);
  const entries = new Map(D.catalog.entries.map(e => [e.id, e]));
  const lessons = new Map(D.plan.lessons.map(l => [l.catalogEntryId, l]));
  const families = new Map(D.taxonomy.families.map(f => [f.id, f.label]));
  const learningLabels = new Map(D.taxonomy.learningTypes.map(f => [f.id, f.label.replace(' learning', '')]));
  const sources = new Map(D.catalog.sources.map(s => [s.id, s]));
  const state = { search: '', type: 'all', task: 'all', family: 'all', firstTen: false,
    level: 'beginner', lastLesson: 'linear-regression', beat: 0, playing: false, speed: 1,
    selectedPoint: 6, fitted: false, modelParams: {} };
  let timer = null,linearMotionJob=null,linearMotionTarget=null;
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = (x, digits=3) => Number.isFinite(Number(x)) ? Number(x).toLocaleString('en-US', {maximumFractionDigits:digits}) : '—';
  const announce = message => { document.getElementById('announcer').textContent = message; };
  const stopPlayback = () => { clearInterval(timer); timer = null; state.playing = false; };
  const route = () => location.hash.slice(1).split('/').filter(Boolean);
  const go = path => { location.hash = path; };
  const initialParameters=id=>defaults(entries.get(id),lessons.get(id));
  const config=id=>state.modelParams[id] ||= initialParameters(id);
  const parameterDefinitions=id=>definitions(entries.get(id),lessons.get(id),id==='linear-regression'?linearDataset():null);
  const taskData=new TaskDataContext(D.datasets),linearDataset=()=>taskData.dataset('linear-regression');
  const experiment=new Experiment();
  const request=()=>({schemaVersion:'1.0.0',modelId:'linear-regression',datasetId:'line-noise',datasetRevision:linearDataset().revision,adapterVersion:'ols-1',modelSeed:7,preprocessing:'none',evaluation:'validation',parameters:{'fit-intercept':config('linear-regression')['fit-intercept']}});
  function updateRunUI(){
    if(route().join('/')!=='lesson/linear-regression')return;
    const status=document.getElementById('run-status');if(!status)return;
    status.textContent=state.linearMotion?'Visual transition · fit computed':experiment.status==='running'?'Fitting on training rows':experiment.status==='requires-new-run'?'Earlier fit · run again':experiment.status==='failed'?'Run failed':experiment.status==='canceled'?'Run canceled':state.fitted?'Fitted on training rows':experiment.result?'Manual exploration · earlier fit saved':'Manual exploration';
    const fit=document.getElementById('fit-preview');if(fit)fit.disabled=experiment.status==='running'||!!state.linearMotion;
    const cancel=document.getElementById('cancel-run');if(cancel){cancel.disabled=experiment.status!=='running'&&!state.linearMotion;cancel.textContent=state.linearMotion?'Stop transition':'Cancel run';}
    const message=document.getElementById('setup-status');if(message&&experiment.status==='failed')message.textContent=experiment.error;
  }
  experiment.subscribe(updateRunUI);
  const onParameterChange=(id,p)=>{if(id==='q-learning'){qLesson.settingsChanged();return;}if(id==='mlp'){mlpLesson.settingsChanged();return;}if(id==='pca'){pcaLesson.settingsChanged();return;}if(id==='kmeans'){kmeansLesson.settingsChanged();return;}if(id==='svm'){svmLesson.settingsChanged(p);return;}if(id==='random-forest'){forestLesson.settingsChanged();return;}if(id==='decision-tree'){treeLesson.settingsChanged();return;}if(id==='knn'){knnLesson.settingsChanged();return;}if(id==='logistic-regression'){logisticLesson.settingsChanged(p);return;}if(id!=='linear-regression')return;stopLinearMotion(false);if(p.category==='training')experiment.update(request());else if(p.category==='exploration'&&experiment.status==='running')experiment.cancel();};
  const {redrawPlots,observePlots,disconnectPlots}=createScenes({getLinearDataset:linearDataset,main,D,state,config,route,lessons,fmt,esc,announce,drawQlearning:container=>qLesson.draw(container),drawMlp:container=>mlpLesson.draw(container),drawPca:container=>pcaLesson.draw(container),drawKmeans:container=>kmeansLesson.draw(container),drawSvm:container=>svmLesson.draw(container),drawForest:container=>forestLesson.draw(container),drawTree:container=>treeLesson.draw(container),drawComparison:()=>route()[1]==='clustering'?clusteringComparison.draw():comparison.draw(),drawKnn:container=>knnLesson.draw(container),drawLogistic:container=>logisticLesson.draw(container),onSceneDrawn:()=>{updateRunUI();linearLesson.refresh();refreshRunTiming();edition.refresh();}});
  const linearLesson=createLinearLesson({state,getDataset:linearDataset,config,experiment,redraw:redrawPlots,fmt,esc,announce});
  const chartFirst=createChartFirst({main,redraw:redrawPlots});
  const studio=createStudioLayout({main,redraw:redrawPlots});
  const knnLesson=createKnnLesson({state,D,config,fmt,esc,announce,isActive:()=>route().join('/')==='lesson/knn',onRender:options=>renderLesson('knn',options),stopPlayback});
  const logisticLesson=createLogisticLesson({state,D,config,fmt,esc,announce,isActive:()=>route().join('/')==='lesson/logistic-regression',onRender:options=>renderLesson('logistic-regression',options),stopPlayback});
  const treeLesson=createTreeLesson({state,D,config,fmt,esc,announce,isActive:()=>route().join('/')==='lesson/decision-tree',onRender:options=>renderLesson('decision-tree',options),stopPlayback});
  const forestLesson=createForestLesson({state,D,config,fmt,esc,announce,isActive:()=>route().join('/')==='lesson/random-forest',onRender:options=>renderLesson('random-forest',options),stopPlayback,openComparison:(datasetId,parameters)=>{const c=comparison.coordinator;c.setDataset(datasetId);c.setModel('left','random-forest');c.setParameters('left',parameters);c.setModel('right','decision-tree');c.setParameters('right',{'max-depth':parameters['max-depth'],'min-leaf':3});go('/compare');}});
  const svmLesson=createSvmLesson({state,D,config,fmt,esc,announce,isActive:()=>route().join('/')==='lesson/svm',onRender:options=>renderLesson('svm',options),stopPlayback,openComparison:(datasetId,parameters)=>{const c=comparison.coordinator;c.setDataset(datasetId);c.setModel('left','svm');c.setParameters('left',{...parameters,kernel:'linear'});c.setModel('right','svm');c.setParameters('right',{...parameters,kernel:'rbf'});go('/compare');}});
  const kmeansLesson=createKmeansLesson({getDataset:()=>taskData.dataset('kmeans'),state,D,config,fmt,esc,announce,isActive:()=>route().join('/')==='lesson/kmeans',onRender:options=>renderLesson('kmeans',options),stopPlayback});
  const pcaLesson=createPcaLesson({getDataset:()=>taskData.dataset('pca'),state,D,config,fmt,esc,announce,isActive:()=>route().join('/')==='lesson/pca',onRender:options=>renderLesson('pca',options),stopPlayback});
  const mlpLesson=createMlpLesson({state,D,config,fmt,esc,announce,isActive:()=>route().join('/')==='lesson/mlp',onRender:options=>renderLesson('mlp',options),stopPlayback,openComparison:(datasetId,parameters)=>{const c=comparison.coordinator;c.setDataset(datasetId);c.setModel('left','mlp');c.setParameters('left',parameters);c.setModel('right','logistic-regression');c.setParameters('right',{c:1,threshold:.5});go('/compare');}});
  const qLesson=createQlearningLesson({state,D,config,fmt,esc,announce,isActive:()=>route().join('/')==='lesson/q-learning',onRender:options=>renderLesson('q-learning',options),stopPlayback});
  const comparison=createComparisonScreen({D,main,fmt,esc,announce,isActive:()=>route()[0]==='compare'&&route()[1]!=='clustering',onRender:renderCompare});
  const clusteringComparison=createClusteringComparisonScreen({D,main,fmt,esc,announce,isActive:()=>route().join('/')==='compare/clustering',onRender:renderCompare});
  const lessonHistories=new Map();
  const controllers={'linear-regression':{experiment,request,dataset:linearDataset},knn:knnLesson,'logistic-regression':logisticLesson,'decision-tree':treeLesson,'random-forest':forestLesson,svm:svmLesson,kmeans:kmeansLesson,pca:pcaLesson,mlp:mlpLesson,'q-learning':qLesson};
  const edition=createAtlasEdition({main,redraw:redrawPlots,esc,fmt,catalog:D.catalog,
    readLesson:id=>{const api=controllers[id],e=api.experiment;return {dataset:api.dataset(),parameters:{...config(id)},selectedRow:state.selectedPoint,status:e.status,threshold:id==='logistic-regression'?config(id).threshold:undefined,result:id==='logistic-regression'&&e.result?.request.datasetRevision===api.dataset().revision?{...e.result,metrics:logisticMetrics(e.result,api.dataset(),config(id).threshold)}:e.result,current:e.status==='completed'&&!!e.result&&e.result.configKey===requestKey(api.request())&&(id!=='linear-regression'||state.fitted&&!state.linearMotion)};},
    readComparison:()=>{const c=route()[1]==='clustering'?clusteringComparison.coordinator:comparison.coordinator;return {sides:Object.fromEntries(['left','right'].map(side=>[side,{...c.view(side),current:!!c.current(side),name:entries.get(c.sides[side].modelId).name}]))};}
  });
  const historyContext=id=>id+'|'+controllers[id].dataset().revision;
  function historyFor(id){if(!lessonHistories.has(id))lessonHistories.set(id,new SettingsHistory());return lessonHistories.get(id).sync(historyContext(id));}
  function refreshHistoryControl(id){const button=document.getElementById('restore-previous');if(button&&route().join('/')==='lesson/'+id)button.disabled=!historyFor(id).canRestore(historyContext(id));}
  function recordSettings(id,before,after){historyFor(id).record(historyContext(id),before,after);refreshHistoryControl(id);}
  function restoreLessonSettings(id){const values=historyFor(id).restore(historyContext(id),value=>validateParameters(value,parameterDefinitions(id)));if(!values)return;stopPlayback();stopLinearMotion(false);if(id==='linear-regression')experiment.cancel();state.modelParams[id]=values;const api=controllers[id];api.settingsChanged?.();api.experiment.update(api.request());
    if(id==='linear-regression'){const m=experiment.result?.model;state.fitted=experiment.status==='completed'&&m?.slope===values.slope&&m?.intercept===values.intercept;}
    renderLesson(id);const button=document.getElementById('restore-previous');(button.disabled?document.getElementById('reset-parameters'):button).focus();const current=api.experiment.status==='completed'&&(id!=='linear-regression'||state.fitted),message='Previous parameters restored. '+(current?'The retained fit matches the training settings.':'Run the model to compute results for these settings.');document.getElementById('setup-status').textContent=message;announce(message);
  }
  function refreshRunTiming(){const box=document.getElementById('lesson-run-timing'),id=route()[1],api=controllers[id];if(!box||!api)return;const e=api.experiment,current=e.status==='completed'&&e.result?.configKey===requestKey(api.request())&&(id!=='linear-regression'||state.fitted&&!state.linearMotion);box.innerHTML=timingMarkup(e.result,{current,status:e.status,modelId:id});}
  function notebookContext(){const [section,id]=route();if(section==='compare'){const cluster=id==='clustering',c=cluster?clusteringComparison.coordinator:comparison.coordinator;return {kind:cluster?'clustering-comparison':'comparison',datasetId:c.datasetId,generator:c.datasetOverride?.generator||null,imported:c.datasetOverride?.imported||null,scaling:c.scaling,models:['left','right'].map(side=>({modelId:c.sides[side].modelId,parameters:c.sides[side].parameters})),level:state.level,chapter:0};}if(section==='lesson'&&controllers[id])return {kind:'lesson',datasetId:controllers[id].dataset().id,generator:controllers[id].dataset().generator||null,imported:controllers[id].dataset().imported||null,models:[{modelId:id,parameters:config(id)}],level:state.level,chapter:state.beat};return null;}
  function notebookOutputs(){const c=notebookContext();if(!c)return [];if(c.kind!=='lesson'){const coordinator=c.kind==='clustering-comparison'?clusteringComparison.coordinator:comparison.coordinator;const pair=coordinator.pair();if(!pair)return [];return ['left','right'].map(side=>{const view=pair[side];return resultOutput(D,view.result,coordinator.sides[side].parameters,coordinator.dataset());});}const id=c.models[0].modelId,api=controllers[id],e=api.experiment;if(e.status!=='completed'||!e.result||e.result.configKey!==requestKey(api.request())||(id==='linear-regression'&&(!state.fitted||state.linearMotion)))return [];return [resultOutput(D,e.result,config(id),api.dataset())];}
  async function openSavedExperiment(savedDocument,run=false){
    const doc=validateExperiment(savedDocument,D),c=doc.configuration;lessonHistories.clear();clusteringComparison.coordinator.resetHistory();clusteringComparison.timingStudy.cancel();clusteringComparison.coordinator.cancelAll();comparison.coordinator.resetHistory();stopPlayback();stopLinearMotion(true);kmeansLesson.stopTrace();qLesson.stopTrace();for(const api of Object.values(controllers))api.experiment.cancel();comparison.coordinator.cancelAll();
    let target;if(c.kind==='clustering-comparison'){clusteringComparison.coordinator.restoreSettings(c.dataset.id,c.models,{generator:c.dataset.generator||null,imported:c.dataset.imported||null});target='/compare/clustering';}
    else if(c.kind==='comparison'){comparison.coordinator.restoreSettings(c.dataset.id,c.models,{generator:c.dataset.generator||null,imported:c.dataset.imported||null,scaling:c.comparisonScaling??'standardize-train'});target='/compare';}
    else{const m=c.models[0],id=m.modelId,api=controllers[id],datasetState={knn:'knn','logistic-regression':'logistic','decision-tree':'tree','random-forest':'forest',svm:'svm',mlp:'mlp'}[id];state.modelParams[id]=structuredClone(m.parameters);if(datasetState)state[datasetState].datasetId=c.dataset.id;
      if(taskModels[id])taskData.restore(id,c.dataset.generator||null,c.dataset.imported||null);const d=experimentDataset(D,c.dataset);if(id==='logistic-regression'){state.logistic.rowId=null;state.logistic.query=c.dataset.id==='two-moons'?[.5,.25]:[0,0];}if(id==='decision-tree'){state.tree.selectedRow=d.partitions.validation[0];state.tree.nodeId=0;}if(id==='random-forest'){state.forest.selectedRow=null;state.forest.treeIndex=0;}if(id==='svm'){state.svm.selectedRow=null;state.svm.supportId=null;}if(id==='mlp'){state.mlp.row=d.partitions.train[0];state.mlp.frame=0;state.mlp.layer=0;state.mlp.neuron=0;}if(id==='kmeans'){state.kmeans.frame=0;state.kmeans.row=0;state.kmeans.reference=false;state.kmeans.history=[];}if(id==='pca'){state.pca.row=0;state.pca.history=[];}if(id==='q-learning'){state.q.cell=d.start[0]*d.columns+d.start[1];state.q.frame=1;state.q.step=1;}if(id==='linear-regression'){state.fitted=false;state.selectedPoint=6;}
      api.experiment.result=null;api.settingsChanged?.();api.experiment.update(api.request());target='/lesson/'+id;
    }
    state.level=c.presentation.level;state.beat=c.presentation.chapter;
    if(location.hash==='#'+target)renderRoute();else await new Promise(resolve=>{window.addEventListener('hashchange',resolve,{once:true});go(target);});
    if(location.hash!=='#'+target)return;
    if(run){if(c.kind==='clustering-comparison')clusteringComparison.coordinator.runBoth();else if(c.kind==='comparison')comparison.coordinator.runBoth();else document.getElementById('fit-preview').click();announce('Saved experiment opened. Recomputing results from the saved configuration.');}
    else announce('Saved settings restored. Run the experiment to compute current results.');
  }
  const sharing=createSharedExperiments({D,main,esc,announce,onOpen:openSavedExperiment});
  const notebook=createExperimentNotebook({D,main,esc,announce,context:notebookContext,onOpen:openSavedExperiment,sharing,outputs:notebookOutputs,timingStudy:()=>route()[0]==='compare'?(route()[1]==='clustering'?clusteringComparison:comparison).timingStudy.record():null,isActive:()=>route()[0]==='library'});
  const guided=createGuidedActivities({main,route,esc,fmt,announce,onRender:renderRoute,read:()=>{const c=notebookContext();return {dataset:c?.kind==='comparison'?comparison.coordinator.dataset():c?.kind==='lesson'?controllers[c.models[0].modelId].dataset():null,outputs:notebookOutputs()};}});
  for(const api of Object.values(controllers))api.experiment.subscribe(()=>{notebook.refreshActions();refreshRunTiming();guided.refresh();edition.refresh();});comparison.coordinator.subscribe(()=>{notebook.refreshActions();guided.refresh();edition.refresh();});clusteringComparison.coordinator.subscribe(()=>{notebook.refreshActions();edition.refresh();});
  function applyTaskData(id,descriptor=null,imported=null){
    // Generate and validate before canceling or changing the active experiment.
    taskData.restore(id,descriptor,imported);stopPlayback();stopLinearMotion(false);const api=controllers[id];
    if(id==='linear-regression'){state.fitted=false;state.selectedPoint=taskData.dataset(id).partitions.train[0];}
    if(id==='kmeans'){kmeansLesson.stopTrace();Object.assign(state.kmeans,{row:0,frame:0,reference:false,history:[]});}
    if(id==='pca')Object.assign(state.pca,{row:0,history:[]});
    api.experiment.cancel();api.settingsChanged?.();api.experiment.update(api.request());renderLesson(id);
  }
  const taskWorkbench=createTaskDataWorkbench({main,context:taskData,esc,fmt,announce,onApply:applyTaskData});
  const clusterTaskWorkbench=createTaskDataWorkbench({main,context:{dataset:()=>clusteringComparison.coordinator.dataset()},anchor:'.compare-shared',esc,fmt,announce,onApply:(id,generator)=>{clusteringComparison.coordinator.setData(generator);renderCompare();}});
  function csvContext(){const [section,id]=route();if(section==='compare'&&id==='clustering')return {key:'clustering-comparison',task:'clustering',dataset:clusteringComparison.coordinator.dataset(),anchor:'.compare-shared'};if(section==='compare')return {key:'compare',task:'classification',dataset:comparison.coordinator.dataset(),scaling:comparison.coordinator.scaling};const task={'linear-regression':'regression',kmeans:'clustering',pca:'pca'}[id];return section==='lesson'&&task?{key:id,task,dataset:controllers[id].dataset()}:null;}
  const csvWorkbench=createCsvWorkbench({main,esc,fmt,announce,context:csvContext,onApply:(imported,scaling)=>{const c=csvContext();if(c.key==='clustering-comparison'){clusteringComparison.coordinator.setImportedData(imported);renderCompare();}else if(c.key==='compare'){comparison.coordinator.setImportedData(imported,scaling);renderCompare();}else applyTaskData(c.key,null,imported);}});
  const narrowLesson=matchMedia('(max-width: 820px)');
  function arrangeLinearControls(){
    if(!['lesson/linear-regression','lesson/knn','lesson/logistic-regression','lesson/decision-tree','lesson/random-forest','lesson/svm','lesson/kmeans','lesson/pca','lesson/mlp','lesson/q-learning'].includes(route().join('/')))return;
    const panel=main.querySelector('.controls-panel'),equation=document.getElementById('lesson-equation');if(!panel||!equation)return;
    if(main.querySelector('.studio-lesson')){main.querySelector('#studio-equation-row').after(panel);panel.classList.add('inline-controls');return;}
    if(narrowLesson.matches){(main.querySelector('#headline-metrics')||equation).after(panel);panel.classList.add('inline-controls');}
    else{main.querySelector('.lesson-layout').append(panel);panel.classList.remove('inline-controls');}
  }
  narrowLesson.addEventListener('change',arrangeLinearControls);
  const {controlMarkup,bindControls}=createControls({main,state,config,parameterDefinitions,esc,fmt,setBeat,redrawPlots,onParameterChange,onSettingsChange:recordSettings,beginEdit:id=>historyFor(id).begin(historyContext(id),config(id)),endEdit:id=>historyFor(id).end()});
  function syncCoefficients(){
    const p=config('linear-regression');for(const key of ['slope','intercept']){
      const number=main.querySelector(`[data-param-number="${key}"]`);if(number)number.value=String(Number(p[key].toFixed(5)));
      const range=main.querySelector(`[data-param-range="${key}"]`);if(range)range.value=String(p[key]);
      const dial=main.querySelector(`[data-dial="${key}"]`);if(dial){const def=parameterDefinitions('linear-regression').find(p=>p.id===key);dial.setAttribute('aria-valuenow',String(p[key]));dial.querySelector('.dial-needle').style.transform=`rotate(${-135+(p[key]-def.minimum)/(def.maximum-def.minimum)*270}deg)`;}
    }
  }
  function stopLinearMotion(snap){
    if(!linearMotionJob)return;linearMotionJob.cancel();linearMotionJob=null;state.linearMotion=false;
    if(snap){Object.assign(config('linear-regression'),linearMotionTarget);state.fitted=true;syncCoefficients();}
    linearMotionTarget=null;updateRunUI();
  }
  const normalize = value => value.toLowerCase().replace(/-/g, ' ').replace(/\s+/g,' ').trim();

  function glyph(family,id) {
    if(['linear-regression','knn','logistic-regression','decision-tree','random-forest','svm','kmeans','pca','mlp','q-learning'].includes(id))return algorithmArt(id).replace('class="algorithm-art"','class="algorithm-art mini-glyph"');
    const start = `<svg class="mini-glyph" data-icon-family="${esc(family)}" viewBox="0 0 58 38" aria-hidden="true"><g fill="none" stroke="#58c4dd" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">`;
    let paths = '';
    if (family.includes('tree') || family === 'ensembles') paths = '<path d="M29 5V12M29 12L13 23M29 12L45 23M13 23L7 33M13 23L20 33M45 23L38 33M45 23L51 33"/><circle cx="29" cy="5" r="3" fill="#ffff00" stroke="none"/>';
    else if (family === 'neural-networks' || family.includes('generative')) paths = '<path d="M8 10L28 7L49 19M8 10L28 19L49 19M8 28L28 19M8 28L28 31L49 19"/><circle cx="8" cy="10" r="3"/><circle cx="8" cy="28" r="3"/><circle cx="28" cy="7" r="3"/><circle cx="28" cy="19" r="3"/><circle cx="28" cy="31" r="3"/><circle cx="49" cy="19" r="3" stroke="#ffff00"/>';
    else if (family === 'clustering' || family.includes('instance')) paths = '<circle cx="17" cy="13" r="11" opacity=".45"/><circle cx="41" cy="25" r="11" opacity=".45"/><path d="M12 13h10M17 8v10M36 25h10M41 20v10" stroke="#ffff00"/><circle cx="10" cy="8" r="1.5"/><circle cx="22" cy="17" r="1.5"/><circle cx="43" cy="31" r="1.5"/>';
    else if (family === 'dimensionality-reduction') paths = '<path d="M8 29L48 9M15 6L38 33" opacity=".5"/><ellipse cx="28" cy="19" rx="22" ry="7" transform="rotate(-27 28 19)"/><path d="M9 29L49 8" stroke="#ffff00"/>';
    else if (family === 'reinforcement-learning') paths = '<path d="M4 5h45v28H4zM19 5v28M34 5v28M4 19h45" opacity=".4"/><path d="M11 27V12H42" stroke="#ffff00"/><circle cx="42" cy="12" r="3" fill="#ffff00" stroke="none"/>';
    else if (family.includes('probabilistic') || family.includes('density')) paths = '<path d="M3 32C13 32 17 7 29 7S43 32 55 32"/><path d="M3 32h52" opacity=".4"/><path d="M29 7v25" stroke="#ffff00"/>';
    else paths = '<path d="M5 32h48M8 35V4" opacity=".4"/><path d="M9 29L49 8" stroke="#ffff00"/><circle cx="16" cy="24" r="2" fill="#58c4dd"/><circle cx="29" cy="21" r="2" fill="#58c4dd"/><circle cx="42" cy="11" r="2" fill="#58c4dd"/>';
    return start + paths + '</g></svg>';
  }

  function atlasMap() {
    const types = [['supervised','Supplied answers',110,42],['unsupervised','Hidden structure',330,42],['reinforcement','Rewards',535,42],['semi-supervised','A few answers',185,154],['self-supervised','Data supplies targets',445,154]];
    return '<svg class="atlas-map" viewBox="0 0 610 205" role="group" aria-label="Choose a learning type">' +
      '<path class="map-path" d="M305 97L110 47M305 97L330 47M305 97L535 47M305 97L185 151M305 97L445 151"/>' +
      '<circle cx="305" cy="97" r="4" fill="#ffff00"/><text x="305" y="121" text-anchor="middle" style="font-size:12px;fill:#afb8c5">Learning signal</text>' +
      types.map(([id,caption,x,y]) => `<g role="button" tabindex="0" data-learning="${id}" aria-label="Filter ${esc(learningLabels.get(id))}" aria-pressed="${state.type === id}"><rect x="${x-80}" y="${y-30}" width="160" height="66" fill="transparent"/><circle class="map-dot" cx="${x}" cy="${y}" r="4"/><text x="${x}" y="${y-13}" text-anchor="middle">${esc(learningLabels.get(id))}</text><text x="${x}" y="${y+23}" text-anchor="middle" style="font-size:11px;fill:#afb8c5">${esc(caption)}</text></g>`).join('') + '</svg>';
  }

  function renderExplore() {
    main.innerHTML = `<div class="page"><section class="hero"><div><h1>Explore the mathematics<br>of machine learning.</h1><p>Discover how different models learn. Follow a visual explanation, change a parameter, and connect the result to the idea.</p></div>${atlasMap()}</section><section class="catalog-layout" id="catalog"><aside class="catalog-sidebar" aria-label="Catalog filters"><div class="filter-group type-filter"><h2>How it learns</h2><div>${[['all','All learning types'],...D.taxonomy.learningTypes.map(t=>[t.id,learningLabels.get(t.id)])].map(([id,label])=>`<button class="type-button" data-learning="${id}" aria-pressed="${state.type===id}"><span>${esc(label)}</span><span>${id==='all'?D.catalog.entries.length:D.catalog.entries.filter(e=>e.learningTypes.includes(id)).length}</span></button>`).join('')}</div></div><div class="filter-group"><label for="task-filter">Problem to solve</label><select id="task-filter"><option value="all">All tasks</option>${D.taxonomy.tasks.map(t=>`<option value="${t.id}" ${state.task===t.id?'selected':''}>${esc(t.label)}</option>`).join('')}</select></div><div class="filter-group"><label for="family-filter">Model family</label><select id="family-filter"><option value="all">All families</option>${D.taxonomy.families.map(t=>`<option value="${t.id}" ${state.family===t.id?'selected':''}>${esc(t.label)}</option>`).join('')}</select></div><p class="sidebar-note">An algorithm can belong to more than one learning type.</p></aside><div><div class="catalog-toolbar"><label class="search-wrap"><span class="sr-only">Search algorithms, aliases, or tasks</span><span class="search-icon" aria-hidden="true"></span><input id="catalog-search" type="search" placeholder="Search algorithms, aliases, or tasks…" value="${esc(state.search)}"></label><label class="lesson-filter"><input type="checkbox" id="first-ten" ${state.firstTen?'checked':''}> First 10 lessons</label></div><div class="catalog-summary"><span id="result-count" role="status" aria-live="polite"></span><span>Algorithms · architectures · training methods</span></div><div class="catalog-grid" id="catalog-cards"></div></div></section></div>`;
    const curriculum=document.createElement('section');curriculum.className='studio-curriculum';curriculum.setAttribute('aria-label','Ten interactive visual lessons');curriculum.innerHTML=`<div class="studio-section-heading"><div><div class="kicker">The visual lessons</div><h2>Start with an idea. Follow the mathematics.</h2></div><span class="small muted">10 interactive lessons</span></div><div class="studio-lesson-index">${D.plan.lessons.map((l,i)=>`<a href="#/lesson/${l.catalogEntryId}"><span class="studio-index-number">${String(i+1).padStart(2,'0')}</span>${glyph(entries.get(l.catalogEntryId).primaryFamily,l.catalogEntryId)}<span>${esc(entries.get(l.catalogEntryId).name)}</span></a>`).join('')}</div>`;main.querySelector('#catalog').before(curriculum);
    renderCards();edition.explore();
    document.getElementById('catalog-search').addEventListener('input', e => {state.search=e.target.value;renderCards();});
    document.getElementById('task-filter').addEventListener('change', e=>{state.task=e.target.value;renderCards();});
    document.getElementById('family-filter').addEventListener('change', e=>{state.family=e.target.value;renderCards();});
    document.getElementById('first-ten').addEventListener('change', e=>{state.firstTen=e.target.checked;renderCards();});
    main.querySelectorAll('.type-button[data-learning]').forEach(el=>{
      const activate=()=>{state.type=el.dataset.learning;main.querySelectorAll('[data-learning]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.learning===state.type)));renderCards();};
      el.addEventListener('click',activate);
      if(el.tagName.toLowerCase()==='g')el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}});
    });
  }

  function renderCards() {
    const order = new Map(D.plan.lessons.map(l=>[l.catalogEntryId,l.learnerOrder]));
    const filtered = D.catalog.entries.filter(e => (state.type==='all'||e.learningTypes.includes(state.type)) &&
      (state.task==='all'||e.tasks.includes(state.task)) && (state.family==='all'||e.primaryFamily===state.family||e.additionalFamilies.includes(state.family)) &&
      (!state.firstTen||lessons.has(e.id)) && (!state.search||normalize([e.id,e.name,...e.aliases,e.description,...e.tasks].join(' ')).includes(normalize(state.search))))
      .sort((a,b)=>(order.get(a.id)||100)-(order.get(b.id)||100));
    document.getElementById('result-count').textContent = `${filtered.length} ${filtered.length===1?'entry':'entries'}${normalize(state.search)==='lda'?' · LDA has two meanings':''}`;
    document.getElementById('catalog-cards').innerHTML = filtered.length ? filtered.map(e=>`<article class="algorithm-card" data-entry="${e.id}"><div class="card-top">${glyph(e.primaryFamily,e.id)}<span class="entity-label">${esc(e.kind.replace(/-/g,' '))}</span></div><h3><a href="#/algorithm/${e.id}">${esc(e.name)}</a></h3><p>${esc(e.description)}</p><div class="card-bottom"><span>${esc(learningLabels.get(e.learningTypes[0]))}</span><a href="#/${lessons.has(e.id)?'lesson':'algorithm'}/${e.id}">${lessons.has(e.id)?D.implementation.lessons.some(l=>l.catalogEntryId===e.id&&l.status==='implemented')?'Interactive lesson':'Lesson preview':'Understand the idea'} <span aria-hidden="true">→</span></a></div></article>`).join('') : `<div class="empty-state"><h2>No matching entries</h2><p>Try another term or clear a filter.</p><button id="clear-filters">Clear filters</button></div>`;
    document.getElementById('clear-filters')?.addEventListener('click',()=>{Object.assign(state,{search:'',type:'all',task:'all',family:'all',firstTen:false});renderExplore();document.getElementById('catalog-search').focus();});
  }

  function renderDetail(id) {
    const e=entries.get(id);if(!e){renderNotFound();return;}
    main.innerHTML=`<div class="page"><div class="breadcrumb"><a href="#/explore">Explore</a><span aria-hidden="true">/</span><span>${esc(families.get(e.primaryFamily))}</span></div><div class="detail-heading">${glyph(e.primaryFamily,e.id)}<div><div class="kicker">${esc(e.kind.replace(/-/g,' '))}</div><h1>${esc(e.name)}</h1><span class="muted small">${esc(families.get(e.primaryFamily))}</span></div></div><div class="detail-layout"><div><p class="detail-lead">${esc(e.intuition)}</p><p class="muted">${esc(e.description)}</p><div class="tag-row">${[...e.learningTypes.map(x=>learningLabels.get(x)),...e.tasks].map(x=>`<span class="tag">${esc(x)}</span>`).join('')}</div><section class="detail-block"><h2>When it fits</h2><ul>${e.assumptions.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section><section class="detail-block"><h2>What it does well</h2><ul>${e.strengths.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section><section class="detail-block"><h2>What to watch for</h2><ul>${e.limitations.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section><section class="detail-block"><h2>See the mechanism</h2><p>${esc(e.visualization.concept)}</p><p class="small">Example: ${esc(e.example.title)}.</p></section></div><aside class="detail-side">${lessons.has(id)?`<a class="primary-link" href="#/lesson/${id}">Open visual lesson <span aria-hidden="true">→</span></a>`:'<span class="tag">Catalog explanation</span>'}<h2>Parameters to explore</h2><ul class="parameter-list">${e.parameters.map(p=>`<li>${esc(p.label)}<span>${esc(p.description)}</span></li>`).join('')}</ul><section class="detail-block"><h2>Related ideas</h2>${e.relatedEntries.map(x=>`<a class="reference-link" href="#/algorithm/${x}">${esc(entries.get(x).name)} →</a>`).join('')}</section><section class="detail-block"><h2>Go deeper</h2>${e.sources.map(key=>{const s=sources.get(key);return `<a class="reference-link" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a>`;}).join('')}</section></aside></div></div>`;
  }

  function renderLesson(id,{preserveView=false}={}) {
    const view=preserveView?captureLessonView(main):null;
    const lesson=lessons.get(id);if(!lesson){renderDetail(id);return;}
    historyFor(id).end();const e=entries.get(id);state.lastLesson=id;state.beat=Math.max(0,Math.min(3,state.beat));
    const params=parameterDefinitions(id).filter(p=>state.level==='advanced'||p.level!=='advanced');
    const dataset=id==='q-learning'?qLesson.dataset():id==='mlp'?mlpLesson.dataset():id==='pca'?pcaLesson.dataset():id==='kmeans'?kmeansLesson.dataset():id==='svm'?svmLesson.dataset():id==='random-forest'?forestLesson.dataset():id==='decision-tree'?treeLesson.dataset():id==='knn'?knnLesson.dataset():id==='logistic-regression'?logisticLesson.dataset():linearDataset();
    const linear=id==='linear-regression',knn=id==='knn',logistic=id==='logistic-regression',tree=id==='decision-tree',forest=id==='random-forest',svm=id==='svm',kmeans=id==='kmeans',pca=id==='pca',mlp=id==='mlp',qlearning=id==='q-learning',interactive=linear||knn||logistic||tree||forest||svm||kmeans||pca||mlp||qlearning;
    main.innerHTML=`<div class="page"><div class="breadcrumb"><a href="#/explore">Explore</a><span>/</span><a href="#/algorithm/${id}">${esc(e.name)}</a><span>/</span><span>Visual lesson</span></div><div class="lesson-heading"><div><div class="kicker">${esc(learningLabels.get(e.learningTypes[0]))} learning · ${esc(lesson.task.replace(/-/g,' '))}</div><h1>${esc(lesson.title)}</h1><p>${esc(lesson.question)}</p></div><div class="segmented" aria-label="Explanation depth"><button data-level="beginner" aria-pressed="${state.level==='beginner'}">Beginner</button><button data-level="advanced" aria-pressed="${state.level==='advanced'}">Advanced</button></div></div><div class="lesson-layout"><aside class="lesson-sidebar"><div class="kicker">Follow the idea</div><ol class="chapter-list">${lesson.storyboard.map((s,i)=>`<li><button class="chapter-button" data-beat="${i}" ${state.beat===i?'aria-current="step"':''}><span class="chapter-number">0${i+1}</span><span>${esc(s.title)}</span></button></li>`).join('')}</ol><div class="related"><span class="kicker">Another lesson</span>${D.plan.lessons.filter(l=>l.catalogEntryId!==id).slice(0,4).map(l=>`<a href="#/lesson/${l.catalogEntryId}">${esc(entries.get(l.catalogEntryId).name)} →</a>`).join('')}<a href="#/compare">Compare models →</a></div></aside><section class="stage-wrap" aria-label="Mathematical lesson stage"><div class="stage-head"><span>${esc(dataset.name)}</span><span id="run-status" class="status ${linear?(state.fitted?'fitted':'manual'):''}">${linear?(state.fitted?'Fitted on training rows':'Manual exploration'):'Not fitted'}</span></div>${qlearning?qLesson.datasetMarkup():mlp?mlpLesson.datasetMarkup():pca?pcaLesson.datasetMarkup():kmeans?kmeansLesson.datasetMarkup():svm?svmLesson.datasetMarkup():forest?forestLesson.datasetMarkup():tree?treeLesson.datasetMarkup():knn?knnLesson.datasetMarkup():logistic?logisticLesson.datasetMarkup():''}<div class="plot-surface"><div class="plot-container" id="lesson-plot" data-plot="lesson"></div><div class="plot-legend" id="lesson-legend"></div></div><div class="math-line" id="lesson-equation"></div><p class="scene-description" id="scene-description">${esc(lesson.storyboard[state.beat].explanation)}</p>${qlearning?qLesson.markup():mlp?mlpLesson.markup():pca?pcaLesson.markup():kmeans?kmeansLesson.markup():svm?svmLesson.markup():forest?forestLesson.markup():tree?treeLesson.markup():linear?linearLesson.markup():knn?knnLesson.markup():logistic?logisticLesson.markup():''}${!interactive&&state.level==='advanced'?`<div class="advanced-note">${esc(e.explanation.advancedFocus)}</div>`:''}<div class="playback" aria-label="Lesson playback"><button id="previous-beat" aria-label="Previous teaching step">←</button><button id="play-lesson" aria-pressed="false">Play</button><button id="next-beat" aria-label="Next teaching step">→</button><button id="replay-lesson">Replay</button><span class="beat-position" id="beat-position">0${state.beat+1} / 04</span><label><span class="sr-only">Playback speed</span><select id="playback-speed"><option value="0.5">0.5×</option><option value="1" ${state.speed===1?'selected':''}>1×</option><option value="2" ${state.speed===2?'selected':''}>2×</option></select></label></div><div class="lesson-metrics" id="lesson-metrics"></div><div class="reflection"><div class="kicker">Pause and explain</div><p>${esc(lesson.reflectionPrompt)}</p>${linear?'<details class="reflection-answer"><summary>Show an explanation</summary><p>The observations contain random noise. Least squares fits this finite training sample, while the generating line describes the noise-free relationship. They can differ even when the method is working correctly. A validation error measures behavior on unseen points from this fixture.</p></details>':knn?'<details class="reflection-answer"><summary>Show an explanation</summary><p>A larger neighborhood averages more local labels and can smooth a noisy boundary. It can also outvote a small region with a real minority pattern. Compare validation results and inspect where the boundary changes; training accuracy alone can be optimistic.</p></details>':qlearning?'<details class="reflection-answer"><summary>Show an explanation</summary><p>Exploratory training sometimes chooses a random action to gather experience. Greedy evaluation always follows the first maximizing action in the learned table and keeps that table fixed. Training success can differ from evaluation success, and a finite episode budget can leave an incomplete policy.</p></details>':mlp?'<details class="reflection-answer"><summary>Show an explanation</summary><p>The training loss measures the observations that supply gradients. Extra capacity or updates can fit those observations without helping unseen validation rows. Initialization and learning rate also affect the result. Compare actual validation curves and completed runs; a finished epoch budget is not a convergence guarantee.</p></details>':pca?'<details class="reflection-answer"><summary>Show an explanation</summary><p>PCA sees feature variation without seeing targets. A high-variance direction can represent nuisance changes, while a low-variance direction may carry useful label information. Explained variance measures linear reconstruction of these features; it does not measure predictive usefulness.</p></details>':kmeans?'<details class="reflection-answer"><summary>Show an explanation</summary><p>More centers can reduce squared distances by splitting existing groups. That does not establish a meaningful group count. Compare geometry and silhouette across actual runs, and remember that cluster identities are arbitrary. K-means assumes squared Euclidean geometry is useful for these features.</p></details>':svm?'<details class="reflection-answer"><summary>Show an explanation</summary><p>Observations safely beyond the unit margin can have zero fitted coefficients. Support observations have nonzero coefficients and determine the score. Some lie on a unit-score contour; others reach the C bound inside the margin or on the wrong side. The support set changes when C or the kernel changes.</p></details>':forest?'<details class="reflection-answer"><summary>Show an explanation</summary><p>Each tree supplies a leaf fraction. Their average is one number even when the trees differ. The class decision uses that mean; it does not require agreement among the individual class labels. More trees can change the mean without improving every validation prediction.</p></details>':tree?'<details class="reflection-answer"><summary>Show an explanation</summary><p>More questions can separate training observations into smaller groups. This can fit noise as well as useful structure. Compare your measured validation results in the run table; extra depth can help, hurt, or leave them unchanged.</p></details>':logistic?'<details class="reflection-answer"><summary>Show an explanation</summary><p>The fitted weights and sigmoid determine probabilities. A threshold only selects which probabilities count as class 1. Moving it changes decisions, precision, and recall while leaving the probabilities and log loss unchanged.</p></details>':''}</div></section><aside class="controls-panel" aria-label="Model parameters"><h2>${linear?'Explore the line':'Explore the model'}</h2><p class="panel-caption">Change one quantity. Follow its effect.</p><div class="controls-body">${params.map(p=>controlMarkup(id,p)).join('')}<div class="panel-actions"><button id="fit-preview" class="primary" ${interactive?'':'disabled'} ${interactive?'':'title="This model adapter is not available yet"'}>${linear?'Fit line':knn?'Evaluate model':logistic?'Fit logistic model':tree?'Fit tree':forest?'Fit forest':svm?'Fit SVM':kmeans?'Fit K-means':pca?'Fit PCA':mlp?'Train network':qlearning?'Train agent':'Fit model'}</button><button id="reset-parameters">Reset</button><button id="restore-previous" aria-describedby="settings-history-note" ${historyFor(id).canRestore(historyContext(id))?'':'disabled'}>Restore previous</button></div><p id="settings-history-note" class="small muted settings-history-note">Undo recent parameter edits for this dataset. History stays in this tab until data changes, a saved experiment opens, or the page reloads.</p><div class="setup-actions"><button id="save-setup">Save setup</button><button id="load-setup">Load setup</button></div><p class="small muted" id="setup-status" role="status"></p>${interactive?'<button id="cancel-run" disabled>Cancel run</button>':''}<div class="dataset-strip"><strong>${dataset.kind==='synthetic-environment'?'6 × 6 grid':`${dataset.X.length} observations`}</strong><p>${dataset.partitions?.train?`${dataset.partitions.train.length} train · ${dataset.partitions.validation.length} validation · ${dataset.partitions.test.length} final check`:dataset.kind==='synthetic-environment'?'Start, goal, and walls':dataset.partitions?.fit?`${dataset.partitions.fit.length} fitting rows · no class targets`:'Unlabeled input preview'}</p><p>${dataset.kind==='synthetic-environment'?'Deterministic environment':dataset.imported?`CSV split seed ${dataset.imported.seed}`:`Data seed ${dataset.imported?.seed??dataset.generator?.recipe.seed??42}`}${linear?' · Synthetic units':''}</p></div></div></aside></div></div>`;
    main.querySelectorAll('[data-level]').forEach(b=>b.addEventListener('click',()=>{stopPlayback();stopLinearMotion(true);state.level=b.dataset.level;renderLesson(id);main.querySelector(`[data-level="${state.level}"]`).focus();}));
    main.querySelectorAll('[data-beat]').forEach(b=>b.addEventListener('click',()=>{stopPlayback();setBeat(id,Number(b.dataset.beat));}));
    document.getElementById('previous-beat').addEventListener('click',()=>{stopPlayback();setBeat(id,Math.max(0,state.beat-1));});
    document.getElementById('next-beat').addEventListener('click',()=>{stopPlayback();setBeat(id,Math.min(3,state.beat+1));});
    document.getElementById('replay-lesson').addEventListener('click',()=>{stopPlayback();setBeat(id,0);});
    document.getElementById('play-lesson').addEventListener('click',()=>{if(state.playing){stopPlayback();updatePlayback();}else startPlayback(id);});
    document.getElementById('playback-speed').value=String(state.speed);
    document.getElementById('playback-speed').addEventListener('change',e=>{state.speed=Number(e.target.value);if(state.playing)startPlayback(id);});
    document.getElementById('restore-previous').addEventListener('click',()=>{try{restoreLessonSettings(id);}catch(error){document.getElementById('setup-status').textContent=error.message;}});
    document.getElementById('reset-parameters').addEventListener('click',()=>{historyFor(id).end();recordSettings(id,config(id),initialParameters(id));stopPlayback();stopLinearMotion(false);state.modelParams[id]=initialParameters(id);state.beat=1;if(linear){state.fitted=false;experiment.update(request());}if(knn)knnLesson.settingsChanged();if(logistic)logisticLesson.settingsChanged();if(tree)treeLesson.settingsChanged();if(forest)forestLesson.settingsChanged();if(svm)svmLesson.settingsChanged();if(kmeans)kmeansLesson.settingsChanged();if(pca)pcaLesson.settingsChanged();if(mlp)mlpLesson.settingsChanged();if(qlearning)qLesson.settingsChanged();renderLesson(id);document.getElementById('reset-parameters').focus();announce('Default parameters restored.');});
    document.getElementById('fit-preview').addEventListener('click',async()=>{
      if(qlearning){await qLesson.fit();return;}if(mlp){await mlpLesson.fit();return;}if(pca){await pcaLesson.fit();return;}if(kmeans){await kmeansLesson.fit();return;}if(svm){await svmLesson.fit();return;}if(forest){await forestLesson.fit();return;}if(tree){await treeLesson.fit();return;}if(knn){await knnLesson.evaluate();return;}if(logistic){await logisticLesson.fit();return;}
      if(!linear)return;stopPlayback();stopLinearMotion(false);setBeat(id,2);
      const from={slope:config(id).slope,intercept:config(id).intercept};
      const accepted=await experiment.run(request(),(snapshot,runId)=>executeInWorker(snapshot,{id:linearDataset().id,revision:linearDataset().revision,X:linearDataset().X,y:linearDataset().y,rowIds:linearDataset().rowIds,partitions:linearDataset().partitions},runId));
      if(!accepted)return;
      const model=experiment.result.model,target={slope:model.slope,intercept:model.intercept};
      if(route().join('/')!=='lesson/'+id){Object.assign(config(id),target);state.fitted=true;return;}
      state.fitted=false;state.linearMotion=true;linearMotionTarget=target;updateRunUI();
      const job=animateLine({from,to:target,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,onFrame:frame=>{Object.assign(config(id),frame);syncCoefficients();redrawPlots();}});linearMotionJob=job;
      if(!await job.promise)return;
      linearMotionJob=null;linearMotionTarget=null;state.linearMotion=false;Object.assign(config(id),target);state.fitted=true;state.beat=3;
      if(route().join('/')==='lesson/'+id){renderLesson(id,{preserveView:true});}announce('Line fitted using only training rows. Select a point to inspect its error.');
    });
    document.getElementById('cancel-run')?.addEventListener('click',()=>{if(qlearning){qLesson.stopTrace();qLesson.experiment.cancel();return;}if(mlp){mlpLesson.experiment.cancel();return;}if(pca){pcaLesson.experiment.cancel();return;}if(kmeans){kmeansLesson.experiment.cancel();return;}if(svm){svmLesson.experiment.cancel();return;}if(forest){forestLesson.experiment.cancel();return;}if(tree){treeLesson.experiment.cancel();return;}if(knn){knnLesson.experiment.cancel();return;}if(logistic){logisticLesson.experiment.cancel();return;}if(state.linearMotion){stopLinearMotion(false);redrawPlots();announce('Visual transition stopped. The computed fit is retained.');}else experiment.cancel();});
    document.getElementById('save-setup').addEventListener('click',()=>{try{saveSetup(localStorage,e,lesson,dataset,config(id));document.getElementById('setup-status').textContent='Setup saved on this browser.';}catch(error){document.getElementById('setup-status').textContent='Could not save setup: '+error.message;}});
    document.getElementById('load-setup').addEventListener('click',()=>{try{const values=loadSetup(localStorage,e,lesson,dataset);if(!values){document.getElementById('setup-status').textContent='No saved setup for this model.';return;}historyFor(id).end();recordSettings(id,config(id),values);stopLinearMotion(false);state.modelParams[id]=values;if(linear){state.fitted=false;experiment.update(request());}if(knn)knnLesson.settingsChanged();if(logistic)logisticLesson.settingsChanged();if(tree)treeLesson.settingsChanged();if(forest)forestLesson.settingsChanged();if(svm)svmLesson.settingsChanged();if(kmeans)kmeansLesson.settingsChanged();if(pca)pcaLesson.settingsChanged();if(mlp)mlpLesson.settingsChanged();if(qlearning)qLesson.settingsChanged();renderLesson(id);document.getElementById('load-setup').focus();document.getElementById('setup-status').textContent='Saved setup loaded. Evaluate or fit again to create a result.';}catch(error){document.getElementById('setup-status').textContent='Could not load setup: '+error.message;}});
    bindControls(id);
    if(linear)linearLesson.bind();
    if(knn)knnLesson.bind();
    if(logistic)logisticLesson.bind();
    if(tree)treeLesson.bind();
    if(forest)forestLesson.bind();
    if(svm)svmLesson.bind();
    if(kmeans)kmeansLesson.bind();
    if(pca)pcaLesson.bind();
    if(mlp)mlpLesson.bind();
    if(qlearning)qLesson.bind();
    if(interactive)arrangeLinearControls();
    updateRunUI();
    if(linear&&state.beat===3)document.getElementById('scene-description').textContent='Compare training and validation error. The highlighted segments show a sample of training residuals.';
    redrawPlots();
    observePlots();
    mountLessonPanel(main,view,'experiment-tools',()=>notebook.mount());
    mountLessonPanel(main,view,'guided-activity',()=>guided.mount());
    mountLessonPanel(main,view,'task-data-workbench',()=>taskWorkbench.mount(id));
    mountLessonPanel(main,view,'csv-workbench',()=>csvWorkbench.mount());
    notebook.refreshActions();guided.refresh();
    mountRunTiming(main);refreshRunTiming();
    chartFirst.lesson('lesson/'+id);studio.lesson('lesson/'+id);arrangeLinearControls();edition.lesson(id);redrawPlots();chartFirst.refresh();
    restoreLessonView(main,view);
  }

  function setBeat(id,index) {
    stopLinearMotion(true);state.beat=index;const l=lessons.get(id);
    main.querySelectorAll('[data-beat]').forEach(b=>{if(Number(b.dataset.beat)===index)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
    document.getElementById('scene-description').textContent=id==='linear-regression'&&index===3?'Compare training and validation error. The highlighted segments show a sample of training residuals.':l.storyboard[index].explanation;
    document.getElementById('beat-position').textContent=`0${index+1} / 04`;
    redrawPlots();updatePlayback();
  }
  function updatePlayback() {const button=document.getElementById('play-lesson');if(button){button.textContent=state.playing?'Pause':'Play';button.setAttribute('aria-pressed',String(state.playing));}}
  function startPlayback(id) {
    stopPlayback();if(state.beat===3)setBeat(id,0);state.playing=true;updatePlayback();
    if(id==='linear-regression'&&state.beat===2&&!state.fitted){stopPlayback();updatePlayback();announce('Fit the line to continue the teaching sequence.');return;}
    timer=setInterval(()=>{if(state.beat>=3){stopPlayback();updatePlayback();}else {setBeat(id,state.beat+1);if(id==='linear-regression'&&state.beat===2&&!state.fitted){stopPlayback();updatePlayback();announce('Fit the line to continue the teaching sequence.');}}},1400/state.speed);
  }

  function renderCompare(){const cluster=route()[1]==='clustering',screen=cluster?clusteringComparison:comparison;main.innerHTML=screen.markup();screen.bind();notebook.mount();guided.mount();if(cluster)clusterTaskWorkbench.mount('kmeans');csvWorkbench.mount();chartFirst.comparison(route().join('/'));studio.comparison(route().join('/'));edition.comparison(route().join('/'));observePlots();}

  function renderNotFound(){main.innerHTML='<div class="not-found"><h1>This idea is not in the atlas.</h1><p>Return to the catalog to find an algorithm or lesson.</p><a class="primary-link" href="#/explore">Browse the catalog</a></div>';}
  function renderRoute() {
    stopPlayback();kmeansLesson.stopTrace();qLesson.stopTrace();stopLinearMotion(true);disconnectPlots();chartFirst.disconnect();studio.disconnect();edition.disconnect();const [section='explore',id]=route();
    const navSection=section==='algorithm'?'explore':['lesson','activities'].includes(section)?'experiment':section;
    document.querySelectorAll('[data-nav]').forEach(a=>{if(a.dataset.nav===navSection)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
    if(section==='explore'||section==='catalog'||!section)renderExplore();else if(section==='algorithm')renderDetail(id);else if(section==='lesson')renderLesson(id);else if(section==='compare')renderCompare();else if(section==='activities')guided.renderHub();else if(section==='library')notebook.render();else if(section==='shared')sharing.render(id);else renderNotFound();
    edition.page(section,id);
    document.querySelector('[data-nav="experiment"]').href='#/lesson/'+state.lastLesson;
    main.focus({preventScroll:true});
    window.scrollTo({top:0,behavior:'instant'});
    document.title=(main.querySelector('h1')?.innerText.replace(/\s+/g,' ')||'Explore')+' — Machine Learning Atlas';
  }
  document.querySelector('.skip-link').addEventListener('click',event=>{event.preventDefault();main.focus();main.scrollIntoView();});
  window.addEventListener('hashchange',renderRoute);
  if(!location.hash)location.hash='/explore';else renderRoute();
  window.MLA_APP={edition,guided,clusteringComparison,clusterTaskWorkbench,lessonHistories,historyFor,csvWorkbench,taskData,taskWorkbench,state,config,experiment,request,content:D,knnLesson,logisticLesson,treeLesson,forestLesson,svmLesson,kmeansLesson,pcaLesson,mlpLesson,qLesson,comparison,notebook,openSavedExperiment,notebookOutputs};
}
