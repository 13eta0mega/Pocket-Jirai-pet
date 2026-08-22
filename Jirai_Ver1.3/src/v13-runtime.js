(() => {
  'use strict';

  const Rig = window.JiraiRig;
  if (!Rig?.MotionController || !Rig?.PartAtlasRenderer || !Rig?.EMOTIONS) return;

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, Number(v) || 0));
  const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
  const E = Rig.EMOTIONS;

  const browPose = {
    neutral:      { left:{dy:0, angle:0, scale:1},    right:{dy:0, angle:0, scale:1} },
    happy:        { left:{dy:2, angle:-2, scale:1},   right:{dy:2, angle:2, scale:1} },
    excited:      { left:{dy:-7,angle:-5,scale:1.05}, right:{dy:-7,angle:5,scale:1.05} },
    teasing:      { left:{dy:-7,angle:-7,scale:1.03}, right:{dy:2, angle:3,scale:.98} },
    pleading:     { left:{dy:-2,angle:-4,scale:1.02}, right:{dy:-2,angle:4,scale:1.02} },
    relaxed:      { left:{dy:4, angle:1, scale:.96},  right:{dy:4, angle:-1,scale:.96} },
    sick:         { left:{dy:2, angle:-2,scale:.98},  right:{dy:2, angle:2,scale:.98} },
    angry:        { left:{}, right:{} },
    annoyed:      { left:{dy:1, angle:5, scale:1},    right:{dy:-5,angle:-6,scale:1.03} },
    sad:          { left:{dy:-1,angle:-6,scale:1.03}, right:{dy:-1,angle:6,scale:1.03} },
    surprised:    { left:{dy:-10,angle:-2,scale:1.08},right:{dy:-10,angle:2,scale:1.08} },
    embarrassed:  { left:{dy:-4,angle:-4,scale:.98},  right:{dy:-4,angle:4,scale:.98} },
    scared:       { left:{dy:-8,angle:-5,scale:1.06}, right:{dy:-8,angle:5,scale:1.06} },
    smug:         { left:{dy:2, angle:5, scale:.98},  right:{dy:-5,angle:-6,scale:1.04} },
    confused:     { left:{dy:-8,angle:-7,scale:1.05}, right:{dy:1, angle:4,scale:.98} },
    love:         { left:{dy:-2,angle:-2,scale:1},    right:{dy:-2,angle:2,scale:1} }
  };

  const defs = {
    neutral:     {label:'기본',bodySprite:'TB01',eyes:['E01','E02'],brows:['B01','B02'],mouth:'M01',arms:'down',legs:'straight',faceOverlays:[],faceFx:[],pose:{},gesture:'settle'},
    happy:       {label:'행복',bodySprite:'TB03',eyes:['E03','E04'],brows:['B01','B02'],mouth:'M05',arms:'open',legs:'straight',faceOverlays:[],faceFx:['FX01','FX02'],pose:{headAngle:-1.5,armL:-4,armR:4,blush:.25,energy:.45},gesture:'happy'},
    excited:     {label:'신남',bodySprite:'TB05',eyes:['E01','E02'],brows:['B03','B04'],mouth:'M05',arms:'raised',legs:'straight',faceOverlays:[],faceFx:[],pose:{headAngle:1.5,armL:-6,armR:6,legL:-3,legR:3,energy:1},gesture:'bounce'},
    teasing:     {label:'장난',bodySprite:'TB05',eyes:['E01','E04'],brows:['B01','B02'],mouth:'M08',arms:'oneRaisedLeft',legs:'bentLeft',faceOverlays:[],faceFx:[],pose:{headAngle:-4,headTurn:.08,bodyLean:-2,energy:.55},gesture:'tease'},
    pleading:    {label:'울망',bodySprite:'TB03',eyes:['E09','E10'],brows:['B05','B06'],mouth:'M01',arms:'clasped',legs:'straight',faceOverlays:[],faceFx:[],pose:{headAngle:3.5,bodyLean:1,blush:.15,energy:.12},gesture:'plead'},
    relaxed:     {label:'느긋',bodySprite:'TB04',eyes:['E05','E06'],brows:['B01','B02'],mouth:'M06',arms:'cheek',legs:'straight',faceOverlays:[],faceFx:[],pose:{headAngle:-2.5,headTurn:-.05,bodyLean:1.2,energy:.05},gesture:'slow'},
    sick:        {label:'아픔',bodySprite:'TB01',eyes:['E05','E06'],brows:['B05','B06'],mouth:'M17',arms:'down',legs:'straight',faceOverlays:['F02','F03'],faceFx:[],pose:{headAngle:4.5,bodyLean:2.2,bodySquash:.02,energy:.02},gesture:'sick'},
    angry:       {label:'화남',bodySprite:'TB02',eyes:['E07','E08'],brows:[],mouth:'M16',arms:'crossed',legs:'straight',faceOverlays:[],faceFx:[],pose:{headAngle:-1,bodyLean:-2,energy:.85},gesture:'angry'},
    annoyed:     {label:'삐짐',bodySprite:'TB02',eyes:['E05','E06'],brows:['B01','B02'],mouth:'M16',arms:'crossed',legs:'straight',faceOverlays:['F02','F03'],faceFx:[],pose:{headAngle:-5,headTurn:-.08,bodyLean:1.5,energy:.12},gesture:'huff'},
    sad:         {label:'슬픔',bodySprite:'TB03',eyes:['E09','E10'],brows:['B05','B06'],mouth:'M17',arms:'clasped',legs:'straight',faceOverlays:[],faceFx:[],pose:{headAngle:5,bodyLean:1.4,energy:.03},gesture:'sad'},
    surprised:   {label:'놀람',bodySprite:'TB03',eyes:['E11','E12'],brows:['B03','B04'],mouth:'M06',arms:'palms',legs:'straight',faceOverlays:[],faceFx:[],pose:{bodySquash:-.02,energy:.85},gesture:'startle'},
    embarrassed: {label:'부끄러움',bodySprite:'TB03',eyes:['E03','E04'],brows:['B03','B04'],mouth:'M02',arms:'clasped',legs:'bentLeft',faceOverlays:[],faceFx:['FX03','FX04'],pose:{headAngle:3,headTurn:.06,blush:1,energy:.18},gesture:'shy'},
    scared:      {label:'겁남',bodySprite:'TB03',eyes:['E11','E12'],brows:['B05','B06'],mouth:'M18',arms:'clasped',legs:'straight',faceOverlays:['F02','F03'],faceFx:[],pose:{headAngle:2,bodySquash:.025,energy:.72},gesture:'shiver'},
    smug:        {label:'의기양양',bodySprite:'TB04',eyes:['E05','E06'],brows:['B01','B02'],mouth:'M07',arms:'cheek',legs:'straight',faceOverlays:['F02','F03'],faceFx:[],pose:{headAngle:-4.5,headTurn:.08,bodyLean:-1.2,energy:.22},gesture:'smug'},
    confused:    {label:'갸웃',bodySprite:'TB04',eyes:['E01','E02'],brows:['B03','B04'],mouth:'M06',arms:'cheek',legs:'straight',faceOverlays:[],faceFx:[],pose:{headAngle:7,headTurn:-.05,energy:.2},gesture:'tilt'},
    love:        {label:'좋아!',bodySprite:'TB03',eyes:['E13','E14'],brows:['B01','B02'],mouth:'M05',arms:'clasped',legs:'straight',faceOverlays:[],faceFx:['FX01','FX02','FX03','FX04'],pose:{headAngle:-2,blush:.55,energy:.72},gesture:'love'}
  };
  for (const [id, def] of Object.entries(defs)) Object.assign(E[id], def, { id, browPose: browPose[id] });

  const Motion = Rig.MotionController;
  const originalUpdate = Motion.prototype.update;
  Motion.prototype.lipTarget = function v13RawLipTarget(sec) {
    if (this.micActive) return clamp(this.micLevel);
    if (this.testLipSync) {
      const phrase = sec % 5.6;
      if (phrase > 4.25) return 0;
      const env = smooth(Math.min(1, phrase * 2.6)) * smooth(Math.min(1, (4.25 - phrase) * 2.2));
      const syllable = Math.abs(Math.sin(sec * 3.2)) * .52 + Math.abs(Math.sin(sec * 5.1 + .65)) * .31 + .06;
      return clamp(syllable * env);
    }
    return clamp(this.manualMouth);
  };
  Motion.prototype.update = function v13MotionUpdate(now, dt, qa = false) {
    const out = originalUpdate.call(this, now, dt, qa);
    const cfg = this.config.lipSync || {};
    const target = clamp(out.mouthOpen);
    if (!Number.isFinite(this._v13MouthSmooth)) this._v13MouthSmooth = target;
    const rising = target > this._v13MouthSmooth;
    const tau = Math.max(0.01, (rising ? (cfg.attack_ms || 115) : (cfg.release_ms || 190)) / 1000);
    const a = 1 - Math.exp(-Math.max(0, dt || .016) / tau);
    this._v13MouthSmooth += (target - this._v13MouthSmooth) * a;
    if (this._v13MouthSmooth < (cfg.dead_zone || .055) * .55 && target === 0) this._v13MouthSmooth = 0;
    out.mouthOpenRaw = target;
    out.mouthOpen = clamp(this._v13MouthSmooth);
    return out;
  };

  const Renderer = Rig.PartAtlasRenderer;
  const previousHealth = Renderer.prototype.meshHealth;

  Renderer.prototype.browPair = function v13BrowPair(def, alpha = 1) {
    if (!def?.brows?.length) { this.lastBrowSprite = 'integrated/none'; return; }
    const [l, r] = def.brows;
    if (!l || !r) return;
    const L = this.config.layout.browLeft, R = this.config.layout.browRight;
    const turn = this._p?.headTurn || 0;
    const pose = def.browPose || {};
    const lp = pose.left || {}, rp = pose.right || {};
    const ls = (this.config.browScale[l] || L.scale || .66) * (lp.scale || 1);
    const rs = (this.config.browScale[r] || R.scale || .66) * (rp.scale || 1);
    this.draw(l,{center:[L.center[0]+turn*10+(lp.dx||0),L.center[1]+(lp.dy||0)],scale:ls,angle:lp.angle||0,alpha});
    this.draw(r,{center:[R.center[0]+turn*10+(rp.dx||0),R.center[1]+(rp.dy||0)],scale:rs,angle:rp.angle||0,alpha});
    this.lastBrowSprite = `${l}/${r}`;
  };

  Renderer.prototype.drawFaceOverlays = function v13FaceOverlays(def, alpha = 1) {
    if (!def?.faceOverlays?.length) return;
    const lo = this.config.layout;
    for (const id of def.faceOverlays) {
      if (id === 'F02') this.draw(id,{center:lo.faceShadowLeft.center,scale:lo.faceShadowLeft.scale,alpha:alpha*.42});
      else if (id === 'F03') this.draw(id,{center:lo.faceShadowRight.center,scale:lo.faceShadowRight.scale,alpha:alpha*.42});
    }
  };

  Renderer.prototype.drawFaceFx = function v13FaceFx(def, alpha = 1) {
    if (!def?.faceFx?.length) return;
    const lo = this.config.layout;
    for (const id of def.faceFx) {
      if (id === 'FX01') this.draw(id,{center:lo.blushSoftLeft.center,scale:lo.blushSoftLeft.scale,alpha:alpha*.58});
      else if (id === 'FX02') this.draw(id,{center:lo.blushSoftRight.center,scale:lo.blushSoftRight.scale,alpha:alpha*.58});
      else if (id === 'FX03') this.draw(id,{center:lo.blushStripeLeft.center,scale:lo.blushStripeLeft.scale,alpha:alpha*.68});
      else if (id === 'FX04') this.draw(id,{center:lo.blushStripeRight.center,scale:lo.blushStripeRight.scale,alpha:alpha*.68});
    }
  };

  Renderer.prototype.drawLipSync = function v13LipSync(level) {
    const cfg = this.config.lipSync || {};
    const ids = cfg.viseme_ids || ['M09','M10','M11','M12','M13','M14','M15'];
    const dead = cfg.dead_zone || .055;
    if (level < dead || !ids.every(id => !!this.part(id))) {
      this._v13Speaking = false;
      this._v13VisemeIndex = null;
      return false;
    }
    const cuts = [dead,.16,.29,.43,.58,.74,.88];
    let target = 0;
    for (let i=1;i<cuts.length;i++) if (level >= cuts[i]) target=i;
    const now = performance.now();
    if (this._v13VisemeIndex == null) {
      this._v13VisemeIndex=target; this._v13PrevVisemeIndex=target; this._v13VisemeChangedAt=now; this._v13VisemeFadeAt=now;
    } else if (target !== this._v13VisemeIndex) {
      const hold = cfg.min_hold_ms || 95, hyst = cfg.hysteresis || .035;
      const elapsed = now - (this._v13VisemeChangedAt || 0);
      let confirmed = false;
      if (target > this._v13VisemeIndex) confirmed = level >= (cuts[target] || 1) + hyst;
      else confirmed = level <= (cuts[this._v13VisemeIndex] || dead) - hyst;
      if (elapsed >= hold && confirmed) {
        this._v13PrevVisemeIndex=this._v13VisemeIndex;
        this._v13VisemeIndex=target;
        this._v13VisemeChangedAt=now;
        this._v13VisemeFadeAt=now;
      }
    }
    const cur = ids[this._v13VisemeIndex], prev = ids[this._v13PrevVisemeIndex ?? this._v13VisemeIndex];
    const fadeMs = cfg.crossfade_ms || 72;
    const f = smooth((now-(this._v13VisemeFadeAt||now))/fadeMs);
    const L=this.config.layout.mouth, x=L.center[0]+(this._p?.headTurn||0)*9, y=L.center[1];
    if (prev !== cur && f < .999) this.draw(prev,{center:[x,y],scale:this.config.mouthScale[prev]||.6,alpha:1-f});
    this.draw(cur,{center:[x,y],scale:this.config.mouthScale[cur]||.6,alpha:prev===cur?1:f});
    this._v13Speaking = true;
    this.lastMouthSprite = cur;
    this.lastVisemeIndex = this._v13VisemeIndex;
    return true;
  };

  const rotatePoint = (pt, pivot, angleDeg) => {
    const a=angleDeg*Math.PI/180, c=Math.cos(a), s=Math.sin(a), dx=pt[0]-pivot[0], dy=pt[1]-pivot[1];
    return [pivot[0]+dx*c-dy*s,pivot[1]+dx*s+dy*c];
  };

  Renderer.prototype.drawIntegratedBody = function v131IntegratedBody(id, alpha=1) {
    const q=this.config.layout.integratedBody?.[id];
    if(!id || !q || !this.part(id)) return false;
    const breath=(this._p?.breath||0)*.004;
    this.draw(id,{center:q.center,scale:q.scale,scaleX:q.scaleX||1,scaleY:(q.scaleY||1)*(1+breath),alpha});
    this.lastBodySprite=id;
    return true;
  };

  Renderer.prototype.drawBodyState = function v131BodyState(def, alpha=1, side={l:0,r:0}) {
    if(def?.bodySprite && this.drawIntegratedBody(def.bodySprite,alpha)) return 'integrated';
    const p=this._p||{}, breath=p.breath*.008;
    this.drawWarped('T01',{center:this.config.layout.T01.center,scale:this.config.layout.T01.scale,shear:p.bodyLean*.45,bulge:breath,alpha});
    this.drawWarped('L01',{center:this.config.layout.L01.center,scale:this.config.layout.L01.scale,shear:p.bodyLean*.7,bulge:breath*.65,alpha});
    this.draw('T02',{alpha});this.draw('T03',{alpha});this.draw('T04',{alpha});
    this.drawArmPose(def?.arms||'down',alpha,side);
    this.lastBodySprite='assembled';
    return 'assembled';
  };

  Renderer.prototype.drawArmPose = function v13ArmPose(pose, alpha=1, side={l:0,r:0}) {
    const lo=this.config.layout;
    const pair=(l,r,lp,rp)=>{
      this.draw(l,{center:lp.center,pivot:lp.pivot,scale:lp.scale,angle:(lp.angle||0)+(side.l||0),alpha});
      this.draw(r,{center:rp.center,pivot:rp.pivot,scale:rp.scale,angle:(rp.angle||0)+(side.r||0),alpha});
    };
    if(pose==='down') return pair('A01','A02',lo.armNeutralLeft,lo.armNeutralRight);
    if(pose==='open') return pair('A03','A04',lo.armOpenLeft,lo.armOpenRight);
    if(pose==='raised') return pair('A05','A06',lo.armRaisedLeft,lo.armRaisedRight);
    if(pose==='oneRaisedLeft') {
      this.draw('A05',{center:lo.armRaisedLeft.center,pivot:lo.armRaisedLeft.pivot,scale:lo.armRaisedLeft.scale,angle:(lo.armRaisedLeft.angle||0)+(side.l||0),alpha});
      this.draw('A02',{center:lo.armNeutralRight.center,pivot:lo.armNeutralRight.pivot,scale:lo.armNeutralRight.scale,angle:(lo.armNeutralRight.angle||0)+(side.r||0),alpha});
      return;
    }
    const map={crossed:'A07',cheek:'A08',palms:'A09',clasped:'A10'}, id=map[pose]||'A07';
    const p=lo.armComposite?.[pose]||lo.armComposite?.crossed||{center:[300,460],scale:.95};
    const energy=((side.l||0)+(side.r||0))*.5;
    this.draw(id,{center:[p.center[0],p.center[1]-Math.abs(energy)*.65],scale:p.scale,angle:energy*.12,alpha});
  };

  Renderer.prototype.drawLegs = function v131LinkedLegPose(pose, alpha=1) {
    const lo=this.config.layout, p=this._p||{}, lA=p.legL||0, rA=p.legR||0, lP=lo.legLeft.pivot, rP=lo.legRight.pivot;
    const rigid=(id,baseCenter,pivot,baseAngle,dynamicAngle,scale)=>{
      const center=rotatePoint(baseCenter,pivot,dynamicAngle);
      this.draw(id,{center,scale,angle:baseAngle+dynamicAngle,alpha});
      return center;
    };
    if(pose==='bentLeft') {
      const b=lo.legPoses?.bentLeft||{legCenter:[232,672],legScale:.96,legAngle:-10,shoeCenter:[208,792],shoeAngle:-15};
      rigid('L07',b.legCenter,lP,b.legAngle,lA,b.legScale);
      rigid('L04',b.shoeCenter,lP,b.shoeAngle,lA,lo.shoeLeft.scale);
      rigid('L03',lo.legRight.center,rP,0,rA,lo.legRight.scale);
      rigid('L05',lo.shoeRight.center,rP,0,rA,lo.shoeRight.scale);
      this.lastFootChain='linked';
      return;
    }
    rigid('L02',lo.legLeft.center,lP,0,lA,lo.legLeft.scale);
    rigid('L04',lo.shoeLeft.center,lP,0,lA,lo.shoeLeft.scale);
    rigid('L03',lo.legRight.center,rP,0,rA,lo.legRight.scale);
    rigid('L05',lo.shoeRight.center,rP,0,rA,lo.shoeRight.scale);
    this.lastFootChain='linked';
  };

  Renderer.prototype.render = function v13LayeredRender(p, emotion) {
    this._p=p;
    const c=this.ctx,fx=this.fx,[w,h]=this.config.canvas;
    c.clearRect(0,0,w,h); fx.clearRect(0,0,w,h);
    const cur=E[emotion]||E.neutral, prev=E[p.previousEmotion]||cur, t=p.transition, gx=p.globalX||0, gy=p.globalBob||0;

    // 1) lower body: legs and shoes are behind skirt/torso.
    this.withGroup([300,607],[gx,gy],p.bodyLean*.15,1,1,()=>{
      if(prev.legs!==cur.legs&&t<.999){this.drawLegs(prev.legs,1-t);this.drawLegs(cur.legs,t);} else this.drawLegs(cur.legs,1);
    });

    // 2) head-back stage: twin tails/back hair are behind body/arms, fixing raised-arm occlusion.
    const hp=this.config.layout.head.pivot, headX=(p.headTurn||0)*12;
    const follow=(p.headAngle*.28)+(p.bodyLean*.12)+Math.sin(performance.now()/470)*.6*(.25+p.energy);
    this.withGroup(hp,[gx+headX,gy],p.headAngle,1-Math.abs(p.headTurn||0)*.025,1,()=>{
      this.draw('H03',{center:this.config.layout.H03.center,scale:this.config.layout.H03.scale,angle:-follow});
      this.draw('H04',{center:this.config.layout.H04.center,scale:this.config.layout.H04.scale,angle:follow});
    });

    // 3) Prefer source-integrated body+arm poses. Fallback assembled torso/arms only where no integrated source exists.
    const squash=p.bodySquash||0;
    this.withGroup([300,365],[gx,gy],p.bodyLean,1+squash*.18,1-squash*.18,()=>{
      const prevKey=prev.bodySprite||`assembled:${prev.arms}`, curKey=cur.bodySprite||`assembled:${cur.arms}`;
      if(prevKey!==curKey&&t<.999){this.drawBodyState(prev,1-t,{l:p.armL,r:p.armR});this.drawBodyState(cur,t,{l:p.armL,r:p.armR});}
      else this.drawBodyState(cur,1,{l:p.armL,r:p.armR});
    });

    // 4) face/front-hair/features. F02/F03 are shadow overlays; real blush uses FX01..FX04.
    this.withGroup(hp,[gx+headX,gy],p.headAngle,1-Math.abs(p.headTurn||0)*.025,1,()=>{
      this.draw('H01');
      this.draw('F01');
      this.draw('H02');
      if(prev!==cur&&t<.999){
        this.drawFaceOverlays(prev,1-t); this.drawFaceOverlays(cur,t);
        this.drawFaceFx(prev,1-t); this.drawFaceFx(cur,t);
        this.browPair(prev,1-t); this.browPair(cur,t);
        this.eyePair(prev,1-t,p.blinkOpen); this.eyePair(cur,t,p.blinkOpen);
      } else {
        this.drawFaceOverlays(cur,1); this.drawFaceFx(cur,1); this.browPair(cur,1); this.eyePair(cur,1,p.blinkOpen);
      }
      if(!this.drawLipSync(p.mouthOpen)){
        if(prev.mouth!==cur.mouth&&t<.999){this.drawMouthBase(prev.mouth,1-t);this.drawMouthBase(cur.mouth,t);} else this.drawMouthBase(cur.mouth,1);
        this.lastMouthSprite=cur.mouth;
      }
      this.draw('H05');this.draw('H06');
    });

    this.lastEyeSprite=`${cur.eyes[0]}/${cur.eyes[1]}${p.blinkOpen<.5?' -> E03/E04':''}`;
    this.lastBrowSprite=cur.brows?.length?`${cur.brows[0]}/${cur.brows[1]}`:'integrated/none';
    this.lastArmPose=cur.arms;this.lastLegPose=cur.legs;
    this.partSnapshot={
      eyes:this.lastEyeSprite,brows:this.lastBrowSprite,mouth:this.lastMouthSprite,body:cur.bodySprite||'assembled',arms:cur.arms,legs:cur.legs,
      faceOverlays:(cur.faceOverlays||[]).join('/')||'-',faceFx:(cur.faceFx||[]).join('/')||'-',
      blinkOpen:+p.blinkOpen.toFixed(3),mouthOpen:+p.mouthOpen.toFixed(3),mouthOpenRaw:+(p.mouthOpenRaw??p.mouthOpen).toFixed(3),
      visemeIndex:this.lastVisemeIndex??null,footChain:this.lastFootChain||'linked',layerMode:'v13.1-integrated-body-linked-feet'
    };
  };

  Renderer.prototype.meshHealth = function v13Health() {
    const base=previousHealth?previousHealth.call(this):{};
    return {...base,activeParts:Object.keys(this.config.parts||{}).length,v13LayerOrder:true,v13BrowProfiles:16,v13LipVisemes:(this.config.lipSync?.viseme_ids||[]).length,v13IntegratedBodies:Object.keys(this.config.layout.integratedBody||{}).length,v13LinkedFootChain:this.config.layout.legChain?.linkedFootPivot===true,v13FaceStackYOffset:this.config.layout.faceStackYOffset||0};
  };
})();
