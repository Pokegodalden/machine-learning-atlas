"""Independent NumPy matrix backpropagation and minibatch-SGD reference."""
from pathlib import Path
import json
import numpy as np
root=Path(__file__).resolve().parents[1];mask=2**32-1
def random_values(seed):
 a=seed
 while True:
  a=(a+0x6D2B79F5)&mask;t=a;t=((t^(t>>15))*(t|1))&mask;t^=(t+(((t^(t>>7))*(t|61))&mask))&mask
  yield ((t^(t>>14))&mask)/2**32
default={'hidden-layers':2,'units':16,'learning-rate':.01,'epochs':200,'batch-size':32}
cases=[(id,default.copy(),7) for id in ['xor-corners','two-moons','two-blobs']]
for id,depth,units,rate,epochs,batch,seed in [('xor-corners',1,2,.0001,50,16,7),('xor-corners',3,4,.1,50,64,7),('xor-corners',1,32,.01,50,32,7),('xor-corners',3,32,.01,50,64,7),('xor-corners',2,16,.1,200,16,7),('two-moons',1,4,.01,50,64,7),('two-moons',3,8,.05,100,32,7),('xor-corners',2,16,.01,200,32,42),('xor-corners',2,16,.01,1000,64,7)]:cases.append((id,{'hidden-layers':depth,'units':units,'learning-rate':rate,'epochs':epochs,'batch-size':batch},seed))
outputs=[]
for dataset_id,p,seed in cases:
 d=json.loads((root.parent/'datasets'/f'{dataset_id}.json').read_text());raw=np.array(d['X']);labels=np.array(d['y']);train=np.array(d['partitions']['train']);validation=np.array(d['partitions']['validation']);mean=raw[train].mean(axis=0);scale=raw[train].std(axis=0);scale[scale==0]=1;X=(raw-mean)/scale;y=labels[train];sizes=[2]+[p['units']]*p['hidden-layers']+[1];rng=random_values(seed);W=[];B=[]
 for a,b in zip(sizes,sizes[1:]):
  bound=np.sqrt(6/(a+b));W.append(np.array([[(2*next(rng)-1)*bound for _ in range(a)] for _ in range(b)]));B.append(np.zeros(b))
 def forward(inputs):
  acts=[inputs]
  for index,(w,b) in enumerate(zip(W,B)):
   scores=acts[-1]@w.T+b
   acts.append(1/(1+np.exp(-scores)) if index==len(W)-1 else np.tanh(scores))
  return acts,scores[:,0]
 def predictions(ids):
  acts,scores=forward(X[ids]);prob=acts[-1][:,0];pred=prob>=.5;actual=labels[ids];conf=np.zeros((2,2),dtype=int)
  for a,b in zip(actual,pred):conf[int(a),int(b)]+=1
  tp=conf[1,1];fp=conf[0,1];fn=conf[1,0];precision=float(tp/(tp+fp)) if tp+fp else 0;recall=float(tp/(tp+fn)) if tp+fn else 0;f1=2*precision*recall/(precision+recall) if precision+recall else 0
  return {'rows':[{'rowId':int(i),'score':float(s),'probability':float(prob[j]),'label':int(pred[j])} for j,(i,s) in enumerate(zip(ids,scores))],'metrics':{'accuracy':float(np.mean(pred==actual)),'precision':precision,'recall':recall,'f1':f1,'confusion':conf.tolist(),'logLoss':float(np.mean(np.logaddexp(0,scores)-actual*scores))}}
 def model():return [{'weights':w.tolist(),'biases':b.tolist()} for w,b in zip(W,B)]
 history=[];saved=[];updates=0;stride=max(1,int(np.ceil(p['epochs']/20)));shuffle=random_values((seed^0xa5a5a5a5)&mask)
 def record(epoch):
  a=predictions(train);b=predictions(validation);history.append({'epoch':epoch,'updates':updates,'trainLoss':a['metrics']['logLoss'],'validationLoss':b['metrics']['logLoss'],'trainAccuracy':a['metrics']['accuracy'],'validationAccuracy':b['metrics']['accuracy']})
  if epoch in [0,stride,p['epochs']//2,p['epochs']]:saved.append({'epoch':epoch,'layers':model()})
 record(0)
 for epoch in range(1,p['epochs']+1):
  order=list(range(len(train)))
  for i in range(len(order)-1,0,-1):
   j=int(next(shuffle)*(i+1));order[i],order[j]=order[j],order[i]
  for start in range(0,len(order),p['batch-size']):
   positions=order[start:start+p['batch-size']];inputs=X[train[positions]];target=y[positions];acts,score=forward(inputs);delta=acts[-1]-target[:,None];gW=[None]*len(W);gB=[None]*len(W)
   for l in range(len(W)-1,-1,-1):
    gW[l]=delta.T@acts[l]/len(positions);gB[l]=delta.mean(axis=0)
    if l>0:delta=(delta@W[l])*(1-acts[l]**2)
   for l in range(len(W)):W[l]-=p['learning-rate']*gW[l];B[l]-=p['learning-rate']*gB[l]
   updates+=1
  record(epoch)
 queries=[[0,0],[.5,.25],[-1,1]];acts,scores=forward((np.array(queries)-mean)/scale)
 outputs.append({'datasetId':dataset_id,'parameters':p,'seed':seed,'sizes':sizes,'mean':mean.tolist(),'scale':scale.tolist(),'layers':model(),'history':history,'checkpoints':saved,'predictions':{'train':predictions(train),'validation':predictions(validation)},'queries':[{'raw':q,'score':float(scores[i]),'probability':float(acts[-1][i,0]),'activations':[a[i].tolist() for a in acts]} for i,q in enumerate(queries)]})
out={'method':'Independent NumPy matrix forward/backpropagation, fresh Glorot initialization, mean minibatch gradients, and explicit epoch shuffles using the specified matching uint32 RNG','numpyVersion':np.__version__,'absoluteTolerance':1e-9,'cases':outputs}
(root/'tests/fixtures/mlp-reference.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps({'fits':len(outputs),'predictions':sum(len(c['predictions']['train']['rows'])+len(c['predictions']['validation']['rows']) for c in outputs),'queries':sum(len(c['queries']) for c in outputs),'defaultXor':outputs[0]['predictions']['validation']['metrics']},indent=2))
