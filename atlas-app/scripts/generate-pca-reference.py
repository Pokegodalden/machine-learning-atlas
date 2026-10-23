"""Independent development reference: NumPy/LAPACK full SVD."""
from pathlib import Path
import json
import numpy as np
root=Path(__file__).resolve().parents[1]
fixture=np.array(json.loads((root.parent/'datasets/tilted-cloud.json').read_text())['X'])
x=np.arange(-3.5,4,1)
datasets={'tilted-cloud':fixture,'axis-aligned':np.array([[-3,0],[-2,0],[-1,0],[0,-.5],[0,.5],[1,0],[2,0],[3,0]]),'near-collinear':np.column_stack([x,2*x+np.array([1,-2,3,-1,2,-3,1,-1])*1e-3]),'negative-correlation':np.column_stack([x,-.7*x+np.array([.2,-.3,.1,-.2,.3,-.1,.1,-.1])]),'rank-one':np.column_stack([x,2*x+3]),'constant':np.tile([2.5,-.75],(8,1))}
cases=[]
for name,X in datasets.items():
 mean=X.mean(axis=0);Y=X-mean;_,singular,V=np.linalg.svd(Y,full_matrices=False)
 for v in V:
  pivot=int(np.argmax(np.abs(v)))
  if v[pivot]<0:v*=-1
 variances=singular**2/(len(X)-1);total=float(variances.sum());ratios=variances/total if total else np.zeros(2)
 for k in [1,2]:
  for white in [False,True]:
   if white and (name=='constant' or (name=='rank-one' and k==2)):continue
   raw=Y@V.T;scores=raw[:,:k]/np.sqrt(variances[:k]) if white else raw[:,:k]
   restored=(scores*np.sqrt(variances[:k]) if white else scores)@V[:k]+mean
   errors=((X-restored)**2).sum(axis=1)
   cases.append({'datasetId':name,'X':X.tolist() if name!='tilted-cloud' else None,'parameters':{'n-components':k,'whiten':white},'mean':mean.tolist(),'components':V.tolist(),'singularValues':singular.tolist(),'explainedVariance':variances.tolist(),'explainedVarianceRatio':ratios.tolist(),'scores':scores.tolist(),'rawScores':raw.tolist(),'reconstruction':restored.tolist(),'squaredErrors':errors.tolist(),'meanSquaredReconstructionError':float(errors.mean()),'retainedVarianceRatio':float(ratios[:k].sum()),'scoreSampleVariance':np.var(scores,axis=0,ddof=1).tolist()})
out={'method':'NumPy LAPACK full SVD of centered data; sign-canonical right singular vectors; independent matrix transform/inverse and sample variances','numpyVersion':np.__version__,'absoluteTolerance':1e-9,'cases':cases}
(root/'tests/fixtures/pca-reference.json').write_text(json.dumps(out,indent=2)+'\n')
default=next(c for c in cases if c['datasetId']=='tilted-cloud' and c['parameters']=={'n-components':1,'whiten':False})
print(json.dumps({'fits':len(cases),'transformedRows':sum(len(c['scores']) for c in cases),'fixtureFits':sum(c['datasetId']=='tilted-cloud' for c in cases),'default':{k:default[k] for k in ['mean','components','explainedVariance','explainedVarianceRatio','meanSquaredReconstructionError']}},indent=2))
