(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
  const smoother = t => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };

  class Spring {
    constructor(value = 0, frequency = 7, damping = .9) {
      this.value = value; this.target = value; this.velocity = 0;
      this.frequency = frequency; this.damping = damping;
    }
    snap(v){ this.value = this.target = v; this.velocity = 0; }
    set(v){ this.target = v; }
    step(dt){
      dt = Math.min(.04, Math.max(0, dt || 0));
      const w = TAU * this.frequency, k = w*w, c = 2*this.damping*w;
      const denom = 1 + dt*c + dt*dt*k;
      this.velocity = (this.velocity + dt*k*(this.target-this.value)) / denom;
      this.value += dt*this.velocity;
      if(!Number.isFinite(this.value) || !Number.isFinite(this.velocity)) this.snap(this.target);
      return this.value;
    }
  }

  const PARAM_DEFAULTS = {
    headAngle:0, headTurn:0, bodyLean:0, bodySquash:0,
    armL:0, armR:0, legL:0, legR:0,
    eyeL:1, eyeR:1, browMood:0,
    mouthOpen:0, energy:.12, blush:0, tears:0, sick:0,
    fear:0, love:0, anger:0, sparkle:0
  };

  const EMOTIONS = {
    neutral:     {label:'기본', parts:{eye:'base', mouth:'neutral', arm:'straight'}, pose:{}, gesture:'settle'},
    happy:       {label:'행복', parts:{eye:'happyClosed', mouth:'happy', arm:'straight'}, pose:{headAngle:-1.8,armL:-.16,armR:.16,browMood:-.05,blush:.18,energy:.42,sparkle:.14}, gesture:'happy'},
    excited:     {label:'신남', parts:{eye:'sparkle', mouth:'happyOpen', arm:'bent'}, pose:{headAngle:1.4,armL:-.72,armR:.72,legL:.10,legR:-.18,energy:1,sparkle:.75}, gesture:'bounce'},
    teasing:     {label:'장난', parts:{eye:'wink', mouth:'happyOpen', arm:'bent'}, pose:{headAngle:-5.5,headTurn:.14,armL:-.14,armR:.52,bodyLean:-1.5,blush:.08,energy:.6}, gesture:'tease'},
    pleading:    {label:'울망', parts:{eye:'sparkle', mouth:'frown', arm:'bent'}, pose:{headAngle:3.8,browMood:-1,armL:-.20,armR:.20,bodySquash:.025,tears:.88,energy:.08}, gesture:'plead'},
    relaxed:     {label:'느긋', parts:{eye:'half', mouth:'soft', arm:'straight'}, pose:{headAngle:-2.5,headTurn:-.08,bodyLean:1.1,armL:.08,armR:-.08,energy:.04}, gesture:'slow'},
    sick:        {label:'아픔', parts:{eye:'half', mouth:'frown', arm:'straight'}, pose:{headAngle:5.0,browMood:-.6,bodyLean:2.0,bodySquash:.04,sick:.85,energy:.02}, gesture:'sick'},
    angry:       {label:'화남', parts:{eye:'angry', mouth:'flat', arm:'bent'}, pose:{headAngle:-1.2,browMood:1,bodyLean:-2.2,armL:-.30,armR:.30,anger:1,energy:.8}, gesture:'angry'},
    annoyed:     {label:'삐짐', parts:{eye:'half', mouth:'flat', arm:'straight'}, pose:{headAngle:-6.0,headTurn:-.15,browMood:.45,bodyLean:1.8,armL:.12,armR:-.12,energy:.12}, gesture:'huff'},
    sad:         {label:'슬픔', parts:{eye:'sparkle', mouth:'frown', arm:'straight'}, pose:{headAngle:5.6,browMood:-1,bodyLean:1.6,armL:.10,armR:-.10,tears:.48,energy:.03}, gesture:'sad'},
    surprised:   {label:'놀람', parts:{eye:'wide', mouth:'o', arm:'bent'}, pose:{headAngle:0,browMood:-.15,armL:-.42,armR:.42,bodySquash:-.025,energy:.85,sparkle:.16}, gesture:'startle'},
    embarrassed: {label:'부끄러움', parts:{eye:'softClosed', mouth:'soft', arm:'bent'}, pose:{headAngle:4.0,headTurn:.12,bodyLean:1.3,armL:-.08,armR:.08,blush:.95,energy:.16}, gesture:'shy'},
    scared:      {label:'겁남', parts:{eye:'wide', mouth:'o', arm:'bent'}, pose:{headAngle:2.4,browMood:-.55,armL:-.50,armR:.50,bodySquash:.03,fear:1,energy:.75}, gesture:'shiver'},
    smug:        {label:'의기양양', parts:{eye:'half', mouth:'happy', arm:'straight'}, pose:{headAngle:-5.0,headTurn:.14,browMood:.25,bodyLean:-1.5,armL:.12,armR:-.12,energy:.22}, gesture:'smug'},
    confused:    {label:'갸웃', parts:{eye:'confused', mouth:'neutral', arm:'bent'}, pose:{headAngle:8.0,headTurn:-.1,browMood:-.28,armL:-.05,armR:.35,energy:.2}, gesture:'tilt'},
    love:        {label:'좋아!', parts:{eye:'sparkle', mouth:'happyOpen', arm:'bent'}, pose:{headAngle:-2.0,headTurn:.04,armL:-.58,armR:.58,bodySquash:-.012,blush:.58,love:1,sparkle:.65,energy:.76}, gesture:'love'}
  };

  class MotionController {
    constructor(config){
      this.config = config; this.springs = {};
      for(const [k,v] of Object.entries(PARAM_DEFAULTS)){
        const fast = k.startsWith('eye') || k === 'mouthOpen';
        const slow = k.startsWith('arm') || k.startsWith('leg') || k === 'bodyLean';
        this.springs[k] = new Spring(v, fast?11:slow?4.5:6.2, fast?.96:.86);
      }
      this.emotion='neutral'; this.previousEmotion='neutral';
      this.changedAt=performance.now(); this.gestureStarted=this.changedAt;
      this.manualMouth=0; this.testLipSync=false; this.micActive=false; this.micLevel=0;
      this.blinkL=1; this.blinkR=1; this.blinkStart=-1; this.doubleBlinkPending=false;
      this.nextBlink=performance.now()+2600; this.nextIdleTurn=performance.now()+4700; this.idleReturnAt=0;
      this.idleTurn=new Spring(0,1.55,.94); this.idleTilt=new Spring(0,1.4,.94);
      this.seed=0x51a17; this.applyEmotion('neutral',true);
    }
    rand(){ this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0; return this.seed/4294967296; }
    applyEmotion(id,snap=false){
      if(!EMOTIONS[id]) id='neutral';
      this.previousEmotion=this.emotion; this.emotion=id; this.changedAt=performance.now(); this.gestureStarted=this.changedAt;
      const pose={...PARAM_DEFAULTS,...EMOTIONS[id].pose};
      for(const [k,s] of Object.entries(this.springs)) snap?s.snap(pose[k]??0):s.set(pose[k]??0);
    }
    setManualMouth(v){ this.manualMouth=clamp(Number(v)||0); }
    setLipTest(v){ this.testLipSync=!!v; }
    setMicLevel(v){ this.micLevel=clamp(v); }
    setMicActive(v){ this.micActive=!!v; }
    forceBlink(){ this.blinkStart=performance.now(); this.doubleBlinkPending=false; }
    scheduleBlink(now){ const i=this.config.idle; this.nextBlink=now+lerp(i.blinkMinMs,i.blinkMaxMs,this.rand()); }
    updateBlink(now,qa=false){
      if(qa && this.blinkStart<0){this.blinkL=this.blinkR=1;return;}
      if(this.blinkStart<0 && now>=this.nextBlink){ this.blinkStart=now; this.doubleBlinkPending=this.rand()<this.config.idle.doubleBlinkChance; }
      if(this.blinkStart<0){ this.blinkL=this.blinkR=1; return; }
      const d=this.config.idle.blinkDurationMs, q=(now-this.blinkStart)/d;
      let v=1;
      if(q<.33)v=1-smoother(q/.33); else if(q<.52)v=.015; else if(q<1)v=smoother((q-.52)/.48);
      else if(this.doubleBlinkPending){ this.doubleBlinkPending=false; this.blinkStart=now+85; v=1; }
      else { this.blinkStart=-1; this.scheduleBlink(now); v=1; }
      this.blinkL=this.blinkR=v;
    }
    updateIdle(now,dt,qa){
      if(qa){this.idleTurn.set(0);this.idleTilt.set(0);} else {
        if(now>=this.nextIdleTurn){
          this.idleTurn.set(lerp(-.14,.14,this.rand())); this.idleTilt.set(lerp(-2.1,2.1,this.rand()));
          this.idleReturnAt=now+lerp(1100,2500,this.rand());
          this.nextIdleTurn=now+lerp(this.config.idle.headTurnMinMs,this.config.idle.headTurnMaxMs,this.rand());
        }
        if(this.idleReturnAt && now>=this.idleReturnAt){this.idleTurn.set(0);this.idleTilt.set(0);this.idleReturnAt=0;}
      }
      this.idleTurn.step(dt); this.idleTilt.step(dt);
    }
    lipTarget(t){
      if(this.micActive)return this.micLevel;
      if(this.testLipSync){
        const phase=t%4.2; if(phase>3.05)return 0;
        const syll=Math.abs(Math.sin(t*8.9)*.64+Math.sin(t*13.7+.5)*.28+Math.sin(t*4.1)*.18);
        return clamp(.04+syll*smooth(Math.min(1,phase*5))*smooth(Math.min(1,(3.05-phase)*4)));
      }
      return this.manualMouth;
    }
    gesture(now){
      const kind=EMOTIONS[this.emotion].gesture,t=(now-this.gestureStarted)/1000;
      const pulse=d=>Math.sin(Math.PI*clamp(t/d));
      switch(kind){
        case'happy':return{bob:Math.sin(t*8)*2.1*Math.exp(-t*1.4),sway:Math.sin(t*3.3)*.8*Math.exp(-t)};
        case'bounce':return{bob:-Math.abs(Math.sin(t*8.3))*11*Math.exp(-t*.5),squash:Math.sin(t*8.3)*.03*Math.exp(-t*.55),leg:Math.sin(t*8.3)*.10};
        case'tease':return{sway:pulse(.7)*-3.2,armR:pulse(.75)*.18};
        case'plead':return{bob:Math.sin(t*4)*1.2*Math.exp(-t*.4),arms:pulse(.8)*.12};
        case'sick':return{sway:Math.sin(t*2.1)*1.0,bob:1.6};
        case'angry':return{shake:Math.sin(t*34)*2.0*Math.exp(-t*1.5),sway:Math.sin(t*19)*.6*Math.exp(-t*1.7)};
        case'huff':return{sway:-2.0+Math.sin(t*1.8)*.5,bob:Math.max(0,Math.sin(t*5))*1.0};
        case'sad':return{bob:2+Math.sin(t*1.4)*.6};
        case'startle':return{bob:-pulse(.38)*16,squash:-pulse(.38)*.045,arms:pulse(.45)*.25};
        case'shy':return{sway:Math.sin(t*2.2)*1.2,bob:Math.sin(t*2.7)*.8};
        case'shiver':return{shake:Math.sin(t*31)*1.5,squash:Math.sin(t*16)*.012};
        case'smug':return{sway:-.7+Math.sin(t*1.2)*.3};
        case'tilt':return{sway:Math.sin(t*1.4)*.4};
        case'love':return{bob:-Math.abs(Math.sin(t*4))*4.2*Math.exp(-t*.25),arms:Math.sin(t*4)*.09,sway:Math.sin(t*2.2)*.6};
        default:return{};
      }
    }
    update(now,dt,qa=false){
      this.updateBlink(now,qa); this.updateIdle(now,dt,qa);
      const sec=now/1000, g=this.gesture(now), out={};
      for(const [k,s] of Object.entries(this.springs))out[k]=s.step(dt);
      const lip=this.lipTarget(sec); this.springs.mouthOpen.set(Math.max(EMOTIONS[this.emotion].pose.mouthOpen||0,lip)); out.mouthOpen=this.springs.mouthOpen.step(dt);
      out.eyeL*=this.blinkL; out.eyeR*=this.blinkR;
      out.breath=Math.sin(sec*TAU*this.config.idle.breathHz);
      out.globalBob=(g.bob||0)+Math.sin(sec*1.55)*.5*(.25+out.energy);
      out.globalX=(g.shake||0); out.bodyLean+=(g.sway||0); out.bodySquash+=(g.squash||0);
      out.armL+=(g.arms||0)+(g.armL||0); out.armR+=(g.arms||0)+(g.armR||0);
      out.legL+=(g.leg||0); out.legR-=(g.leg||0);
      out.headTurn+=this.idleTurn.value; out.headAngle+=this.idleTilt.value;
      out.previousEmotion=this.previousEmotion; out.emotion=this.emotion;
      out.transition=smooth((now-this.changedAt)/this.config.motion.transitionMs);
      return out;
    }
  }

  class LayeredRenderer {
    constructor(canvas,fxCanvas,config){
      this.canvas=canvas; this.fxCanvas=fxCanvas; this.config=config;
      this.ctx=canvas.getContext('2d',{alpha:true}); this.fx=fxCanvas.getContext('2d',{alpha:true});
      this.image=null; this.baseCanvas=null; this.headCanvas=null; this.bodyCanvas=null;
      this.baseFeatures={}; this.meshVisible=false; this.label='Layered atlas rig';
      this.lastLayout=null; this.lastMouthSprite='neutral'; this.lastEyeSprite='base'; this.lastArmPose='straight'; this.lastLegPose='normal';
      this.partSnapshot={};
    }
    async load(url){ const img=new Image(); img.decoding='async'; img.src=url; await img.decode(); this.image=img; this.buildLayers(); return img; }
    makeCanvas(w=320,h=474){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
    buildLayers(){
      const [sx,sy,sw,sh]=this.config.atlas.characterCrop;
      const base=this.makeCanvas(sw,sh),b=base.getContext('2d'); b.drawImage(this.image,sx,sy,sw,sh,0,0,sw,sh); this.baseCanvas=base;
      const f=this.config.face;
      this.baseFeatures.eyeL=this.cropCanvas(base,f.baseEyeL); this.baseFeatures.eyeR=this.cropCanvas(base,f.baseEyeR);
      this.baseFeatures.browL=this.cropCanvas(base,f.baseBrowL); this.baseFeatures.browR=this.cropCanvas(base,f.baseBrowR); this.baseFeatures.mouth=this.cropCanvas(base,f.baseMouth);
      this.headCanvas=this.makeCanvas(sw,sh); const hc=this.headCanvas.getContext('2d'); hc.drawImage(base,0,0); hc.save(); hc.globalCompositeOperation='destination-out'; hc.fillStyle='#000'; hc.fillRect(0,this.config.layers.headCutY,sw,sh-this.config.layers.headCutY); hc.restore(); this.inpaintHead(this.headCanvas);
      this.bodyCanvas=this.makeCanvas(sw,sh); const bc=this.bodyCanvas.getContext('2d'); bc.drawImage(base,0,0);
      const mask=this.makeCanvas(sw,sh),mc=mask.getContext('2d'); mc.fillStyle='#fff'; mc.beginPath(); const pts=this.config.layers.bodyPolygon; pts.forEach(([x,y],i)=>i?mc.lineTo(x,y):mc.moveTo(x,y)); mc.closePath(); mc.fill(); bc.globalCompositeOperation='destination-in'; bc.drawImage(mask,0,0); bc.globalCompositeOperation='source-over';
    }
    cropCanvas(src,[x,y,w,h]){const c=this.makeCanvas(w,h),ctx=c.getContext('2d');ctx.drawImage(src,x,y,w,h,0,0,w,h);return c;}
    inpaintHead(canvas){
      const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,img=ctx.getImageData(0,0,w,h),d=img.data;
      const mask=new Uint8Array(w*h); for(const [cx,cy,rx,ry] of this.config.face.cleanMasks){const x0=Math.max(0,Math.floor(cx-rx)),x1=Math.min(w-1,Math.ceil(cx+rx)),y0=Math.max(0,Math.floor(cy-ry)),y1=Math.min(h-1,Math.ceil(cy+ry));for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const dx=(x-cx)/rx,dy=(y-cy)/ry;if(dx*dx+dy*dy<=1&&d[(y*w+x)*4+3]>20)mask[y*w+x]=1;}}
      const known=new Uint8Array(w*h);for(let i=0;i<w*h;i++)known[i]=mask[i]?0:1;const nr=new Uint8ClampedArray(d),dirs=[-1,1,-w,w,-w-1,-w+1,w-1,w+1];
      for(let pass=0;pass<55;pass++){const fill=[];for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;if(!mask[i]||known[i])continue;let rr=0,gg=0,bb=0,aa=0,n=0;for(const off of dirs){const j=i+off;if(known[j]){const p=j*4;rr+=nr[p];gg+=nr[p+1];bb+=nr[p+2];aa+=nr[p+3];n++;}}if(n>=2)fill.push([i,rr/n,gg/n,bb/n,aa/n]);}if(!fill.length)break;for(const [i,r,g,b,a] of fill){const p=i*4;nr[p]=r;nr[p+1]=g;nr[p+2]=b;nr[p+3]=a;known[i]=1;}}
      for(let i=0;i<w*h;i++)if(mask[i]){const p=i*4;d[p]=nr[p];d[p+1]=nr[p+1];d[p+2]=nr[p+2];d[p+3]=nr[p+3];}ctx.putImageData(img,0,0);
    }
    resize(){const dpr=Math.min(2,window.devicePixelRatio||1),r=this.canvas.getBoundingClientRect(),w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;this.fxCanvas.width=w;this.fxCanvas.height=h;}return{w,h,dpr};}
    layout(w,h){const d=this.config.display,H=Math.min(h*d.heightRatio,d.maxHeight*(w/720)),S=H/474,W=320*S;return{x:w*d.centerXRatio-W/2,y:h*d.topRatio,w:W,h:H,s:S};}
    atlasPart(key){return this.config.atlas.parts[key];}
    drawAtlas(ctx,key,x,y,targetW,targetH,opts={}){const r=this.atlasPart(key);if(!r||!this.image)return;const[sx,sy,sw,sh]=r;let dw=targetW,dh=targetH;if(dw==null&&dh==null){dw=sw;dh=sh;}else if(dw==null)dw=dh*sw/sh;else if(dh==null)dh=dw*sh/sw;ctx.save();ctx.translate(x,y);ctx.rotate((opts.angle||0)*Math.PI/180);ctx.scale(opts.flipX?-1:1,opts.flipY?-1:1);ctx.globalAlpha=opts.alpha??1;const ax=opts.anchorX??.5,ay=opts.anchorY??.5;ctx.drawImage(this.image,sx,sy,sw,sh,-dw*ax,-dh*ay,dw,dh);ctx.restore();}
    drawCanvasSprite(ctx,sprite,x,y,w,h,opts={}){ctx.save();ctx.translate(x,y);ctx.rotate((opts.angle||0)*Math.PI/180);ctx.scale(opts.flipX?-1:1,1);ctx.globalAlpha=opts.alpha??1;const ax=opts.anchorX??.5,ay=opts.anchorY??.5;ctx.drawImage(sprite,-w*ax,-h*ay,w,h);ctx.restore();}
    eyeSpec(style,side){const E=this.config.expressions.eyes;if(style==='base')return{base:true};if(style==='wink')return side==='L'?{base:true}:E.closedR;if(style==='confused')return side==='L'?{base:true}:E.halfR;if(style==='happyClosed'||style==='softClosed')return side==='L'?E.closedL:E.closedR;if(style==='half')return side==='L'?E.halfL:E.halfR;if(style==='angry')return side==='L'?E.angryL:E.angryR;if(style==='sparkle')return side==='L'?E.sparkleL:E.sparkleR;if(style==='wide')return side==='L'?E.wideL:E.wideR;return{base:true};}
    drawEye(ctx,style,side,alpha,blink){const f=this.config.face,center=side==='L'?f.leftEye:f.rightEye,openSpec=this.eyeSpec(style,side),closedSpec=side==='L'?this.config.expressions.eyes.closedL:this.config.expressions.eyes.closedR;const drawSpec=(spec,a)=>{if(a<=.005)return;if(spec.base){const s=side==='L'?this.baseFeatures.eyeL:this.baseFeatures.eyeR,rect=side==='L'?f.baseEyeL:f.baseEyeR;this.drawCanvasSprite(ctx,s,center[0],center[1],rect[2],rect[3],{alpha:a});}else this.drawAtlas(ctx,spec.key,center[0]+(spec.dx||0),center[1]+(spec.dy||0),spec.w,spec.h,{alpha:a,flipX:!!spec.flipX});};const close=clamp(1-blink);drawSpec(openSpec,alpha*(1-close));drawSpec(closedSpec,alpha*close);this.lastEyeSprite=close>.55?'closed':style;}
    drawBrows(ctx,p,alpha=1){const f=this.config.face,m=p.browMood||0,l=f.baseBrowL,r=f.baseBrowR;this.drawCanvasSprite(ctx,this.baseFeatures.browL,f.browLeft[0],f.browLeft[1],l[2],l[3],{angle:-m*13,alpha});this.drawCanvasSprite(ctx,this.baseFeatures.browR,f.browRight[0],f.browRight[1],r[2],r[3],{angle:m*13,alpha});}
    mouthSpec(style){return this.config.expressions.mouths[style]||this.config.expressions.mouths.neutral;}
    drawMouth(ctx,style,alpha,p){const m=this.config.face.mouth;let use=style;if(p.mouthOpen>.12){if(p.mouthOpen>.72)use='lipLarge';else if(p.mouthOpen>.42)use='lipMedium';else use='lipSmall';}const spec=this.mouthSpec(use);if(spec.base){const r=this.config.face.baseMouth;this.drawCanvasSprite(ctx,this.baseFeatures.mouth,m[0],m[1],r[2],r[3],{alpha});}else this.drawAtlas(ctx,spec.key,m[0]+(spec.dx||0),m[1]+(spec.dy||0),spec.w,spec.h,{alpha});this.lastMouthSprite=use;}
    drawArmPair(ctx,pose,p,alpha=1){const A=this.config.rig.arms[pose]||this.config.rig.arms.straight,l=this.config.rig.shoulderL,r=this.config.rig.shoulderR,baseL=A.angleL+(p.armL||0)*55,baseR=A.angleR+(p.armR||0)*55;this.drawAtlas(ctx,A.left,l[0]+(A.dxL||0),l[1]+(A.dyL||0),A.widthL,A.heightL,{angle:baseL,anchorY:A.anchorY??.08,alpha,flipX:!!A.flipL});this.drawAtlas(ctx,A.right,r[0]+(A.dxR||0),r[1]+(A.dyR||0),A.widthR,A.heightR,{angle:baseR,anchorY:A.anchorY??.08,alpha,flipX:!!A.flipR});this.lastArmPose=pose;}
    drawLegs(ctx,p){const L=this.config.rig.legs,l=this.config.rig.hipL,r=this.config.rig.hipR;this.drawAtlas(ctx,L.left,l[0],l[1],L.widthL,L.heightL,{angle:(L.angleL||0)+(p.legL||0)*36,anchorY:L.anchorY??.05,flipX:!!L.flipL});this.drawAtlas(ctx,L.right,r[0],r[1],L.widthR,L.heightR,{angle:(L.angleR||0)+(p.legR||0)*36,anchorY:L.anchorY??.05,flipX:!!L.flipR});this.lastLegPose=Math.abs(p.legL)+Math.abs(p.legR)>.12?'moving':'normal';}
    partsFor(id){return(EMOTIONS[id]||EMOTIONS.neutral).parts;}
    render(p,emotionId){
      if(!this.image)return;const{w,h}=this.resize(),ctx=this.ctx;ctx.clearRect(0,0,w,h);this.fx.clearRect(0,0,w,h);const L=this.layout(w,h);this.lastLayout=L;
      ctx.save();ctx.translate(L.x+p.globalX,L.y+p.globalBob);ctx.scale(L.s,L.s);const bx=1+p.breath*.006+p.bodySquash*.018,by=1-p.breath*.003-p.bodySquash*.012;ctx.translate(160,286);ctx.rotate((p.bodyLean||0)*Math.PI/180);ctx.scale(bx,by);ctx.translate(-160,-286);
      this.drawLegs(ctx,p);const cur=this.partsFor(emotionId),prev=this.partsFor(p.previousEmotion||emotionId),t=p.transition??1;if(prev.arm!==cur.arm){this.drawArmPair(ctx,prev.arm,p,1-t);this.drawArmPair(ctx,cur.arm,p,t);}else this.drawArmPair(ctx,cur.arm,p,1);ctx.drawImage(this.bodyCanvas,0,0);
      ctx.save();const neck=this.config.rig.neck;ctx.translate(neck[0]+p.headTurn*10,neck[1]);ctx.rotate((p.headAngle||0)*Math.PI/180);ctx.scale(1-Math.abs(p.headTurn)*.055,1);ctx.translate(-neck[0],-neck[1]);ctx.drawImage(this.headCanvas,0,0);this.drawBrows(ctx,p,1);
      if(prev.eye!==cur.eye){this.drawEye(ctx,prev.eye,'L',1-t,p.eyeL);this.drawEye(ctx,prev.eye,'R',1-t,p.eyeR);this.drawEye(ctx,cur.eye,'L',t,p.eyeL);this.drawEye(ctx,cur.eye,'R',t,p.eyeR);}else{this.drawEye(ctx,cur.eye,'L',1,p.eyeL);this.drawEye(ctx,cur.eye,'R',1,p.eyeR);}if(prev.mouth!==cur.mouth&&p.mouthOpen<=.12){this.drawMouth(ctx,prev.mouth,1-t,p);this.drawMouth(ctx,cur.mouth,t,p);}else this.drawMouth(ctx,cur.mouth,1,p);this.drawFaceFX(ctx,p);ctx.restore();ctx.restore();this.drawStageFX(p,w,h);this.partSnapshot={eye:this.lastEyeSprite,mouth:this.lastMouthSprite,arm:this.lastArmPose,leg:this.lastLegPose,previous:p.previousEmotion,emotion:emotionId,transition:p.transition};
    }
    drawFaceFX(ctx,p){const f=this.config.face;if(p.blush>.03){ctx.save();ctx.globalAlpha=.16+.35*p.blush;ctx.fillStyle='#ff7fae';for(const[x,y]of[f.leftCheek,f.rightCheek]){ctx.beginPath();ctx.ellipse(x,y,18,9,0,0,TAU);ctx.fill();}ctx.restore();}if(p.tears>.04){ctx.save();ctx.fillStyle=`rgba(120,205,255,${.25+.55*p.tears})`;for(const[x,y]of[f.leftEye,f.rightEye]){ctx.beginPath();ctx.ellipse(x,y+31,4,10,.1,0,TAU);ctx.fill();}ctx.restore();}}
    drawStageFX(p,w,h){const c=this.fx,L=this.lastLayout;if(!L)return;const s=L.s,t=performance.now()/1000;if(p.sparkle>.08){c.save();c.globalAlpha=.3+.5*p.sparkle;c.fillStyle='#ffd7e8';c.font=`${18*s}px system-ui`;for(let i=0;i<4;i++){const a=t*.8+i*1.6;c.fillText(i%2?'✦':'✧',L.x+L.w*.5+Math.cos(a)*120*s,L.y+L.h*.28+Math.sin(a*1.3)*70*s);}c.restore();}if(p.love>.08){c.save();c.fillStyle='#ff619c';c.globalAlpha=.45+.45*p.love;c.font=`${20*s}px system-ui`;for(let i=0;i<4;i++){const q=(t*.45+i*.25)%1;c.fillText('♥',L.x+L.w*.5+(i-1.5)*42*s,L.y+L.h*.2-q*75*s);}c.restore();}if(p.anger>.08){c.save();c.strokeStyle=`rgba(255,75,94,${.35+.55*p.anger})`;c.lineWidth=3*s;const x=L.x+L.w*.82,y=L.y+L.h*.17,z=12*s;c.beginPath();c.moveTo(x-z,y);c.lineTo(x,y-z);c.lineTo(x+z,y);c.moveTo(x+z,y);c.lineTo(x,y+z);c.stroke();c.restore();}if(p.fear>.08){c.save();c.fillStyle=`rgba(129,206,255,${.3+.55*p.fear})`;c.beginPath();c.ellipse(L.x+L.w*.81,L.y+L.h*.2,5*s,12*s,-.2,0,TAU);c.fill();c.restore();}if(p.sick>.08){c.save();const g=c.createRadialGradient(L.x+L.w*.5,L.y+L.h*.3,0,L.x+L.w*.5,L.y+L.h*.3,85*s);g.addColorStop(0,`rgba(115,205,125,${.14*p.sick})`);g.addColorStop(1,'rgba(115,205,125,0)');c.fillStyle=g;c.beginPath();c.arc(L.x+L.w*.5,L.y+L.h*.3,85*s,0,TAU);c.fill();c.restore();}if(this.meshVisible){c.save();c.fillStyle='rgba(255,255,255,.75)';c.font='11px system-ui';c.fillText('SPRITE RIG: head / eyes / brows / mouth / arms / legs',12,h-14);c.restore();}}
    meshHealth(){return{inverted:0,degenerate:0,minArea:1,meanArea:1,mode:'layered-sprites'};}
  }

  window.JiraiRig={Spring,MotionController,MeshRenderer:LayeredRenderer,LayeredRenderer,EMOTIONS,PARAM_DEFAULTS,clamp,smooth};
})();
