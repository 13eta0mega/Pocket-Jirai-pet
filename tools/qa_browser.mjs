import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const browser = await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const page = await browser.newPage({viewport:{width:1100,height:900},deviceScaleFactor:1});
const consoleErrors=[];
page.on('console',m=>{ if(m.type()==='error') consoleErrors.push(m.text()); });
page.on('pageerror',e=>consoleErrors.push(e.message));
await page.goto('http://127.0.0.1:4173/?qa=1',{waitUntil:'networkidle'});
await page.waitForFunction(()=>window.__JIRAI_QA__?.ready===true,{timeout:15000});
const results={started:new Date().toISOString(),samples:{},errors:consoleErrors};
results.initial=await page.evaluate(()=>window.__JIRAI_QA__.snapshot());
for(const id of ['happy','excited','angry','pleading','surprised','love']){
  await page.evaluate(id=>window.__JIRAI_QA__.setEmotion(id),id);
  await page.waitForTimeout(850);
  results.samples[id]=await page.evaluate(()=>window.__JIRAI_QA__.snapshot());
}
await page.evaluate(()=>{window.__JIRAI_QA__.setLipTest(false);window.__JIRAI_QA__.setMouth(.92)});
await page.waitForTimeout(350);
results.mouth=await page.evaluate(()=>window.__JIRAI_QA__.snapshot());
await page.evaluate(()=>window.__JIRAI_QA__.forceBlink());
await page.waitForTimeout(95);
results.blink=await page.evaluate(()=>window.__JIRAI_QA__.snapshot());
const shot=await page.locator('#stageWrap').screenshot({type:'jpeg',quality:42});
const b64=shot.toString('base64');
await fs.mkdir('qa/jirai-v11',{recursive:true});
for(let i=0,n=0;i<b64.length;i+=3800,n++) await fs.writeFile(`qa/jirai-v11/preview_${String(n).padStart(2,'0')}.txt`,b64.slice(i,i+3800));
const diffs=Object.fromEntries(Object.entries(results.samples).map(([id,s])=>[id,
  Math.abs((s.params?.headAngle||0)-(results.initial.params?.headAngle||0))+
  Math.abs((s.params?.armL||0)-(results.initial.params?.armL||0))+
  Math.abs((s.params?.mouthForm||0)-(results.initial.params?.mouthForm||0))
]));
const allSnapshots=[results.initial,...Object.values(results.samples),results.mouth,results.blink];
const allFinite=allSnapshots.every(s=>Object.values(s.params||{}).filter(v=>typeof v==='number').every(v=>Number.isFinite(v)&&Math.abs(v)<100));
const meshSamples=[results.initial,...Object.values(results.samples),results.mouth];
const meshHealthy=meshSamples.every(s=>(s.mesh?.inverted??999)===0&&(s.mesh?.degenerate??999)<4&&(s.mesh?.minArea??0)>.02);
const checks={
  ready:results.initial.ready===true,
  asset:results.initial.assetLoaded===true,
  renderer:/WebGL2|Canvas2D/.test(results.initial.renderer),
  buttons:results.initial.buttonCount===16,
  emotionTransitions:Object.values(diffs).every(v=>v>.08),
  mouth:(results.mouth.params?.mouthOpen||0)>.55,
  blink:Math.min(results.blink.params?.eyeL??1,results.blink.params?.eyeR??1)<.65,
  finiteParameters:allFinite,
  meshNoFoldover:meshHealthy,
  atlasMouth:results.mouth.mouthSprite!=='base',
  steadyFps:Math.max(...Object.values(results.samples).map(s=>s.fps||0))>=25,
  consoleErrors:consoleErrors.length===0
};
results.differences=diffs; results.checks=checks; results.pass=Object.values(checks).every(Boolean);
await fs.writeFile('qa/jirai-v11/report.json',JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
await browser.close();
if(!results.pass)process.exit(1);
