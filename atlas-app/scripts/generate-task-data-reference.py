"""Development-only independent scalar generator and NumPy least-squares/SVD checks."""
from pathlib import Path
import json,math,numpy as np
class Random:
 def __init__(self,seed):self.a=seed
 def draw(self):
  self.a=(self.a+0x6d2b79f5)&0xffffffff
  t=((self.a^(self.a>>15))*(self.a|1))&0xffffffff
  t^=(t+(((t^(t>>7))*(t|61))&0xffffffff))&0xffffffff
  return ((t^(t>>14))&0xffffffff)/2**32
def shuffled(ids,seed):
 a=ids[:];rng=Random(seed)
 for i in range(len(a)-1,0,-1):
  j=int(rng.draw()*(i+1));a[i],a[j]=a[j],a[i]
 return a
recipes=[
 dict(task='regression',samples=80,noise=0,outliers=0,seed=0,slope=.8,intercept=.4),
 dict(task='regression',samples=120,noise=1.2,outliers=.2,seed=4294967295,slope=-1.2,intercept=.3),
 dict(task='clusters',samples=80,noise=.4,outliers=.1,seed=7,stretch=2,angle=37,features='both',groups=4,separation=3),
 dict(task='clusters',samples=100,noise=0,outliers=0,seed=1,stretch=1,angle=-90,features='first',groups=2,separation=4),
 dict(task='ellipse',samples=80,noise=.12,outliers=.05,seed=42,stretch=1.7,angle=-47,features='both',spread=2.5),
 dict(task='ellipse',samples=100,noise=.6,outliers=0,seed=0,stretch=.5,angle=90,features='second',spread=1.5)]
cases=[]
for r in recipes:
 rng=Random(r['seed']);X=[];y=[];n=r['samples'];ids=list(range(n));angle=math.radians(r.get('angle',0));c=math.cos(angle);s=math.sin(angle)
 for i in ids:
  u=max(rng.draw(),2**-32);v=rng.draw();radius=math.sqrt(-2*math.log(u));nx=radius*math.cos(2*math.pi*v);ny=radius*math.sin(2*math.pi*v);x=rng.draw()*6-3
  if r['task']=='regression':X.append([x]);y.append(r['slope']*x+r['intercept']+r['noise']*ny)
  else:
   if r['task']=='clusters':
    t=2*math.pi*(i%r['groups'])/r['groups'];bx=r['separation']*math.cos(t)/2+r['noise']*nx;by=r['separation']*math.sin(t)/2+r['noise']*ny
   else:bx=r['spread']*nx;by=r['noise']*ny
   by*=r['stretch'];X.append([c*bx-s*by,s*bx+c*by])
 out=Random(r['seed']^0x165667b1)
 for i in shuffled(ids,r['seed']^0x27d4eb2f)[:int(n*r['outliers']+.5)]:
  if r['task']=='regression':y[i]+=(-1 if out.draw()<.5 else 1)*(3+out.draw()*3)
  else:X[i]=[out.draw()*10-5,out.draw()*10-5]
 if r.get('features')=='first':X=[[x,0] for x,_ in X]
 if r.get('features')=='second':X=[[0,y] for _,y in X]
 X=[[round(v,10) for v in row] for row in X];y=[round(v,10) for v in y]
 if r['task']=='regression':
  split=shuffled(ids,r['seed']^0xfd7046c5);tr=sorted(split[:n*3//5]);va=sorted(split[n*3//5:n*4//5]);te=sorted(split[n*4//5:]);partitions=dict(train=tr,validation=va,test=te);fits=[]
  for intercept in [True,False]:
   A=np.array(X)[tr];A=np.column_stack([A,np.ones(len(tr))]) if intercept else A;coef=np.linalg.lstsq(A,np.array(y)[tr],rcond=None)[0];w=float(coef[0]);b=float(coef[1]) if intercept else 0
   fits.append(dict(intercept=intercept,slope=w,bias=b,predictions=[w*x[0]+b for x in X]))
  extra=dict(y=y,ols=fits)
 else:
  partitions=dict(fit=ids);extra={}
  if r['task']=='ellipse':
   A=np.array(X);mean=A.mean(axis=0);_,sv,V=np.linalg.svd(A-mean,full_matrices=False);extra['pca']=dict(mean=mean.tolist(),variance=(sv**2/(n-1)).tolist(),projector=np.outer(V[0],V[0]).tolist())
 cases.append(dict(recipe=r,X=X,partitions=partitions,**extra))
target=Path(__file__).resolve().parents[1]/'tests/fixtures/task-data-reference.json';target.write_text(json.dumps(dict(cases=cases),indent=2)+'\n',encoding='utf-8')
print(f'Wrote {len(cases)} independent cases, {sum(len(c["X"]) for c in cases)} observations, four OLS fits and two SVD references.')
