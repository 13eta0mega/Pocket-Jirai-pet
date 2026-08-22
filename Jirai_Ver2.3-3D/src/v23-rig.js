import * as THREE from 'three';
import { CALIBRATION as C } from './v23-config.js';

const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const smoothstep=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const ellipse=(nx,ny,cx,cy,rx,ry)=>1-smoothstep(.70,1.18,Math.hypot((nx-cx)/rx,(ny-cy)/ry));

export function setMaterialQuality(m,renderer){
  if(!m)return;m.side=THREE.FrontSide;m.transparent=!!m.transparent;m.alphaTest=m.alphaTest||0;
  if(m.map){m.map.colorSpace=THREE.SRGBColorSpace;m.map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());m.map.needsUpdate=true;}
  if(m.emissiveMap)m.emissiveMap.colorSpace=THREE.SRGBColorSpace;m.needsUpdate=true;
}
export function disposeObject(obj){obj.traverse(o=>{if(o.geometry)o.geometry.dispose?.();for(const m of(Array.isArray(o.material)?o.material:[o.material])){if(!m)continue;for(const k of Object.keys(m)){const v=m[k];if(v?.isTexture)v.dispose?.();}m.dispose?.();}});}
function cloneMaterials(mesh){if(Array.isArray(mesh.material))mesh.material=mesh.material.map(m=>m?.clone?.()||m);else if(mesh.material)mesh.material=mesh.material.clone();}

function coverageRecord(){return{weighted:0,sumX:0,sumY:0,max:0};}
function addCoverage(r,w,nx,ny){if(w>.18){r.weighted++;r.sumX+=nx;r.sumY+=ny;}r.max=Math.max(r.max,w);}
function finishCoverage(r){return{weightedVertices:r.weighted,centroid:r.weighted?[+(r.sumX/r.weighted).toFixed(3),+(r.sumY/r.weighted).toFixed(3)]:[0,0],max:+r.max.toFixed(3)};}

