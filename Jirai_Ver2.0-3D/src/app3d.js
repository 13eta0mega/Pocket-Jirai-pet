(() => {
'use strict';
const $=s=>document.querySelector(s);
const canvas=$('#gl'); const gl=canvas.getContext('webgl2',{antialias:true,alpha:false,powerPreference:'high-performance'});
if(!gl){$('#status').textContent='WebGL2 미지원';throw new Error('WebGL2 required');}
const UI={fps:$('#fps'),meshInfo:$('#meshInfo'),emotionName:$('#emotionName'),status:$('#status'),emotions:$('#emotions'),lipTest:$('#lipTest'),micBtn:$('#micBtn'),mouth:$('#mouth'),autoBlink:$('#autoBlink'),idle:$('#idle'),lod:$('#lod'),lodVal:$('#lodVal'),headVal:$('#headVal'),mouthVal:$('#mouthVal'),sourceInfo:$('#sourceInfo')};
const emotions={
 neutral:{ko:'기본',head:0,lean:0,arms:[0,0],legs:[0,0],mouth:0,energy:.12},
 happy:{ko:'행복',head:-3,lean:1,arms:[-6,6],legs:[0,0],mouth:.22,energy:.35},
 excited:{ko:'신남',head:2,lean:0,arms:[-24,24],legs:[-3,3],mouth:.45,energy:1},
 teasing:{ko:'장난',head:-8,lean:-2,arms:[-28,2],legs:[-7,2],mouth:.3,energy:.55},
 pleading:{ko:'울망',head:5,lean:1,arms:[8,-8],legs:[0,0],mouth:.05,energy:.1},
 relaxed:{ko:'느긋',head:-4,lean:2,arms:[3,-3],legs:[0,0],mouth:.08,energy:.08},
 sick:{ko:'아픔',head:7,lean:3,arms:[3,-3],legs:[0,0],mouth:.12,energy:.03},
 angry:{ko:'화남',head:-2,lean:-3,arms:[10,-10],legs:[1,-1],mouth:.14,energy:.7},
 annoyed:{ko:'삐짐',head:-7,lean:2,arms:[8,-8],legs:[0,0],mouth:.04,energy:.12},
 sad:{ko:'슬픔',head:6,lean:2,arms:[6,-6],legs:[0,0],mouth:.03,energy:.04},
 surprised:{ko:'놀람',head:0,lean:0,arms:[-18,18],legs:[-2,2],mouth:.5,energy:.8},
 embarrassed:{ko:'부끄러움',head:5,lean:1,arms:[7,-7],legs:[-8,2],mouth:.08,energy:.16},
 scared:{ko:'겁남',head:3,lean:1,arms:[10,-10],legs:[-3,3],mouth:.35,energy:.65},
 smug:{ko:'의기양양',head:-6,lean:-2,arms:[5,-5],legs:[0,0],mouth:.1,energy:.2},
 confused:{ko:'갸웃',head:9,lean:0,arms:[-4,4],legs:[0,0],mouth:.12,energy:.2},
 love:{ko:'좋아!',head:-3,lean:0,arms:[7,-7],legs:[0,0],mouth:.28,energy:.6}
};
const state={emotion:'neutral',cur:{head:0,lean:0,armL:0,armR:0,legL:0,legR:0,mouth:0},yaw:0,pitch:0,zoom:2.7,model:null,info:null,mic:null,analyser:null,audio:null,drag:null,last:performance.now(),frames:[],nextBlink:performance.now()+2500,blinkStart:0};
const vsrc=`#version 300 es
precision highp float;
layout(location=0) in vec3 aQPos;layout(location=1) in vec3 aColor;layout(location=2) in vec3 aNormal;layout(location=3) in vec4 aW0;layout(location=4) in vec3 aW1;
uniform mat4 uMVP;uniform vec3 uMin,uMax;uniform float uHead,uLean,uArmL,uArmR,uLegL,uLegR,uBlink,uMouth,uBob,uBreath;
out vec3 vColor;out float vLight;
vec3 rz(vec3 p,vec3 pivot,float ang,float w){float c=cos(ang),s=sin(ang);vec3 q=p-pivot;vec3 r=vec3(c*q.x-s*q.y,s*q.x+c*q.y,q.z)+pivot;return mix(p,r,w);} 
void main(){vec3 p=mix(uMin,uMax,aQPos*.5+.5);float head=aW0.x,al=aW0.y,ar=aW0.z,ll=aW0.w,lr=aW1.x,blink=aW1.y,mouth=aW1.z;
 float m=uMouth*mouth;p.y+=m*(p.y<.395?-.027:.013);p.z+=m*.012;
 float bw=uBlink*blink;p.y=mix(p.y,.535+(p.y-.535)*.12,bw);
 p=rz(p,vec3(-.25,.12,0),uArmL,al);p=rz(p,vec3(.25,.12,0),uArmR,ar);p=rz(p,vec3(-.12,-.32,0),uLegL,ll);p=rz(p,vec3(.12,-.32,0),uLegR,lr);
 p=rz(p,vec3(0,.27,0),uHead,head);p=rz(p,vec3(0,-.12,0),uLean,1.0);float torso=(1.0-head)*(1.0-smoothstep(-.38,-.28,p.y));p.x*=1.0+uBreath*.012*torso;p.z*=1.0+uBreath*.008*torso;p.y+=uBob;
 gl_Position=uMVP*vec4(p,1.0);vColor=aColor;vec3 n=normalize(aNormal);vLight=.72+.28*max(dot(n,normalize(vec3(-.3,.55,.78))),0.0);}
`;
const fsrc=`#version 300 es
precision highp float;in vec3 vColor;in float vLight;out vec4 frag;void main(){vec3 c=vColor*vLight;c=pow(c,vec3(.93));frag=vec4(c,1.0);}`;
function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;}
const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vsrc));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fsrc));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));gl.useProgram(program);
const U={};for(const n of ['uMVP','uMin','uMax','uHead','uLean','uArmL','uArmR','uLegL','uLegR','uBlink','uMouth','uBob','uBreath'])U[n]=gl.getUniformLocation(program,n);
function parseJ3D(ab){const d=new DataView(ab);const magic=String.fromCharCode(...new Uint8Array(ab,0,4));if(magic!=='J3D1')throw new Error('bad J3D');const stride=d.getUint16(6,true),vc=d.getUint32(8,true),ic=d.getUint32(12,true);const mn=[d.getFloat32(16,true),d.getFloat32(20,true),d.getFloat32(24,true)],mx=[d.getFloat32(28,true),d.getFloat32(32,true),d.getFloat32(36,true)],vo=d.getUint32(40,true),io=d.getUint32(44,true);return{ab,stride,vc,ic,mn,mx,vo,io};}
function embeddedModel(){const b64=(window.JIRAI3D_CHUNKS||[]).join('');if(!b64)throw new Error('embedded model missing');const raw=atob(b64),u=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)u[i]=raw.charCodeAt(i);return u.buffer;}
async function loadLOD(i){UI.status.textContent='LOD 로딩 중';const ab=embeddedModel();const m=parseJ3D(ab);if(state.model?.vao)gl.deleteVertexArray(state.model.vao);const vao=gl.createVertexArray();gl.bindVertexArray(vao);const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,new Uint8Array(ab,m.vo,m.vc*m.stride),gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.SHORT,true,m.stride,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.UNSIGNED_BYTE,true,m.stride,6);gl.enableVertexAttribArray(2);gl.vertexAttribPointer(2,3,gl.BYTE,true,m.stride,9);gl.enableVertexAttribArray(3);gl.vertexAttribPointer(3,4,gl.UNSIGNED_BYTE,true,m.stride,12);gl.enableVertexAttribArray(4);gl.vertexAttribPointer(4,3,gl.UNSIGNED_BYTE,true,m.stride,16);const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint8Array(ab,m.io,m.ic*2),gl.STATIC_DRAW);gl.bindVertexArray(null);state.model={...m,vao,vb,ib,lod:i};UI.meshInfo.textContent=`${m.vc.toLocaleString()} V / ${(m.ic/3).toLocaleString()} T`;UI.lodVal.textContent=`LOD2`;UI.status.textContent='실시간 3D 준비 완료';}
function mat4mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)o[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return o;}
function perspective(fovy,aspect,n,f){const t=1/Math.tan(fovy/2),o=new Float32Array(16);o[0]=t/aspect;o[5]=t;o[10]=(f+n)/(n-f);o[11]=-1;o[14]=2*f*n/(n-f);return o;}
function lookAt(e,t,u){let zx=e[0]-t[0],zy=e[1]-t[1],zz=e[2]-t[2],zl=Math.hypot(zx,zy,zz);zx/=zl;zy/=zl;zz/=zl;let xx=u[1]*zz-u[2]*zy,xy=u[2]*zx-u[0]*zz,xz=u[0]*zy-u[1]*zx,xl=Math.hypot(xx,xy,xz);xx/=xl;xy/=xl;xz/=xl;const yx=zy*xz-zz*xy,yy=zz*xx-zx*xz,yz=zx*xy-zy*xx;return new Float32Array([xx,yx,zx,0,xy,yy,zy,0,xz,yz,zz,0,-(xx*e[0]+xy*e[1]+xz*e[2]),-(yx*e[0]+yy*e[1]+yz*e[2]),-(zx*e[0]+zy*e[1]+zz*e[2]),1]);}
function rotY(a){const c=Math.cos(a),s=Math.sin(a);return new Float32Array([c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1]);}function rotX(a){const c=Math.cos(a),s=Math.sin(a);return new Float32Array([1,0,0,0,0,c,s,0,0,-s,c,0,0,0,0,1]);}
function resize(){const dpr=Math.min(devicePixelRatio||1,2),r=canvas.getBoundingClientRect(),w=Math.max(2,Math.round(r.width*dpr)),h=Math.max(2,Math.round(r.height*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}}
function rad(d){return d*Math.PI/180}function lerp(a,b,k){return a+(b-a)*k;}function setEmotion(id){state.emotion=id;UI.emotionName.textContent=emotions[id].ko;document.querySelectorAll('.emotions button').forEach(b=>b.classList.toggle('active',b.dataset.id===id));}
for(const[id,e]of Object.entries(emotions)){const b=document.createElement('button');b.dataset.id=id;b.innerHTML=`${e.ko}<small>${id}</small>`;b.onclick=()=>setEmotion(id);UI.emotions.appendChild(b);}setEmotion('neutral');
function blinkValue(now){if(!UI.autoBlink.checked)return 0;if(!state.blinkStart&&now>state.nextBlink){state.blinkStart=now;state.nextBlink=now+2600+Math.random()*3200;}if(!state.blinkStart)return 0;const x=(now-state.blinkStart)/190;if(x>=1){state.blinkStart=0;return 0;}return Math.sin(Math.PI*x);}
function lipTarget(now){if(state.analyser){const a=new Uint8Array(state.analyser.fftSize);state.analyser.getByteTimeDomainData(a);let s=0;for(const v of a){const q=(v-128)/128;s+=q*q;}return Math.min(1,Math.max(0,(Math.sqrt(s/a.length)-.015)*7));}if(UI.lipTest.checked){const sec=now/1000,ph=sec%5.2;if(ph>4)return 0;return Math.min(1,(.15+.55*Math.abs(Math.sin(sec*3.1))+.24*Math.abs(Math.sin(sec*4.7+.4)))*Math.min(1,ph*2)*Math.min(1,(4-ph)*2));}return +UI.mouth.value;}
async function mic(){if(state.mic){state.mic.getTracks().forEach(t=>t.stop());state.mic=null;state.analyser=null;UI.micBtn.textContent='마이크';return;}try{const st=await navigator.mediaDevices.getUserMedia({audio:true});const ac=new AudioContext(),src=ac.createMediaStreamSource(st),an=ac.createAnalyser();an.fftSize=512;an.smoothingTimeConstant=.75;src.connect(an);state.mic=st;state.audio=ac;state.analyser=an;UI.micBtn.textContent='마이크 끄기';UI.lipTest.checked=false;}catch(e){UI.status.textContent='마이크 권한 실패';}}
UI.micBtn.onclick=mic;UI.lod.onchange=()=>loadLOD(+UI.lod.value).catch(e=>UI.status.textContent=e.message);
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);state.drag={x:e.clientX,y:e.clientY,yaw:state.yaw,pitch:state.pitch};});canvas.addEventListener('pointermove',e=>{if(!state.drag)return;state.yaw=state.drag.yaw+(e.clientX-state.drag.x)*.008;state.pitch=Math.max(-.45,Math.min(.45,state.drag.pitch+(e.clientY-state.drag.y)*.006));});canvas.addEventListener('pointerup',()=>state.drag=null);canvas.addEventListener('pointercancel',()=>state.drag=null);canvas.addEventListener('wheel',e=>{e.preventDefault();state.zoom=Math.max(2.15,Math.min(4.3,state.zoom+e.deltaY*.002));},{passive:false});
function frame(now){requestAnimationFrame(frame);resize();if(!state.model)return;const dt=Math.min(.05,(now-state.last)/1000);state.last=now;const e=emotions[state.emotion],idle=UI.idle.checked;const sec=now/1000,energy=e.energy;const head=e.head+(idle?Math.sin(sec*.75)*1.2*(.25+energy):0),lean=e.lean+(idle?Math.sin(sec*.55)*.7:0),armL=e.arms[0]+(state.emotion==='excited'?Math.sin(sec*5)*5:0),armR=e.arms[1]-(state.emotion==='excited'?Math.sin(sec*5)*5:0),legL=e.legs[0],legR=e.legs[1],mouth=Math.max(e.mouth*.15,lipTarget(now));const k=1-Math.exp(-dt*8);state.cur.head=lerp(state.cur.head,head,k);state.cur.lean=lerp(state.cur.lean,lean,k);state.cur.armL=lerp(state.cur.armL,armL,k);state.cur.armR=lerp(state.cur.armR,armR,k);state.cur.legL=lerp(state.cur.legL,legL,k);state.cur.legR=lerp(state.cur.legR,legR,k);state.cur.mouth=lerp(state.cur.mouth,mouth,1-Math.exp(-dt*(mouth>state.cur.mouth?8.7:5.2)));
 gl.clearColor(.055,.04,.07,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.cullFace(gl.BACK);gl.useProgram(program);const aspect=canvas.width/canvas.height,P=perspective(rad(34),aspect,.1,20),V=lookAt([0,.02,state.zoom],[0,0,0],[0,1,0]),M=mat4mul(rotY(state.yaw),rotX(state.pitch)),MVP=mat4mul(P,mat4mul(V,M));gl.uniformMatrix4fv(U.uMVP,false,MVP);gl.uniform3fv(U.uMin,state.model.mn);gl.uniform3fv(U.uMax,state.model.mx);gl.uniform1f(U.uHead,rad(state.cur.head));gl.uniform1f(U.uLean,rad(state.cur.lean));gl.uniform1f(U.uArmL,rad(state.cur.armL));gl.uniform1f(U.uArmR,rad(state.cur.armR));gl.uniform1f(U.uLegL,rad(state.cur.legL));gl.uniform1f(U.uLegR,rad(state.cur.legR));gl.uniform1f(U.uBlink,blinkValue(now));gl.uniform1f(U.uMouth,state.cur.mouth);gl.uniform1f(U.uBob,idle?Math.sin(sec*1.35)*.008*(.2+energy):0);gl.uniform1f(U.uBreath,idle?(Math.sin(sec*1.4)*.5+.5):0);gl.bindVertexArray(state.model.vao);gl.drawElements(gl.TRIANGLES,state.model.ic,gl.UNSIGNED_SHORT,0);gl.bindVertexArray(null);
 state.frames.push(now);while(state.frames[0]<now-1000)state.frames.shift();UI.fps.textContent=`${state.frames.length} FPS`;UI.headVal.textContent=state.cur.head.toFixed(1);UI.mouthVal.textContent=state.cur.mouth.toFixed(2);
}
(async()=>{try{state.info={source:{bytes:18602492,vertices:166066,triangles:332128,deformers:0,textures:5}};const s=state.info.source;UI.sourceInfo.textContent=`원본 FBX ${(s.bytes/1048576).toFixed(1)} MiB · ${s.vertices.toLocaleString()} vertices · ${s.triangles.toLocaleString()} triangles · 2048² texture × ${s.textures} · skeleton ${s.deformers?'있음':'없음'}`;UI.lod.value='2';await loadLOD(2);requestAnimationFrame(frame);}catch(e){console.error(e);UI.status.textContent='로드 실패: '+e.message;}})();
})();
