from __future__ import annotations

from pathlib import Path
import json, shutil
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
ORIGINAL = ROOT / 'assets/original'
EXPR_PATH = ROOT / 'assets/generated/expressions/expression_sheet_cute_gothic_bunny_girl_01.png'
OUT = ROOT / 'assets/runtime-v5'
STATES = OUT / 'states'
TALK = OUT / 'talk'
QA = ROOT / 'qa/runtime-v5'
CANVAS = (320, 320)

FILES = {
    'stand': 'jirai_stand.png',
    'jump': 'jirai_jump.png',
    'peace': 'jirai_peace.png',
    'uruuru': 'jirai_uruuru.png',
    'gorogoro': 'jirai_gorogoro.png',
    'haku': 'jirai_haku.png',
}


def qsave(im: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    q = im.convert('RGBA').quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    q.save(path, optimize=True)


def center_canvas(im: Image.Image) -> Image.Image:
    if im.width > CANVAS[0] or im.height > CANVAS[1]:
        raise RuntimeError(f'Original {im.size} exceeds fixed canvas {CANVAS}')
    out = Image.new('RGBA', CANVAS, (0, 0, 0, 0))
    out.alpha_composite(im, ((CANVAS[0] - im.width)//2, (CANVAS[1] - im.height)//2))
    return out


def rich_face_cell(src: Image.Image, index: int) -> Image.Image:
    row, col = divmod(index, 4)
    cell = src.crop((col*362, row*543, (col+1)*362, (row+1)*543))
    y0 = 145 if row == 0 else 0
    return cell.crop((40, y0, 322, y0+260)).resize((200, 205), Image.Resampling.LANCZOS)


def feature(face: Image.Image, box: tuple[int,int,int,int], kind: str) -> tuple[Image.Image, tuple[int,int,int,int]]:
    arr = np.array(face.convert('RGBA'))
    x0,y0,x1,y1 = box
    sub = arr[y0:y1, x0:x1]
    r,g,b = sub[:,:,0], sub[:,:,1], sub[:,:,2]
    seed = ((r < 145) & (g < 130) & (b < 145)) | ((r > 145) & (g < 135) & (b > 95) & ((r.astype(int)-g.astype(int)) > 25))
    mask = cv2.morphologyEx(seed.astype(np.uint8)*255, cv2.MORPH_CLOSE, np.ones((3,3),np.uint8), iterations=1)
    n, labels, stats, _ = cv2.connectedComponentsWithStats((mask>0).astype(np.uint8), 8)
    ids = [i for i in range(1,n) if stats[i,cv2.CC_STAT_AREA] >= 3]
    if not ids:
        raise RuntimeError(f'No feature component in {box}')
    ids = sorted(ids, key=lambda i:stats[i,cv2.CC_STAT_AREA], reverse=True)[:3]
    keep = np.zeros_like(mask)
    for i in ids:
        keep[labels==i] = 255
    if kind == 'eye':
        contours,_ = cv2.findContours(keep, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        filled = np.zeros_like(keep)
        for contour in contours:
            if cv2.contourArea(contour) > 25:
                cv2.drawContours(filled, [contour], -1, 255, -1)
            else:
                cv2.drawContours(filled, [contour], -1, 255, 1)
        keep = filled
    keep = cv2.dilate(keep, np.ones((2,2),np.uint8), iterations=1)
    ys,xs = np.where(keep>0)
    bx0,bx1,by0,by1 = xs.min(),xs.max()+1,ys.min(),ys.max()+1
    crop = sub[by0:by1,bx0:bx1].copy()
    crop[:,:,3] = keep[by0:by1,bx0:bx1]
    return Image.fromarray(crop, 'RGBA'), (x0+bx0,y0+by0,x0+bx1,y0+by1)


def feature_bank(expr: Image.Image) -> list[dict[str, tuple[Image.Image, tuple[int,int,int,int]]]]:
    bank=[]
    for idx in range(8):
        face=rich_face_cell(expr,idx)
        bank.append({
            'left': feature(face,(45,105,95,165),'eye'),
            'right': feature(face,(115,105,165,165),'eye'),
            'mouth': feature(face,(80,150,125,190),'mouth'),
        })
    return bank


def skin_fill(out: Image.Image, source: Image.Image, box: tuple[int,int,int,int]) -> None:
    arr=np.array(source.convert('RGBA'))
    x0,y0,x1,y1=box
    sample=arr[y0:y1,x0:x1,:3]
    r,g,b=sample[:,:,0],sample[:,:,1],sample[:,:,2]
    skin=(r>205)&(g>150)&(b>120)&((r.astype(int)-g.astype(int))<90)
    vals=sample[skin]
    color=tuple(np.median(vals,axis=0).astype(np.uint8)) if len(vals) else (248,215,190)
    patch=Image.new('RGBA',(x1-x0,y1-y0),color+(255,))
    alpha=Image.new('L',patch.size,0)
    d=ImageDraw.Draw(alpha); d.rounded_rectangle((0,0,patch.width-1,patch.height-1), radius=6, fill=255)
    alpha=alpha.filter(ImageFilter.GaussianBlur(.8)); patch.putalpha(alpha)
    out.alpha_composite(patch,(x0,y0))


def compose_face(base: Image.Image, bank, eye_index: int, mouth_index: int, mouth_scale: float=1.0) -> Image.Image:
    out=base.copy()
    skin_fill(out, base, (87,87,120,114)); skin_fill(out, base, (136,87,169,114)); skin_fill(out, base, (113,117,143,135))
    scale=.72; sx0=105.; sy0=140.; dx0=128.; dy0=101.
    parts=[bank[eye_index]['left'], bank[eye_index]['right'], bank[mouth_index]['mouth']]
    for idx,(im,(x0,y0,x1,y1)) in enumerate(parts):
        cx=(x0+x1)/2; cy=(y0+y1)/2
        use_scale=scale*(mouth_scale if idx==2 else 1.0)
        w=max(1,round(im.width*use_scale)); h=max(1,round(im.height*use_scale))
        im=im.resize((w,h),Image.Resampling.LANCZOS)
        dx=round(dx0+(cx-sx0)*scale-w/2); dy=round(dy0+(cy-sy0)*scale-h/2)
        out.alpha_composite(im,(dx,dy))
    return out


def contact(items: list[tuple[str,Image.Image]], path: Path, cols=4) -> None:
    cw,ch=340,360; rows=(len(items)+cols-1)//cols
    sheet=Image.new('RGB',(cw*cols,ch*rows),(238,238,238))
    for i,(label,im) in enumerate(items):
        card=Image.new('RGBA',(cw,ch),(255,255,255,255)); card.alpha_composite(im,((cw-im.width)//2,8)); ImageDraw.Draw(card).text((10,335),label,fill='black')
        sheet.paste(card.convert('RGB'),((i%cols)*cw,(i//cols)*ch))
    path.parent.mkdir(parents=True,exist_ok=True); sheet.save(path,quality=93)


def main() -> None:
    for key,name in FILES.items():
        if not (ORIGINAL/name).exists(): raise SystemExit(f'Missing original asset: {ORIGINAL/name}')
    if OUT.exists(): shutil.rmtree(OUT)
    if QA.exists(): shutil.rmtree(QA)
    STATES.mkdir(parents=True); TALK.mkdir(parents=True); QA.mkdir(parents=True)
    originals={k:Image.open(ORIGINAL/v).convert('RGBA') for k,v in FILES.items()}
    expr=Image.open(EXPR_PATH).convert('RGBA'); bank=feature_bank(expr)
    stand=originals['stand']

    derived={
        'neutral': compose_face(stand,bank,0,0),
        'angry': compose_face(stand,bank,5,5),
        'annoyed': compose_face(stand,bank,5,0),
        'sad': compose_face(stand,bank,4,4),
        'surprised': compose_face(stand,bank,3,3),
        'embarrassed': compose_face(stand,bank,0,1,.72),
        'scared': compose_face(stand,bank,3,4),
        'smug': compose_face(stand,bank,5,0),
        'confused': compose_face(stand,bank,0,4),
    }
    raw_states=[
        ('neutral','기본',derived['neutral'],'idle'),
        ('happy','행복',stand,'happy_bob'),
        ('excited','신남',originals['jump'],'bounce'),
        ('teasing','장난',originals['peace'],'tiny_sway'),
        ('pleading','울망',originals['uruuru'],'tiny_sway'),
        ('relaxed','느긋',originals['gorogoro'],'slow_sway'),
        ('sick','아픔',originals['haku'],'weak_sway'),
        ('angry','화남',derived['angry'],'micro_shake'),
        ('annoyed','삐짐',derived['annoyed'],'side_sway'),
        ('sad','슬픔',derived['sad'],'sad_sink'),
        ('surprised','놀람',derived['surprised'],'startle'),
        ('embarrassed','부끄러움',derived['embarrassed'],'shy_sway'),
        ('scared','겁남',derived['scared'],'shiver'),
        ('smug','의기양양',derived['smug'],'smug_hold'),
        ('confused','갸웃',derived['confused'],'head_tilt'),
        ('love','좋아!',stand,'heart_bob'),
    ]
    manifest_states=[]; qa=[]
    for i,(sid,label,im,motion) in enumerate(raw_states):
        fixed=center_canvas(im); name=f'{i:02d}_{sid}.png'; qsave(fixed,STATES/name); manifest_states.append({'id':sid,'label':label,'src':f'assets/runtime-v5/states/{name}','motion':motion});qa.append((f'{i:02d} {sid}',fixed))

    blink=center_canvas(compose_face(stand,bank,1,0)); qsave(blink,OUT/'blink.png')

    mouth_specs=[(0,1.0),(1,.48),(1,.68),(1,.88),(7,1.0),(3,.9)]
    talk=[]; talk_paths=[]
    for i,(mi,ms) in enumerate(mouth_specs):
        frame=center_canvas(compose_face(stand,bank,0,mi,ms)); name=f'mouth_{i}.png';qsave(frame,TALK/name);talk.append((f'mouth {i}',frame));talk_paths.append(f'assets/runtime-v5/talk/{name}')

    contact(qa,QA/'states_contact.jpg')
    contact([('neutral',center_canvas(derived['neutral'])),('blink',blink)],QA/'blink_contact.jpg',cols=2)
    contact(talk,QA/'talk_contact.jpg',cols=3)

    manifest={
        'version':5,'renderer':'reference-full-sprite-fixed-canvas','canvas':[320,320],
        'display':{'width':560,'height':560,'x':360,'y':360},'states':manifest_states,
        'blink':{'src':'assets/runtime-v5/blink.png','safe_states':['neutral'],'min_interval_ms':2800,'max_interval_ms':6200,'duration_ms':150},
        'lip_sync':{'frames':talk_paths,'safe_states':['neutral'],'thresholds':[.08,.2,.38,.58,.78], 'note':'Full pre-baked reference-proportion sprites; no runtime mouth coordinates.'},
        'qa':{'status':'reference-locked-prototype','rules':['All runtime states are 320x320.','Six user reference PNGs are preserved pixel-for-pixel before fixed-canvas centering.','Derived expressions modify only facial features offline.','Runtime uses no independent character part positioning.']}
    }
    (OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    pngs=list(OUT.rglob('*.png')); problems=[]
    for p in pngs:
        im=Image.open(p)
        if im.size != CANVAS:problems.append(f'{p.name}: {im.size}')
        if im.convert('RGBA').getchannel('A').getbbox() is None:problems.append(f'{p.name}: empty')
    total=sum(p.stat().st_size for p in pngs)
    if total>3*1024*1024:problems.append(f'budget {total}')
    if len(manifest_states)!=16:problems.append('state count')
    if problems:raise SystemExit('\n'.join(problems))
    report={'runtime_png_count':len(pngs),'runtime_png_bytes':total,'runtime_png_kib':round(total/1024,1),'budget_bytes':3*1024*1024,'budget_used_percent':round(total/(3*1024*1024)*100,1),'all_canvas_sizes_equal':True,'reference_assets':6,'qa_pass':True}
    (QA/'report.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report,indent=2))

if __name__=='__main__':main()
