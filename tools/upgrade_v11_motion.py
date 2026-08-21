from pathlib import Path

engine = Path('src/rig-engine.js')
s = engine.read_text(encoding='utf-8')

old = """      const mx=f.mouth[0], my=f.mouth[1], mi=bell(u,mx,.15)*bell(v,my,.075);
      if(mi>0){ const side=Math.sign(v-my)||1; y += side*p.mouthOpen*L.h*.024*mi; const corner=clamp(Math.abs(u-mx)/.12); y -= p.mouthForm*corner*L.h*.009*mi; x += (u-mx)*p.mouthOpen*L.w*.015*mi; }
      const armBand=band(v,.47,.73,.09), lArm=smooth((.37-u)/.3)*armBand, rArm=smooth((u-.63)/.3)*armBand;
      y -= p.armL*L.h*.07*lArm + p.armR*L.h*.07*rArm; x -= p.armL*L.w*.025*lArm; x += p.armR*L.w*.025*rArm;
      const legBand=smooth((v-.73)/.2), lLeg=smooth((.53-u)/.28)*legBand, rLeg=smooth((u-.47)/.28)*legBand;
      y -= (p.legL*lLeg+p.legR*rLeg)*L.h*.028; x -= p.legL*lLeg*L.w*.026; x += p.legR*rLeg*L.w*.026;
"""
new = """      const mx=f.mouth[0], my=f.mouth[1], mi=bell(u,mx,.15)*bell(v,my,.075);
      if(mi>0){
        // When a mapped atlas mouth is active, gently collapse the painted neutral mouth
        // underneath it. This prevents a doubled mouth while keeping the surrounding skin stable.
        const spriteMix=smooth((p.mouthOpen-.08)/.28);
        if(spriteMix>0){
          const mcx=L.x+mx*L.w, mcy=L.y+my*L.h;
          x=lerp(x,mcx,mi*spriteMix*.12);
          y=lerp(y,mcy,mi*spriteMix*.48);
        }
        const side=Math.sign(v-my)||1;
        y += side*p.mouthOpen*L.h*.010*mi*(1-spriteMix*.7);
        const corner=clamp(Math.abs(u-mx)/.12);
        y -= p.mouthForm*corner*L.h*.009*mi;
        x += (u-mx)*p.mouthOpen*L.w*.006*mi;
      }

      // Limb motion uses soft local rotations around anatomical pivots instead of simple
      // translations. The feathered masks preserve dress/torso continuity while giving the
      // hands and feet visibly larger arcs, closer to layered Live2D motion.
      const armBand=band(v,.455,.745,.085), lArm=smooth((.39-u)/.29)*armBand, rArm=smooth((u-.61)/.29)*armBand;
      if(lArm>.001){ const q=rotate(x,y,L.x+L.w*.315,L.y+L.h*.49,-p.armL*.48*lArm); x=q[0]-p.armL*L.w*.008*lArm; y=q[1]-p.armL*L.h*.012*lArm; }
      if(rArm>.001){ const q=rotate(x,y,L.x+L.w*.685,L.y+L.h*.49,p.armR*.48*rArm); x=q[0]+p.armR*L.w*.008*rArm; y=q[1]-p.armR*L.h*.012*rArm; }
      const legBand=smooth((v-.70)/.22), lLeg=smooth((.53-u)/.25)*legBand, rLeg=smooth((u-.47)/.25)*legBand;
      if(lLeg>.001){ const q=rotate(x,y,L.x+L.w*.44,L.y+L.h*.735,p.legL*.23*lLeg); x=q[0]-p.legL*L.w*.012*lLeg; y=q[1]; }
      if(rLeg>.001){ const q=rotate(x,y,L.x+L.w*.56,L.y+L.h*.735,-p.legR*.23*rLeg); x=q[0]+p.legR*L.w*.012*rLeg; y=q[1]; }
"""
if old not in s:
    raise SystemExit('deformation block not found')
s = s.replace(old, new, 1)

