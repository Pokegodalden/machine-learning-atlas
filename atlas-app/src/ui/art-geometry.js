// Geometry for the small explanatory cloud only; this never replaces a lesson fit.
export const artPoints=Object.freeze([[28,89],[44,76],[59,92],[74,62],[88,79],[104,48],[121,68],[139,38],[154,56],[171,24],[188,40]].map(Object.freeze));
const mean=axis=>artPoints.reduce((sum,p)=>sum+p[axis],0)/artPoints.length;
const mx=mean(0),my=mean(1),xx=artPoints.reduce((s,p)=>s+(p[0]-mx)**2,0),yy=artPoints.reduce((s,p)=>s+(p[1]-my)**2,0),xy=artPoints.reduce((s,p)=>s+(p[0]-mx)*(p[1]-my),0);
export const artFit=Object.freeze({slope:xy/xx,intercept:my-xy/xx*mx});
export const artPrincipal=Object.freeze({mean:[mx,my],angle:Math.atan2(2*xy,xx-yy)/2});
const clamp=p=>Math.max(0,Math.min(1,p));
export function regressionGeometry(progress=1){const t=clamp(progress),slope=-.12+(artFit.slope+.12)*t,intercept=79+(artFit.intercept-79)*t;return {slope,intercept,line:[[23,slope*23+intercept],[195,slope*195+intercept]],residuals:artPoints.map(([x,y])=>({x,y,predicted:slope*x+intercept}))};}
export function pcaGeometry(progress=1){const angle=artPrincipal.angle*clamp(progress),v=[Math.cos(angle),Math.sin(angle)],center=artPrincipal.mean;return {center,v,line:[-94,94].map(t=>[center[0]+t*v[0],center[1]+t*v[1]]),projections:artPoints.map(([x,y])=>{const score=(x-center[0])*v[0]+(y-center[1])*v[1];return {x,y,px:center[0]+score*v[0],py:center[1]+score*v[1]};})};}
export function paintMathArt(svg,id,progress){
 const line=svg.querySelector('.art-fit-line');if(!line)return;
 const geometry=id==='linear-regression'?regressionGeometry(progress):pcaGeometry(progress),[[x1,y1],[x2,y2]]=geometry.line;
 line.setAttribute('d',`M${x1} ${y1}L${x2} ${y2}`);svg.dataset.artProgress=String(progress);
 if(id==='linear-regression')svg.querySelectorAll('[data-art-residual]').forEach((node,i)=>{const p=geometry.residuals[i];node.setAttribute('x1',p.x);node.setAttribute('x2',p.x);node.setAttribute('y1',p.y);node.setAttribute('y2',p.predicted);});
 else{const label=svg.querySelector('.art-direction-label');if(label){label.setAttribute('x',x2-10);label.setAttribute('y',y2-7);}svg.querySelectorAll('[data-art-projection]').forEach((node,i)=>{const p=geometry.projections[i];node.setAttribute('x1',p.x);node.setAttribute('y1',p.y);node.setAttribute('x2',p.px);node.setAttribute('y2',p.py);});svg.querySelectorAll('[data-art-foot]').forEach((node,i)=>{const p=geometry.projections[i];node.setAttribute('cx',p.px);node.setAttribute('cy',p.py);});}
}
export function mathArtMarkup(id){
 const observations=artPoints.map(([x,y],i)=>`<circle class="art-observation" data-art-point="${i}" cx="${x}" cy="${y}" r="3" fill="var(--cyan)"/>`).join('');
 const geometry=id==='linear-regression'?regressionGeometry():pcaGeometry();
 const segments=id==='linear-regression'?geometry.residuals.map((p,i)=>`<line class="art-residual" data-art-residual="${i}" x1="${p.x}" x2="${p.x}" y1="${p.y}" y2="${p.predicted}"/>`).join(''):geometry.projections.map((p,i)=>`<line class="art-projection" data-art-projection="${i}" x1="${p.x}" y1="${p.y}" x2="${p.px}" y2="${p.py}"/><circle class="art-projection-foot" data-art-foot="${i}" cx="${p.px}" cy="${p.py}" r="1.6"/>`).join('');
 const [[x1,y1],[x2,y2]]=geometry.line;
 return `<path class="art-axis" d="M18 12V106H205"/>${segments}<path class="art-gold art-fit-line" d="M${x1} ${y1}L${x2} ${y2}"/>${id==='pca'?`<text class="art-direction-label" x="${x2-10}" y="${y2-7}">PC₁</text><circle class="art-mean" cx="${mx}" cy="${my}" r="3.5"/>`:''}${observations}`;
}
