(() => {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
  const smoother = t => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
  const bell = (x, c, r) => {
    const q = Math.abs(x - c) / r;
    return q >= 1 ? 0 : 0.5 + 0.5 * Math.cos(Math.PI * q);
  };
  const band = (x, a, b, feather = 0.08) => smooth((x - a) / feather) * (1 - smooth((x - b) / feather));
  const rotate = (x, y, cx, cy, rad) => {
    const dx = x - cx, dy = y - cy, c = Math.cos(rad), s = Math.sin(rad);
    return [cx + dx * c - dy * s, cy + dx * s + dy * c];
  };

  class Spring {
    constructor(value = 0, frequency = 7.5, damping = 0.88) {
      this.value = value;
      this.target = value;
      this.velocity = 0;
      this.frequency = frequency;
      this.damping = damping;
    }
    snap(value) { this.value = this.target = value; this.velocity = 0; }
    set(value) { this.target = value; }
    step(dt) {
      // Implicit Euler remains stable for high-frequency facial springs even when a frame stalls.
      dt = Math.min(Math.max(dt, 0), 0.04);
      const omega = TAU * this.frequency;
      const k = omega * omega;
      const c = 2 * this.damping * omega;
      const denom = 1 + dt * c + dt * dt * k;
      this.velocity = (this.velocity + dt * k * (this.target - this.value)) / denom;
      this.value += dt * this.velocity;
      if (!Number.isFinite(this.value) || !Number.isFinite(this.velocity)) this.snap(this.target);
      return this.value;
    }
  }

  const PARAM_DEFAULTS = {
    headAngle: 0, headTurn: 0, headY: 0,
    bodyLean: 0, bodySquash: 0,
    eyeL: 1, eyeR: 1, browMood: 0,
    mouthOpen: 0, mouthForm: 0.15,
    armL: 0, armR: 0, legL: 0, legR: 0,
    energy: 0.15, blush: 0, tears: 0, sick: 0,
    fear: 0, love: 0, anger: 0, sparkle: 0
  };

  const EMOTIONS = {
    neutral:    { label:'기본', pose:{}, gesture:'settle' },
    happy:      { label:'행복', pose:{ headAngle:-1.8, headTurn:-0.05, eyeL:.84, eyeR:.84, mouthForm:.86, armL:.16, armR:.16, energy:.4, blush:.16, sparkle:.18 }, gesture:'happy' },
    excited:    { label:'신남', pose:{ headAngle:1.2, eyeL:1, eyeR:1, mouthOpen:.28, mouthForm:.8, armL:.72, armR:.72, legL:.14, legR:-.12, energy:1, sparkle:.8 }, gesture:'bounce' },
    teasing:    { label:'장난', pose:{ headAngle:-5.8, headTurn:.18, eyeL:1, eyeR:.18, mouthForm:.64, armL:.12, armR:.48, bodyLean:-1.8, energy:.55, blush:.08 }, gesture:'tease' },
    pleading:   { label:'울망', pose:{ headAngle:3.8, headTurn:-.03, eyeL:1, eyeR:1, browMood:-.9, mouthForm:-.45, armL:.18, armR:.18, bodySquash:.04, tears:.85, energy:.1 }, gesture:'plead' },
    relaxed:    { label:'느긋', pose:{ headAngle:-2.5, headTurn:-.1, eyeL:.42, eyeR:.42, mouthForm:.35, bodyLean:1.2, armL:-.08, armR:-.08, energy:.06 }, gesture:'slow' },
    sick:       { label:'아픔', pose:{ headAngle:5.2, headTurn:.06, eyeL:.36, eyeR:.32, browMood:-.45, mouthForm:-.38, bodyLean:2.2, bodySquash:.06, armL:.08, armR:.08, sick:.82, energy:.03 }, gesture:'sick' },
    angry:      { label:'화남', pose:{ headAngle:-1, headTurn:.08, eyeL:.72, eyeR:.72, browMood:1, mouthForm:-.7, bodyLean:-2.4, armL:.32, armR:.32, anger:1, energy:.78 }, gesture:'angry' },
    annoyed:    { label:'삐짐', pose:{ headAngle:-6.5, headTurn:-.2, eyeL:.5, eyeR:.5, browMood:.45, mouthForm:-.6, bodyLean:2, armL:-.12, armR:-.12, energy:.16 }, gesture:'huff' },
    sad:        { label:'슬픔', pose:{ headAngle:5.8, headTurn:-.08, eyeL:.7, eyeR:.7, browMood:-1, mouthForm:-.72, bodyLean:1.8, bodySquash:.055, armL:-.16, armR:-.16, tears:.42, energy:.04 }, gesture:'sad' },
    surprised:  { label:'놀람', pose:{ headAngle:0, eyeL:1, eyeR:1, browMood:-.15, mouthOpen:.68, mouthForm:.05, armL:.42, armR:.42, bodySquash:-.03, energy:.82, sparkle:.18 }, gesture:'startle' },
    embarrassed:{ label:'부끄러움', pose:{ headAngle:4.5, headTurn:.17, eyeL:.65, eyeR:.65, mouthForm:.26, armL:.15, armR:.15, bodyLean:1.5, blush:.92, energy:.18 }, gesture:'shy' },
    scared:     { label:'겁남', pose:{ headAngle:2.5, headTurn:-.08, eyeL:1, eyeR:1, browMood:-.5, mouthOpen:.36, mouthForm:-.25, armL:.46, armR:.46, bodySquash:.03, fear:1, energy:.72 }, gesture:'shiver' },
    smug:       { label:'의기양양', pose:{ headAngle:-5, headTurn:.17, eyeL:.54, eyeR:.54, browMood:.28, mouthForm:.72, armL:-.16, armR:-.16, bodyLean:-1.6, energy:.22 }, gesture:'smug' },
    confused:   { label:'갸웃', pose:{ headAngle:8.5, headTurn:-.12, eyeL:.92, eyeR:.92, browMood:-.25, mouthForm:.02, armL:.08, armR:.34, energy:.2 }, gesture:'tilt' },
    love:       { label:'좋아!', pose:{ headAngle:-2, headTurn:.05, eyeL:.74, eyeR:.74, mouthForm:.9, armL:.62, armR:.62, bodySquash:-.015, blush:.52, love:1, sparkle:.55, energy:.72 }, gesture:'love' }
  };

  class MotionController {
    constructor(config) {
      this.config = config;
      this.springs = {};
      for (const [key, value] of Object.entries(PARAM_DEFAULTS)) {
        const fast = key.startsWith('eye') || key.startsWith('mouth');
        const slow = key.startsWith('arm') || key.startsWith('leg') || key === 'bodyLean';
        this.springs[key] = new Spring(value, fast ? 10 : slow ? 4.6 : 6.3, fast ? .95 : .84);
      }
      this.emotion = 'neutral';
      this.previousEmotion = 'neutral';
      this.changedAt = performance.now();
      this.gestureStarted = this.changedAt;
      this.idleTurn = new Spring(0, 1.65, .93);
      this.idleTilt = new Spring(0, 1.45, .94);
      this.hairL = new Spring(0, 2.3, .7);
      this.hairR = new Spring(0, 2.15, .72);
      this.mouthReactive = new Spring(0, 11, .92);
      this.manualMouth = 0;
      this.testLipSync = false;
      this.micLevel = 0;
      this.micActive = false;
      this.blinkL = 1;
      this.blinkR = 1;
      this.blinkStart = -1;
      this.doubleBlinkPending = false;
      this.nextBlink = performance.now() + 2800;
      this.nextIdleTurn = performance.now() + 4500;
      this.idleReturnAt = 0;
      this.randomSeed = 0x51a17;
      this.lastHeadAngle = 0;
      this.lastHeadTurn = 0;
      this.applyEmotion('neutral', true);
    }
    rand() {
      this.randomSeed = (Math.imul(this.randomSeed, 1664525) + 1013904223) >>> 0;
      return this.randomSeed / 4294967296;
    }
    applyEmotion(id, snap = false) {
      if (!EMOTIONS[id]) id = 'neutral';
      this.previousEmotion = this.emotion;
      this.emotion = id;
      this.changedAt = performance.now();
      this.gestureStarted = this.changedAt;
      const pose = { ...PARAM_DEFAULTS, ...EMOTIONS[id].pose };
      for (const [key, spring] of Object.entries(this.springs)) {
        if (snap) spring.snap(pose[key] ?? PARAM_DEFAULTS[key] ?? 0);
        else spring.set(pose[key] ?? PARAM_DEFAULTS[key] ?? 0);
      }
    }
    setManualMouth(v) { this.manualMouth = clamp(Number(v) || 0); }
    setLipTest(v) { this.testLipSync = !!v; }
    setMicLevel(v) { this.micLevel = clamp(v); }
    setMicActive(v) { this.micActive = !!v; }
    forceBlink() { this.blinkStart = performance.now(); this.doubleBlinkPending = false; }
    scheduleBlink(now) {
      const idle = this.config.idle;
      this.nextBlink = now + lerp(idle.blinkMinMs, idle.blinkMaxMs, this.rand());
    }
    updateBlink(now) {
      if (this.blinkStart < 0 && now >= this.nextBlink) {
        this.blinkStart = now;
        this.doubleBlinkPending = this.rand() < this.config.idle.doubleBlinkChance;
      }
      if (this.blinkStart < 0) { this.blinkL = this.blinkR = 1; return; }
      const d = this.config.idle.blinkDurationMs;
      const p = (now - this.blinkStart) / d;
      if (p < .34) this.blinkL = this.blinkR = 1 - smoother(p / .34);
      else if (p < .52) this.blinkL = this.blinkR = .035;
      else if (p < 1) this.blinkL = this.blinkR = smoother((p - .52) / .48);
      else if (this.doubleBlinkPending) {
        this.doubleBlinkPending = false;
        this.blinkStart = now + 90;
        this.blinkL = this.blinkR = 1;
      } else {
        this.blinkStart = -1;
        this.blinkL = this.blinkR = 1;
        this.scheduleBlink(now);
      }
    }
    updateIdle(now, dt, qaMode) {
      if (qaMode) {
        this.idleTurn.set(0);
        this.idleTilt.set(0);
      } else {
        if (now >= this.nextIdleTurn) {
          this.idleTurn.set(lerp(-.15, .15, this.rand()));
          this.idleTilt.set(lerp(-2.4, 2.4, this.rand()));
          this.idleReturnAt = now + lerp(1200, 2600, this.rand());
          this.nextIdleTurn = now + lerp(this.config.idle.headTurnMinMs, this.config.idle.headTurnMaxMs, this.rand());
        }
        if (this.idleReturnAt && now >= this.idleReturnAt) {
          this.idleTurn.set(0); this.idleTilt.set(0); this.idleReturnAt = 0;
        }
      }
      this.idleTurn.step(dt); this.idleTilt.step(dt);
    }
    lipTarget(t) {
      if (this.micActive) return this.micLevel;
      if (this.testLipSync) {
        const phase = t % 4.2;
        if (phase > 3.0) return 0;
        const syllables = Math.abs(Math.sin(t * 8.7) * .68 + Math.sin(t * 13.4 + .7) * .25 + Math.sin(t * 4.1) * .16);
        const gate = smooth(Math.min(1, phase * 5)) * smooth(Math.min(1, (3.0 - phase) * 4));
        return clamp(.05 + syllables * gate);
      }
      return this.manualMouth;
    }
    gesture(now) {
      const kind = EMOTIONS[this.emotion].gesture;
      const t = (now - this.gestureStarted) / 1000;
      const pulse = duration => Math.sin(Math.PI * clamp(t / duration));
      switch (kind) {
        case 'happy': return { bob: Math.sin(t * 8) * 2.2 * Math.exp(-t * 1.5), sway: Math.sin(t * 3.4) * .8 * Math.exp(-t) };
        case 'bounce': return { bob: -Math.abs(Math.sin(t * 8.5)) * 12 * Math.exp(-t * .5), squash: Math.sin(t * 8.5) * .035 * Math.exp(-t * .55) };
        case 'tease': return { sway: pulse(.7) * -3.5, armR: pulse(.75) * .24 };
        case 'plead': return { bob: Math.sin(t * 4) * 1.4 * Math.exp(-t * .4), arms: pulse(.8) * .12 };
        case 'sick': return { sway: Math.sin(t * 2.1) * 1.1, bob: 1.8 };
        case 'angry': return { shake: Math.sin(t * 34) * 2.4 * Math.exp(-t * 1.5), sway: Math.sin(t * 19) * .7 * Math.exp(-t * 1.8) };
        case 'huff': return { sway: -2.5 + Math.sin(t * 1.8) * .5, bob: Math.max(0, Math.sin(t * 5)) * 1.2 };
        case 'sad': return { bob: 2.2 + Math.sin(t * 1.4) * .7 };
        case 'startle': return { bob: -pulse(.38) * 18, squash: -pulse(.38) * .055, arms: pulse(.45) * .3 };
        case 'shy': return { sway: Math.sin(t * 2.2) * 1.3, bob: Math.sin(t * 2.7) * .9 };
        case 'shiver': return { shake: Math.sin(t * 31) * 1.7, squash: Math.sin(t * 16) * .012 };
        case 'smug': return { sway: Math.sin(t * 1.4) * .6 };
        case 'tilt': return { sway: pulse(.8) * 2.6 };
        case 'love': return { bob: Math.sin(t * 5.2) * 2.1, sway: Math.sin(t * 2.2) * 1.1, arms: pulse(.85) * .18 };
        case 'slow': return { sway: Math.sin(t * 1.25) * .7, bob: Math.sin(t * 1.5) * .55 };
        default: return { bob:0, sway:0, shake:0, squash:0, arms:0 };
      }
    }
    update(now, dt, qaMode = false) {
      const t = now / 1000;
      if (qaMode && this.blinkStart < 0) {
        this.blinkL = this.blinkR = 1;
      } else {
        this.updateBlink(now);
      }
      this.updateIdle(now, dt, qaMode);
      for (const spring of Object.values(this.springs)) spring.step(dt);
      this.mouthReactive.set(Math.max(this.springs.mouthOpen.value, this.lipTarget(t)));
      const mouthOpen = clamp(this.mouthReactive.step(dt));
      const g = this.gesture(now);
      const breath = Math.sin(t * TAU * this.config.idle.breathHz) * .5 + Math.sin(t * TAU * this.config.idle.breathHz * .51 + 1.2) * .12;
      const headAngle = this.springs.headAngle.value + this.idleTilt.value + (g.sway || 0);
      const headTurn = this.springs.headTurn.value + this.idleTurn.value;
      const headVelocity = (headAngle - this.lastHeadAngle) / Math.max(dt, .001);
      const turnVelocity = (headTurn - this.lastHeadTurn) / Math.max(dt, .001);
      this.lastHeadAngle = headAngle; this.lastHeadTurn = headTurn;
      this.hairL.set(clamp(-headVelocity * .013 - turnVelocity * .18, -.8, .8));
      this.hairR.set(clamp(-headVelocity * .012 + turnVelocity * .18, -.8, .8));
      this.hairL.step(dt); this.hairR.step(dt);
      const out = {};
      for (const [key, spring] of Object.entries(this.springs)) out[key] = Number.isFinite(spring.value) ? spring.value : spring.target;
      out.headAngle = clamp(out.headAngle, -14, 14);
      out.headTurn = clamp(out.headTurn, -.42, .42);
      out.bodyLean = clamp(out.bodyLean, -8, 8);
      out.bodySquash = clamp(out.bodySquash, -.12, .12);
      out.mouthForm = clamp(out.mouthForm, -1, 1);
      out.eyeL = clamp(out.eyeL); out.eyeR = clamp(out.eyeR);
      out.armL = clamp(out.armL, -.45, 1.15); out.armR = clamp(out.armR, -.45, 1.15);
      out.legL = clamp(out.legL, -.45, .45); out.legR = clamp(out.legR, -.45, .45);
      Object.assign(out, {
        headAngle, headTurn,
        eyeL: clamp(out.eyeL * this.blinkL, .02, 1), eyeR: clamp(out.eyeR * this.blinkR, .02, 1),
        mouthOpen, breath,
        globalBob: g.bob || 0, globalX: g.shake || 0, gestureSquash: g.squash || 0,
        armL: out.armL + (g.arms || 0), armR: out.armR + (g.arms || 0) + (g.armR || 0),
        hairL: this.hairL.value, hairR: this.hairR.value
      });
      return out;
    }
  }

  class MeshRenderer {
    constructor(canvas, fxCanvas, config, qaMode = false) {
      this.canvas = canvas; this.fxCanvas = fxCanvas; this.fx = fxCanvas.getContext('2d');
      this.config = config; this.qaMode = qaMode;
      this.gl = canvas.getContext('webgl2', { alpha:true, antialias:true, premultipliedAlpha:false, preserveDrawingBuffer:qaMode });
      this.fallback = !this.gl; this.ctx2d = this.fallback ? canvas.getContext('2d', { alpha:true }) : null;
      this.image = null; this.texture = null; this.program = null; this.vertices = []; this.indices = []; this.uvs = []; this.lastLayout = null; this.meshVisible = false;
      this.initMesh(); if (!this.fallback) this.initGL();
    }
    initMesh() {
      const xs = this.config.mesh.xStops, ys = this.config.mesh.yStops;
      for (let y = 0; y < ys.length; y++) for (let x = 0; x < xs.length; x++) this.vertices.push({ u:xs[x], v:ys[y], x:0, y:0 });
      for (let y = 0; y < ys.length - 1; y++) for (let x = 0; x < xs.length - 1; x++) {
        const i = y * xs.length + x, r = i + 1, d = i + xs.length, dr = d + 1; this.indices.push(i,d,r, r,d,dr);
      }
      const [ax,ay,aw,ah] = this.config.atlas.characterCrop;
      for (const p of this.vertices) this.uvs.push((ax+p.u*aw)/this.config.atlas.width, (ay+p.v*ah)/this.config.atlas.height);
    }
    shader(type, source) {
      const gl=this.gl, s=gl.createShader(type); gl.shaderSource(s,source); gl.compileShader(s);
      if (!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s;
    }
    initGL() {
      const gl=this.gl;
      const vs=this.shader(gl.VERTEX_SHADER,`#version 300 es\nprecision highp float;\nin vec2 a_position;\nin vec2 a_uv;\nuniform vec2 u_resolution;\nout vec2 v_uv;\nvoid main(){vec2 p=a_position/u_resolution*2.0-1.0;gl_Position=vec4(p.x,-p.y,0,1);v_uv=a_uv;}`);
      const fs=this.shader(gl.FRAGMENT_SHADER,`#version 300 es\nprecision mediump float;\nin vec2 v_uv;\nuniform sampler2D u_texture;\nout vec4 outColor;\nvoid main(){vec4 c=texture(u_texture,v_uv);if(c.a<0.004)discard;outColor=c;}`);
      const p=gl.createProgram(); gl.attachShader(p,vs); gl.attachShader(p,fs); gl.linkProgram(p);
      if (!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      this.program=p; gl.useProgram(p);
      this.aPosition=gl.getAttribLocation(p,'a_position'); this.aUV=gl.getAttribLocation(p,'a_uv'); this.uResolution=gl.getUniformLocation(p,'u_resolution');
      this.positionBuffer=gl.createBuffer(); this.uvBuffer=gl.createBuffer(); this.indexBuffer=gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER,this.uvBuffer); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(this.uvs),gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.indexBuffer); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(this.indices),gl.STATIC_DRAW);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    }
    async load(url) {
      const img = new Image(); img.decoding='async'; img.src=url; await img.decode(); this.image=img;
      if (!this.fallback) {
        const gl=this.gl, tex=gl.createTexture(); this.texture=tex; gl.bindTexture(gl.TEXTURE_2D,tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
      }
      return img;
    }
    resize() {
      const dpr=Math.min(2,window.devicePixelRatio||1), rect=this.canvas.getBoundingClientRect();
      const w=Math.max(1,Math.round(rect.width*dpr)), h=Math.max(1,Math.round(rect.height*dpr));
      if (this.canvas.width!==w||this.canvas.height!==h) { this.canvas.width=w; this.canvas.height=h; this.fxCanvas.width=w; this.fxCanvas.height=h; }
      return { w,h,dpr };
    }
    layout(w,h) {
      const disp=this.config.display, charH=Math.min(h*disp.heightRatio,disp.maxHeight*(w/720)), charW=charH*this.config.atlas.characterCrop[2]/this.config.atlas.characterCrop[3];
      return { x:w*disp.centerXRatio-charW/2, y:h*disp.topRatio, w:charW, h:charH };
    }
    deformPoint(u,v,p,L) {
      let x=L.x+u*L.w, y=L.y+v*L.h;
      y += p.globalBob; x += p.globalX;
      const torso=band(v,.42,.76,.08);
      x += (u-.5)*L.w*(p.breath*.012 + p.bodySquash*.05 + p.gestureSquash*.06)*torso;
      y += p.breath*2.2*torso;
      const bodyInf=smooth((v-.37)/.28);
      [x,y]=rotate(x,y,L.x+L.w*.5,L.y+L.h*.57,(p.bodyLean*bodyInf)*Math.PI/180);
      const headInf=1-smooth((v-.46)/.15), hpX=L.x+L.w*.5, hpY=L.y+L.h*.34;
      const headScaleX=1-Math.abs(p.headTurn)*.055;
      x=hpX+(x-hpX)*(1+(headScaleX-1)*headInf);
      x += p.headTurn*L.w*.075*headInf*(.7+.3*(1-Math.abs(u-.5)*2));
      y += p.headY*headInf + Math.abs(p.headTurn)*L.h*.008*headInf;
      const rr=rotate(x,y,hpX,hpY,p.headAngle*Math.PI/180*headInf); x=rr[0]; y=rr[1];
      const upper=1-smooth((v-.02)/.46), leftOuter=smooth((.38-u)/.32)*upper, rightOuter=smooth((u-.62)/.32)*upper;
      x += p.hairL*14*leftOuter + p.hairR*14*rightOuter; y += Math.abs(p.hairL)*2.5*leftOuter + Math.abs(p.hairR)*2.5*rightOuter;
      const f=this.config.face;
      const eyeWarp=(cx,cy,open)=>{ const wx=bell(u,cx,.145), wy=bell(v,cy,.082), inf=wx*wy; if(inf<=0)return; const targetY=L.y+cy*L.h+(v-cy)*L.h*(.12+.88*open); y=lerp(y,targetY,inf*(1-open)*.88); };
      eyeWarp(f.leftEye[0],f.leftEye[1],p.eyeL); eyeWarp(f.rightEye[0],f.rightEye[1],p.eyeR);
      const browBand=bell(v,f.browY,.055);
      if(browBand>0){ const side=u<.5?-1:1, inner=1-clamp(Math.abs(u-.5)/.24); y += p.browMood*side*(u-.5)*-13*browBand + (-p.browMood)*inner*2.4*browBand; }
      const mx=f.mouth[0], my=f.mouth[1], mi=bell(u,mx,.15)*bell(v,my,.075);
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
      return { x,y };
    }
    updateMesh(p,w,h) {
      const L=this.layout(w,h); this.lastLayout=L; const out=new Float32Array(this.vertices.length*2);
      for(let i=0;i<this.vertices.length;i++){ const v=this.vertices[i], q=this.deformPoint(v.u,v.v,p,L); v.x=q.x; v.y=q.y; out[i*2]=q.x; out[i*2+1]=q.y; }
      return out;
    }
    render(p, emotionId) {
      if(!this.image)return; const {w,h}=this.resize(), positions=this.updateMesh(p,w,h);
      if(this.fallback){ const c=this.ctx2d; c.clearRect(0,0,w,h); const L=this.lastLayout, crop=this.config.atlas.characterCrop; c.save(); c.translate(w/2+p.globalX,h*.52+p.globalBob); c.rotate((p.bodyLean+p.headAngle*.2)*Math.PI/180); c.translate(-w/2,-h*.52); c.drawImage(this.image,...crop,L.x,L.y,L.w,L.h); c.restore(); }
      else { const gl=this.gl; gl.viewport(0,0,w,h); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT); gl.useProgram(this.program); gl.uniform2f(this.uResolution,w,h); gl.bindTexture(gl.TEXTURE_2D,this.texture); gl.bindBuffer(gl.ARRAY_BUFFER,this.positionBuffer); gl.bufferData(gl.ARRAY_BUFFER,positions,gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(this.aPosition); gl.vertexAttribPointer(this.aPosition,2,gl.FLOAT,false,0,0); gl.bindBuffer(gl.ARRAY_BUFFER,this.uvBuffer); gl.enableVertexAttribArray(this.aUV); gl.vertexAttribPointer(this.aUV,2,gl.FLOAT,false,0,0); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.indexBuffer); gl.drawElements(gl.TRIANGLES,this.indices.length,gl.UNSIGNED_SHORT,0); }
      this.drawFX(p,emotionId,w,h);
    }
    facePoint(u,v,p){ return this.deformPoint(u,v,p,this.lastLayout); }
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
      if(p.blush>.02){ c.save(); c.globalAlpha=clamp(p.blush)*.28; for(const q of [lp,rp]){const g=c.createRadialGradient(q.x,q.y,0,q.x,q.y,16*scale);g.addColorStop(0,'rgba(255,91,145,.9)');g.addColorStop(1,'rgba(255,91,145,0)');c.fillStyle=g;c.beginPath();c.arc(q.x,q.y,16*scale,0,TAU);c.fill();} c.restore(); }
      if(p.tears>.04){ c.save(); c.fillStyle=`rgba(125,205,255,${.18+.55*p.tears})`; const le=this.facePoint(f.leftEye[0],f.leftEye[1]+.045,p), re=this.facePoint(f.rightEye[0],f.rightEye[1]+.045,p); for(const q of [le,re]){c.beginPath();c.ellipse(q.x,q.y+7*scale,4*scale,10*scale,.1,0,TAU);c.fill();} c.restore(); }
      if(p.sick>.03){ const q=this.facePoint(.5,.31,p); c.save(); const g=c.createRadialGradient(q.x,q.y,0,q.x,q.y,90*scale);g.addColorStop(0,`rgba(125,210,132,${.12*p.sick})`);g.addColorStop(1,'rgba(125,210,132,0)');c.fillStyle=g;c.beginPath();c.arc(q.x,q.y,90*scale,0,TAU);c.fill();c.restore(); }
      const t=performance.now()/1000;
      if(p.sparkle>.05){ c.save(); c.globalAlpha=.25+.55*p.sparkle; c.fillStyle='#ffd8ed'; c.font=`${18*scale}px system-ui`; for(let i=0;i<4;i++){const a=t*.7+i*1.7,q=this.facePoint(.5,.25,p);c.fillText(i%2?'✦':'✧',q.x+Math.cos(a)*120*scale,q.y+Math.sin(a*1.3)*80*scale);}c.restore(); }
      if(p.love>.05){ const q=this.facePoint(.5,.21,p); c.save(); c.fillStyle='#ff649f'; c.globalAlpha=.4+.5*p.love; c.font=`${20*scale}px system-ui`; for(let i=0;i<4;i++){const phase=(t*.45+i*.27)%1;c.fillText('♥',q.x+(i-1.5)*48*scale+Math.sin(t*2+i)*9*scale,q.y-20*scale-phase*90*scale);}c.restore(); }
      if(p.anger>.05){ const q=this.facePoint(.78,.17,p); c.save(); c.strokeStyle=`rgba(255,75,94,${.35+.55*p.anger})`;c.lineWidth=3*scale;c.lineCap='round';const s=12*scale;c.beginPath();c.moveTo(q.x-s,q.y);c.lineTo(q.x,q.y-s);c.moveTo(q.x,q.y-s);c.lineTo(q.x+s,q.y);c.moveTo(q.x+s,q.y);c.lineTo(q.x,q.y+s);c.stroke();c.restore(); }
      if(p.fear>.05){ const q=this.facePoint(.78,.22,p); c.save(); c.fillStyle=`rgba(129,206,255,${.3+.55*p.fear})`;c.beginPath();c.ellipse(q.x+8*scale,q.y-4*scale,5*scale,12*scale,-.2,0,TAU);c.fill();c.restore(); }
      if(this.meshVisible&&!this.fallback){ c.save();c.strokeStyle='rgba(107,220,255,.26)';c.lineWidth=1;const xs=this.config.mesh.xStops,ys=this.config.mesh.yStops;for(let yi=0;yi<ys.length;yi++){c.beginPath();for(let xi=0;xi<xs.length;xi++){const v=this.vertices[yi*xs.length+xi];xi?c.lineTo(v.x,v.y):c.moveTo(v.x,v.y);}c.stroke();}for(let xi=0;xi<xs.length;xi++){c.beginPath();for(let yi=0;yi<ys.length;yi++){const v=this.vertices[yi*xs.length+xi];yi?c.lineTo(v.x,v.y):c.moveTo(v.x,v.y);}c.stroke();}c.restore(); }
    }
  }

  window.JiraiRig = { Spring, MotionController, MeshRenderer, EMOTIONS, PARAM_DEFAULTS, clamp, smooth };
})();
