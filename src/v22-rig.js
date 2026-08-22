import * as THREE from 'three';
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const smoothstep=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
const ellipse=(nx,ny,cx,cy,rx,ry)=>1-smoothstep(.72,1.20,Math.hypot((nx-cx)/rx,(ny-cy)/ry));

export function setMaterialQuality(m,renderer){
  if(!m)return;m.side=THREE.FrontSide;m.transparent=!!m.transparent;m.alphaTest=m.alphaTest||0;
  if(m.map){m.map.colorSpace=THREE.SRGBColorSpace;m.map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());m.map.needsUpdate=true;}
  if(m.emissiveMap)m.emissiveMap.colorSpace=THREE.SRGBColorSpace;m.needsUpdate=true;
}
export function disposeObject(obj){obj.traverse(o=>{if(o.geometry)o.geometry.dispose?.();for(const m of(Array.isArray(o.material)?o.material:[o.material])){if(!m)continue;for(const k of Object.keys(m)){const v=m[k];if(v?.isTexture)v.dispose?.();}m.dispose?.();}});}
function cloneMaterials(mesh){if(Array.isArray(mesh.material))mesh.material=mesh.material.map(m=>m?.clone?.()||m);else if(mesh.material)mesh.material=mesh.material.clone();}

export function installRig(obj,renderer){
  const uniforms=[];let riggedMeshes=0;obj.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(obj),size=new THREE.Vector3(),center=new THREE.Vector3();box.getSize(size);box.getCenter(center);const eps=1e-6;
  obj.traverse(mesh=>{
    if(!mesh.isMesh||!mesh.geometry?.getAttribute('position'))return;
    const g=mesh.geometry;cloneMaterials(mesh);mesh.updateMatrixWorld(true);g.computeBoundingBox();const pos=g.getAttribute('position'),count=pos.count;
    const names=['aJHead','aJArmL','aJArmR','aJTorso','aJEyeL','aJEyeR','aJMouth','aJBrowL','aJBrowR','aJHairL','aJHairR'];
    const data=Object.fromEntries(names.map(n=>[n,new Float32Array(count)]));const v=new THREE.Vector3();
    for(let i=0;i<count;i++){
      v.fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld);const nx=(v.x-box.min.x)/(size.x||eps),ny=(v.y-box.min.y)/(size.y||eps),nz=(v.z-box.min.z)/(size.z||eps);
      const sideL=smoothstep(.08,.22,.5-nx),sideR=smoothstep(.08,.22,nx-.5),armBand=smoothstep(.24,.34,ny)*(1-smoothstep(.64,.72,ny));
      const front=smoothstep(.50,.70,nz),faceBand=smoothstep(.67,.74,ny)*(1-smoothstep(.92,.97,ny))*front;
      data.aJHead[i]=smoothstep(.57,.69,ny);data.aJArmL[i]=sideL*armBand;data.aJArmR[i]=sideR*armBand;
      data.aJTorso[i]=smoothstep(.27,.40,ny)*(1-smoothstep(.62,.70,ny))*(1-smoothstep(.30,.46,Math.abs(nx-.5)));
      data.aJEyeL[i]=ellipse(nx,ny,.425,.805,.072,.038)*faceBand;data.aJEyeR[i]=ellipse(nx,ny,.575,.805,.072,.038)*faceBand;
      data.aJMouth[i]=ellipse(nx,ny,.500,.718,.064,.040)*faceBand;data.aJBrowL[i]=ellipse(nx,ny,.425,.855,.080,.030)*faceBand;data.aJBrowR[i]=ellipse(nx,ny,.575,.855,.080,.030)*faceBand;
      const hb=smoothstep(.64,.72,ny)*(1-smoothstep(.94,.99,ny));data.aJHairL[i]=hb*smoothstep(.18,.34,.5-nx);data.aJHairR[i]=hb*smoothstep(.18,.34,nx-.5);
    }
    for(const n of names)g.setAttribute(n,new THREE.BufferAttribute(data[n],1));
    const w=(x,y,z)=>mesh.worldToLocal(new THREE.Vector3(x,y,z));
    const p={head:w(center.x,box.min.y+size.y*.61,center.z),armL:w(box.min.x+size.x*.34,box.min.y+size.y*.57,center.z),armR:w(box.min.x+size.x*.66,box.min.y+size.y*.57,center.z),eyeL:w(box.min.x+size.x*.425,box.min.y+size.y*.805,box.max.z),eyeR:w(box.min.x+size.x*.575,box.min.y+size.y*.805,box.max.z),mouth:w(center.x,box.min.y+size.y*.718,box.max.z),hairL:w(box.min.x+size.x*.32,box.min.y+size.y*.86,center.z),hairR:w(box.min.x+size.x*.68,box.min.y+size.y*.86,center.z)};
    const span=Math.max((g.boundingBox?.max?.y-g.boundingBox?.min?.y)||0,size.y*.5,eps);
    for(const mat of(Array.isArray(mesh.material)?mesh.material:[mesh.material])){
      if(!mat)continue;setMaterialQuality(mat,renderer);
      const u={uJHead:{value:0},uJArmL:{value:0},uJArmR:{value:0},uJBreath:{value:0},uJEyeL:{value:1},uJEyeR:{value:1},uJMouthOpen:{value:0},uJMouthSmile:{value:0},uJBrowL:{value:0},uJBrowR:{value:0},uJHairL:{value:0},uJHairR:{value:0},uJHeadPivot:{value:p.head},uJArmLPivot:{value:p.armL},uJArmRPivot:{value:p.armR},uJEyeLPivot:{value:p.eyeL},uJEyeRPivot:{value:p.eyeR},uJMouthPivot:{value:p.mouth},uJHairLPivot:{value:p.hairL},uJHairRPivot:{value:p.hairR},uJSpan:{value:span}};
      mat.onBeforeCompile=shader=>{Object.assign(shader.uniforms,u);shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>\nattribute float aJHead,aJArmL,aJArmR,aJTorso,aJEyeL,aJEyeR,aJMouth,aJBrowL,aJBrowR,aJHairL,aJHairR;\nuniform float uJHead,uJArmL,uJArmR,uJBreath,uJEyeL,uJEyeR,uJMouthOpen,uJMouthSmile,uJBrowL,uJBrowR,uJHairL,uJHairR,uJSpan;\nuniform vec3 uJHeadPivot,uJArmLPivot,uJArmRPivot,uJEyeLPivot,uJEyeRPivot,uJMouthPivot,uJHairLPivot,uJHairRPivot;\nvec3 jr(vec3 p,vec3 q,float a){float c=cos(a),s=sin(a);vec2 d=p.xy-q.xy;return vec3(vec2(c*d.x-s*d.y,s*d.x+c*d.y)+q.xy,p.z);}`);shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`vec3 transformed=vec3(position);\ntransformed=mix(transformed,jr(transformed,uJHeadPivot,uJHead),aJHead);\ntransformed=mix(transformed,jr(transformed,uJArmLPivot,uJArmL),aJArmL);\ntransformed=mix(transformed,jr(transformed,uJArmRPivot,uJArmR),aJArmR);\ntransformed=mix(transformed,jr(transformed,uJHairLPivot,uJHairL),aJHairL);\ntransformed=mix(transformed,jr(transformed,uJHairRPivot,uJHairR),aJHairR);\nfloat br=uJBreath*aJTorso;transformed.x+=(transformed.x-uJHeadPivot.x)*br*.018;transformed.y+=br*uJSpan*.0025;\ntransformed.y=uJEyeLPivot.y+(transformed.y-uJEyeLPivot.y)*mix(1.0,uJEyeL,aJEyeL);\ntransformed.y=uJEyeRPivot.y+(transformed.y-uJEyeRPivot.y)*mix(1.0,uJEyeR,aJEyeR);\ntransformed.y=uJMouthPivot.y+(transformed.y-uJMouthPivot.y)*(1.0+uJMouthOpen*.72*aJMouth);\nfloat md=clamp(abs(transformed.x-uJMouthPivot.x)/(uJSpan*.075+1e-5),0.0,1.0);transformed.y+=aJMouth*uJMouthSmile*md*uJSpan*.0055;\ntransformed.y+=(aJBrowL*uJBrowL+aJBrowR*uJBrowR)*uJSpan*.006;`);};
      mat.customProgramCacheKey=()=>`jirai-fixed-front-v22-face`;mat.needsUpdate=true;uniforms.push(u);
    }
    riggedMeshes++;
  });
  return{uniforms,riggedMeshes};
}

export function updateRig(uniforms,p,options){
  const body=options.body,face=options.face,hair=options.hair;
  for(const u of uniforms){u.uJHead.value=body?THREE.MathUtils.degToRad(p.head):0;u.uJArmL.value=body?THREE.MathUtils.degToRad(p.armL):0;u.uJArmR.value=body?THREE.MathUtils.degToRad(p.armR):0;u.uJBreath.value=body?p.breath:0;u.uJEyeL.value=face?p.eyeL:1;u.uJEyeR.value=face?p.eyeR:1;u.uJMouthOpen.value=face?p.mouth:0;u.uJMouthSmile.value=face?p.smile:0;u.uJBrowL.value=face?p.browL:0;u.uJBrowR.value=face?p.browR:0;u.uJHairL.value=hair?THREE.MathUtils.degToRad(p.hairL):0;u.uJHairR.value=hair?THREE.MathUtils.degToRad(p.hairR):0;}
}
