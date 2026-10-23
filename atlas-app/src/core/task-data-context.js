import {importCsv} from '../data/csv-data.js';
import {generateTaskData,taskFromDescriptor} from '../data/task-data.js';
export const taskModels={'linear-regression':{task:'regression',id:'line-noise'},kmeans:{task:'clusters',id:'three-clusters'},pca:{task:'ellipse',id:'tilted-cloud'}};
export class TaskDataContext{
  constructor(datasets){this.datasets=datasets;this.overrides={};}
  dataset(model){const spec=taskModels[model];if(!spec)throw Error('This lesson does not support task data.');return this.overrides[model]||this.datasets[spec.id];}
  setRecipe(model,recipe){return this.restore(model,{version:'task-synthetic-1',recipe});}
  restore(model,descriptor=null,imported=null){if(descriptor&&imported)throw Error('Choose a single dataset source.');const spec=taskModels[model];if(!spec)throw Error('This lesson does not support task data.');const d=imported?importCsv(imported):descriptor?taskFromDescriptor(descriptor):null;if(d&&(d.id!==spec.id||(imported?imported.task!==({'linear-regression':'regression',kmeans:'clustering',pca:'pca'}[model]):d.generator.recipe.task!==spec.task)))throw Error('This generated task is incompatible with the lesson.');this.overrides[model]=d;return this.dataset(model);}
}
