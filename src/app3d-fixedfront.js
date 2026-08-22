import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const $ = (s) => document.querySelector(s);
const ui = {
  canvas: $('#gl'), fps: $('#fps'), meshInfo: $('#meshInfo'), status: $('#status'), modelName: $('#modelName'),
  fileInput: $('#fileInput'), pickBtn: $('#pickBtn'), restoreBtn: $('#restoreBtn'), empty: $('#emptyState'), dropZone: $('#dropZone'),
  reset: $('#resetCamera'), idle: $('#idleToggle'), deform: $('#deformToggle'), grid: $('#gridToggle'), zoom: $('#zoomSlider'), zoomValue: $('#zoomValue'),
  emotions: $('#emotionButtons'), motionLabel: $('#motionLabel'), cycle: $('#cycleBtn'),
  vertex: $('#vertexCount'), tri: $('#triCount'), meshes: $('#meshCount'), badge: $('#diagnosticBadge'), skin: $('#skinInfo'), anim: $('#animInfo'),
  material: $('#materialInfo'), texture: $('#textureInfo'), size: $('#sizeInfo'), rigMode: $('#rigMode')
};

const EMOTIONS = {
  neutral:{ko:'기본',head:0,body:0,armL:0,armR:0,energy:.10},
  happy:{ko:'행복',head:-2,body:.8,armL:-2.5,armR:2.5,energy:.35},
  excited:{ko:'신남',head:1,body:0,armL:-9,armR:9,energy:1},
  teasing:{ko:'장난',head:-6,body:-1.2,armL:-8,armR:1.5,energy:.55},
  pleading:{ko:'울망',head:4,body:.8,armL:3,armR:-3,energy:.12},
  relaxed:{ko:'느긋',head:-3,body:1.2,armL:1,armR:-1,energy:.08},
  sick:{ko:'아픔',head:5,body:1.8,armL:1,armR:-1,energy:.03},
  angry:{ko:'화남',head:-1.5,body:-1.8,armL:3.5,armR:-3.5,energy:.70},
  annoyed:{ko:'삐짐',head:-5,body:1,armL:2,armR:-2,energy:.12},
  sad:{ko:'슬픔',head:5,body:1.4,armL:2,armR:-2,energy:.04},
  surprised:{ko:'놀람',head:0,body:0,armL:-7,armR:7,energy:.82},
  embarrassed:{ko:'부끄러움',head:3.5,body:.7,armL:2.5,armR:-2.5,energy:.16},
  scared:{ko:'겁남',head:2,body:.9,armL:3.5,armR:-3.5,energy:.65},
  smug:{ko:'의기양양',head:-4,body:-1,armL:1.5,armR:-1.5,energy:.20},
  confused:{ko:'갸웃',head:6,body:0,armL:-1.5,armR:1.5,energy:.20},
  love:{ko:'좋아!',head:-2,body:0,armL:2.5,armR:-2.5,energy:.60}
};

