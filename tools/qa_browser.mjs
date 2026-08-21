import fs from 'node:fs/promises';
import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true,args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist']});
const page=await browser.newPage({viewport:{width:1100,height:900},deviceScaleFactor:1});
const errors=[];
page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:4173/?qa=1',{waitUntil:'networkidle'});
await page.waitForFunction(()=>window.__JIRAI_QA__?.ready===true,{timeout:15000});

const result={started:new Date().toISOString(),samples:{},errors,visual:{}};
result.initial=await page.evaluate(()=>window.__JIRAI_QA__.snapshot());
const ids=['neutral','happy','excited','teasing','pleading','relaxed','angry','sad','surprised','embarrassed','scared','smug','confused','love'];
for(const id of ids){
  await page.evaluate(id=>window.__JIRAI_QA__.setEmotion(id),id);
  await page.waitForTimeout(720);
  result.samples[id]=await page.evaluate(()=>window.__JIRAI_QA__.snapshot());
}

await page.evaluate(()=>{window.__JIRAI_QA__.setEmotion('neutral');window.__JIRAI_QA__.setLipTest(false);window.__JIRAI_QA__.setMouth(.95)});
await page.waitForTimeout(300);
result.mouth=await page.evaluate(()=>window.__JIRAI_QA__.snapshot());
await page.evaluate(()=>{window.__JIRAI_QA__.setMouth(0);window.__JIRAI_QA__.forceBlink()});
await page.waitForTimeout(105);
result.blink=await page.evaluate(()=>window.__JIRAI_QA__.snapshot());

async function canvasMetrics(){
  return await page.evaluate(()=>{
    const c=document.querySelector('#rigCanvas'),ctx=c.getContext('2d'),{width:w,height:h}=c;
    const d=ctx.getImageData(0,0,w,h).data;
    let minX=w,minY=h,maxX=-1,maxY=-1,count=0;
    const step=2,gw=Math.ceil(w/step),gh=Math.ceil(h/step),mask=new Uint8Array(gw*gh);
    for(let gy=0;gy<gh;gy++)for(let gx=0;gx<gw;gx++){
      const x=Math.min(w-1,gx*step),y=Math.min(h-1,gy*step),a=d[(y*w+x)*4+3];
      if(a>18){mask[gy*gw+gx]=1;count++;if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}
    }
    const seen=new Uint8Array(mask.length),comps=[];
    for(let i=0;i<mask.length;i++)if(mask[i]&&!seen[i]){
      const q=[i];seen[i]=1;let n=0,cminX=gw,cminY=gh,cmaxX=0,cmaxY=0;
      while(q.length){const z=q.pop(),yy=Math.floor(z/gw),xx=z-yy*gw;n++;cminX=Math.min(cminX,xx);cmaxX=Math.max(cmaxX,xx);cminY=Math.min(cminY,yy);cmaxY=Math.max(cmaxY,yy);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=xx+dx,ny=yy+dy;if(nx<0||ny<0||nx>=gw||ny>=gh)continue;const ni=ny*gw+nx;if(mask[ni]&&!seen[ni]){seen[ni]=1;q.push(ni);}}}
      if(n>10)comps.push({pixels:n,bbox:[cminX*step,cminY*step,(cmaxX-cminX+1)*step,(cmaxY-cminY+1)*step]});
    }
    comps.sort((a,b)=>b.pixels-a.pixels);
    return {w,h,alphaSamples:count,bbox:maxX>=0?[minX,minY,maxX-minX+1,maxY-minY+1]:null,components:comps.slice(0,8)};
  });
}

async function tinyPreview(name){
  await page.locator('#stageWrap').evaluate(el=>{el.style.width='200px';el.style.height='200px'});
  await page.waitForTimeout(100);
  const buf=await page.locator('#stageWrap').screenshot({type:'jpeg',quality:16,scale:'css'});
  const b64=buf.toString('base64');
  await fs.writeFile(`qa/jirai-v11/${name}_tiny.txt`,b64);
  return {jpegBytes:buf.length,base64Chars:b64.length};
}

await fs.mkdir('qa/jirai-v11',{recursive:true});
await page.evaluate(()=>window.__JIRAI_QA__.setEmotion('neutral'));
await page.waitForTimeout(600);
result.visual.neutral=await canvasMetrics();
result.visual.neutralPreview=await tinyPreview('neutral');
await page.evaluate(()=>window.__JIRAI_QA__.setEmotion('excited'));
await page.waitForTimeout(720);
result.visual.excited=await canvasMetrics();
result.visual.excitedPreview=await tinyPreview('excited');

const sig=s=>`${s.parts?.eye}|${s.parts?.mouth}|${s.parts?.arm}`;
const unique=new Set(Object.values(result.samples).map(sig));
const finite=[result.initial,...Object.values(result.samples),result.mouth,result.blink].every(s=>Object.values(s.params||{}).filter(v=>typeof v==='number').every(Number.isFinite));
const nb=result.visual.neutral.bbox||[0,0,0,0],nc=result.visual.neutral.components||[];
const characterHeight=nb[3]/Math.max(1,result.visual.neutral.h),characterWidth=nb[2]/Math.max(1,result.visual.neutral.w);
const dominantRatio=nc.length?nc[0].pixels/Math.max(1,nc.reduce((a,c)=>a+c.pixels,0)):0;
result.checks={
  ready:result.initial.ready===true,
  asset:result.initial.assetLoaded===true,
  renderer:/Layered atlas rig/.test(result.initial.renderer),
  buttons:result.initial.buttonCount===16,
  semanticPartDiversity:unique.size>=8,
  excitedUsesBentArms:result.samples.excited.armPose==='bent',
  neutralUsesStraightArms:result.samples.neutral.armPose==='straight',
  emotionEyesDiffer:result.samples.pleading.eyeSprite!==result.samples.neutral.eyeSprite&&result.samples.surprised.eyeSprite!==result.samples.neutral.eyeSprite,
  emotionMouthsDiffer:result.samples.happy.mouthSprite!==result.samples.neutral.mouthSprite&&result.samples.sad.mouthSprite!==result.samples.happy.mouthSprite,
  lipUsesAtlasPart:/lip/.test(result.mouth.mouthSprite||''),
  blinkUsesClosedPart:result.blink.eyeSprite==='closed',
  characterVerticalCoverage:characterHeight>.60,
  characterWidthReasonable:characterWidth>.28&&characterWidth<.82,
  noLargeDetachedArtifact:dominantRatio>.82,
  tinyPreviewSingleChunk:result.visual.neutralPreview.base64Chars<3800&&result.visual.excitedPreview.base64Chars<3800,
  finiteParameters:finite,
  fps:Math.max(...Object.values(result.samples).map(s=>s.fps||0))>=25,
  consoleErrors:errors.length===0
};
result.geometry={characterHeight,characterWidth,dominantRatio};
result.uniquePartSignatures=[...unique];
result.pass=Object.values(result.checks).every(Boolean);
await fs.writeFile('qa/jirai-v11/report.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
await browser.close();
if(!result.pass)process.exit(1);
