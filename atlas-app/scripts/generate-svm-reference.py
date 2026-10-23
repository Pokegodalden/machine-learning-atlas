"""Independent dual QP reference: global best-gain pair search with NumPy."""
from pathlib import Path
import json
import numpy as np
root=Path(__file__).resolve().parents[2]
def solve(X,y,c,kernel,gamma=None):
 mean=X.mean(axis=0);scale=X.std(axis=0);scale[scale==0]=1;Z=(X-mean)/scale
 K=Z@Z.T if kernel=='linear' else np.exp(-gamma*np.sum((Z[:,None]-Z[None,:])**2,axis=2))
 n=len(y);alpha=np.zeros(n);g=np.zeros(n);curvature=np.maximum(0,np.diag(K)[:,None]+np.diag(K)[None,:]-2*K)
 for iteration in range(300000):
  up=np.where(y==1,c-alpha,alpha);down=np.where(y==1,alpha,c-alpha);h=y-g
  upper=h[up>0].max();lower=h[down>0].min()
  if upper-lower<=1e-8:break
  violation=h[:,None]-h[None,:];bound=np.minimum(up[:,None],down[None,:]);step=np.minimum(bound,np.divide(np.maximum(violation,0),curvature,out=np.full_like(curvature,np.inf),where=curvature>1e-14));gain=step*violation-.5*curvature*step**2
  gain[(bound<=0)|(violation<=0)]=-np.inf
  i,j=np.unravel_index(gain.argmax(),gain.shape);t=step[i,j]
  if not t>0:raise RuntimeError('No improving reference pair')
  alpha[i]=np.clip(alpha[i]+y[i]*t,0,c);alpha[j]=np.clip(alpha[j]-y[j]*t,0,c);g+=t*(K[:,i]-K[:,j])
  if iteration%1000==999:g=K@(alpha*y)
 else:raise RuntimeError('Reference did not converge')
 g=K@(alpha*y);h=y-g;up=np.where(y==1,c-alpha,alpha);down=np.where(y==1,alpha,c-alpha);b=(h[up>0].max()+h[down>0].min())/2
 norm=float((alpha*y)@g);primal=.5*norm+c*np.maximum(0,1-y*(g+b)).sum();dual=alpha.sum()-.5*norm
 return {'mean':mean,'scale':scale,'z':Z,'alpha':alpha,'b':b,'iterations':iteration,'primal':float(primal),'dual':float(dual),'kernel':kernel,'gamma':gamma}
def scores(model,raw):
 z=(np.array(raw)-model['mean'])/model['scale'];K=z@model['z'].T if model['kernel']=='linear' else np.exp(-model['gamma']*np.sum((z[:,None]-model['z'][None,:])**2,axis=2));return K@model['coefficient']+model['b']
cases=[]
for dataset in ['two-blobs','two-moons']:
 d=json.loads((root/'datasets'/f'{dataset}.json').read_text());X=np.array(d['X']);labels=np.array(d['y']);train=d['partitions']['train'];y=labels[train]*2-1
 settings=[(c,k,.5 if k=='rbf' else None) for c in [.001,1,100] for k in ['linear','rbf']]+[(100,'rbf',gamma) for gamma in [.001,10]]
 for c,k,gamma in settings:
  m=solve(X[train],y,c,k,gamma);m['coefficient']=m['alpha']*y;predictions={};metrics={}
  for split in ['train','validation']:
   rows=d['partitions'][split];values=scores(m,X[rows]);pred=(values>0).astype(int);predictions[split]=[{'rowId':i,'score':float(s),'label':int(p)} for i,s,p in zip(rows,values,pred)]
   cm=np.zeros((2,2),dtype=int)
   for i,p in zip(rows,pred):cm[labels[i],p]+=1
   tn,fp,fn,tp=map(int,cm.ravel());precision=tp/(tp+fp) if tp+fp else 0;recall=tp/(tp+fn) if tp+fn else 0
   metrics[split]={'accuracy':(tn+tp)/len(rows),'precision':precision,'recall':recall,'f1':2*precision*recall/(precision+recall) if precision+recall else 0,'confusion':cm.tolist()}
  raw=[[0,0],[.5,.25],[-.7,.6]];qs=scores(m,raw)
  cases.append({'datasetId':dataset,'c':c,'kernel':k,'gamma':gamma,'mean':m['mean'].tolist(),'scale':m['scale'].tolist(),'intercept':float(m['b']),'weights':(m['coefficient']@m['z']).tolist() if k=='linear' else None,'iterations':m['iterations'],'primalObjective':m['primal'],'dualObjective':m['dual'],'predictions':predictions,'metrics':metrics,'queries':[{'raw':x,'score':float(s),'label':int(s>0)} for x,s in zip(raw,qs)]})
report={'method':'NumPy global maximum predicted dual-gain pair search; independent of JavaScript most-violating-pair selection','numpyVersion':np.__version__,'referenceKktTolerance':1e-8,'scoreAbsoluteTolerance':2e-4,'cases':cases}
target=root/'atlas-app/tests/fixtures/svm-reference.json';target.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8');print(json.dumps({'fits':len(cases),'predictions':sum(len(v) for c in cases for v in c['predictions'].values()),'queries':len(cases)*3,'outputBytes':target.stat().st_size}))
