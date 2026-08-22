#!/usr/bin/env python3
import copy, json, math, hashlib
from pathlib import Path
from PIL import Image
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
review=json.load(open(ROOT/'config/jirai-v13-review.json',encoding='utf-8'))
base_cfg=json.load(open(ROOT/'config/jirai-v12-atlas.json',encoding='utf-8'))
base_atlas=Image.open(ROOT/'src/Jirai_Character_Active58.png').convert('RGBA')
PADDING=2
WIDTH=base_atlas.width

sources={5:Image.open(ROOT/'src/Jirai_Character_Parts5.png').convert('RGBA'),6:Image.open(ROOT/'src/Jirai_Character_Parts6.png').convert('RGBA'),7:Image.open(ROOT/'src/Jirai_Character_Parts7.png').convert('RGBA')}
new_parts=review['promoted_parts']

# Keep every Ver1.2 atlas coordinate unchanged and append only Ver1.3 additions below it.
items=[]
for p in new_parts:
    x,y,w,h=p['rect']; crop=sources[p['sheet']].crop((x,y,x+w,y+h))
    arr=np.array(crop)
    arr[arr[:,:,3] <= 4]=0
    crop=Image.fromarray(arr,'RGBA')
    items.append((p['id'],crop,p))

x=PADDING; y=base_atlas.height+PADDING; row_h=0; pos={}
for sid,im,p in sorted(items,key=lambda q:(-q[1].height,-q[1].width,q[0])):
    if x+im.width+PADDING>WIDTH:
        x=PADDING; y+=row_h+PADDING; row_h=0
    pos[sid]=(x,y); x+=im.width+PADDING; row_h=max(row_h,im.height)
used_h=y+row_h+PADDING
height=int(math.ceil(used_h/64)*64)
atlas=Image.new('RGBA',(WIDTH,height),(0,0,0,0));atlas.alpha_composite(base_atlas,(0,0))

cfg=copy.deepcopy(base_cfg)
cfg['version']='1.3.1-active77-integratedbody-viseme7'
cfg['sheets']={'atlas':'src/Jirai_Character_Active77_V13.png'}
for sid,im,p in items:
    px,py=pos[sid];atlas.alpha_composite(im,(px,py));cfg['parts'][sid]={'sheet':'atlas','src':[px,py,im.width,im.height]}

lo=cfg.setdefault('layout',{})
# Tighten the complete face stack upward inside the hair shell.
for key in ('F01','eyeLeft','eyeRight','browLeft','browRight','mouth'):
    if key in lo and 'center' in lo[key]: lo[key]['center'][1]-=8
lo['faceShadowLeft']={'center':[225,290],'scale':.42};lo['faceShadowRight']={'center':[375,290],'scale':.42}
lo['blushSoftLeft']={'center':[225,291],'scale':.55};lo['blushSoftRight']={'center':[375,291],'scale':.55}
lo['blushStripeLeft']={'center':[225,292],'scale':.52};lo['blushStripeRight']={'center':[375,292],'scale':.52}
lo['faceStackYOffset']=-8
lo['armComposite']={
 'crossed':{'center':[300,460],'scale':.95},'cheek':{'center':[306,452],'scale':1.02},
 'palms':{'center':[300,458],'scale':1.02},'clasped':{'center':[300,454],'scale':.98}}
lo['shoeLeft']['center'][1]-=10;lo['shoeRight']['center'][1]-=10
lo['legPoses']={'bentLeft':{'legCenter':[232,672],'legScale':.96,'legAngle':-10,'shoeCenter':[208,782],'shoeAngle':-15}}
lo['legChain']={'linkedFootPivot':True,'leftPivot':lo['legLeft']['pivot'],'rightPivot':lo['legRight']['pivot'],'socketOverlapPx':10}
# Align integrated poses by the common skirt baseline rather than crop center.
body_scale=1.27; skirt_bottom=652
lo['integratedBody']={}
for sid in ('TB01','TB02','TB03','TB04','TB05'):
    h=cfg['parts'][sid]['src'][3]
    lo['integratedBody'][sid]={'center':[300,round(skirt_bottom-h*body_scale/2,2)],'scale':body_scale,'skirtBottomY':skirt_bottom}

cfg.setdefault('mouthScale',{}).update({'M09':1.12,'M10':.96,'M11':1.04,'M12':.72,'M13':.74,'M14':.75,'M15':.58,'M16':.9,'M17':.65,'M18':.58})
cfg['lipSync']=review['lip_sync'];cfg['browProfiles']=review['brow_profiles'];cfg['renderLayers']=review['layer_system'];
cfg.setdefault('motion',{})['transitionMs']=480
cfg['atlas']['size']=[WIDTH,height];cfg['atlas']['sourcePartCount']=len(cfg['parts']);cfg['atlas']['v13BaseAtlasBytes']=base_atlas.width*base_atlas.height
cfg['atlas']['v13AppendOnly']=True;cfg['atlas']['sourceIndexVersion']=review['version']

out_atlas=ROOT/'src/Jirai_Character_Active77_V13.png';atlas.save(out_atlas,optimize=True,compress_level=9)
out_cfg=ROOT/'config/jirai-v13-atlas.json';json.dump(cfg,open(out_cfg,'w',encoding='utf-8'),ensure_ascii=False,indent=2)
sha=hashlib.sha256(out_atlas.read_bytes()).hexdigest()
validation={'version':cfg['version'],'parts':len(cfg['parts']),'baseParts':58,'promotedParts':len(new_parts),'integratedBodies':5,'atlasSize':[WIDTH,height],'atlasBytes':out_atlas.stat().st_size,'sha256':sha,'lipVisemes':len(cfg['lipSync']['viseme_ids']),'browProfiles':len(cfg['browProfiles']),'faceStackYOffset':lo['faceStackYOffset'],'linkedFootChain':bool(lo['legChain']['linkedFootPivot']),'shoeSocketOverlapPx':lo['legChain']['socketOverlapPx'],'appendOnlyBaseCoordinates':True}
(ROOT/'qa/jirai-v13').mkdir(parents=True,exist_ok=True)
json.dump(validation,open(ROOT/'qa/jirai-v13/build.json','w',encoding='utf-8'),ensure_ascii=False,indent=2)
print(json.dumps(validation,ensure_ascii=False))
