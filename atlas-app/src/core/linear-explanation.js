export function explainObservation(dataset,rowId,model){
  if(!Number.isInteger(rowId)||!dataset.X[rowId]||!Number.isFinite(dataset.y[rowId]))throw new Error('Select a valid observation.');
  const x=dataset.X[rowId][0],observed=dataset.y[rowId],predicted=model.slope*x+model.intercept,residual=observed-predicted;
  return {rowId,x,observed,predicted,residual,squaredError:residual**2,absoluteError:Math.abs(residual),split:dataset.partitions.train.includes(rowId)?'training':dataset.partitions.validation.includes(rowId)?'validation':'test'};
}
export function regressionSummary(dataset,rows,model){
  if(!rows.length)throw new Error('Evaluation requires observations.');
  const errors=rows.map(i=>explainObservation(dataset,i,model));
  const mse=errors.reduce((s,p)=>s+p.squaredError,0)/rows.length;
  return {mse,rmse:Math.sqrt(mse),mae:errors.reduce((s,p)=>s+p.absoluteError,0)/rows.length,rowCount:rows.length};
}
export function interpolateLine(from,to,t){const bounded=Math.max(0,Math.min(1,t));return {slope:from.slope+(to.slope-from.slope)*bounded,intercept:from.intercept+(to.intercept-from.intercept)*bounded};}
export function visibleRows(dataset,split){return split==='training'?dataset.partitions.train:split==='validation'?dataset.partitions.validation:[...dataset.partitions.train,...dataset.partitions.validation];}
