// Focused semantic, contrast and browser review; not a substitute for a human AT audit.
const {chromium}=require(process.env.MLA_PLAYWRIGHT_MODULE||'playwright'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),origin='http://127.0.0.1:8773/';
const routes=['explore','algorithm/pca','algorithm/transformer','library','activities','compare','compare/clustering',...['linear-regression','knn','logistic-regression','decision-tree','random-forest','svm','kmeans','pca','mlp','q-learning'].map(id=>'lesson/'+id)];
(async()=>{
 const results=[];
 for(const [name,executablePath] of [['Edge','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'],['Chrome','C:/Program Files/Google/Chrome/Application/chrome.exe']]){
  const browser=await chromium.launch({executablePath,headless:true});
  try{
   const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));const cdp=await page.context().newCDPSession(page);
   for(const route of routes){
    await page.goto(origin+'#/'+route);await page.waitForFunction(()=>!!window.MLA_APP);await page.locator('h1').waitFor();
    const findings=await page.evaluate(()=>{
     const visible=n=>!!n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden'&&!n.closest('[aria-hidden=true]');
     const name=n=>n.getAttribute('aria-label')||(n.getAttribute('aria-labelledby')||'').split(/\s+/).map(id=>document.getElementById(id)?.textContent||'').join(' ').trim()||[...(n.labels||[])].map(l=>l.textContent).join(' ').trim()||n.getAttribute('title')||n.textContent.trim();
     const unnamed=[...document.querySelectorAll('button,input:not([type=hidden]),select,textarea,summary,a[href]')].filter(n=>visible(n)&&!name(n)).map(n=>({tag:n.tagName,id:n.id,type:n.type}));
     const rgba=s=>{const m=s.match(/[\d.]+/g)?.map(Number);return m&&m.length>=3?[m[0],m[1],m[2],m[3]??1]:[0,0,0,0];},over=(a,b)=>[...a.slice(0,3).map((v,i)=>v*a[3]+b[i]*(1-a[3])),1];
     const luminance=c=>c.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
     const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
     const contrastIssues=[];
     for(const node of document.querySelectorAll('h1,h2,h3,p,label,summary,button,a,span,td,th,dt,dd')){
      if(!(node instanceof HTMLElement)||!visible(node)||node.closest('button:disabled,[aria-disabled=true],.brand,.sr-only')||!node.childNodes.length)continue;
      const text=[...node.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join(' ').trim();if(!text)continue;
      const style=getComputedStyle(node);let opacity=1;const ancestors=[];for(let p=node;p;p=p.parentElement){ancestors.push(p);opacity*=Number(getComputedStyle(p).opacity);}if(opacity===0)continue;
      let background=[8,11,16,1];for(const p of ancestors.reverse())background=over(rgba(getComputedStyle(p).backgroundColor),background);
      const color=rgba(style.color);color[3]*=opacity;const rendered=over(color,background),ratio=contrast(rendered,background),size=parseFloat(style.fontSize),large=size>=24||(size>=18.66&&parseFloat(style.fontWeight)>=700),required=large?3:4.5;
      if(ratio+.01<required)contrastIssues.push({text:text.slice(0,90),tag:node.tagName,id:node.id,class:node.className,color:style.color,background:background.slice(0,3).map(Math.round),ratio:+ratio.toFixed(2),required});
     }
     return {lang:document.documentElement.lang,mainCount:document.querySelectorAll('main').length,h1Count:document.querySelectorAll('h1').length,unnamed,contrastIssues};
    });
    const ax=await cdp.send('Accessibility.getFullAXTree'),namedCharts=ax.nodes.filter(n=>!n.ignored&&n.name?.value&&['graphics-document','img','group'].includes(n.role?.value)).map(n=>n.name.value).filter(n=>/plot|observations|decisions|regression|projection|clusters/i.test(n));
    results.push({browser:name,route,viewport:1440,...findings,namedCharts:namedCharts.slice(0,8),errors:[...errors]});
    if(name==='Edge'&&['compare','lesson/linear-regression','library'].includes(route))await page.screenshot({path:path.join(root,'screens/release-'+route.replaceAll('/','-')+'.png'),fullPage:false});
   }
   for(const width of [320,390,610,768])for(const route of ['explore','compare','compare/clustering','lesson/linear-regression','library']){
    await page.setViewportSize({width,height:1000});await page.goto(origin+'#/'+route);await page.waitForFunction(()=>!!window.MLA_APP);await page.locator('h1').waitFor();results.push({browser:name,route,viewport:width,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),errors:[...errors]});
   }
   await page.goto(origin+'#/lesson/linear-regression');await page.waitForFunction(()=>!!window.MLA_APP);await page.locator('#fit-preview').click();await page.waitForFunction(()=>MLA_APP.experiment.status==='completed'&&!MLA_APP.state.linearMotion);results.push({browser:name,route:'lesson/linear-regression',action:'real fit',finiteSlope:await page.evaluate(()=>Number.isFinite(MLA_APP.experiment.result.model.slope)),errors:[...errors]});
  }finally{await browser.close();}
 }
 const issues=results.filter(r=>r.unnamed?.length||r.contrastIssues?.length||r.overflow||r.errors.length||r.mainCount!==undefined&&(r.mainCount!==1||r.h1Count!==1)||r.finiteSlope===false);
 const report={status:issues.length?'findings':'passed',method:'Local headless Edge and Chrome; 17 route templates plus four narrow widths; DOM accessible-name and rendered-color checks, Chromium accessibility tree inspection and a real fit. Color checks approximate composed solid backgrounds and require manual review of exceptions. Both browsers use Chromium; Firefox, Safari and human assistive-technology interpretation remain untested.',humanScreenReaderReviewCompleted:false,beginnerPilotCompleted:false,results,issueCases:issues.length};
 fs.writeFileSync(path.join(root,'release-accessibility-validation.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,cases:results.length,issueCases:issues.length,uniqueContrastPairs:[...new Set(issues.flatMap(r=>(r.contrastIssues||[]).map(i=>i.color+' on '+i.background+' '+i.ratio)))],unnamed:issues.flatMap(r=>r.unnamed||[])}));
})().catch(e=>{console.error(e);process.exitCode=1;});