const renderer = new THREE.WebGLRenderer({canvas:ui.canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1;
renderer.shadowMap.enabled=false;
renderer.setClearColor(0x100c14,1);

const scene=new THREE.Scene();scene.background=new THREE.Color(0x100c14);
const camera=new THREE.PerspectiveCamera(30,1,.001,1000);
scene.add(new THREE.HemisphereLight(0xffe7f3,0x2a2132,2.25));
const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(-3,4,5);scene.add(key);
const fill=new THREE.DirectionalLight(0xff8fc1,1.05);fill.position.set(3,1,2);scene.add(fill);
const rim=new THREE.DirectionalLight(0x98bfff,.65);rim.position.set(1,2,-4);scene.add(rim);
const grid=new THREE.GridHelper(4,20,0x56374a,0x2c2231);grid.visible=false;scene.add(grid);
const root=new THREE.Group();scene.add(root);

let model=null,modelInfo=null,sourceBytes=0,last=performance.now(),frames=[],cycleTimer=0;
let restModelPosition=new THREE.Vector3();
let frontCamera={targetY:0,distance:4,maxDim:1};
const state={emotion:'neutral',cur:{head:0,body:0,armL:0,armR:0},uniforms:[],riggedMeshes:0,bbox:null};

function formatBytes(n){if(!n)return '-';const u=['B','KB','MB','GB'];let i=0,v=n;while(v>=1024&&i<u.length-1){v/=1024;i++;}return `${v.toFixed(i?2:0)} ${u[i]}`;}
function clamp(v,a=0,b=1){return Math.min(b,Math.max(a,v));}
function smoothstep(a,b,x){const t=clamp((x-a)/(b-a));return t*t*(3-2*t);}
function lerp(a,b,t){return a+(b-a)*t;}
function disposeObject(obj){obj.traverse(o=>{if(o.geometry)o.geometry.dispose?.();const mats=Array.isArray(o.material)?o.material:[o.material];for(const m of mats){if(!m)continue;for(const k of Object.keys(m)){const v=m[k];if(v?.isTexture)v.dispose?.();}m.dispose?.();}});}
function setMaterialQuality(m){if(!m)return;m.side=THREE.FrontSide;m.transparent=!!m.transparent;m.alphaTest=m.alphaTest||0;if(m.map){m.map.colorSpace=THREE.SRGBColorSpace;m.map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());m.map.needsUpdate=true;}if(m.emissiveMap)m.emissiveMap.colorSpace=THREE.SRGBColorSpace;m.needsUpdate=true;}

function analyze(obj,file){let vertices=0,triangles=0,meshes=0,skinned=0;const materials=new Set(),textures=new Set();obj.traverse(o=>{if(!o.isMesh)return;meshes++;if(o.isSkinnedMesh)skinned++;const g=o.geometry;if(g){const pos=g.getAttribute('position');if(pos)vertices+=pos.count;if(g.index)triangles+=Math.floor(g.index.count/3);else if(pos)triangles+=Math.floor(pos.count/3);}const ms=Array.isArray(o.material)?o.material:[o.material];for(const m of ms){if(!m)continue;materials.add(m);setMaterialQuality(m);for(const k of Object.keys(m)){const v=m[k];if(v?.isTexture)textures.add(v);}}});const clips=obj.animations?.length||0;ui.vertex.textContent=vertices.toLocaleString();ui.tri.textContent=triangles.toLocaleString();ui.meshes.textContent=meshes.toLocaleString();ui.meshInfo.textContent=`${vertices.toLocaleString()} V / ${triangles.toLocaleString()} T`;ui.skin.textContent=skinned?`${skinned} SkinnedMesh`:'없음';ui.anim.textContent=`${clips} clips`;ui.material.textContent=materials.size.toLocaleString();ui.texture.textContent=textures.size.toLocaleString();ui.size.textContent=formatBytes(file?.size||sourceBytes);ui.badge.textContent=skinned||clips?'Rig data 있음':'Static mesh + GPU 2.5D';return{vertices,triangles,meshes,skinned,materials:materials.size,textures:textures.size,clips};}

function fitModel(obj){obj.rotation.set(0,0,0);obj.scale.setScalar(1);obj.position.set(0,0,0);obj.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(obj),size=new THREE.Vector3(),center=new THREE.Vector3();box.getSize(size);box.getCenter(center);obj.position.x-=center.x;obj.position.z-=center.z;obj.position.y-=box.min.y;obj.updateMatrixWorld(true);const box2=new THREE.Box3().setFromObject(obj),size2=new THREE.Vector3();box2.getSize(size2);state.bbox=box2.clone();restModelPosition=obj.position.clone();const maxDim=Math.max(size2.x,size2.y,size2.z)||1;frontCamera.targetY=size2.y*.49;frontCamera.maxDim=maxDim;const fov=THREE.MathUtils.degToRad(camera.fov);frontCamera.distance=Math.max((size2.y*.58)/Math.tan(fov/2),maxDim*1.28);camera.position.set(0,frontCamera.targetY,frontCamera.distance);camera.lookAt(0,frontCamera.targetY,0);camera.near=Math.max(.001,maxDim/1200);camera.far=Math.max(100,maxDim*80);camera.updateProjectionMatrix();grid.scale.setScalar(Math.max(.2,maxDim/2));grid.position.y=0;applyZoom();}
function cloneMaterials(mesh){if(Array.isArray(mesh.material))mesh.material=mesh.material.map(m=>m?.clone?.()||m);else if(mesh.material)mesh.material=mesh.material.clone();}

function installFixedFrontRig(obj){state.uniforms=[];state.riggedMeshes=0;obj.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(obj),size=new THREE.Vector3(),center=new THREE.Vector3();box.getSize(size);box.getCenter(center);const eps=1e-6;obj.traverse(mesh=>{if(!mesh.isMesh||!mesh.geometry?.getAttribute('position'))return;const g=mesh.geometry;cloneMaterials(mesh);mesh.updateMatrixWorld(true);const pos=g.getAttribute('position'),count=pos.count;const head=new Float32Array(count),armL=new Float32Array(count),armR=new Float32Array(count),torso=new Float32Array(count);const v=new THREE.Vector3();for(let i=0;i<count;i++){v.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld);const nx=(v.x-box.min.x)/(size.x||eps),ny=(v.y-box.min.y)/(size.y||eps);const sideL=smoothstep(.08,.22,.5-nx),sideR=smoothstep(.08,.22,nx-.5),armBand=smoothstep(.24,.34,ny)*(1-smoothstep(.64,.72,ny));head[i]=smoothstep(.57,.69,ny);armL[i]=sideL*armBand;armR[i]=sideR*armBand;torso[i]=smoothstep(.27,.40,ny)*(1-smoothstep(.62,.70,ny))*(1-smoothstep(.30,.46,Math.abs(nx-.5)));}g.setAttribute('aJHead',new THREE.BufferAttribute(head,1));g.setAttribute('aJArmL',new THREE.BufferAttribute(armL,1));g.setAttribute('aJArmR',new THREE.BufferAttribute(armR,1));g.setAttribute('aJTorso',new THREE.BufferAttribute(torso,1));const headPivotW=new THREE.Vector3(center.x,box.min.y+size.y*.61,center.z),armLPivotW=new THREE.Vector3(box.min.x+size.x*.34,box.min.y+size.y*.57,center.z),armRPivotW=new THREE.Vector3(box.min.x+size.x*.66,box.min.y+size.y*.57,center.z);const headPivot=mesh.worldToLocal(headPivotW.clone()),armLPivot=mesh.worldToLocal(armLPivotW.clone()),armRPivot=mesh.worldToLocal(armRPivotW.clone());const localSpan=Math.max((g.boundingBox?.max?.y-g.boundingBox?.min?.y)||0,size.y*.5,eps);const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];for(const mat of mats){if(!mat)continue;setMaterialQuality(mat);const uniforms={uJHead:{value:0},uJArmL:{value:0},uJArmR:{value:0},uJBreath:{value:0},uJHeadPivot:{value:headPivot.clone()},uJArmLPivot:{value:armLPivot.clone()},uJArmRPivot:{value:armRPivot.clone()},uJSpan:{value:localSpan}};mat.userData.jiraiUniforms=uniforms;mat.onBeforeCompile=(shader)=>{Object.assign(shader.uniforms,uniforms);shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>\nattribute float aJHead;\nattribute float aJArmL;\nattribute float aJArmR;\nattribute float aJTorso;\nuniform float uJHead;\nuniform float uJArmL;\nuniform float uJArmR;\nuniform float uJBreath;\nuniform float uJSpan;\nuniform vec3 uJHeadPivot;\nuniform vec3 uJArmLPivot;\nuniform vec3 uJArmRPivot;\nvec3 jiraiRotateZ(vec3 p,vec3 pivot,float a){float c=cos(a),s=sin(a);vec2 q=p.xy-pivot.xy;return vec3(vec2(c*q.x-s*q.y,s*q.x+c*q.y)+pivot.xy,p.z);}`);shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`vec3 transformed=vec3(position);\nvec3 jh=jiraiRotateZ(transformed,uJHeadPivot,uJHead);transformed=mix(transformed,jh,aJHead);\nvec3 jl=jiraiRotateZ(transformed,uJArmLPivot,uJArmL);transformed=mix(transformed,jl,aJArmL);\nvec3 jr=jiraiRotateZ(transformed,uJArmRPivot,uJArmR);transformed=mix(transformed,jr,aJArmR);\nfloat jb=uJBreath*aJTorso;transformed.x+=(transformed.x-uJHeadPivot.x)*jb*.018;transformed.y+=jb*uJSpan*.0025;`);mat.userData.jiraiShader=shader;};mat.customProgramCacheKey=()=>`jirai-fixed-front-v2`;mat.needsUpdate=true;state.uniforms.push(uniforms);}state.riggedMeshes++;});ui.rigMode.textContent=`GPU 2.5D · ${state.riggedMeshes} mesh`;}

function updateRigUniforms(headDeg,armLDeg,armRDeg,breath){const enabled=ui.deform.checked,h=enabled?THREE.MathUtils.degToRad(headDeg):0,al=enabled?THREE.MathUtils.degToRad(armLDeg):0,ar=enabled?THREE.MathUtils.degToRad(armRDeg):0,br=enabled?breath:0;for(const u of state.uniforms){u.uJHead.value=h;u.uJArmL.value=al;u.uJArmR.value=ar;u.uJBreath.value=br;}}
async function cacheFile(file){try{const db=await openDB();await new Promise((resolve,reject)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').put(file,'last-fbx');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});ui.restoreBtn.hidden=false;}catch(e){console.warn('FBX cache skipped',e);}}
function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open('jirai-original-fbx',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('files'))r.result.createObjectStore('files');};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function restoreCached(){try{const db=await openDB();return await new Promise((resolve,reject)=>{const tx=db.transaction('files');const r=tx.objectStore('files').get('last-fbx');r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);});}catch{return null;}}
async function loadFBXFile(file,{cache=true}={}){if(!file)return;if(!/\.fbx$/i.test(file.name||'')){ui.status.textContent='FBX 파일만 선택해 주세요';return;}ui.status.textContent='원본 FBX 읽는 중…';ui.empty.classList.remove('hidden');const reader=await file.arrayBuffer();sourceBytes=file.size;ui.status.textContent='FBX 원본 파싱 중…';await new Promise(r=>requestAnimationFrame(r));try{const loader=new FBXLoader(),obj=loader.parse(reader,'');if(model){root.remove(model);disposeObject(model);}model=obj;root.add(model);model.rotation.set(0,0,0);model.scale.setScalar(1);const info=analyze(model,file);fitModel(model);installFixedFrontRig(model);ui.modelName.textContent=file.name;ui.status.textContent='정면 고정 2.5D 준비 완료';ui.empty.classList.add('hidden');if(cache)cacheFile(file);modelInfo=info;window.__JIRAI3D_QA__={ready:true,source:'direct-original-fbx-fixed-front',fileName:file.name,fileSize:file.size,...info,noDecimation:true,pseudoRig:false,fixedFront:true,gpuDeform:true,riggedMeshes:state.riggedMeshes};}catch(e){console.error(e);ui.status.textContent=`FBX 파싱 실패: ${e.message}`;window.__JIRAI3D_QA__={ready:false,error:String(e),source:'direct-original-fbx-fixed-front'};}}

function buildEmotionButtons(){for(const[id,e]of Object.entries(EMOTIONS)){const b=document.createElement('button');b.type='button';b.dataset.id=id;b.innerHTML=`<span>${e.ko}</span><small>${id}</small>`;b.addEventListener('click',()=>setEmotion(id));ui.emotions.appendChild(b);}setEmotion('neutral');}
function setEmotion(id){if(!EMOTIONS[id])return;state.emotion=id;ui.motionLabel.textContent=`${EMOTIONS[id].ko} · motion`;document.querySelectorAll('.emotion-grid button').forEach(b=>b.classList.toggle('active',b.dataset.id===id));}
function applyZoom(){const z=Number(ui.zoom.value||1);ui.zoomValue.textContent=`${z.toFixed(2)}×`;camera.position.set(0,frontCamera.targetY,frontCamera.distance/z);camera.lookAt(0,frontCamera.targetY,0);}
function resetFront(){if(!model)return;model.position.copy(restModelPosition);model.rotation.set(0,0,0);state.cur={head:0,body:0,armL:0,armR:0};ui.zoom.value='1';applyZoom();setEmotion('neutral');}

ui.fileInput.addEventListener('change',()=>loadFBXFile(ui.fileInput.files?.[0]));ui.pickBtn.addEventListener('click',()=>ui.fileInput.click());ui.reset.addEventListener('click',resetFront);ui.grid.addEventListener('change',()=>grid.visible=ui.grid.checked);ui.zoom.addEventListener('input',applyZoom);ui.restoreBtn.addEventListener('click',async()=>{const f=await restoreCached();if(f)loadFBXFile(f,{cache:false});});ui.cycle.addEventListener('click',()=>{if(cycleTimer){clearInterval(cycleTimer);cycleTimer=0;ui.cycle.textContent='16종 자동 순환';return;}const ids=Object.keys(EMOTIONS);let i=ids.indexOf(state.emotion);setEmotion(ids[(++i)%ids.length]);cycleTimer=setInterval(()=>setEmotion(ids[(++i)%ids.length]),2200);ui.cycle.textContent='자동 순환 정지';});for(const type of ['dragenter','dragover'])ui.dropZone.addEventListener(type,e=>{e.preventDefault();ui.dropZone.classList.add('dragover');});for(const type of ['dragleave','drop'])ui.dropZone.addEventListener(type,e=>{e.preventDefault();ui.dropZone.classList.remove('dragover');});ui.dropZone.addEventListener('drop',e=>{const f=[...e.dataTransfer.files].find(x=>/\.fbx$/i.test(x.name));if(f)loadFBXFile(f);});
function resize(){const r=ui.canvas.getBoundingClientRect(),w=Math.max(2,Math.floor(r.width)),h=Math.max(2,Math.floor(r.height));renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
function loop(now){requestAnimationFrame(loop);resize();const dt=Math.min(.05,(now-last)/1000||.016);last=now;if(model){const e=EMOTIONS[state.emotion],sec=now*.001,idle=ui.idle.checked,microHead=idle?Math.sin(sec*.72)*(.35+e.energy*.35):0,microBody=idle?Math.sin(sec*.53)*.28:0,bounce=idle?Math.sin(sec*(1.1+e.energy*.55))*frontCamera.maxDim*(.0007+.0012*e.energy):0,breath=idle?(.5+.5*Math.sin(sec*1.35))*(.35+.30*e.energy):0,excited=Math.sin(sec*5.2)*e.energy*1.1,k=1-Math.exp(-dt*7.5);state.cur.head=lerp(state.cur.head,e.head+microHead,k);state.cur.body=lerp(state.cur.body,e.body+microBody,k);state.cur.armL=lerp(state.cur.armL,e.armL-excited,k);state.cur.armR=lerp(state.cur.armR,e.armR+excited,k);model.position.copy(restModelPosition);model.position.y+=bounce;model.rotation.set(0,0,THREE.MathUtils.degToRad(state.cur.body*.18));updateRigUniforms(state.cur.head,state.cur.armL,state.cur.armR,breath);}renderer.render(scene,camera);frames.push(now);while(frames.length&&frames[0]<now-1000)frames.shift();ui.fps.textContent=`${frames.length} FPS`;}

buildEmotionButtons();restoreCached().then(f=>{if(f){ui.restoreBtn.hidden=false;ui.status.textContent='저장된 원본 FBX 자동 복원 중…';loadFBXFile(f,{cache:false});}else ui.status.textContent='원본 FBX 파일을 선택해 주세요';});requestAnimationFrame(loop);