old = """    facePoint(u,v,p){ return this.deformPoint(u,v,p,this.lastLayout); }
    drawFX(p,emotionId,w,h){
      const c=this.fx; c.clearRect(0,0,w,h); if(!this.lastLayout)return;
      const f=this.config.face, lp=this.facePoint(f.leftCheek[0],f.leftCheek[1],p), rp=this.facePoint(f.rightCheek[0],f.rightCheek[1],p), scale=this.lastLayout.h/474;
"""
new = """    facePoint(u,v,p){ return this.deformPoint(u,v,p,this.lastLayout); }
    meshHealth(){
      let inverted=0, degenerate=0, minArea=Infinity, sum=0, count=0;
      for(let i=0;i<this.indices.length;i+=3){
        const a=this.vertices[this.indices[i]], b=this.vertices[this.indices[i+1]], c=this.vertices[this.indices[i+2]];
        const area=((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))*.5;
        const aa=Math.abs(area); minArea=Math.min(minArea,aa); sum+=aa; count++;
        if(area>=0) inverted++; if(aa<.04) degenerate++;
      }
      return {inverted,degenerate,minArea:Number.isFinite(minArea)?minArea:0,meanArea:count?sum/count:0};
    }
    drawAtlasMouth(c,p,scale){
      const parts=this.config.atlas.parts||{};
      if(!this.image||p.mouthOpen<.12){ this.lastMouthSprite='base'; return; }
      let key='mouthSmall';
      if(p.mouthOpen>.72) key='mouthLarge'; else if(p.mouthOpen>.4) key='mouthMedium';
      const src=parts[key]; if(!src){ this.lastMouthSprite='base'; return; }
      const q=this.facePoint(this.config.face.mouth[0],this.config.face.mouth[1],p);
      const [sx,sy,sw,sh]=src;
      const grow=.96+p.mouthOpen*.13;
      const dw=sw*scale*grow, dh=sh*scale*grow;
      c.save(); c.translate(q.x,q.y); c.rotate((p.headAngle+p.bodyLean*.18)*Math.PI/180); c.scale(1-Math.abs(p.headTurn)*.11,1);
      c.globalAlpha=clamp((p.mouthOpen-.08)/.18);
      c.drawImage(this.image,sx,sy,sw,sh,-dw/2,-dh*.48,dw,dh);
      c.restore(); this.lastMouthSprite=key;
    }
    drawFX(p,emotionId,w,h){
      const c=this.fx; c.clearRect(0,0,w,h); if(!this.lastLayout)return;
      const f=this.config.face, lp=this.facePoint(f.leftCheek[0],f.leftCheek[1],p), rp=this.facePoint(f.rightCheek[0],f.rightCheek[1],p), scale=this.lastLayout.h/474;
      this.drawAtlasMouth(c,p,scale);
"""
if old not in s:
    raise SystemExit('FX insertion point not found')
s = s.replace(old, new, 1)
engine.write_text(s, encoding='utf-8')

app = Path('src/app.js')
a = app.read_text(encoding='utf-8')
old = """    snapshot:()=>({ready:state.ready,renderer:state.renderer,assetLoaded:state.assetLoaded,emotion:state.current,fps:state.fps,errors:[...state.errors],params:{...window.__JIRAI_QA_STATE__},buttonCount:ui.grid.children.length}),
"""
new = """    snapshot:()=>({ready:state.ready,renderer:state.renderer,assetLoaded:state.assetLoaded,emotion:state.current,fps:state.fps,errors:[...state.errors],params:{...window.__JIRAI_QA_STATE__},buttonCount:ui.grid.children.length,mesh:renderer?.meshHealth?.()||null,mouthSprite:renderer?.lastMouthSprite||'base'}),
"""
if old not in a:
    raise SystemExit('QA snapshot line not found')
a = a.replace(old, new, 1)
app.write_text(a, encoding='utf-8')

qa = Path('tools/qa_browser.mjs')
q = qa.read_text(encoding='utf-8')
old = """const allSnapshots=[results.initial,...Object.values(results.samples),results.mouth,results.blink];
const allFinite=allSnapshots.every(s=>Object.values(s.params||{}).filter(v=>typeof v==='number').every(v=>Number.isFinite(v)&&Math.abs(v)<100));
const checks={
"""
new = """const allSnapshots=[results.initial,...Object.values(results.samples),results.mouth,results.blink];
const allFinite=allSnapshots.every(s=>Object.values(s.params||{}).filter(v=>typeof v==='number').every(v=>Number.isFinite(v)&&Math.abs(v)<100));
const meshSamples=[results.initial,...Object.values(results.samples),results.mouth];
const meshHealthy=meshSamples.every(s=>(s.mesh?.inverted??999)===0&&(s.mesh?.degenerate??999)<4&&(s.mesh?.minArea??0)>.02);
const checks={
"""
if old not in q:
    raise SystemExit('QA precheck block not found')
q = q.replace(old, new, 1)
old = """  finiteParameters:allFinite,
  steadyFps:Math.max(...Object.values(results.samples).map(s=>s.fps||0))>=25,
  consoleErrors:consoleErrors.length===0
"""
new = """  finiteParameters:allFinite,
  meshNoFoldover:meshHealthy,
  atlasMouth:results.mouth.mouthSprite!=='base',
  steadyFps:Math.max(...Object.values(results.samples).map(s=>s.fps||0))>=25,
  consoleErrors:consoleErrors.length===0
"""
if old not in q:
    raise SystemExit('QA checks tail not found')
q = q.replace(old, new, 1)
qa.write_text(q, encoding='utf-8')
print('Upgraded Jirai Ver1.1 motion, atlas mouth rendering and mesh QA.')