export function installRig(obj,renderer){
  const uniforms=[];let riggedMeshes=0;obj.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(obj),size=new THREE.Vector3(),center=new THREE.Vector3();box.getSize(size);box.getCenter(center);const eps=1e-6;
  const cov={head:coverageRecord(),eyeL:coverageRecord(),eyeR:coverageRecord(),mouth:coverageRecord(),browL:coverageRecord(),browR:coverageRecord(),armL:coverageRecord(),armR:coverageRecord(),hairL:coverageRecord(),hairR:coverageRecord()};
  obj.traverse(mesh=>{
    if(!mesh.isMesh||!mesh.geometry?.getAttribute('position'))return;
    const g=mesh.geometry;cloneMaterials(mesh);mesh.updateMatrixWorld(true);g.computeBoundingBox();const pos=g.getAttribute('position'),count=pos.count;
    // Ver2.3.1 mobile-safe packing. Four custom attribute slots keep us well
    // below WebGL2's minimum MAX_VERTEX_ATTRIBS=16 even with position/normal/uv.
    const rig0=new Float32Array(count*4);   // head, armL, armR, torso
    const face0=new Float32Array(count*4);  // eyeL, eyeR, mouth, browL
    const face1=new Float32Array(count*4);  // browR, hairL, hairR, front
    const coord=new Float32Array(count*2);  // normalized x, y
    const v=new THREE.Vector3();
    for(let i=0;i<count;i++){
      v.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld);const nx=(v.x-box.min.x)/(size.x||eps),ny=(v.y-box.min.y)/(size.y||eps),nz=(v.z-box.min.z)/(size.z||eps);
      const front=smoothstep(C.faceFront.start,C.faceFront.end,nz);
      const outerL=smoothstep(C.arms.inner,C.arms.outer,.5-nx),outerR=smoothstep(C.arms.inner,C.arms.outer,nx-.5);
      const armBand=smoothstep(C.arms.y0,C.arms.y0+.075,ny)*(1-smoothstep(C.arms.y1-.065,C.arms.y1,ny));
      const faceBand=smoothstep(.680,.735,ny)*(1-smoothstep(.900,.960,ny))*front;
      const head=smoothstep(C.head.start,C.head.end,ny),armL=outerL*armBand,armR=outerR*armBand;
      const torso=smoothstep(.29,.39,ny)*(1-smoothstep(.60,.68,ny))*(1-smoothstep(.31,.47,Math.abs(nx-.5)));
      const eyeL=ellipse(nx,ny,C.eyeL.cx,C.eyeL.cy,C.eyeL.rx,C.eyeL.ry)*faceBand,eyeR=ellipse(nx,ny,C.eyeR.cx,C.eyeR.cy,C.eyeR.rx,C.eyeR.ry)*faceBand;
      const mouth=ellipse(nx,ny,C.mouth.cx,C.mouth.cy,C.mouth.rx,C.mouth.ry)*faceBand,browL=ellipse(nx,ny,C.browL.cx,C.browL.cy,C.browL.rx,C.browL.ry)*faceBand,browR=ellipse(nx,ny,C.browR.cx,C.browR.cy,C.browR.rx,C.browR.ry)*faceBand;
      const hb=smoothstep(C.hair.y0,C.hair.y0+.06,ny)*(1-smoothstep(C.hair.y1-.04,C.hair.y1,ny));
      const hairL=hb*smoothstep(C.hair.inner,C.hair.outer,.5-nx)*(1-faceBand*.65),hairR=hb*smoothstep(C.hair.inner,C.hair.outer,nx-.5)*(1-faceBand*.65);
      const r=i*4,q=i*2;rig0[r]=head;rig0[r+1]=armL;rig0[r+2]=armR;rig0[r+3]=torso;face0[r]=eyeL;face0[r+1]=eyeR;face0[r+2]=mouth;face0[r+3]=browL;face1[r]=browR;face1[r+1]=hairL;face1[r+2]=hairR;face1[r+3]=front;coord[q]=nx;coord[q+1]=ny;
      addCoverage(cov.head,head,nx,ny);addCoverage(cov.eyeL,eyeL,nx,ny);addCoverage(cov.eyeR,eyeR,nx,ny);addCoverage(cov.mouth,mouth,nx,ny);addCoverage(cov.browL,browL,nx,ny);addCoverage(cov.browR,browR,nx,ny);addCoverage(cov.armL,armL,nx,ny);addCoverage(cov.armR,armR,nx,ny);addCoverage(cov.hairL,hairL,nx,ny);addCoverage(cov.hairR,hairR,nx,ny);
    }
    g.setAttribute('aJRig0',new THREE.BufferAttribute(rig0,4));g.setAttribute('aJFace0',new THREE.BufferAttribute(face0,4));g.setAttribute('aJFace1',new THREE.BufferAttribute(face1,4));g.setAttribute('aJCoord',new THREE.BufferAttribute(coord,2));
    const w=(x,y,z)=>mesh.worldToLocal(new THREE.Vector3(x,y,z));
    const p={
      head:w(center.x,box.min.y+size.y*C.head.pivotY,center.z),
      armL:w(box.min.x+size.x*.31,box.min.y+size.y*.585,center.z),armR:w(box.min.x+size.x*.69,box.min.y+size.y*.585,center.z),
      eyeL:w(box.min.x+size.x*C.eyeL.cx,box.min.y+size.y*C.eyeL.cy,box.max.z),eyeR:w(box.min.x+size.x*C.eyeR.cx,box.min.y+size.y*C.eyeR.cy,box.max.z),
      mouth:w(box.min.x+size.x*C.mouth.cx,box.min.y+size.y*C.mouth.cy,box.max.z),
      hairL:w(box.min.x+size.x*.27,box.min.y+size.y*.84,center.z),hairR:w(box.min.x+size.x*.73,box.min.y+size.y*.84,center.z)
    };
    const span=Math.max((g.boundingBox?.max?.y-g.boundingBox?.min?.y)||0,size.y*.5,eps);
    for(const mat of(Array.isArray(mesh.material)?mesh.material:[mesh.material])){
      if(!mat)continue;setMaterialQuality(mat,renderer);
      const u={uJHead:{value:0},uJArmL:{value:0},uJArmR:{value:0},uJBreath:{value:0},uJEyeL:{value:1},uJEyeR:{value:1},uJMouthOpen:{value:0},uJMouthSmile:{value:0},uJBrowL:{value:0},uJBrowR:{value:0},uJHairL:{value:0},uJHairR:{value:0},uJHeadPivot:{value:p.head},uJArmLPivot:{value:p.armL},uJArmRPivot:{value:p.armR},uJEyeLPivot:{value:p.eyeL},uJEyeRPivot:{value:p.eyeR},uJMouthPivot:{value:p.mouth},uJHairLPivot:{value:p.hairL},uJHairRPivot:{value:p.hairR},uJSpan:{value:span}};
      mat.onBeforeCompile=shader=>{
        Object.assign(shader.uniforms,u);
        shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>\nattribute vec4 aJRig0,aJFace0,aJFace1;\nattribute vec2 aJCoord;\nuniform float uJHead,uJArmL,uJArmR,uJBreath,uJEyeL,uJEyeR,uJMouthOpen,uJMouthSmile,uJBrowL,uJBrowR,uJHairL,uJHairR,uJSpan;\nuniform vec3 uJHeadPivot,uJArmLPivot,uJArmRPivot,uJEyeLPivot,uJEyeRPivot,uJMouthPivot,uJHairLPivot,uJHairRPivot;\nvarying vec3 vJCoord;\nvec3 jr(vec3 p,vec3 q,float a){float c=cos(a),s=sin(a);vec2 d=p.xy-q.xy;return vec3(vec2(c*d.x-s*d.y,s*d.x+c*d.y)+q.xy,p.z);}`);
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`vec3 transformed=vec3(position);\nfloat aJHead=aJRig0.x,aJArmL=aJRig0.y,aJArmR=aJRig0.z,aJTorso=aJRig0.w;\nfloat aJEyeL=aJFace0.x,aJEyeR=aJFace0.y,aJMouth=aJFace0.z,aJBrowL=aJFace0.w;\nfloat aJBrowR=aJFace1.x,aJHairL=aJFace1.y,aJHairR=aJFace1.z,aJFront=aJFace1.w;\nvJCoord=vec3(aJCoord,aJFront);\nfloat el=mix(1.0,max(0.16,uJEyeL),aJEyeL);transformed.y=uJEyeLPivot.y+(transformed.y-uJEyeLPivot.y)*el;\nfloat er=mix(1.0,max(0.16,uJEyeR),aJEyeR);transformed.y=uJEyeRPivot.y+(transformed.y-uJEyeRPivot.y)*er;\ntransformed.y+=(transformed.y-uJMouthPivot.y)*uJMouthOpen*.34*aJMouth;\nfloat md=clamp(abs(transformed.x-uJMouthPivot.x)/(uJSpan*.080+1e-5),0.0,1.0);transformed.y+=aJMouth*uJMouthSmile*md*uJSpan*.0048;\ntransformed.y+=(aJBrowL*uJBrowL+aJBrowR*uJBrowR)*uJSpan*.0048;\ntransformed=mix(transformed,jr(transformed,uJHairLPivot,uJHairL),aJHairL);\ntransformed=mix(transformed,jr(transformed,uJHairRPivot,uJHairR),aJHairR);\ntransformed=mix(transformed,jr(transformed,uJHeadPivot,uJHead),aJHead);\ntransformed=mix(transformed,jr(transformed,uJArmLPivot,uJArmL),aJArmL);\ntransformed=mix(transformed,jr(transformed,uJArmRPivot,uJArmR),aJArmR);\nfloat br=uJBreath*aJTorso;transformed.x+=(transformed.x-uJHeadPivot.x)*br*.010;transformed.y+=br*uJSpan*.0018;`);
        shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\nuniform float uJMouthOpen;\nvarying vec3 vJCoord;`);
        shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>\nfloat jOpen=smoothstep(0.045,0.18,uJMouthOpen);\nvec2 jq=vec2((vJCoord.x-0.501)/0.074,(vJCoord.y-0.709)/(0.010+uJMouthOpen*0.040));\nfloat jM=(1.0-smoothstep(0.68,1.0,dot(jq,jq)))*jOpen*smoothstep(0.38,0.62,vJCoord.z);\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.145,0.018,0.038),jM*0.88);\nvec2 jt=vec2(jq.x,(jq.y+0.34)*1.18);\nfloat jT=(1.0-smoothstep(0.30,0.78,dot(jt,jt)))*jM*smoothstep(0.30,0.62,uJMouthOpen);\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.74,0.20,0.34),jT*0.52);`);
        mat.userData.jiraiShader=shader;
      };
      mat.customProgramCacheKey=()=>`jirai-fixed-front-v231-packed`;mat.needsUpdate=true;uniforms.push(u);
    }
    riggedMeshes++;
  });
  const coverage=Object.fromEntries(Object.entries(cov).map(([k,v])=>[k,finishCoverage(v)]));
  return{uniforms,riggedMeshes,coverage,customAttributeSlots:4,bbox:{min:box.min.toArray(),max:box.max.toArray(),size:size.toArray()}};
}

export function updateRig(uniforms,p,options){
  const body=options.body,face=options.face,hair=options.hair;
  for(const u of uniforms){u.uJHead.value=body?THREE.MathUtils.degToRad(p.head):0;u.uJArmL.value=body?THREE.MathUtils.degToRad(p.armL):0;u.uJArmR.value=body?THREE.MathUtils.degToRad(p.armR):0;u.uJBreath.value=body?p.breath:0;u.uJEyeL.value=face?p.eyeL:1;u.uJEyeR.value=face?p.eyeR:1;u.uJMouthOpen.value=face?clamp(p.mouth,0,.74):0;u.uJMouthSmile.value=face?p.smile:0;u.uJBrowL.value=face?p.browL:0;u.uJBrowR.value=face?p.browR:0;u.uJHairL.value=hair?THREE.MathUtils.degToRad(p.hairL):0;u.uJHairR.value=hair?THREE.MathUtils.degToRad(p.hairR):0;}
}
