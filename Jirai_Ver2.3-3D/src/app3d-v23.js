import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { EMOTIONS, CALIBRATION } from './v23-config.js';
import { installRig, updateRig, setMaterialQuality, disposeObject } from './v23-rig.js';

const $=s=>document.querySelector(s);
const ui={canvas:$('#gl'),fps:$('#fps'),meshInfo:$('#meshInfo'),status:$('#status'),modelName:$('#modelName'),fileInput:$('#fileInput'),pickBtn:$('#pickBtn'),restoreBtn:$('#restoreBtn'),empty:$('#emptyState'),dropZone:$('#dropZone'),reset:$('#resetCamera'),idle:$('#idleToggle'),deform:$('#deformToggle'),face:$('#faceToggle'),hair:$('#hairToggle'),blink:$('#blinkToggle'),lipTest:$('#lipTest'),micBtn:$('#micBtn'),mouth:$('#mouthSlider'),mouthValue:$('#mouthValue'),grid:$('#gridToggle'),zoom:$('#zoomSlider'),zoomValue:$('#zoomValue'),emotions:$('#emotionButtons'),motionLabel:$('#motionLabel'),cycle:$('#cycleBtn'),vertex:$('#vertexCount'),tri:$('#triCount'),meshes:$('#meshCount'),badge:$('#diagnosticBadge'),skin:$('#skinInfo'),anim:$('#animInfo'),material:$('#materialInfo'),texture:$('#textureInfo'),size:$('#sizeInfo'),rigMode:$('#rigMode'),faceState:$('#faceState')};
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const smoothstep=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const lerp=(a,b,t)=>a+(b-a)*t;

