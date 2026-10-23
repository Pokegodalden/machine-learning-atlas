import {evaluateQlearning} from './q-learning.js';
import {evaluateMlp} from './mlp.js';
import {evaluatePca} from './pca.js';
import {evaluateKmeans} from './kmeans.js';
import {fitLinear} from './linear-regression.js';
import {evaluateKnn} from './knn.js';
import {evaluateLogistic} from './logistic-regression.js';
import {evaluateTree} from './decision-tree.js';
import {evaluateForest} from './random-forest.js';
import {evaluateSvm} from './svm.js';
export const modelCapabilities=Object.freeze([
  {id:'linear-regression',status:'foundation-adapter',version:'ols-1',task:'regression',datasetIds:['line-noise'],outputs:['numeric-predictions','training-and-validation-metrics','fitted-coefficients'],checkpointKind:'fitted-model'},
  {id:'knn',status:'implemented',version:'knn-1',task:'classification',datasetIds:['two-blobs','two-moons'],outputs:['labels','vote-shares','neighbors','confusion-matrix','sampled-decision-map'],checkpointKind:'stored-training-set'},
  {id:'logistic-regression',status:'implemented',version:'logistic-newton-1',task:'classification',datasetIds:['two-blobs','two-moons','xor-corners'],outputs:['probabilities','scores','classification-metrics','newton-checkpoints'],checkpointKind:'newton-iteration'},
  {id:'decision-tree',status:'implemented',version:'cart-gini-1',task:'classification',datasetIds:['two-blobs','two-moons'],outputs:['labels','fitted-nodes','leaf-regions','decision-paths','classification-metrics'],checkpointKind:'fitted-split'},
  {id:'random-forest',status:'implemented',version:'forest-gini-1',task:'classification',datasetIds:['two-blobs','two-moons'],outputs:['averaged-probabilities','bootstrap-identities','feature-choices','classification-metrics','forest-size-checkpoints'],checkpointKind:'fitted-tree'},
  {id:'svm',status:'implemented',version:'svm-smo-1',task:'classification',datasetIds:['two-blobs','two-moons'],outputs:['decision-scores','support-coefficients','score-contours','classification-metrics','optimization-certificate'],checkpointKind:'dual-pair-updates'},
  {id:'kmeans',status:'implemented',version:'lloyd-1',task:'clustering',datasetIds:['three-clusters'],outputs:['cluster-assignments','centroids','lloyd-states','inertia','silhouette','restart-summaries'],checkpointKind:'lloyd-state'},
  {id:'pca',status:'implemented',version:'pca-jacobi-1',task:'dimensionality-reduction',datasetIds:['tilted-cloud'],outputs:['sample-mean','principal-components','explained-variance','scores','reconstruction','original-unit-error'],checkpointKind:'fitted-decomposition'},
  {id:'mlp',status:'implemented',version:'mlp-sgd-1',task:'classification',datasetIds:['xor-corners','two-moons','two-blobs'],outputs:['probabilities','hidden-activations','epoch-history','checkpoint-maps','classification-metrics','matched-logistic-baseline'],checkpointKind:'sgd-epoch'},
  {id:'q-learning',status:'implemented',version:'q-tabular-1',task:'sequential-decision',datasetIds:['grid-route'],outputs:['state-action-values','recorded-transitions','episode-returns','greedy-evaluation','environment-reference'],checkpointKind:'sampled-episode'}
]);
export function runAdapter(request,dataset,runId,onProgress=()=>{}){
  const capability=modelCapabilities.find(x=>x.id===request.modelId);
  if(!capability?.version)throw new Error('This model adapter is not available yet.');
  return request.modelId==='q-learning'?evaluateQlearning(request,dataset,runId,onProgress):request.modelId==='mlp'?evaluateMlp(request,dataset,runId,onProgress):request.modelId==='pca'?evaluatePca(request,dataset,runId):request.modelId==='kmeans'?evaluateKmeans(request,dataset,runId,onProgress):request.modelId==='knn'?evaluateKnn(request,dataset,runId):request.modelId==='logistic-regression'?evaluateLogistic(request,dataset,runId):request.modelId==='decision-tree'?evaluateTree(request,dataset,runId):request.modelId==='random-forest'?evaluateForest(request,dataset,runId,onProgress):request.modelId==='svm'?evaluateSvm(request,dataset,runId,onProgress):fitLinear(request,dataset,runId);
}
