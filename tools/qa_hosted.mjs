import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const stamp=Date.now();
const targets = [
  ['rawGithack','https://raw.githack.com/13eta0mega/Pocket-Jirai-pet/Jirai_Ver1.1/index.html?hostqa='+stamp],
  ['githubPagesRoot','https://13eta0mega.github.io/Pocket-Jirai-pet/?hostqa='+stamp],
  ['githubPagesV11','https://13eta0mega.github.io/Pocket-Jirai-pet/Jirai_Ver1.1/?hostqa='+stamp]
];
const browser = await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const reports={};
for (const [name,url] of targets) {
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
  await page.waitForTimeout(2500);
  const state=await page.evaluate(()=>({
    href:location.href,
    title:document.title,
    bodyText:(document.body?.innerText||'').slice(0,1800),
    ready:window.__JIRAI_QA__?.ready??false,
    snapshot:window.__JIRAI_QA__?.snapshot?.()??null,
    bodyChildren:document.body?.children.length??0,
    canvas:document.querySelector('#rigCanvas')?{w:document.querySelector('#rigCanvas').width,h:document.querySelector('#rigCanvas').height}:null
  })).catch(e=>({evalError:String(e)}));
  reports[name]={url,status,gotoError,consoleErrors,failed,state};
  await page.close();
}
await fs.mkdir('qa/hosted',{recursive:true});
await fs.writeFile('qa/hosted/report.json',JSON.stringify(reports,null,2));
console.log(JSON.stringify(reports,null,2));
await browser.close();

// Hosted QA refresh: semantic atlas parts v1.2.1 published