const renderer=new THREE.WebGLRenderer({canvas:ui.canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.shadowMap.enabled=false;renderer.setClearColor(0x100c14,1);
const scene=new THREE.Scene();scene.background=new THREE.Color(0x100c14);const camera=new THREE.PerspectiveCamera(30,1,.001,1000);
scene.add(new THREE.HemisphereLight(0xffe7f3,0x2a2132,2.25));const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(-3,4,5);scene.add(key);const fill=new THREE.DirectionalLight(0xff8fc1,1.05);fill.position.set(3,1,2);scene.add(fill);const rim=new THREE.DirectionalLight(0x98bfff,.65);rim.position.set(1,2,-4);scene.add(rim);const grid=new THREE.GridHelper(4,20,0x56374a,0x2c2231);grid.visible=false;scene.add(grid);const root=new THREE.Group();scene.add(root);

let model=null,sourceBytes=0,last=performance.now(),frames=[],cycleTimer=0,restModelPosition=new THREE.Vector3();
let micStream=null,audioCtx=null,analyser=null,micData=null;
const frontCamera={targetY:0,distance:4,maxDim:1};
const state={emotion:'neutral',cur:{head:0,body:0,armL:0,armR:0,eyeL:1,eyeR:1,mouth:0,smile:0,browL:0,browR:0,hairL:0,hairR:0},uniforms:[],riggedMeshes:0,nextBlink:performance.now()+2600,blinkStart:0,blinking:false,mouthSmooth:0,micLevel:0};

function formatBytes(n){if(!n)return '-';const u=['B','KB','MB','GB'];let i=0,v=n;while(v>=1024&&i<u.length-1){v/=1024;i++;}return`${v.toFixed(i?2:0)} ${u[i]}`;}
function analyze(obj,file){let vertices=0,triangles=0,meshes=0,skinned=0;const materials=new Set(),textures=new Set();obj.traverse(o=>{if(!o.isMesh)return;meshes++;if(o.isSkinnedMesh)skinned++;const g=o.geometry,p=g?.getAttribute('position');if(p){vertices+=p.count;triangles+=g.index?Math.floor(g.index.count/3):Math.floor(p.count/3);}for(const m of(Array.isArray(o.material)?o.material:[o.material])){if(!m)continue;materials.add(m);setMaterialQuality(m,renderer);for(const k of Object.keys(m)){const v=m[k];if(v?.isTexture)textures.add(v);}}});const clips=obj.animations?.length||0;ui.vertex.textContent=vertices.toLocaleString();ui.tri.textContent=triangles.toLocaleString();ui.meshes.textContent=meshes.toLocaleString();ui.meshInfo.textContent=`${vertices.toLocaleString()} V / ${triangles.toLocaleString()} T`;ui.skin.textContent=skinned?`${skinned} SkinnedMesh`:'없음';ui.anim.textContent=`${clips} clips`;ui.material.textContent=materials.size.toLocaleString();ui.texture.textContent=textures.size.toLocaleString();ui.size.textContent=formatBytes(file?.size||sourceBytes);ui.badge.textContent=skinned||clips?'Rig data 있음':'Static mesh + GPU facial rig';return{vertices,triangles,meshes,skinned,materials:materials.size,textures:textures.size,clips};}
function fitModel(obj){obj.rotation.set(0,0,0);obj.scale.setScalar(1);obj.position.set(0,0,0);obj.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(obj),size=new THREE.Vector3(),center=new THREE.Vector3();box.getSize(size);box.getCenter(center);obj.position.x-=center.x;obj.position.z-=center.z;obj.position.y-=box.min.y;obj.updateMatrixWorld(true);const box2=new THREE.Box3().setFromObject(obj),size2=new THREE.Vector3();box2.getSize(size2);restModelPosition=obj.position.clone();const maxDim=Math.max(size2.x,size2.y,size2.z)||1;frontCamera.targetY=size2.y*.49;frontCamera.maxDim=maxDim;const fov=THREE.MathUtils.degToRad(camera.fov);frontCamera.distance=Math.max((size2.y*.58)/Math.tan(fov/2),maxDim*1.28);camera.near=Math.max(.001,maxDim/1200);camera.far=Math.max(100,maxDim*80);camera.updateProjectionMatrix();grid.scale.setScalar(Math.max(.2,maxDim/2));grid.position.y=0;applyZoom();}
function applyZoom(){const z=Number(ui.zoom.value||1);ui.zoomValue.textContent=`${z.toFixed(2)}×`;camera.position.set(0,frontCamera.targetY,frontCamera.distance/z);camera.lookAt(0,frontCamera.targetY,0);}

function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open('jirai-original-fbx',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('files'))r.result.createObjectStore('files');};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function cacheFile(file){try{const db=await openDB();await new Promise((resolve,reject)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').put(file,'last-fbx');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});ui.restoreBtn.hidden=false;}catch(e){console.warn('FBX cache skipped',e);}}
async function restoreCached(){try{const db=await openDB();return await new Promise((resolve,reject)=>{const tx=db.transaction('files');const r=tx.objectStore('files').get('last-fbx');r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);});}catch{return null;}}
async function loadFBXFile(file,{cache=true}={}){if(!file)return;if(!/\.fbx$/i.test(file.name||'')){ui.status.textContent='FBX 파일만 선택해 주세요';return;}ui.status.textContent='원본 FBX 읽는 중…';ui.empty.classList.remove('hidden');const buf=await file.arrayBuffer();sourceBytes=file.size;ui.status.textContent='FBX 원본 파싱 중…';await new Promise(r=>requestAnimationFrame(r));try{const obj=new FBXLoader().parse(buf,'');if(model){root.remove(model);disposeObject(model);}model=obj;root.add(model);const info=analyze(model,file);fitModel(model);const rig=installRig(model,renderer);state.uniforms=rig.uniforms;state.riggedMeshes=rig.riggedMeshes;ui.rigMode.textContent=`CALIBRATED FRONT 2.5D · ${rig.riggedMeshes} mesh`;ui.modelName.textContent=file.name;ui.status.textContent='Ver2.3 정면 캘리브레이션 완료';ui.empty.classList.add('hidden');if(cache)cacheFile(file);window.__JIRAI3D_QA__={ready:true,version:'2.3.0',source:'direct-original-fbx-fixed-front-calibrated',fileName:file.name,fileSize:file.size,...info,noDecimation:true,pseudoRig:false,fixedFront:true,gpuDeform:true,faceDeform:true,hairSecondary:true,riggedMeshes:rig.riggedMeshes,coverage:rig.coverage,calibration:CALIBRATION,videoReviewFixes:['face masks aligned to source FBX','face deform before head rotation','head mask excludes shoulders','arm mask narrowed','slower emotion transition','slower lip sync','procedural mouth interior']};}catch(e){console.error(e);ui.status.textContent=`FBX 파싱 실패: ${e.message}`;window.__JIRAI3D_QA__={ready:false,error:String(e)};}}

function buildEmotionButtons(){for(const[id,e]of Object.entries(EMOTIONS)){const b=document.createElement('button');b.type='button';b.dataset.id=id;b.innerHTML=`<span>${e.ko}</span><small>${id}</small>`;b.addEventListener('click',()=>setEmotion(id));ui.emotions.appendChild(b);}setEmotion('neutral');}
function setEmotion(id){if(!EMOTIONS[id])return;state.emotion=id;ui.motionLabel.textContent=`${EMOTIONS[id].ko} · face + motion`;document.querySelectorAll('.emotion-grid button').forEach(b=>b.classList.toggle('active',b.dataset.id===id));}
function resetFront(){if(!model)return;model.position.copy(restModelPosition);model.rotation.set(0,0,0);Object.assign(state.cur,{head:0,body:0,armL:0,armR:0,eyeL:1,eyeR:1,mouth:0,smile:0,browL:0,browR:0,hairL:0,hairR:0});state.mouthSmooth=0;ui.mouth.value='0';ui.zoom.value='1';applyZoom();setEmotion('neutral');}
function blinkScale(now){if(!ui.blink.checked)return 1;if(!state.blinking&&now>=state.nextBlink){state.blinking=true;state.blinkStart=now;}if(!state.blinking)return 1;const t=(now-state.blinkStart)/260;if(t>=1){state.blinking=false;state.nextBlink=now+3000+Math.random()*3600;return 1;}return .16+.84*Math.abs(Math.cos(Math.PI*t));}
function lipTarget(now){if(analyser){analyser.getByteTimeDomainData(micData);let sum=0;for(const v of micData){const n=(v-128)/128;sum+=n*n;}state.micLevel=clamp((Math.sqrt(sum/micData.length)-.014)*7);return state.micLevel;}if(ui.lipTest.checked){const sec=now*.001,phrase=sec%6.4;if(phrase>4.8)return 0;const env=smoothstep(0,.48,phrase)*(1-smoothstep(4.2,4.8,phrase));const syllable=Math.abs(Math.sin(sec*2.15))*.46+Math.abs(Math.sin(sec*3.55+.65))*.27+.035;return clamp(syllable*env,0,.72);}return Number(ui.mouth.value||0);}
async function toggleMic(){if(micStream){micStream.getTracks().forEach(t=>t.stop());micStream=null;analyser=null;if(audioCtx)await audioCtx.close().catch(()=>{});audioCtx=null;ui.micBtn.textContent='마이크 입력';ui.micBtn.classList.remove('active');return;}try{micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});audioCtx=new(window.AudioContext||window.webkitAudioContext)();const src=audioCtx.createMediaStreamSource(micStream);analyser=audioCtx.createAnalyser();analyser.fftSize=512;analyser.smoothingTimeConstant=.80;src.connect(analyser);micData=new Uint8Array(analyser.fftSize);ui.lipTest.checked=false;ui.micBtn.textContent='마이크 끄기';ui.micBtn.classList.add('active');}catch(e){console.error(e);ui.status.textContent='마이크 권한을 사용할 수 없습니다';}}

ui.fileInput.addEventListener('change',()=>loadFBXFile(ui.fileInput.files?.[0]));ui.pickBtn.addEventListener('click',()=>ui.fileInput.click());ui.reset.addEventListener('click',resetFront);ui.grid.addEventListener('change',()=>grid.visible=ui.grid.checked);ui.zoom.addEventListener('input',applyZoom);ui.restoreBtn.addEventListener('click',async()=>{const f=await restoreCached();if(f)loadFBXFile(f,{cache:false});});ui.micBtn.addEventListener('click',toggleMic);
ui.cycle.addEventListener('click',()=>{if(cycleTimer){clearInterval(cycleTimer);cycleTimer=0;ui.cycle.textContent='16종 자동 순환';return;}const ids=Object.keys(EMOTIONS);let i=ids.indexOf(state.emotion);setEmotion(ids[(++i)%ids.length]);cycleTimer=setInterval(()=>setEmotion(ids[(++i)%ids.length]),3200);ui.cycle.textContent='자동 순환 정지';});
for(const type of['dragenter','dragover'])ui.dropZone.addEventListener(type,e=>{e.preventDefault();ui.dropZone.classList.add('dragover');});for(const type of['dragleave','drop'])ui.dropZone.addEventListener(type,e=>{e.preventDefault();ui.dropZone.classList.remove('dragover');});ui.dropZone.addEventListener('drop',e=>{const f=[...e.dataTransfer.files].find(x=>/\.fbx$/i.test(x.name));if(f)loadFBXFile(f);});
function resize(){const r=ui.canvas.getBoundingClientRect(),w=Math.max(2,Math.floor(r.width)),h=Math.max(2,Math.floor(r.height));renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
function loop(now){
  requestAnimationFrame(loop);resize();const dt=Math.min(.05,(now-last)/1000||.016);last=now;
  if(model){
    const e=EMOTIONS[state.emotion],sec=now*.001,idle=ui.idle.checked,blink=blinkScale(now);
    const microHead=idle?Math.sin(sec*.58)*(.18+e.energy*.16):0;
    const microBody=idle?Math.sin(sec*.44)*.12:0;
    const bounce=idle?Math.sin(sec*(.82+e.energy*.25))*frontCamera.maxDim*(.00045+.00065*e.energy):0;
    const breath=idle?(.5+.5*Math.sin(sec*1.08))*(.28+.18*e.energy):0;
    const accent=Math.sin(sec*3.2)*e.energy*.34;
    const rawLip=clamp(lipTarget(now),0,.72);
    const tau=rawLip>state.mouthSmooth?.16:.27,aLip=1-Math.exp(-dt/tau);
    state.mouthSmooth+=(rawLip-state.mouthSmooth)*aLip;
    if(rawLip<.035&&state.mouthSmooth<.045)state.mouthSmooth=0;
    const kBody=1-Math.exp(-dt*3.8),kFace=1-Math.exp(-dt*5.2),kEye=1-Math.exp(-dt*8.0);
    state.cur.head=lerp(state.cur.head,e.head+microHead,kBody);
    state.cur.body=lerp(state.cur.body,e.body+microBody,kBody);
    state.cur.armL=lerp(state.cur.armL,e.armL-accent,kBody);
    state.cur.armR=lerp(state.cur.armR,e.armR+accent,kBody);
    state.cur.eyeL=lerp(state.cur.eyeL,clamp(e.eyeL*blink,.16,1.12),kEye);
    state.cur.eyeR=lerp(state.cur.eyeR,clamp(e.eyeR*blink,.16,1.12),kEye);
    state.cur.mouth=lerp(state.cur.mouth,clamp(Math.max(e.mouth,state.mouthSmooth),0,.72),kFace);
    state.cur.smile=lerp(state.cur.smile,e.smile,kFace);
    state.cur.browL=lerp(state.cur.browL,e.browL,kFace);
    state.cur.browR=lerp(state.cur.browR,e.browR,kFace);
    const hairWave=Math.sin(sec*.92+state.cur.head*.08)*(.18+e.energy*.12);
    state.cur.hairL=lerp(state.cur.hairL,-state.cur.head*.08+hairWave,1-Math.exp(-dt*2.8));
    state.cur.hairR=lerp(state.cur.hairR,-state.cur.head*.08-hairWave,1-Math.exp(-dt*2.8));
    model.position.copy(restModelPosition);model.position.y+=bounce;
    model.rotation.set(0,0,THREE.MathUtils.degToRad(state.cur.body*.13));
    updateRig(state.uniforms,{...state.cur,breath},{body:ui.deform.checked,face:ui.face.checked,hair:ui.hair.checked});
    ui.mouthValue.textContent=state.cur.mouth.toFixed(2);
    ui.faceState.textContent=`Eye ${state.cur.eyeL.toFixed(2)}/${state.cur.eyeR.toFixed(2)} · Mouth ${state.cur.mouth.toFixed(2)} · Head ${state.cur.head.toFixed(1)}°`;
    if(window.__JIRAI3D_QA__)Object.assign(window.__JIRAI3D_QA__,{emotion:state.emotion,eyeL:state.cur.eyeL,eyeR:state.cur.eyeR,mouthOpen:state.cur.mouth,mouthRaw:rawLip,blinkActive:state.blinking,hairL:state.cur.hairL,hairR:state.cur.hairR,head:state.cur.head,body:state.cur.body,fixedFront:true});
  }
  renderer.render(scene,camera);frames.push(now);while(frames.length&&frames[0]<now-1000)frames.shift();ui.fps.textContent=`${frames.length} FPS`;
}

buildEmotionButtons();restoreCached().then(f=>{if(f){ui.restoreBtn.hidden=false;ui.status.textContent='저장된 원본 FBX 자동 복원 중…';loadFBXFile(f,{cache:false});}else ui.status.textContent='원본 FBX 파일을 선택해 주세요';});requestAnimationFrame(loop);
