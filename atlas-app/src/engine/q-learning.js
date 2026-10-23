import {measureFit,measureReference,startFit} from './run-timing.js';
import {requestKey} from '../core/experiment.js';

export const qDefaults=()=>({'learning-rate':.2,discount:.95,exploration:.1,episodes:500});
export function qParameters(input={}){
  if(Object.keys(input).some(key=>!(key in qDefaults())))throw Error('Unknown Q-learning parameter.');
  const p={...qDefaults(),...input};
  for(const [key,lo,hi] of [['learning-rate',.01,1],['discount',0,.999],['exploration',0,1],['episodes',50,2000]])
    if(typeof p[key]!=='number'||!Number.isFinite(p[key])||p[key]<lo||p[key]>hi||(key==='episodes'&&!Number.isInteger(p[key])))throw Error(`Invalid ${key} parameter.`);
  return p;
}
const same=(a,b)=>a[0]===b[0]&&a[1]===b[1];
export const stateIndex=(env,s)=>s[0]*env.columns+s[1];
export function validateEnvironment(e){
  if(!Number.isInteger(e.rows)||!Number.isInteger(e.columns)||e.rows<2||e.columns<2||e.rows*e.columns>400)throw Error('Invalid grid dimensions.');
  const inside=s=>Array.isArray(s)&&s.length===2&&s.every(Number.isInteger)&&s[0]>=0&&s[0]<e.rows&&s[1]>=0&&s[1]<e.columns;
  if(!Array.isArray(e.walls)||!e.walls.every(inside)||!inside(e.start)||!inside(e.goal)||same(e.start,e.goal)||e.walls.some(w=>same(w,e.start)||same(w,e.goal)))throw Error('Invalid grid cells.');
  if(JSON.stringify(e.actions)!=='["up","right","down","left"]'||JSON.stringify(e.actionDeltas)!=='[[-1,0],[0,1],[1,0],[0,-1]]')throw Error('Unsupported action order.');
  if(!Number.isFinite(e.rewards?.nonterminalStep)||!Number.isFinite(e.rewards?.enterGoal)||!Number.isInteger(e.episodeStepLimit)||e.episodeStepLimit<1||e.episodeStepLimit>1000)throw Error('Invalid reward or external limit.');
}
export function transition(e,state,action){
  if(!Number.isInteger(action)||action<0||action>3)throw Error('Invalid action.');
  if(same(state,e.goal))return {nextState:[...state],reward:0,terminal:true,blocked:false};
  const delta=e.actionDeltas[action],candidate=state.map((v,i)=>v+delta[i]);
  const blocked=candidate[0]<0||candidate[0]>=e.rows||candidate[1]<0||candidate[1]>=e.columns||e.walls.some(w=>same(w,candidate));
  const nextState=blocked?[...state]:candidate,terminal=same(nextState,e.goal);
  return {nextState,reward:terminal?e.rewards.enterGoal:e.rewards.nonterminalStep,terminal,blocked};
}
export const greedyAction=values=>values.indexOf(Math.max(...values));
export function updateValue(oldQ,reward,nextValues,alpha,gamma,terminal){
  const bootstrap=terminal?0:Math.max(...nextValues),target=reward+gamma*bootstrap;
  return {oldQ,bootstrap,target,tdError:target-oldQ,updatedQ:oldQ+alpha*(target-oldQ)};
}
export function greedyEvaluation(e,q){
  let state=[...e.start],totalReturn=0;const trajectory=[];
  for(let step=1;step<=e.episodeStepLimit;step++){
    const action=greedyAction(q[stateIndex(e,state)]),t=transition(e,state,action);
    trajectory.push({step,state:[...state],action,...t});totalReturn+=t.reward;state=t.nextState;
    if(t.terminal)return {success:true,steps:step,stepsToGoal:step,totalReturn,trajectory,exploration:0,updates:0};
  }
  return {success:false,steps:e.episodeStepLimit,stepsToGoal:null,totalReturn,trajectory,exploration:0,updates:0};
}
export function shortestRoute(e){
  const queue=[[...e.start]],seen=new Map([[stateIndex(e,e.start),null]]);
  for(let i=0;i<queue.length;i++){
    const s=queue[i];if(same(s,e.goal)){const path=[];let cell=s;while(cell){path.unshift(cell);cell=seen.get(stateIndex(e,cell));}return {steps:path.length-1,path,method:'Breadth-first search · environment reference, not learned'};}
    for(let a=0;a<4;a++){const t=transition(e,s,a),key=stateIndex(e,t.nextState);if(!seen.has(key)){seen.set(key,s);queue.push(t.nextState);}}
  }
  return {steps:null,path:[],method:'Breadth-first search · no feasible route'};
}
function randomSource(seed){let n=seed>>>0;return ()=>{n=(n+0x6d2b79f5)>>>0;let t=Math.imul(n^(n>>>15),n|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
const copyQ=q=>q.map(row=>[...row]);
export function replayCheckpoint(checkpoint,step){
  const q=copyQ(checkpoint.startQ);for(const t of checkpoint.trace.slice(0,step))q[t.stateId][t.action]=t.updatedQ;return q;
}
export function evaluateQlearning(request,e,runId,onProgress=()=>{}){
  if(request.schemaVersion!=='1.0.0'||request.adapterVersion!=='q-tabular-1'||request.modelId!=='q-learning')throw Error('Unsupported Q-learning request version.');
  if(request.datasetId!==e.id||request.datasetRevision!==e.revision)throw Error('Environment identity or revision mismatch.');
  if(request.preprocessing!=='none'||request.evaluation!=='greedy-policy'||!Number.isInteger(request.modelSeed)||request.modelSeed<0||request.modelSeed>4294967295)throw Error('Invalid Q-learning protocol.');
  validateEnvironment(e);const parameters=qParameters(request.parameters),alpha=parameters['learning-rate'],gamma=parameters.discount,epsilon=parameters.exploration;
  const stopFit=startFit();
  const random=randomSource(request.modelSeed),q=Array.from({length:e.rows*e.columns},()=>[0,0,0,0]),visits=q.map(row=>row.map(()=>0)),lastUpdates=q.map(row=>row.map(()=>null)),history=[],checkpoints=[];
  const interval=Math.ceil(parameters.episodes/20);let updates=0;
  checkpoints.push({episode:0,startQ:copyQ(q),q:copyQ(q),trace:[],totalReturn:0,steps:0,success:false});
  for(let episode=1;episode<=parameters.episodes;episode++){
    const capture=episode===1||episode%interval===0||episode===parameters.episodes,startQ=capture?copyQ(q):null,trace=[];
    let state=[...e.start],totalReturn=0,success=false,steps=0,exploratoryActions=0;
    for(let step=1;step<=e.episodeStepLimit;step++){
      const stateId=stateIndex(e,state),explored=random()<epsilon,action=explored?Math.floor(random()*4):greedyAction(q[stateId]),t=transition(e,state,action);
      const truncated=step===e.episodeStepLimit&&!t.terminal,backup=updateValue(q[stateId][action],t.reward,q[stateIndex(e,t.nextState)],alpha,gamma,t.terminal);
      const record={episode,step,update:++updates,state:[...state],stateId,action,...t,truncated,explored,...backup};
      q[stateId][action]=backup.updatedQ;visits[stateId][action]++;lastUpdates[stateId][action]=record;
      if(capture)trace.push(record);totalReturn+=t.reward;steps=step;exploratoryActions+=Number(explored);state=t.nextState;
      if(t.terminal){success=true;break;}
    }
    const summary={episode,totalReturn,steps,success,truncated:!success,exploratoryActions};history.push(summary);
    if(capture){const checkpoint={...summary,startQ,q:copyQ(q),trace};checkpoints.push(checkpoint);onProgress({phase:'q-training',episodesCompleted:episode,episodesRequested:parameters.episodes,checkpoint:structuredClone(checkpoint),history:structuredClone(history)});}
  }
  stopFit();
  const recent=history.slice(-50),evaluation=greedyEvaluation(e,q);
  return {schemaVersion:'1.0.0',runId,configKey:requestKey(request),request:structuredClone(request),model:{kind:'q-learning',parameters,q,visits,lastUpdates,seed:request.modelSeed},history,checkpoints,evaluation,
    metrics:{training:{episodes:history.length,updates,lastWindow:recent.length,recentSuccessRate:recent.filter(h=>h.success).length/recent.length,meanReturn:history.reduce((s,h)=>s+h.totalReturn,0)/history.length},evaluation:{success:evaluation.success,stepsToGoal:evaluation.stepsToGoal,totalReturn:evaluation.totalReturn}},
    environmentReference:measureReference(()=>shortestRoute(e)),solver:{initialization:'zero',rng:'mulberry32; exploration draw every transition, action draw only when exploring',tieBreak:'up, right, down, left; first maximum',epsilonSchedule:'fixed',externalStepLimit:e.episodeStepLimit,episodesCompleted:history.length}};
}
