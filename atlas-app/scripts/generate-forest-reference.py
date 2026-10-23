"""Development reference: NumPy partitions, exact rational impurity, integer RNG."""
from pathlib import Path
from fractions import Fraction
import json
import numpy as np
root=Path(__file__).resolve().parents[2];mask32=(1<<32)-1
class Random:
 def __init__(self,seed):self.state=seed&mask32
 def uint(self):
  self.state=(self.state+0x6D2B79F5)&mask32;t=((self.state^(self.state>>15))*(1|self.state))&mask32
  t=(((t+(((t^(t>>7))*(61|t))&mask32))&mask32)^t)&mask32
  return (t^(t>>14))&mask32
 def integer(self,n):
  limit=(1<<32)-((1<<32)%n)
  while True:
   value=self.uint()
   if value<limit:return value%n
def grow(X,y,ids,depth,limit,random):
 counts=np.bincount(y[ids],minlength=2).tolist();node={'feature':None,'threshold':None,'counts':counts,'sampleCount':len(ids),'label':int(counts[1]>counts[0]),'sampledFeatures':None,'evaluatedFeatures':None}
 if not min(counts) or depth>=limit or len(ids)<6:return node
 first=random.integer(2);node['sampledFeatures']=[first];node['evaluatedFeatures']=[]
 for feature in [first,1-first]:
  node['evaluatedFeatures'].append(feature);values=np.unique(X[ids,feature]);options=[]
  for a,b in zip(values[:-1],values[1:]):
   threshold=float(a/2+b/2);selected=X[ids,feature]<=threshold;l=ids[selected];r=ids[~selected]
   if min(len(l),len(r))<3:continue
   lc=np.bincount(y[l],minlength=2).tolist();rc=np.bincount(y[r],minlength=2).tolist()
   def impurity(c):return 1-sum(Fraction(v,sum(c))**2 for v in c)
   score=(len(l)*impurity(lc)+len(r)*impurity(rc))/len(ids);options.append((score,threshold,l,r))
  if options:
   _,threshold,l,r=min(options,key=lambda x:x[:2]);node.update(feature=feature,threshold=threshold,left=grow(X,y,l,depth+1,limit,random),right=grow(X,y,r,depth+1,limit,random));break
 return node
def flat(n):return [{k:v for k,v in n.items() if k not in ['left','right']}]+(flat(n['left'])+flat(n['right']) if n['feature'] is not None else [])
def predict(n,x):
 while n['feature'] is not None:n=n['left'] if x[n['feature']]<=n['threshold'] else n['right']
 return n['counts'][1]/sum(n['counts'])
cases=[]
for dataset in ['two-moons','two-blobs']:
 d=json.loads((root/'datasets'/f'{dataset}.json').read_text());X=np.array(d['X']);y=np.array(d['y']);train=d['partitions']['train']
 for size,depth,seed in [(5,1,7),(5,4,7),(50,4,7),(200,16,7),(5,4,42)]:
  master=Random(seed);trees=[];structures=[]
  for i in range(size):
   sampleSeed,featureSeed=master.uint(),master.uint();sample=Random(sampleSeed);draws=[train[sample.integer(len(train))] for _ in train]
   tree=grow(X,y,np.array(draws),0,depth,Random(featureSeed));trees.append(tree);structures.append({'sampleSeed':sampleSeed,'featureSeed':featureSeed,'bootstrapRowIds':draws,'nodes':flat(tree)})
  predictions={};metrics={}
  for split in ['train','validation']:
   predictions[split]=[];cm=np.zeros((2,2),dtype=int)
   for row in d['partitions'][split]:
    probabilities=[predict(t,X[row]) for t in trees];mean=sum(probabilities)/size;label=int(mean>.5)
    predictions[split].append({'rowId':row,'label':label,'probability':mean,'treeProbabilities':probabilities});cm[y[row],label]+=1
   tn,fp,fn,tp=map(int,cm.ravel());pr=tp/(tp+fp) if tp+fp else 0;re=tp/(tp+fn) if tp+fn else 0
   metrics[split]={'accuracy':(tn+tp)/sum(map(sum,cm)),'precision':pr,'recall':re,'f1':2*pr*re/(pr+re) if pr+re else 0,'confusion':cm.tolist()}
  queries=[]
  for raw in ([[.5,.25],[0,0],[-.7,.6]] if dataset=='two-moons' else [[0,0],[-1,.5],[1,-.5]]):
   fractions=[predict(t,raw) for t in trees];mean=sum(fractions)/size;queries.append({'raw':raw,'probability':mean,'label':int(mean>.5),'treeProbabilities':fractions})
  cases.append({'datasetId':dataset,'treeCount':size,'maxDepth':depth,'seed':seed,'trees':structures,'predictions':predictions,'metrics':metrics,'queries':queries})
rng=Random(7);report={'method':'NumPy boolean midpoint partitions with exact Fraction Gini and independent integer arithmetic PRNG implementation','numpyVersion':np.__version__,'absoluteTolerance':1e-12,'seed7FirstUInt32':[rng.uint() for _ in range(8)],'cases':cases}
target=root/'atlas-app/tests/fixtures/forest-reference.json';target.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'fits':len(cases),'trees':sum(c['treeCount'] for c in cases),'predictions':sum(len(v) for c in cases for v in c['predictions'].values()),'outputBytes':target.stat().st_size}))
