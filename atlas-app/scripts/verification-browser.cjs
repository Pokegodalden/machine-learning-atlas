// Keep each suite's contexts isolated while sharing a single browser process.
// Repeated Windows Chromium startup was contributing failed sandbox-account logons.
exports.openVerificationBrowser=async function(chromium,options){
 const endpoint=process.env.MLA_BROWSER_WS_ENDPOINT;
 if(!endpoint)return chromium.launch(options);
 const url=new URL(endpoint);
 if(url.protocol!=='ws:'||url.hostname!=='127.0.0.1')throw Error('Verification browser must use a local loopback endpoint.');
 return chromium.connect(endpoint);
};

// Legacy feature suites exercise the full teaching workspace. Explicitly reveal
// the new disclosures before those interactions; verify-chart-first checks the
// clean default layout separately, with no disclosure setup.
exports.expandChartDetails=async function(page){
 await page.waitForFunction(()=>!!window.MLA_APP);
 await page.evaluate(()=>{
  for(const id of ['studio-data','studio-view','studio-inspector','studio-reflect','lesson-details','lesson-guide','parameter-actions','comparison-details','compare-left-card-details','compare-right-card-details','cluster-left-card-details','cluster-right-card-details']){
   const box=document.getElementById(id);if(box)box.open=true;
  }
  // Legacy full-workspace suites inspect both panels; verify-v22 covers the
  // default narrow-screen A/B switch and its retained linked observation.
  document.querySelector('[data-compare-view="both"]')?.click();
 });
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
};

// saveAs also works over a Playwright connection; Download.path does not.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
let downloadDirectory=null;const downloadedFiles=new Set();
exports.verificationDownloadPath=async function(download){
 if(!downloadDirectory)downloadDirectory=fs.mkdtempSync(path.join(os.tmpdir(),'mla-verification-downloads-'));
 const file=path.join(downloadDirectory,crypto.randomUUID());downloadedFiles.add(file);
 await download.saveAs(file);return file;
};
process.once('exit',()=>{
 for(const file of downloadedFiles)try{fs.unlinkSync(file);}catch{}
 if(downloadDirectory)try{fs.rmdirSync(downloadDirectory);}catch{}
});
