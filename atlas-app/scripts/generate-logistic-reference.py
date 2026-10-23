from pathlib import Path
import json,numpy as np
root=Path(__file__).resolve().parents[2];cases=[]
for name in ['two-blobs','two-moons','xor-corners']:
 d=json.loads((root/'datasets'/f'{name}.json').read_text());X=np.asarray(d['X']);y=np.asarray(d['y']);train=np.asarray(d['partitions']['train']);mean=X[train].mean(axis=0);scale=X[train].std(axis=0);scale[scale==0]=1;A=np.column_stack([(X-mean)/scale,np.ones(len(X))]);T=A[train];target=y[train]
 for c in [.001,1.,100.]:
  theta=np.zeros(3);penalty=np.array([1/c,1/c,0.])
  def sig(s):return np.exp(-np.logaddexp(0,-s))
  for sweep in range(5000):
   for j in range(3):
    col=T[:,j];base=T@theta-theta[j]*col
    def derivative(t):return np.dot(col,sig(base+t*col)-target)+penalty[j]*t
    lo,hi=-1.,1.
    while derivative(lo)>0:lo*=2
    while derivative(hi)<0:hi*=2
    for _ in range(60):
     mid=(lo+hi)/2
     if derivative(mid)>0:hi=mid
     else:lo=mid
    theta[j]=(lo+hi)/2
   gradient=T.T@(sig(T@theta)-target)+penalty*theta
   if np.max(np.abs(gradient))<5e-11:break
  else:raise RuntimeError('Coordinate reference did not converge')
  scores=A@theta;prob=sig(scores);predictions={split:[{'rowId':i,'score':float(scores[i]),'probability':float(prob[i])} for i in d['partitions'][split]] for split in ['train','validation']};metrics={}
  for threshold in [0.,.25,.5,.75,1.]:
   labels=np.ones(len(X),dtype=int) if threshold==0 else np.zeros(len(X),dtype=int) if threshold==1 else (prob>=threshold).astype(int)
   metrics[str(threshold)]={}
   for split in ['train','validation']:
    rows=d['partitions'][split];cm=np.zeros((2,2),dtype=int);np.add.at(cm,(y[rows],labels[rows]),1);tn,fp,fn,tp=cm.ravel();p=tp/(tp+fp) if tp+fp else 0.;r=tp/(tp+fn) if tp+fn else 0.;metrics[str(threshold)][split]={'accuracy':float((labels[rows]==y[rows]).mean()),'precision':float(p),'recall':float(r),'f1':float(2*p*r/(p+r)) if p+r else 0.,'confusion':cm.tolist(),'logLoss':float(np.mean(np.logaddexp(0,scores[rows])-y[rows]*scores[rows]))}
  objective=float(np.sum(np.logaddexp(0,scores[train])-target*scores[train])+(theta[0]**2+theta[1]**2)/(2*c))
  cases.append({'datasetId':name,'c':c,'weights':theta[:2].tolist(),'intercept':float(theta[2]),'mean':mean.tolist(),'scale':scale.tolist(),'objective':objective,'gradientInfinityNorm':float(np.max(np.abs(gradient))),'coordinateSweeps':sweep+1,'predictions':predictions,'metrics':metrics})
  print(name,c,'sweeps',sweep+1,'gradient',float(np.max(np.abs(gradient))))
folder=root/'atlas-app/tests/fixtures';folder.mkdir(parents=True,exist_ok=True);(folder/'logistic-reference.json').write_text(json.dumps({'method':'NumPy coordinate minimization by derivative-root bisection (independent of JavaScript Newton solver)','numpyVersion':np.__version__,'coefficientAbsoluteTolerance':1e-7,'probabilityAbsoluteTolerance':1e-9,'cases':cases},indent=2)+'\n')
