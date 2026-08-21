import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const url = 'https://raw.githack.com/13eta0mega/Pocket-Jirai-pet/Jirai_Ver1.1/index.html?hostqa=' + Date.now();
const browser = await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const page = await browser.newPage({viewport:{width:1100,height:900}});
const consoleErrors=[];
const failed=[];
page.on('console',m=>{ if(m.type()==='error') consoleErrors.push(m.text()); });
page.on('pageerror',e=>consoleErrors.push(e.message));
page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure()?.errorText||'failed'}));
let status=null, gotoError=null;
try {
  const res=await page.goto(url,{waitUntil:'networkidle',timeout:30000});
  status=res?.status()??null;
} catch(e) { gotoError=String(e); }
await page.waitForTimeout(3000);
const state=await page.evaluate(()=>({
  href:location.href,
  title:document.title,
  bodyText:(document.body?.innerText||'').slice(0,2500),
  ready:window.__JIRAI_QA__?.ready??false,
  snapshot:window.__JIRAI_QA__?.snapshot?.()??null,
  bodyChildren:document.body?.children.length??0,
  canvas:document.querySelector('#rigCanvas')?{w:document.querySelector('#rigCanvas').width,h:document.querySelector('#rigCanvas').height}:null
})).catch(e=>({evalError:String(e)}));
const report={url,status,gotoError,consoleErrors,failed,state};
await fs.mkdir('qa/hosted',{recursive:true});
await fs.writeFile('qa/hosted/report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
await browser.close();
