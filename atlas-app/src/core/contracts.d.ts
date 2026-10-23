export type ParameterValue = number | string | boolean;
export interface RunRequest {
  schemaVersion: '1.0.0';
  modelId: string;
  datasetId: string;
  datasetRevision: string;
  adapterVersion: string;
  modelSeed: number;
  preprocessing: 'none' | 'standardize-train' | 'center-fit';
  evaluation: 'validation' | 'fit' | 'greedy-policy'; // Clustering uses all declared fit rows; final test is separate.
  parameters: Record<string, ParameterValue>;
}
export interface Prediction {rowId: number; value: number;}
export interface RegressionMetrics {mse: number; rmse: number; mae: number; rowCount: number;}
export interface LinearModel {kind: 'linear-regression'; slope: number; intercept: number;}
export interface Checkpoint {
  index: number;
  kind: 'fitted-model'; // No synthetic optimizer steps.
  model: {slope: number; intercept: number};
}
export interface LinearResult {
 timing?:RunTiming;
  schemaVersion: '1.0.0';
  runId: number;
  configKey: string;
  request: RunRequest;
  model: LinearModel;
  preprocessing: {kind: 'none'};
  predictions: {train: Prediction[]; validation: Prediction[]};
  metrics: {train: RegressionMetrics; validation: RegressionMetrics};
  checkpoints: Checkpoint[];
}
export interface KnnModel {
  kind: 'knn'; k: number; weights: 'uniform' | 'distance';
  mean: number[]; scale: number[];
  training: {rowId: number; label: 0 | 1; z: number[]}[];
}
export interface ClassMetrics {
  accuracy: number; precision: number; recall: number; f1: number;
  confusion: number[][]; rowCount: number; zeroDivision: 0;
}
export interface KnnResult {
 timing?:RunTiming;
  schemaVersion: '1.0.0'; runId: number; configKey: string; request: RunRequest;
  model: KnnModel;
  preprocessing: {kind:'standardize-train'; mean:number[]; scale:number[]; ddof:0; fitRowIds:number[]};
  predictions: Record<'train'|'validation',{rowId:number; label:0|1; class1VoteShare:number}[]>;
  metrics: Record<'train'|'validation',ClassMetrics>;
  decisionMap: {extent:number; resolution:48; labels:number[]; sampling:'cell-centers'};
  checkpoints: {index:number; kind:'stored-training-set'; rowIds:number[]}[];
}
export interface LogisticModel {
  kind:'logistic-regression'; weights:number[]; intercept:number; c:number;
  mean:number[]; scale:number[];
}
export interface LogisticResult {
 timing?:RunTiming;
  schemaVersion:'1.0.0'; runId:number; configKey:string; request:RunRequest;
  model:LogisticModel;
  preprocessing:{kind:'standardize-train'; mean:number[]; scale:number[]; ddof:0; fitRowIds:number[]};
  predictions:Record<'train'|'validation',{rowId:number; score:number; probability:number}[]>;
  metrics:Record<'train'|'validation',ClassMetrics & {logLoss:number; threshold:number}>;
  checkpoints:{index:number; kind:'newton-iteration'; weights:number[]; intercept:number; objective:number; gradientInfinityNorm:number}[];
  solver:{kind:'damped-newton'; converged:true; tolerance:number; objectiveConvention:string};
}
export type ExperimentStatus = 'ready' | 'running' | 'completed' | 'requires-new-run' | 'canceled' | 'failed';
export type ComparisonSide = 'left' | 'right';
export interface ComparisonView {
  rows: {rowId:number; label:0|1; score?:number; probability?:number; class1VoteShare?:number; class1Fraction?:number; leafId?:number}[];
  metrics: ClassMetrics & {logLoss?:number};
  result: KnnResult | LogisticResult | TreeResult | ForestResult | SvmResult | MlpResult;
  threshold: number | null;
}
export interface PairedComparison {
  left: ComparisonView; right: ComparisonView;
  rows: {rowId:number; actual:0|1; left:0|1; right:0|1; disagree:boolean}[];
  disagreements: number[];
  leftOnlyCorrect:number; rightOnlyCorrect:number; bothCorrect:number; bothWrong:number;
}
export interface ComparisonMap {
  domain: [number,number][]; // Original feature units, shared by both panels.
  resolution:number; labels:number[]; sampling:'cell-centers';
}
export interface TreeNode {
  id:number; depth:number; rowIds:number[]; sampleCount:number; counts:[number,number];
  impurity:number; label:0|1; class1Fraction:number;
  feature:number|null; threshold:number|null; left:number|null; right:number|null;
  gain:number; stopReason:string|null;
  sampledFeatures?:number[]; evaluatedFeatures?:number[];
}
export interface TreeResult {
 timing?:RunTiming;
  schemaVersion:'1.0.0'; runId:number; configKey:string; request:RunRequest;
  model:{kind:'decision-tree'; criterion:'gini'; root:0; nodes:TreeNode[];
    parameters:{'max-depth':number; 'min-leaf':number}; depth:number; leafCount:number;
    tieRule:string; randomness:string};
  preprocessing:{kind:'none'; fitRowIds:number[]};
  predictions:Record<'train'|'validation',{rowId:number; label:0|1; class1Fraction:number; leafId:number; path:number[]}[]>;
  metrics:Record<'train'|'validation',ClassMetrics>;
  checkpoints:{index:number; kind:'fitted-split'; nodeId:number; feature:number; threshold:number; depth:number}[];
}
export interface ForestResult {
 timing?:RunTiming;
  schemaVersion:'1.0.0'; runId:number; configKey:string; request:RunRequest;
  model:{kind:'random-forest'; parameters:{'n-estimators':number; 'max-depth':number};
    trees:(TreeResult['model'] & {index:number; sampleSeed:number; featureSeed:number;
      bootstrapRowIds:number[]; uniqueTrainingCount:number; outOfBagRowIds:number[]})[];
    seed:number; criterion:'gini'; minimumLeaf:3; maxFeatures:1; bootstrapSize:number;
    randomGenerator:string; featurePolicy:string; aggregation:string};
  preprocessing:{kind:'none'; fitRowIds:number[]};
  predictions:Record<'train'|'validation',{rowId:number; label:0|1; probability:number; treeProbabilities:number[]}[]>;
  metrics:Record<'train'|'validation',ClassMetrics>;
  checkpoints:{index:number; kind:'fitted-tree'; treeCount:number; trainAccuracy:number; validationAccuracy:number}[];
  singleTree:TreeResult;
  decisionMap:{domain:[number,number][]; resolution:number; labels:number[]; probabilities:number[]; sampling:'cell-centers'};
}
export interface SvmModel {
  kind:'svm'; parameters:{c:number; kernel:'linear'|'rbf'; gamma?:number};
  mean:number[]; scale:number[]; intercept:number; weights:number[]|null;
  training:{rowId:number; label:0|1; internalLabel:-1|1; z:number[];
    alpha:number; coefficient:number; support:boolean}[];
  supportTolerance:number; supportRowIds:number[];
  labelMapping:{0:-1; 1:1}; decisionRule:string;
}
export interface SvmResult {
 timing?:RunTiming;
  schemaVersion:'1.0.0'; runId:number; configKey:string; request:RunRequest;
  model:SvmModel;
  preprocessing:{kind:'standardize-train'; mean:number[]; scale:number[]; ddof:0; fitRowIds:number[]};
  predictions:Record<'train'|'validation',{rowId:number; score:number; label:0|1}[]>;
  metrics:Record<'train'|'validation',ClassMetrics>;
  checkpoints:{index:number; kind:'dual-pair-updates'; iteration:number; kktGap:number; dualObjective:number}[];
  solver:{kind:'deterministic-most-violating-pair-smo'; converged:true; iterations:number;
    tolerance:number; kktGap:number; equalityResidual:number; primalObjective:number;
    dualObjective:number; dualityGap:number; interceptConvention:string};
  geometry:{domain:[number,number][]; resolution:number; scores:number[]; labels:number[];
    contours:{level:number; segments:[[number,number],[number,number]][]}[];
    sampling:'cell centers; contours interpolate vertex scores'};
}
export interface KmeansResult {
 timing?:RunTiming;
  schemaVersion:'1.0.0'; runId:number; configKey:string; request:RunRequest;
  model:{kind:'kmeans'; centers:number[][];
    parameters:{'n-clusters':number; restarts:number; initialization:'kmeans++'|'random'};
    seed:number; fitRowIds:number[]; tieRule:string; emptyClusterRule:string};
  preprocessing:{kind:'none'; fitRowIds:number[]};
  predictions:{fit:{rowId:number; cluster:number; squaredDistance:number}[]};
  metrics:{fit:{inertia:number; silhouette:number|null; silhouetteReason:string|null;
    clusterSizes:number[]; occupiedClusters:number; rowCount:number}};
  checkpoints:{index:number; phase:'initial'|'assignment'|'update'; iteration:number;
    centers:number[][]; labels:number[]|null; inertia:number|null;
    sizes:number[]; emptyClusters:number[]}[];
  trials:{index:number; seed:number; initialIndices:number[]; initialRowIds:number[];
    inertia:number; iterations:number; converged:boolean; occupiedClusters:number}[];
  selectedTrial:number;
  solver:{kind:'lloyd'; iterations:number; converged:boolean; maxIterations:100;
    selectionRule:string; randomGenerator:'mulberry32-uint32-v1'; initialization:'kmeans++'|'random'};
}
export interface PcaModel {
  kind:'pca'; parameters:{'n-components':1|2; whiten:boolean}; mean:number[];
  components:number[][]; singularValues:number[]; explainedVariance:number[];
  explainedVarianceRatio:number[]; totalVariance:number; rank:number;
  varianceTolerance:number; scoreScales:number[]; sampleCount:number; ddof:1;
  signConvention:string; solver:'two-column-jacobi-svd'; fitRowIds:number[];
}
export interface PcaPoint {
  rowId:number; centered:number[]; rawScores:number[]; scores:number[];
  reconstruction:number[]; residual:number[]; squaredError:number;
}
export interface PcaResult {
 timing?:RunTiming;
  schemaVersion:'1.0.0'; runId:number; configKey:string; request:RunRequest;
  model:PcaModel;
  preprocessing:{kind:'center-fit'; mean:number[]; fitRowIds:number[]; standardize:false};
  predictions:{fit:PcaPoint[]};
  metrics:{fit:{rowCount:number; retainedComponents:number; retainedVarianceRatio:number;
    meanSquaredReconstructionError:number; meanSquaredErrorPerFeature:number;
    rootMeanSquaredReconstructionDistance:number; maximumReconstructionDistance:number;
    scoreSampleVariance:number[]}};
  checkpoints:{index:0; kind:'fitted-decomposition'; mean:number[];
    components:number[][]; singularValues:number[]}[];
  solver:{kind:'two-column-jacobi-svd'; centered:true; standardized:false;
    ddof:1; deterministic:true; signConvention:string; varianceTolerance:number};
}
export interface MlpParameters {
  'hidden-layers':number; units:number; 'learning-rate':number;
  epochs:number; 'batch-size':16|32|64;
}
export interface MlpModel {
  kind:'mlp'; parameters:MlpParameters; sizes:number[];
  layers:{weights:number[][]; biases:number[]}[];
  seed:number; mean:number[]; scale:number[];
}
export interface MlpHistory {
  epoch:number; updates:number; trainLoss:number; validationLoss:number;
  trainAccuracy:number; validationAccuracy:number;
}
export interface MlpMap {
  domain:[number,number][]; resolution:number; probabilities:number[];
  labels:number[]; sampling:'cell-centers';
}
export interface MlpCheckpoint {
  index:number; kind:'sgd-epoch'; epoch:number; updates:number; model:MlpModel;
  metrics:Record<'train'|'validation',ClassMetrics & {logLoss:number}>; map:MlpMap;
}
export interface MlpResult {
 timing?:RunTiming;
  schemaVersion:'1.0.0'; runId:number; configKey:string; request:RunRequest;
  model:MlpModel;
  preprocessing:{kind:'standardize-train'; mean:number[]; scale:number[]; ddof:0; fitRowIds:number[]};
  predictions:Record<'train'|'validation',{rowId:number; score:number; probability:number; label:0|1}[]>;
  metrics:Record<'train'|'validation',ClassMetrics & {logLoss:number}>;
  history:MlpHistory[]; checkpoints:MlpCheckpoint[]; baseline:LogisticResult;
  decisionMap:MlpMap;
  solver:{kind:'minibatch-sgd'; epochsCompleted:number; updates:number; batchSize:number;
    learningRate:number; activation:'tanh'; output:'sigmoid'; objective:string;
    momentum:0; dropout:0; initialization:string; randomGenerator:'mulberry32-uint32-v1';
    shuffleSeed:number; status:'budget-completed'; converged:null;
    work:{connections:number; parameters:number; visits:number; limit:100000000}};
}
// Progress checkpoints are explicitly partial. Only a completed worker result
// can populate MlpResult and completed-run metric cards.
export interface MlpTrainingProgress {
  phase:'mlp-training'; epoch:number; totalEpochs:number; updates:number;
  history:MlpHistory[]; checkpoint:MlpCheckpoint;
}
export interface SavedSetup {
  schemaVersion: '1.0.0';
  modelId: string;
  datasetId: string;
  datasetRevision: string;
  parameters: Record<string, ParameterValue>;
  savedAt: string;
}
// These declarations describe the implemented v1 slice; JS runtime checks and
// tests enforce it today. TypeScript compilation is not part of this scaffold.

