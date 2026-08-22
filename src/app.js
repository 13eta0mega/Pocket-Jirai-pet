(() => {
  'use strict';
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const qs=new URLSearchParams(location.search), qaMode=qs.has('qa');
  const state={ready:false,fps:0,renderer:'--',assetLoaded:false,current:'neutral',mic:null,analyser:null,micData:null,errors:[],assetMode:'--',sheetCount:0,configVersion:'--',configUrl:'--'};
  const ui={canvas:$('#rigCanvas'),fx:$('#fxCanvas'),grid:$('#emotionGrid'),fps:$('#fpsChip'),renderer:$('#rendererChip'),asset:$('#assetChip'),emotion:$('#emotionLabel'),motion:$('#motionLabel'),lipTest:$('#lipTest'),micBtn:$('#micBtn'),mouth:$('#mouthSlider'),mouthValue:$('#mouthValue'),breath:$('#breathToggle'),blink:$('#blinkToggle'),mesh:$('#meshToggle'),autoCycle:$('#autoCycleBtn'),neutral:$('#neutralBtn'),status:$('#statusText'),wave:$('#wave'),parts:$('#partsNow')};
  let config,rig,renderer,last=performance.now(),frames=[],cycleTimer=0,running=true;
  const clamp01=v=>Math.max(0,Math.min(1,Number(v)||0));
  const recordError=e=>{const msg=e instanceof Error?(e.stack||e.message):String(e);state.errors.push(msg);console.error(e);if(ui.status)ui.status.textContent='오류: '+msg.split('\n')[0];};
  window.addEventListener('error',e=>recordError(e.error||e.message));
  window.addEventListener('unhandledrejection',e=>recordError(e.reason));

  function buildWave(){for(let i=0;i<28;i++){const b=document.createElement('i');b.style.setProperty('--i',i);ui.wave.appendChild(b);}}
  function buildEmotionButtons(){for(const[id,def]of Object.entries(JiraiRig.EMOTIONS)){const b=document.createElement('button');b.type='button';b.dataset.emotion=id;b.innerHTML=`<span>${def.label}</span><small>${id}</small>`;b.addEventListener('click',()=>setEmotion(id));ui.grid.appendChild(b);}}
  function setEmotion(id){if(!rig||!JiraiRig.EMOTIONS[id])return;rig.applyEmotion(id);state.current=id;ui.emotion.textContent=JiraiRig.EMOTIONS[id].label;ui.motion.textContent=JiraiRig.EMOTIONS[id].gesture;$$('.emotion-grid button').forEach(b=>b.classList.toggle('active',b.dataset.emotion===id));}
  function updateWave(level){[...ui.wave.children].forEach((b,i)=>{const q=.25+.75*Math.abs(Math.sin(i*.73+performance.now()*.004));b.style.transform=`scaleY(${.2+level*q*1.15})`;});}

  async function toggleMic(){
    if(state.mic){state.mic.getTracks().forEach(t=>t.stop());state.mic=null;state.analyser=null;rig.setMicActive(false);ui.micBtn.classList.remove('active');ui.micBtn.textContent='마이크 입력';return;}
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
      const ac=new(window.AudioContext||window.webkitAudioContext)(),source=ac.createMediaStreamSource(stream),analyser=ac.createAnalyser();
      analyser.fftSize=512;
      analyser.smoothingTimeConstant=.72;
      source.connect(analyser);
      state.mic=stream;state.analyser=analyser;state.micData=new Uint8Array(analyser.fftSize);
      rig.setMicActive(true);ui.lipTest.checked=false;rig.setLipTest(false);ui.micBtn.classList.add('active');ui.micBtn.textContent='마이크 끄기';
    }catch(e){recordError(e);}
  }
  function updateMic(){
    if(!state.analyser)return;
    state.analyser.getByteTimeDomainData(state.micData);
    let sum=0;for(const v of state.micData){const n=(v-128)/128;sum+=n*n;}
    const rms=Math.sqrt(sum/state.micData.length),g=Math.max(0,(rms-.018)*6.1);
    rig.setMicLevel(Math.min(1,g));
  }

  function tick(now){
    if(!running)return;requestAnimationFrame(tick);
    const dt=Math.min(.04,(now-last)/1000||.016);last=now;updateMic();
    const p=rig.update(now,dt,qaMode);
    if(!ui.blink.checked)p.blinkOpen=1;if(!ui.breath.checked)p.breath=0;
    renderer.debug=ui.mesh.checked;renderer.render(p,state.current);updateWave(p.mouthOpen);
    ui.mouthValue.textContent=p.mouthOpen.toFixed(2);
    frames.push(now);while(frames.length&&frames[0]<now-1000)frames.shift();state.fps=frames.length;ui.fps.textContent=`${state.fps} FPS`;
    const parts=renderer.partSnapshot||{};
    ui.parts.textContent=`Eyes ${parts.eyes||'-'} · Brows ${parts.brows||'-'} · Mouth ${parts.mouth||'-'} · Arms ${parts.arms||'-'} · Legs ${parts.legs||'-'}`;
    if(state.ready)ui.status.textContent=`${JiraiRig.EMOTIONS[state.current].label} · ${state.configVersion}`;
    window.__JIRAI_QA_STATE__={...p,emotion:state.current};
  }

  function wireUI(){
    ui.lipTest.addEventListener('change',()=>{rig.setLipTest(ui.lipTest.checked);if(ui.lipTest.checked&&state.mic)toggleMic();});
    ui.micBtn.addEventListener('click',toggleMic);
    ui.mouth.addEventListener('input',()=>{rig.setManualMouth(ui.mouth.value);if(+ui.mouth.value>0){ui.lipTest.checked=false;rig.setLipTest(false);}});
    ui.autoCycle.addEventListener('click',()=>{if(cycleTimer){clearInterval(cycleTimer);cycleTimer=0;ui.autoCycle.textContent='감정 자동 순환';return;}const ids=Object.keys(JiraiRig.EMOTIONS);let i=ids.indexOf(state.current);setEmotion(ids[(++i)%ids.length]);cycleTimer=setInterval(()=>setEmotion(ids[(++i)%ids.length]),2600);ui.autoCycle.textContent='자동 순환 정지';});
    ui.neutral.addEventListener('click',()=>{if(cycleTimer){clearInterval(cycleTimer);cycleTimer=0;ui.autoCycle.textContent='감정 자동 순환';}ui.mouth.value=0;rig.setManualMouth(0);ui.lipTest.checked=false;rig.setLipTest(false);setEmotion('neutral');});
  }

  async function loadRuntimeConfig(){
    const candidates=['config/jirai-v13-atlas.json','config/jirai-v12-atlas.json','config/jirai-v12.json'];
    let lastError=null;
    for(const url of candidates){
      try{const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error(`${url} ${response.status}`);return{config:await response.json(),url};}
      catch(e){lastError=e;}
    }
    throw lastError||new Error('runtime config load failed');
  }

  async function boot(){
    try{
      buildWave();buildEmotionButtons();wireUI();
      const loaded=await loadRuntimeConfig();config=loaded.config;state.configUrl=loaded.url;state.configVersion=config.version||'--';state.sheetCount=Object.keys(config.sheets||{}).length;
      state.assetMode=state.configVersion.startsWith('1.3')?'v13-active-atlas':(config.atlas?.offlineClean?'active58-atlas':'source-sheets');
      rig=new JiraiRig.MotionController(config);renderer=new JiraiRig.PartAtlasRenderer(ui.canvas,ui.fx,config);state.renderer=renderer.label;ui.renderer.textContent=state.renderer;
      await renderer.load();state.assetLoaded=true;ui.asset.textContent=`${state.sheetCount} atlas / ${Object.keys(config.parts||{}).length} active OK`;ui.asset.classList.add('ok');
      setEmotion(qs.get('emotion')||'neutral');
      if(qs.has('mouth')){const v=clamp01(qs.get('mouth'));ui.mouth.value=v;rig.setManualMouth(v);}
      state.ready=true;ui.status.textContent=`${state.configVersion} 준비 완료`;if(qs.has('blink'))setTimeout(()=>rig.forceBlink(),120);requestAnimationFrame(tick);
    }catch(e){recordError(e);ui.asset.textContent='Asset FAIL';}
  }

  window.__JIRAI_QA__={
    get ready(){return state.ready;},
    setEmotion:id=>setEmotion(id),
    setMouth:v=>{ui.mouth.value=v;rig.setManualMouth(v);},
    setLipTest:v=>{ui.lipTest.checked=!!v;rig.setLipTest(!!v);},
    forceBlink:()=>rig.forceBlink(),
    snapshot:()=>({ready:state.ready,renderer:state.renderer,assetLoaded:state.assetLoaded,emotion:state.current,fps:state.fps,errors:[...state.errors],assetMode:state.assetMode,sheetCount:state.sheetCount,configVersion:state.configVersion,configUrl:state.configUrl,params:{...window.__JIRAI_QA_STATE__},parts:{...(renderer?.partSnapshot||{})},buttonCount:ui.grid.children.length,mesh:renderer?.meshHealth?.()||null,mouthSprite:renderer?.lastMouthSprite||'M01',browSprite:renderer?.lastBrowSprite||'-',eyeSprite:renderer?.lastEyeSprite||'E01/E02',armPose:renderer?.lastArmPose||'down',visemeIndex:renderer?.lastVisemeIndex??null}),
    stop:()=>{running=false;}
  };
  boot();
})();
