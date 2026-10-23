"""Development reference: NumPy distance matrices and grouped means, not JS code."""
from pathlib import Path
import json
import numpy as np
root=Path(__file__).resolve().parents[1]
X=np.array(json.loads((root.parent/'datasets/three-clusters.json').read_text())['X'])
MASK=2**32-1
def rng(seed):
 a=seed
 while True:
  a=(a+0x6D2B79F5)&MASK;t=a
  t=((t^(t>>15))*(t|1))&MASK
  t^=(t+(((t^(t>>7))*(t|61))&MASK))&MASK
  yield ((t^(t>>14))&MASK)/2**32
def initial(k,method,seed):
 r=rng(seed)
 if method=='random':
  pool=list(range(len(X)))
  for j in range(k):
   pos=j+int(next(r)*(len(X)-j));pool[j],pool[pos]=pool[pos],pool[j]
  return pool[:k]
 ids=[int(next(r)*len(X))]
 while len(ids)<k:
  distances=((X[:,None,:]-X[ids][None,:,:])**2).sum(axis=2).min(axis=1)
  total=float(sum(distances))
  if not total:ids.append(next(i for i in range(len(X)) if i not in ids));continue
  target=next(r)*total;prefix=0
  for i,v in enumerate(distances):
   prefix+=float(v)
   if prefix>target:ids.append(i);break
 return ids
def trial(k,method,seed):
 ids=initial(k,method,seed);centers=X[ids].copy();previous=None;updates=0;converged=False
 while True:
  distances=((X[:,None,:]-centers[None,:,:])**2).sum(axis=2);labels=np.argmin(distances,axis=1)
  if previous is not None and np.array_equal(labels,previous):converged=True;break
  if updates==100:break
  centers=np.stack([X[labels==j].mean(axis=0) if np.any(labels==j) else centers[j] for j in range(k)])
  previous=labels;updates+=1
 squared=((X-centers[labels])**2).sum(axis=1)
 return dict(centers=centers.tolist(),labels=labels.tolist(),squaredDistances=squared.tolist(),inertia=float(sum(squared)),initialIndices=ids,iterations=updates,converged=converged)
def silhouette(labels):
 labels=np.array(labels);groups=np.unique(labels)
 if len(groups)<2 or len(groups)>=len(X):return None
 distances=np.sqrt(((X[:,None,:]-X[None,:,:])**2).sum(axis=2));values=[]
 for i,label in enumerate(labels):
  own=labels==label;n=int(own.sum())
  if n==1:values.append(0);continue
  a=float(distances[i,own].sum())/(n-1)
  b=min(float(distances[i,labels==other].mean()) for other in groups if other!=label)
  values.append((b-a)/max(a,b) if max(a,b) else 0)
 return float(np.mean(values))
cases=[]
settings=[(k,method,seed,5 if seed==7 else 1) for k in [2,3,6,8] for method in ['kmeans++','random'] for seed in [7,42]]+[(3,method,7,20) for method in ['kmeans++','random']]
for k,method,seed,restarts in settings:
 trials=[]
 for index in range(restarts):
  trial_seed=(seed+index*0x9e3779b9)&MASK;fit=trial(k,method,trial_seed);trials.append(dict(index=index,seed=trial_seed,**fit))
 best=min(trials,key=lambda t:t['inertia']);cases.append(dict(parameters={'n-clusters':k,'restarts':restarts,'initialization':method},seed=seed,selectedTrial=best['index'],silhouette=silhouette(best['labels']),**{key:best[key] for key in ['centers','labels','squaredDistances','inertia','iterations','converged']},trials=[{key:t[key] for key in ['index','seed','initialIndices','inertia','iterations','converged']} for t in trials]))
out={'method':'NumPy broadcast distance matrices, vectorized group means, independent silhouette distance matrix; specified matching PRNG for reproducible initial rows','numpyVersion':np.__version__,'absoluteTolerance':1e-9,'cases':cases}
(root/'tests/fixtures/kmeans-reference.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({'fits':len(cases),'trialInitializations':sum(len(c['trials']) for c in cases),'assignmentComparisons':sum(len(c['labels']) for c in cases),'default':next({k:c[k] for k in ['inertia','silhouette','selectedTrial','centers']} for c in cases if c['parameters']=={'n-clusters':3,'restarts':5,'initialization':'kmeans++'} and c['seed']==7)},indent=2))
