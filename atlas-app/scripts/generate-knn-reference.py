from pathlib import Path
import numpy as np,json
root=Path(__file__).resolve().parents[2];cases=[]
for name in ['two-blobs','two-moons']:
    d=json.loads((root/'datasets'/f'{name}.json').read_text());x=np.asarray(d['X']);y=np.asarray(d['y']);rows=np.array(d['partitions']['train']);train=x[rows];mean=train.mean(axis=0);scale=train.std(axis=0);scale[scale==0]=1;z=(train-mean)/scale
    for k in [1,5,25]:
        for weight in ['uniform','distance']:
            def prediction(q):
                distances=np.linalg.norm(z-(np.asarray(q)-mean)/scale,axis=1);idx=np.lexsort((rows,distances))[:k];near=distances[idx]
                votes=np.ones(k) if weight=='uniform' else (near==0).astype(float) if np.any(near==0) else 1/near
                scores=np.bincount(y[rows[idx]],weights=votes,minlength=2);return {'label':int(scores[1]>scores[0]),'class1VoteShare':float(scores[1]/scores.sum()),'neighbors':[{'rowId':int(rows[i]),'distance':float(distances[i]),'weight':float(w)} for i,w in zip(idx,votes)]}
            predictions={split:[{'rowId':i,**{key:v for key,v in prediction(x[i]).items() if key!='neighbors'}} for i in d['partitions'][split]] for split in ['train','validation']}
            metrics={}
            for split in ['train','validation']:
                actual=y[d['partitions'][split]];pred=np.array([p['label'] for p in predictions[split]]);cm=np.zeros((2,2),dtype=int)
                np.add.at(cm,(actual,pred),1);tn,fp,fn,tp=cm.ravel();precision=tp/(tp+fp) if tp+fp else 0.;recall=tp/(tp+fn) if tp+fn else 0.;metrics[split]={'accuracy':float((pred==actual).mean()),'precision':float(precision),'recall':float(recall),'f1':float(2*precision*recall/(precision+recall)) if precision+recall else 0.,'confusion':cm.tolist()}
            queries=[x[int(rows[0])].tolist(),[0.,0.],[1.,.5],[-.75,.25]]
            cases.append({'datasetId':name,'k':k,'weights':weight,'mean':mean.tolist(),'scale':scale.tolist(),'predictions':predictions,'metrics':metrics,'queries':[{'raw':q,**prediction(q)} for q in queries]})
path=root/'atlas-app/tests/fixtures/knn-reference.json';path.write_text(json.dumps({'method':'NumPy vectorized standardization, lexsort, distances, weighted bincount','numpyVersion':np.__version__,'absoluteTolerance':1e-12,'cases':cases},indent=2)+'\n')
print(f'Generated {len(cases)} independent configurations and {sum(len(p) for c in cases for p in c["predictions"].values())} predictions.')
