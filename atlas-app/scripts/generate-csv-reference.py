"""Development-only CSV/preprocessing and NumPy reference, independent of app JS."""
from pathlib import Path
import csv,io,json,statistics,numpy as np
def shuffle(ids,seed):
 a=ids[:];state=seed
 for i in range(len(a)-1,0,-1):
  state=(state+0x6d2b79f5)&0xffffffff;t=((state^(state>>15))*(state|1))&0xffffffff;t^=(t+(((t^(t>>7))*(t|61))&0xffffffff))&0xffffffff;u=((t^(t>>14))&0xffffffff)/2**32;j=int(u*(i+1));a[i],a[j]=a[j],a[i]
 return a
def source(headers,rows):
 out=io.StringIO(newline='');w=csv.writer(out);w.writerow(headers);w.writerows(rows);return out.getvalue()
inputs=[
 dict(task='classification',name='binary.csv',csv=source(['distance','flag','class'],[[str(i%17-8) if i%13 else '',['yes','no'][i%2] if i%19 else '',['warm','cold'][i%2]] for i in range(80)]),features=[0,1],types=['numeric','binary'],target=2),
 dict(task='regression',name='large-line.csv',csv=source(['measurement','response'],[[str(i-40) if i%11 else '',str(300*(i-40)+700+(i%3-1)*.25)] for i in range(100)]),features=[0],types=['numeric'],target=1),
 dict(task='pca',name='cloud.csv',csv=source(['first','second'],[[str(i%13-6) if i%9 else '',str((i%13-6)*.8+(i%7)*.07)] for i in range(80)]),features=[0,1],types=['numeric','numeric'],target=None),
 dict(task='clustering',name='groups.csv',csv=source(['a','b'],[[str((i%3-1)*3+(i%7)*.01),str((i%5-2)*.1)] for i in range(80)]),features=[0,1],types=['numeric','numeric'],target=None)]
cases=[]
for item in inputs:
 r=dict(version='csv-1',missing='impute',seed=17,**item);reader=csv.reader(io.StringIO(r['csv']));headers=next(reader);rows=[[v.strip() for v in row] for row in reader];ids=list(range(len(rows)));targetLabels=None;y=None
 if r['task']=='classification':targetLabels=sorted(set(row[r['target']] for row in rows));y=[targetLabels.index(row[r['target']]) for row in rows]
 if r['task']=='regression':y=[float(row[r['target']]) for row in rows]
 if y is None:parts=dict(fit=ids)
 else:
  parts=dict(train=[],validation=[],test=[]);groups=[ids] if r['task']=='regression' else [[i for i in ids if y[i]==k] for k in [0,1]]
  for k,group in enumerate(groups):
   order=shuffle(group,r['seed']^(((k+1)*0x9e3779b9)&0xffffffff));n=len(group)*3//5;v=len(group)//5;parts['train']+=order[:n];parts['validation']+=order[n:n+v];parts['test']+=order[n+v:]
  parts={k:sorted(v) for k,v in parts.items()}
 fit=parts.get('train',parts.get('fit'));X=[[] for _ in ids];facts=[]
 for col,typ in zip(r['features'],r['types']):
  observed=[rows[i][col] for i in fit if rows[i][col]!=''];cats=sorted(set(observed)) if typ=='binary' else None;fill=statistics.median(float(v) for v in observed) if typ=='numeric' else sorted(cats,key=lambda c:(-observed.count(c),c))[0]
  for i in ids:
   v=rows[i][col] if rows[i][col]!='' else fill;X[i].append(float(v) if typ=='numeric' else cats.index(v if v in cats else fill))
  facts.append(dict(fillValue=fill,categories=cats))
 extra={}
 if r['task']=='regression':
  A=np.column_stack([np.array(X)[fit],np.ones(len(fit))]);coef=np.linalg.lstsq(A,np.array(y)[fit],rcond=None)[0];extra['ols']=dict(slope=float(coef[0]),intercept=float(coef[1]))
 if r['task']=='pca':
  A=np.array(X);mean=A.mean(axis=0);_,sv,V=np.linalg.svd(A-mean,full_matrices=False);extra['pca']=dict(mean=mean.tolist(),variance=(sv**2/(len(fit)-1)).tolist(),projector=np.outer(V[0],V[0]).tolist())
 cases.append(dict(descriptor=r,X=X,y=y,partitions=parts,facts=facts,targetLabels=targetLabels,**extra))
p=Path(__file__).resolve().parents[1]/'tests/fixtures/csv-reference.json';p.write_text(json.dumps(dict(cases=cases),indent=2)+'\n',encoding='utf-8');print('Wrote four independent CSV cases / 340 observations, NumPy OLS and SVD references.')
