"""Independent scalar Python oracle; no app engine code is imported."""
from pathlib import Path
import json
from collections import deque
root=Path(__file__).resolve().parents[1]
env=json.loads((root.parent/'datasets/grid-route.json').read_text())
walls=set(map(tuple,env['walls']));goal=tuple(env['goal']);start=tuple(env['start']);deltas=[(-1,0),(0,1),(1,0),(0,-1)]
def rng(seed):
 n=seed
 while True:
  n=(n+0x6d2b79f5)&0xffffffff
  t=((n^(n>>15))*(n|1))&0xffffffff
  t^=(t+(((t^(t>>7))*(t|61))&0xffffffff))&0xffffffff
  yield ((t^(t>>14))&0xffffffff)/4294967296
def move(s,a):
 r,c=s;dr,dc=deltas[a];n=(r+dr,c+dc)
 if n in walls or not(0<=n[0]<6 and 0<=n[1]<6):n=s
 return n,1 if n==goal else -.02,n==goal
def run(p,seed):
 q=[[0.,0.,0.,0.] for _ in range(36)];visits=[[0]*4 for _ in range(36)];random=rng(seed);history=[];sampled=[]
 for episode in range(1,p['episodes']+1):
  s=start;ret=0;exploratory=0
  for step in range(1,101):
   idx=s[0]*6+s[1];explore=next(random)<p['exploration'];a=int(next(random)*4) if explore else q[idx].index(max(q[idx]));n,reward,terminal=move(s,a)
   old=q[idx][a];bootstrap=0 if terminal else max(q[n[0]*6+n[1]]);target=reward+p['discount']*bootstrap;updated=old+p['learning-rate']*(target-old)
   if episode in [1,p['episodes']]:sampled.append(dict(episode=episode,step=step,state=list(s),action=a,nextState=list(n),reward=reward,terminal=terminal,truncated=step==100 and not terminal,oldQ=old,bootstrap=bootstrap,target=target,updatedQ=updated,explored=explore))
   q[idx][a]=updated;visits[idx][a]+=1;ret+=reward;exploratory+=explore;s=n
   if terminal:break
  history.append(dict(episode=episode,totalReturn=ret,steps=step,success=terminal,truncated=not terminal,exploratoryActions=exploratory))
 s=start;route=[list(s)];ret=0
 for step in range(1,101):
  row=q[s[0]*6+s[1]];a=row.index(max(row));s,reward,terminal=move(s,a);ret+=reward;route.append(list(s))
  if terminal:break
 return dict(parameters=p,seed=seed,q=q,visits=visits,history=history,sampledUpdates=sampled,evaluation=dict(success=terminal,steps=step,stepsToGoal=step if terminal else None,totalReturn=ret,path=route))
base={'learning-rate':.2,'discount':.95,'exploration':.1,'episodes':500}
cases=[run({**base,**patch},seed) for patch,seed in [({},7),({'episodes':50,'learning-rate':.01},7),({'discount':0,'episodes':50},7),({'exploration':0,'episodes':50},7),({'exploration':1,'episodes':2000,'learning-rate':1,'discount':.999},42),({'episodes':50,'discount':.999,'learning-rate':1},42)]]
queue=deque([(start,0)]);seen={start};shortest=None
while queue:
 s,n=queue.popleft()
 if s==goal:shortest=n;break
 for a in range(4):
  nxt,_,_=move(s,a)
  if nxt not in seen:seen.add(nxt);queue.append((nxt,n+1))
out={'method':'Independent scalar Python tabular epsilon-greedy implementation and deque BFS; explicit uint32 Mulberry32 generator','absoluteTolerance':1e-12,'shortestRouteSteps':shortest,'cases':cases}
(root/'tests/fixtures/q-learning-reference.json').write_text(json.dumps(out,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'cases':len(cases),'shortestRouteSteps':shortest,'outcomes':[(c['evaluation']['success'],c['evaluation']['steps']) for c in cases]}))
