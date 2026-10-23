const {chromium}=require(process.env.MLA_PLAYWRIGHT_MODULE||'playwright');
const {spawn}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const available=fs.readdirSync(__dirname).filter(n=>/^verify-.+\.cjs$/.test(n)&&n!=='verify-all.cjs').sort(),selected=process.argv.slice(2),suites=selected.length?selected:available;
 if(suites.some(n=>!available.includes(n))||new Set(suites).size!==suites.length)throw Error('Select distinct verification suite filenames from scripts/.');
 const server=await chromium.launchServer({executablePath:process.env.MLA_BROWSER_EXECUTABLE||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,host:'127.0.0.1'}),results=[];
 let cursor=0;
 const run=suite=>new Promise(resolve=>{
  const child=spawn(process.execPath,[path.join(__dirname,suite)],{env:{...process.env,MLA_BROWSER_WS_ENDPOINT:server.wsEndpoint()},windowsHide:true,stdio:['ignore','pipe','pipe']});let output='';
  child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);
  child.on('error',error=>{output+=error.message;});
  child.on('close',code=>{const result={suite,exitCode:code,output:output.slice(-1800)};results.push(result);console.log(JSON.stringify(result));resolve();});
 });
 try{
  await Promise.all(Array.from({length:Math.min(3,suites.length)},async()=>{while(cursor<suites.length)await run(suites[cursor++]);}));
 }finally{await server.close();}
 const report={status:results.length===suites.length&&results.every(r=>r.exitCode===0)?'passed':'failed',browserProcessesLaunched:1,contextIsolation:'Each suite owns independent contexts over its own Playwright connection.',suites:results};
 fs.writeFileSync(path.join(__dirname,'../browser-batch-validation.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify({status:report.status,suites:results.length,browserProcessesLaunched:1}));
 if(report.status!=='passed')process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
