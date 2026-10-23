"""Independent exhaustive midpoint search using NumPy masks and rational Gini."""
from pathlib import Path
from fractions import Fraction
import json
import numpy as np
root=Path(__file__).resolve().parents[2]
cases=[]
def fit(X,y,ids,limit,minimum,depth=0,path='root'):
 counts=np.bincount(y[ids],minlength=2).tolist()
 node={'path':path,'depth':depth,'rowIds':list(map(int,ids)),'counts':counts,'label':int(counts[1]>counts[0]),'threshold':None,'feature':None}
 if depth>=limit or min(counts)==0 or len(ids)<2*minimum:return node
 options=[]
 for feature in range(2):
  values=np.unique(X[ids,feature])
  for a,b in zip(values[:-1],values[1:]):
   threshold=float(a/2+b/2)
   mask=X[ids,feature]<=threshold
   left,right=ids[mask],ids[~mask]
   if min(len(left),len(right))<minimum:continue
   lc=np.bincount(y[left],minlength=2).tolist();rc=np.bincount(y[right],minlength=2).tolist()
   def impurity(c):
    n=sum(c)
    return 1-sum(Fraction(k,n)**2 for k in c)
   score=(len(left)*impurity(lc)+len(right)*impurity(rc))/len(ids)
   options.append((score,feature,threshold,left,right))
 if not options:return node
 _,feature,threshold,left,right=min(options,key=lambda t:t[:3])
 node.update(feature=feature,threshold=threshold,left=fit(X,y,left,limit,minimum,depth+1,path+'L'),right=fit(X,y,right,limit,minimum,depth+1,path+'R'))
 return node
def predict(node,x):
 while node['feature'] is not None:node=node['left'] if x[node['feature']]<=node['threshold'] else node['right']
 return {'label':node['label'],'leafPath':node['path'],'class1Fraction':node['counts'][1]/sum(node['counts'])}
def flatten(node):
 result=[{k:v for k,v in node.items() if k not in ['left','right']}]
 if node['feature'] is not None:result+=flatten(node['left'])+flatten(node['right'])
 return result
for dataset in ['two-moons','two-blobs']:
 d=json.loads((root/'datasets'/f'{dataset}.json').read_text());X=np.array(d['X']);y=np.array(d['y']);train=np.array(d['partitions']['train'])
 for limit in [1,4,16]:
  for minimum in [1,3,12]:
   tree=fit(X,y,train,limit,minimum);predictions={};metrics={}
   for split in ['train','validation']:
    rows=d['partitions'][split];predictions[split]=[{'rowId':i,**predict(tree,X[i])} for i in rows]
    cm=np.zeros((2,2),dtype=int)
    for i,p in zip(rows,predictions[split]):cm[y[i],p['label']]+=1
    tn,fp,fn,tp=map(int,cm.ravel());pr=tp/(tp+fp) if tp+fp else 0;re=tp/(tp+fn) if tp+fn else 0
    metrics[split]={'accuracy':(tn+tp)/len(rows),'precision':pr,'recall':re,'f1':2*pr*re/(pr+re) if pr+re else 0,'confusion':cm.tolist()}
   nodes=flatten(tree)
   cases.append({'datasetId':dataset,'maxDepth':limit,'minLeaf':minimum,'nodes':nodes,'leafCount':sum(n['feature'] is None for n in nodes),'depth':max(n['depth'] for n in nodes),'predictions':predictions,'metrics':metrics})
report={'method':'Exhaustive midpoint enumeration, NumPy boolean partitions, exact Fraction weighted Gini (independent of sorted-prefix JavaScript search)','numpyVersion':np.__version__,'thresholdTolerance':1e-12,'cases':cases}
dest=root/'atlas-app/tests/fixtures/tree-reference.json';dest.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'fits':len(cases),'predictions':sum(len(v) for c in cases for v in c['predictions'].values()),'output':str(dest)}))
