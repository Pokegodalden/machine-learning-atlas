import {explainObservation,regressionSummary,visibleRows} from '../core/linear-explanation.js';
export function createScenes({main,D,state,config,route,lessons,fmt,esc,announce,onSceneDrawn,drawKnn,drawLogistic,drawComparison,drawTree,drawForest,drawSvm,drawKmeans,drawPca,drawMlp,drawQlearning,getLinearDataset}){
let observer=null;
  function plotBase(container,X,{xLabel='x₁',yLabel='x₂',id='chart',fixedHeight=null}={}) {
    const width=Math.max(280,container.clientWidth),height=fixedHeight||Math.max(275,Math.min(395,width*.56));
    const left=48,right=22,top=24,bottom=41;
    const xs=X.map(p=>p[0]),ys=X.map(p=>p[1]);
    const extent=a=>{let lo=Math.min(...a),hi=Math.max(...a);const pad=Math.max((hi-lo)*.13,.5);return [lo-pad,hi+pad];};
    const [xmin,xmax]=extent(xs),[ymin,ymax]=extent(ys);
    const px=x=>left+(x-xmin)/(xmax-xmin)*(width-left-right),py=y=>height-bottom-(y-ymin)/(ymax-ymin)*(height-top-bottom);
    const ticks=(lo,hi)=>{const span=hi-lo,step=span<=5?1:span<=10?2:5;const values=[];for(let i=Math.ceil(lo/step)*step;i<=hi;i+=step)values.push(i);return values.length>6?values.filter((_,i)=>i%2===0):values;};
    const xt=ticks(xmin,xmax),yt=ticks(ymin,ymax);
    let svg=`<svg data-xmin="${xmin}" data-xmax="${xmax}" data-ymin="${ymin}" data-ymax="${ymax}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(xLabel)} versus ${esc(yLabel)} point plot"><defs><clipPath id="clip-${id}"><rect x="${left}" y="${top}" width="${width-left-right}" height="${height-top-bottom}"/></clipPath></defs>`;
    for(const x of xt)svg+=`<line class="plot-grid" x1="${px(x)}" x2="${px(x)}" y1="${top}" y2="${height-bottom}"/><text x="${px(x)}" y="${height-bottom+19}" text-anchor="middle">${fmt(x,1)}</text>`;
    for(const y of yt)svg+=`<line class="plot-grid" y1="${py(y)}" y2="${py(y)}" x1="${left}" x2="${width-right}"/><text x="${left-10}" y="${py(y)+4}" text-anchor="end">${fmt(y,1)}</text>`;
    if(xmin<=0&&xmax>=0)svg+=`<line class="plot-axis" x1="${px(0)}" x2="${px(0)}" y1="${top}" y2="${height-bottom}"/>`;
    if(ymin<=0&&ymax>=0)svg+=`<line class="plot-axis" y1="${py(0)}" y2="${py(0)}" x1="${left}" x2="${width-right}"/>`;
    svg+=`<text class="axis-name" x="${width-right}" y="${height-8}" text-anchor="end">${esc(xLabel)}</text><text class="axis-name" x="17" y="${top+7}">${esc(yLabel)}</text><g clip-path="url(#clip-${id})">`;
    return {svg,px,py,width,height,xmin,xmax,ymin,ymax,close:'</g></svg>'};
  }

  function drawLinear(container) {
    const d=getLinearDataset?.()||D.datasets['line-noise'],p=config('linear-regression'),view=state.linearView,rows=visibleRows(d,view.split),all=visibleRows(d,'both');
    if(!rows.includes(state.selectedPoint))state.selectedPoint=rows[0];
    const chosen=explainObservation(d,state.selectedPoint,p),hasLine=state.beat>=1,hasTruth=state.beat===3&&view.showTruth&&!!d.truth;
    const domain=all.map(i=>[d.X[i][0],d.y[i]]);if(hasLine)domain.push([chosen.x,chosen.predicted]);
    const plot=plotBase(container,domain,{xLabel:'x',yLabel:'y',id:'line'});let svg=plot.svg;
    if(hasTruth)svg+=`<path class="truth-line" d="M${plot.px(plot.xmin)},${plot.py(d.truth.slope*plot.xmin+d.truth.intercept)} L${plot.px(plot.xmax)},${plot.py(d.truth.slope*plot.xmax+d.truth.intercept)}"/>`;
    if(hasLine&&view.residuals!=='none')for(const i of view.residuals==='all'?rows:[chosen.rowId]){
      const point=explainObservation(d,i,p);svg+=`<line class="residual-line ${i===chosen.rowId?'active-residual':''}" data-residual-row="${i}" x1="${plot.px(point.x)}" x2="${plot.px(point.x)}" y1="${plot.py(point.observed)}" y2="${plot.py(point.predicted)}"/>`;
    }
    if(hasLine)svg+=`<path class="candidate-line" d="M${plot.px(plot.xmin)},${plot.py(p.slope*plot.xmin+p.intercept)} L${plot.px(plot.xmax)},${plot.py(p.slope*plot.xmax+p.intercept)}"/>`;
    if(hasLine){const x0=plot.px(0),y0=plot.py(p.intercept),x1=plot.px(1),y1=plot.py(p.slope+p.intercept);svg+=`<path class="v22-slope-cue" d="M${x0} ${y0}H${x1}V${y1}"/><line class="v22-intercept-cue" x1="${x0}" x2="${x0}" y1="${plot.py(0)}" y2="${y0}"/><circle class="v22-intercept-cue" cx="${x0}" cy="${y0}" r="7"/>`;}
    const train=new Set(d.partitions.train);
    for(const i of rows)svg+=`<circle class="${train.has(i)?'data-point':'validation-point'}" cx="${plot.px(d.X[i][0])}" cy="${plot.py(d.y[i])}" r="${i===chosen.rowId?4.3:3.1}"/>`;
    svg+=`<circle class="selected-ring" cx="${plot.px(chosen.x)}" cy="${plot.py(chosen.observed)}" r="7"/>`;
    if(hasLine){const labelX=plot.px(chosen.x)>plot.width/2?plot.px(chosen.x)-10:plot.px(chosen.x)+10,anchor=plot.px(chosen.x)>plot.width/2?'end':'start';svg+=`<line class="point-guide" x1="${plot.px(chosen.x)}" x2="${plot.px(chosen.x)}" y1="${plot.py(chosen.predicted)}" y2="${plot.height-41}"/><circle class="prediction-marker" cx="${plot.px(chosen.x)}" cy="${plot.py(chosen.predicted)}" r="5"/><text class="prediction-label" x="${labelX}" y="${plot.py(chosen.predicted)-9}" text-anchor="${anchor}">ŷᵢ</text>`;}
    for(const i of rows)svg+=`<circle data-point-index="${i}" cx="${plot.px(d.X[i][0])}" cy="${plot.py(d.y[i])}" r="11" fill="transparent"><title>Observation ${i+1}: x ${fmt(d.X[i][0])}, y ${fmt(d.y[i])}</title></circle>`;
    container.innerHTML=svg+plot.close;
    const select=row=>{state.selectedPoint=row;drawLinear(container);const point=explainObservation(d,row,p);announce(`Observation ${row+1}, ${point.split}. Residual ${fmt(point.residual)}. Squared error ${fmt(point.squaredError)}.`);};
    container.querySelectorAll('[data-point-index]').forEach(el=>el.addEventListener('click',()=>select(Number(el.dataset.pointIndex))));
    container.tabIndex=0;container.setAttribute('aria-label','Point plot. Arrow keys select observations. Numeric details appear below.');
    container.onkeydown=event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();const index=rows.indexOf(state.selectedPoint);select(rows[(index+(event.key==='ArrowRight'?1:-1)+rows.length)%rows.length]);};
    document.getElementById('lesson-legend').innerHTML='<span class="legend-item"><i class="swatch"></i>Training observations</span><span class="legend-item"><i class="swatch validation"></i>Validation observations</span>'+ (hasLine?'<span class="legend-item"><i class="swatch line"></i>Displayed line</span>':'')+(hasLine&&view.residuals!=='none'?'<span class="legend-item"><i class="swatch residual"></i>Residual · observed − predicted</span>':'')+(hasTruth?'<span class="legend-item"><i class="swatch truth"></i>Generating relationship</span>':'');
    document.getElementById('lesson-equation').innerHTML=hasLine?`<span>ŷ =</span><button class="equation-quantity yellow" data-quantity="slope" aria-label="Adjust slope w">${fmt(p.slope)}</button><span>x ${p.intercept<0?'−':'+'}</span><button class="equation-quantity green" data-quantity="intercept" aria-label="Adjust intercept b">${fmt(Math.abs(p.intercept))}</button>`:'<span class="cyan">xᵢ</span><span>↔</span><span class="cyan">yᵢ</span>';
    document.querySelectorAll('[data-quantity]').forEach(el=>el.addEventListener('click',()=>document.querySelector(`[data-param-number="${el.dataset.quantity}"]`).focus()));
    const tr=regressionSummary(d,d.partitions.train,p),va=regressionSummary(d,d.partitions.validation,p);
    document.getElementById('lesson-metrics').innerHTML=[['Training RMSE',tr.rmse,`${d.partitions.train.length} training observations`],['Validation RMSE',va.rmse,`${d.partitions.validation.length} validation observations`],['Squared-error loss',tr.mse,'Mean on training rows'],['Training MAE',tr.mae,'Mean absolute training error'],['Validation MAE',va.mae,'Mean absolute validation error']].map(([label,value,detail])=>`<div class="metric-item"><span class="metric-label">${label}</span><span class="metric-value">${hasLine?fmt(value):'—'}</span><span class="metric-detail">${detail}</span></div>`).join('');
    const residualContainer=document.getElementById('residual-plot');
    if(residualContainer&&state.beat===3){const diagnostic=plotBase(residualContainer,all.map(i=>[d.X[i][0],explainObservation(d,i,p).residual]).concat([[0,0]]),{xLabel:'x',yLabel:'r',id:'residuals',fixedHeight:185});let chart=diagnostic.svg;
      for(const i of rows){const point=explainObservation(d,i,p);chart+=`<circle class="${train.has(i)?'data-point':'validation-point'}" data-diagnostic-row="${i}" cx="${diagnostic.px(point.x)}" cy="${diagnostic.py(point.residual)}" r="${i===chosen.rowId?4.5:2.5}"/>`;}
      chart+=`<circle class="selected-ring" cx="${diagnostic.px(chosen.x)}" cy="${diagnostic.py(chosen.residual)}" r="7"/>`;residualContainer.innerHTML=chart+diagnostic.close;
    }
    const status=document.getElementById('run-status');status.className=`status ${state.fitted?'fitted':'manual'}`;onSceneDrawn();
  }

  function drawCloud(container,d,id,validationOnly=false) {
    const rows=validationOnly?d.partitions.validation:d.partitions.train||d.partitions.fit;
    const points=rows.map(i=>d.X[i]);const plot=plotBase(container,points,{id});let svg=plot.svg;
    for(const i of rows){const x=plot.px(d.X[i][0]),y=plot.py(d.X[i][1]);svg+=d.y?.[i]===1?`<rect x="${x-3.2}" y="${y-3.2}" width="6.4" height="6.4" fill="#b68bd1" opacity=".8"/>`:`<circle cx="${x}" cy="${y}" r="3.1" fill="#58c4dd" opacity=".8"/>`;}
    container.innerHTML=svg+plot.close;
  }

  function drawNetwork(container,id) {
    const cfg=config(id),width=Math.max(280,container.clientWidth),height=355;
    const sizes=[2,...Array(cfg['hidden-layers']).fill(cfg.units),1],visible=sizes.map(n=>Math.min(n,5));
    const nodes=visible.map((n,col)=>Array.from({length:n},(_,row)=>({x:35+col*(width-70)/(sizes.length-1),y:90+row*43+(5-n)*21.5})));
    let svg=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Architecture schematic, not trained activations">`;
    for(let i=0;i<nodes.length-1;i++)for(const a of nodes[i])for(const b of nodes[i+1])svg+=`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="#354253" stroke-width="1"/>`;
    nodes.forEach((layer,col)=>{svg+=`<text x="${layer[0].x}" y="45" text-anchor="middle" fill="#afb8c5">${col===0?'Input':col===nodes.length-1?'Output':`Hidden ${col}`}</text><text x="${layer[0].x}" y="65" text-anchor="middle" fill="#afb8c5">${sizes[col]} ${sizes[col]===1?'unit':'units'}</text>`;for(const n of layer)svg+=`<circle cx="${n.x}" cy="${n.y}" r="9" fill="#080b10" stroke="${col===nodes.length-1?'#ffff00':'#58c4dd'}" stroke-width="2"/>`;});
    svg+='<text x="'+width/2+'" y="330" text-anchor="middle">Showing at most 5 units per layer · architecture schematic</text></svg>';container.innerHTML=svg;
  }

  function redrawPlots() {
    const [section,id]=route();
    if(section==='lesson'&&lessons.has(id)) {
      const el=document.getElementById('lesson-plot');if(!el)return;const l=lessons.get(id),d=D.datasets[l.primaryDatasetId];
      if(id==='linear-regression'){drawLinear(el);return;}
      if(id==='knn'){drawKnn(el);return;}
      if(id==='logistic-regression'){drawLogistic(el);return;}
      if(id==='q-learning'){drawQlearning(el);return;}
      if(id==='mlp'){drawMlp(el);return;}
      if(id==='pca'){drawPca(el);return;}
      if(id==='kmeans'){drawKmeans(el);return;}
      if(id==='svm'){drawSvm(el);return;}
      if(id==='random-forest'){drawForest(el);return;}
      if(id==='decision-tree'){drawTree(el);return;}
      if(id==='q-learning')el.innerHTML=`<div class="grid-world" role="img" aria-label="Six-by-six grid with start, goal, and walls">${Array.from({length:36},(_,i)=>{const r=Math.floor(i/6),c=i%6,wall=d.walls.some(p=>p[0]===r&&p[1]===c),start=d.start[0]===r&&d.start[1]===c,goal=d.goal[0]===r&&d.goal[1]===c;return `<div class="grid-cell ${wall?'wall':start?'start':goal?'goal':''}">${start?'S':goal?'G':wall?'':`${r},${c}`}</div>`;}).join('')}</div><div class="generic-preview-label">Environment preview · policy not trained</div>`;
      else if(id==='mlp')drawNetwork(el,id);
      else drawCloud(el,d,'lesson-'+id);
      document.getElementById('lesson-legend').innerHTML=id==='q-learning'?'<span> S · start</span><span> G · goal</span><span>Filled cells · walls</span>':id==='mlp'?'<span>Network structure · no trained activation values</span>':d.y?'<span class="legend-item"><i class="swatch"></i>Class 0</span><span class="legend-item"><i class="swatch class1"></i>Class 1</span>':'<span class="legend-item"><i class="swatch"></i>Unlabeled observations</span>';
      document.getElementById('lesson-equation').textContent=id==='pca'?'z = (x − x̄)ᵀv₁':id==='kmeans'?'J = Σᵢ ‖xᵢ − μcᵢ‖²':id==='logistic-regression'?'p(y = 1 | x) = σ(wᵀx + b)':id==='q-learning'?'Q(s, a) ← Q(s, a) + α · error':id==='mlp'?'hₗ = φ(Wₗhₗ₋₁ + bₗ)':'Input preview · model not fitted';
      document.getElementById('lesson-metrics').innerHTML=[['Model result','—','Not fitted'],['Evaluation','—','Run required'],['Input',d.X?String(d.X.length):'6 × 6',d.X?'Observations':'Grid size']].map(([label,value,detail])=>`<div class="metric-item"><span class="metric-label">${label}</span><span class="metric-value">${value}</span><span class="metric-detail">${detail}</span></div>`).join('');
    } else if(section==='compare') {
      drawComparison();
    }
  }
  function observePlots(){observer?.disconnect();observer=new ResizeObserver(()=>redrawPlots());main.querySelectorAll('.plot-container').forEach(el=>observer.observe(el));}


return {redrawPlots,observePlots,disconnectPlots:()=>observer?.disconnect()};
}
