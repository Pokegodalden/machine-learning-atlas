const {openVerificationBrowser}=require('./verification-browser.cjs');
const {chromium}=require(process.env.MLA_PLAYWRIGHT_MODULE||'playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const root=path.resolve(__dirname,'..'),browser=await openVerificationBrowser(chromium,{executablePath:process.env.MLA_BROWSER_EXECUTABLE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),checks=[],errors=[];
 const check=(name,value)=>{assert(value,name);checks.push(name);};page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(30000);
 const visit=async route=>{await page.goto('http://127.0.0.1:8773/?v=0.21.0#/'+route);await page.waitForFunction(()=>!!window.MLA_APP);};
 try{
 for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:1000});
  for(const id of ['linear-regression','knn','logistic-regression','decision-tree','random-forest','svm','kmeans','pca','mlp','q-learning']){
   await visit('lesson/'+id);
   check(`${id} ${width}: diagnostics closed initially`,await page.locator('#lesson-details').evaluate(n=>!n.open));
   check(`${id} ${width}: compact tools closed initially`,await page.locator('.workspace-tools>details').evaluateAll(ns=>ns.every(n=>!n.open)));
   check(`${id} ${width}: three actual key metrics`,await page.locator('#headline-metrics .headline-item').count()===3&&await page.locator('#headline-metrics').evaluate(n=>[...n.querySelectorAll('.headline-value')].every(v=>[...document.querySelectorAll('#lesson-metrics .metric-value')].some(m=>m.textContent===v.textContent))));
   check(`${id} ${width}: main chart starts in first viewport`,await page.locator('#lesson-plot').evaluate((n,width)=>n.getBoundingClientRect().top<650&&n.getBoundingClientRect().width>width*.6,width));
   check(`${id} ${width}: no horizontal overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  }
 }
 await page.setViewportSize({width:1440,height:1000});await visit('lesson/linear-regression');
 await page.screenshot({path:path.join(root,'screens/chart-first-lesson-desktop.png'),fullPage:true});
 await page.locator('[data-param-number="slope"]').fill('1.5');
 check('Manual controls update visible metrics while diagnostics stay closed',await page.locator('#headline-metrics .headline-value').first().innerText()!=='—'&&await page.locator('#lesson-details').evaluate(n=>!n.open));
 await page.locator('#parameter-actions>summary').focus();await page.keyboard.press('Enter');check('More actions works with keyboard',await page.locator('#reset-parameters').isVisible());
 await page.locator('#reset-parameters').click();check('More actions stays open after Reset',await page.locator('#parameter-actions').evaluate(n=>n.open));
 await page.locator('#fit-preview').click();await page.waitForFunction(()=>MLA_APP.state.fitted&&!MLA_APP.state.linearMotion);
 check('Fit keeps diagnostics closed',await page.locator('#lesson-details').evaluate(n=>!n.open));
 check('Compact metrics reflect the fitted chart',await page.locator('#headline-metrics').evaluate(n=>[...n.querySelectorAll('.headline-value')].every(v=>[...document.querySelectorAll('#lesson-metrics .metric-value')].some(m=>m.textContent===v.textContent))));
 await page.locator('#lesson-details>summary').click();await page.locator('#studio-inspector>summary').click();check('Point inspection and residual chart remain available',await page.locator('#selected-observation').isVisible()&&await page.locator('#residual-plot svg').count()===1);
 await page.locator('#lesson-details>summary').click();await page.locator('#lesson-plot [data-point-index]').last().click();check('Selecting a chart point reveals its contextual inspector',await page.locator('#studio-inspector').evaluate(n=>n.open));
 await page.locator('#experiment-tools>summary').click();await page.locator('#experiment-name').fill('Chart-first experiment');await page.locator('#save-experiment').click();check('Compact save tool keeps experiment functionality',await page.locator('#experiment-message').innerText().then(t=>t.includes('Saved')));
 await page.evaluate(()=>{for(const box of document.querySelectorAll('.workspace-tools>details,#lesson-details,#parameter-actions'))box.open=false;document.activeElement?.blur();scrollTo({top:0,behavior:'instant'});});await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:path.join(root,'screens/chart-first-lesson-desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:1000});await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:path.join(root,'screens/chart-first-lesson-mobile.png'),fullPage:true});
 for(const route of ['compare','compare/clustering'])for(const width of [1440,390,320]){
  await page.setViewportSize({width,height:1000});await visit(route);const prefix=route.includes('clustering')?'cluster':'compare';
  check(`${route} ${width}: detailed results collapsed`,await page.locator('#comparison-details').evaluate(n=>!n.open));
  check(`${route} ${width}: both cards retain sliders and headline metrics`,await page.locator('.compare-headline .headline-value').count()===4&&await page.locator('.compare-controls input[type=range]').count()>=2);
  check(`${route} ${width}: no horizontal overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  if(width===1440){await page.locator('#'+prefix+'-run-both').click();await page.waitForFunction(prefix=>!!MLA_APP[prefix==='cluster'?'clusteringComparison':'comparison'].coordinator.pair(),prefix);await page.waitForTimeout(50);check(route+': summary values come from current full results',await page.locator('.compare-headline .headline-value').evaluateAll(ns=>ns.every(n=>n.textContent!=='—'&&[...document.querySelectorAll('[data-compare-metric],[data-cluster-metric]')].some(cell=>cell.textContent===n.textContent))));await page.screenshot({path:path.join(root,'screens/chart-first-'+prefix+'-desktop.png'),fullPage:true});}
 }
 await visit('lesson/knn');await page.locator('#guided-activity>summary').click();await page.locator('#guided-activity>summary').click();await page.locator('a[href="#/activities"]').first().evaluate(n=>n.click());await page.locator('[data-open-activity="knn-neighbors"]').click();
 await page.locator('#guided-prediction').waitFor();check('Activity hub explicitly reopens a previously closed tool',await page.locator('#guided-prediction').isVisible());
 check('No browser errors',errors.length===0);
 }catch(e){errors.push(e.stack||e.message);console.log(await page.evaluate(()=>({width:innerWidth,plot:document.querySelector('#lesson-plot')?.getBoundingClientRect().toJSON(),heading:document.querySelector('h1')?.textContent,overflow:document.documentElement.scrollWidth})));await page.screenshot({path:path.join(root,'screens/chart-first-failure.png'),fullPage:true});}finally{await browser.close();fs.writeFileSync(path.join(root,'chart-first-browser-validation.json'),JSON.stringify({status:errors.length?'failed':'passed',checks,errors},null,2)+'\n');console.log(JSON.stringify({checks:checks.length,errors}));if(errors.length)process.exitCode=1;}
})().catch(e=>{console.error(e);process.exitCode=1;});
