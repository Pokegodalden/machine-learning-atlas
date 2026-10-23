"""Independent Python geometry/partitions and NumPy raw-input logistic fits."""
from pathlib import Path
import json,math
import numpy as np
root=Path(__file__).resolve().parents[1]
def rng(seed):
 n=seed
 while True:
  n=(n+0x6d2b79f5)&0xffffffff;t=((n^(n>>15))*(n|1))&0xffffffff;t^=(t+(((t^(t>>7))*(t|61))&0xffffffff))&0xffffffff
  yield ((t^(t>>14))&0xffffffff)/4294967296
def shuffle(items,seed):
 order=list(items);random=rng(seed)
 for i in range(len(order)-1,0,-1):
  j=int(next(random)*(i+1));order[i],order[j]=order[j],order[i]
 return order
def geometry(p):
 n=p['samples'];half=n//2;X=[];y=[]
 for label in [0,1]:
  random=rng(p['seed']^(0x85ebca6b if label else 0xc2b2ae35))
  for _ in range(half):
   u=max(next(random),2**-32);v=next(random);angle=next(random)*math.pi;r=math.sqrt(-2*math.log(u));nx=r*math.cos(2*math.pi*v);ny=r*math.sin(2*math.pi*v)
   if p['pattern']=='blobs':point=[(1 if label else -1)*p['separation']/2+p['noise']*nx,p['noise']*ny]
   else:point=[(1-math.cos(angle) if label else math.cos(angle))+p['noise']*nx,(1-p['separation']-math.sin(angle) if label else math.sin(angle))+p['noise']*ny]
   X.append([point[0],point[1]*p['stretch']]);y.append(label)
 outliers=shuffle(range(n),p['seed']^0x27d4eb2f)[:math.floor(n*p['outliers']+.5)];random=rng(p['seed']^0x165667b1);points=[[(next(random)*7-3.5),(next(random)*7-3.5)*p['stretch']] for _ in range(n)]
 for i in outliers:X[i]=points[i]
 for row in X:
  if p['features']=='first':row[1]=0
  if p['features']=='second':row[0]=0
  row[:]=[round(v,10) for v in row]
 parts={'train':[],'validation':[],'test':[]}
 for label in [0,1]:
  order=shuffle([i for i in range(n) if y[i]==label],p['seed']^(0xd3a2646c if label else 0xfd7046c5));a=half*6//10;b=half*2//10
  parts['train']+=order[:a];parts['validation']+=order[a:a+b];parts['test']+=order[a+b:]
 for v in parts.values():v.sort()
 return {'recipe':p,'X':X,'y':y,'partitions':parts,'outlierCount':len(outliers)}
base={'pattern':'moons','samples':240,'noise':.2,'separation':.5,'outliers':0,'stretch':1,'seed':42,'features':'both'}
cases=[geometry({**base,**patch}) for patch in [{},{'pattern':'blobs','separation':2},{'samples':80,'noise':0,'separation':0,'stretch':.25,'seed':0},{'pattern':'blobs','samples':400,'noise':1,'separation':4,'outliers':.25,'stretch':3,'seed':4294967295},{'samples':160,'noise':.35,'outliers':.125,'stretch':2,'seed':7,'features':'first'},{'pattern':'blobs','samples':80,'separation':2,'noise':.5,'outliers':.1,'stretch':3,'seed':7},{'samples':320,'noise':.1,'outliers':.05,'seed':1234,'features':'second'},{'samples':80,'noise':.4,'outliers':.25,'stretch':.25,'seed':19}]]
def logistic(case):
 ids=case['partitions']['train'];X=np.array(case['X']);labels=np.array(case['y']);A=np.column_stack((X[ids],np.ones(len(ids))));y=labels[ids];theta=np.zeros(3)
 def obj(t):
  scores=A@t;return float(np.sum(np.logaddexp(0,scores)-y*scores)+(t[0]**2+t[1]**2)/2)
 for _ in range(81):
  scores=A@theta;p=1/(1+np.exp(-scores));g=A.T@(p-y)+np.array([theta[0],theta[1],0]);H=A.T@((p*(1-p))[:,None]*A)+np.diag([1.,1.,0.])
  if np.max(np.abs(g))<=1e-9:break
  direction=np.linalg.solve(H,g);step=1.;old=obj(theta)
  for _ in range(45):
   trial=theta-step*direction
   if obj(trial)<=old-1e-4*step*float(g@direction)+1e-13:break
   step*=.5
  theta=trial
 rows=case['partitions']['train']+case['partitions']['validation'];scores=np.column_stack((X[rows],np.ones(len(rows))))@theta
 return {'parameters':{'c':1},'weights':theta[:2].tolist(),'intercept':float(theta[2]),'rows':[{'rowId':i,'score':float(s),'probability':float(1/(1+np.exp(-s)))} for i,s in zip(rows,scores)]}
for c in [cases[0],cases[1],cases[5],cases[7]]:c['rawLogistic']=logistic(c)
report={'method':'Independent scalar Python Mulberry32, Box-Muller geometry, seeded shuffles and rounded observations; NumPy damped Newton fits using raw features','numpyVersion':np.__version__,'coordinateAbsoluteTolerance':1.1e-10,'fitAbsoluteTolerance':1e-8,'cases':cases}
(root/'tests/fixtures/synthetic-reference.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'cases':len(cases),'observations':sum(len(c['X']) for c in cases),'rawLogisticFits':4}))