// Q-learning uses the environment only; no supervised partitions or targets.
export interface QTransition {
 episode:number; step:number; update:number; state:number[]; stateId:number;
 action:number; nextState:number[]; reward:number; terminal:boolean;
 truncated:boolean; blocked:boolean; explored:boolean; oldQ:number;
 bootstrap:number; target:number; tdError:number; updatedQ:number;
}
export interface QCheckpoint {
 episode:number; startQ:number[][]; q:number[][]; trace:QTransition[];
 totalReturn:number; steps:number; success:boolean;
}
export interface QProgress {
 phase:'q-training'; episodesCompleted:number; episodesRequested:number;
 checkpoint:QCheckpoint; history:{episode:number;totalReturn:number;steps:number;success:boolean;truncated:boolean;exploratoryActions:number}[];
}
export interface QParameters {
 'learning-rate':number; discount:number; exploration:number; episodes:number;
}
export interface QModel {
 kind:'q-learning'; parameters:QParameters; q:number[][]; visits:number[][];
 lastUpdates:(QTransition|null)[][]; seed:number;
}
export interface QEvaluation {
 success:boolean; steps:number; stepsToGoal:number|null; totalReturn:number;
 exploration:0; updates:0;
 trajectory:{step:number;state:number[];action:number;nextState:number[];reward:number;terminal:boolean;blocked:boolean}[];
}
export interface QResult {
 timing?:RunTiming;
 schemaVersion:'1.0.0'; runId:number; configKey:string; request:RunRequest;
 model:QModel; history:QProgress['history']; checkpoints:QCheckpoint[];
 evaluation:QEvaluation;
 metrics:{training:{episodes:number;updates:number;lastWindow:number;recentSuccessRate:number;meanReturn:number};evaluation:{success:boolean;stepsToGoal:number|null;totalReturn:number}};
 environmentReference:{steps:number|null;path:number[][];method:string};
 solver:{initialization:'zero';rng:string;tieBreak:string;epsilonSchedule:'fixed';externalStepLimit:number;episodesCompleted:number};
}
export interface SyntheticRecipe {
 pattern:'blobs'|'moons'; samples:number; noise:number; separation:number;
 outliers:number; stretch:number; seed:number; features:'both'|'first'|'second';
}
export interface SyntheticGenerator {version:'synthetic-1';recipe:SyntheticRecipe;}
export interface ExperimentDatasetDescriptor {
 id:string; revision:string; generator?:SyntheticGenerator|TaskGenerator; imported?:CsvDescriptor;
}
// Exactly one source: a frozen revision, a generator, or an embedded CSV.
export interface CsvDescriptor {
 version:'csv-1'; name:string; csv:string;
 task:'classification'|'regression'|'clustering'|'pca';
 features:number[]; target:number|null; types:('numeric'|'binary')[];
 missing:'reject'|'impute'; seed:number;
}
export type TaskRecipe = {samples:number;noise:number;outliers:number;seed:number} & (
 {task:'regression';slope:number;intercept:number} |
 ({stretch:number;angle:number;features:'both'|'first'|'second'} & (
  {task:'clusters';groups:number;separation:number} | {task:'ellipse';spread:number}
 ))
);
export interface TaskGenerator {version:'task-synthetic-1';recipe:TaskRecipe;}
export interface PortableExperiment {
 format:'machine-learning-atlas-experiment'; schemaVersion:'1.0.0';
 appVersion:string; name:string;
 configuration:{
   kind:'lesson'|'comparison'; dataset:ExperimentDatasetDescriptor;
   models:Pick<RunRequest,'modelId'|'adapterVersion'|'modelSeed'|'preprocessing'|'evaluation'|'parameters'>[];
   presentation:{level:'beginner'|'advanced';chapter:number};
   comparisonScaling?:'none'|'standardize-train';
 };
}

export interface RunTiming {version:'timing-1';clock:'performance.now';fitMs:number;referenceMs:number;otherMs:number;workerRunMs:number;roundTripMs:number;}
export interface PairedTimingTrial {index:number;order:('left'|'right')[];left:{runId:number;requestKey:string;timing:RunTiming};right:{runId:number;requestKey:string;timing:RunTiming};}
