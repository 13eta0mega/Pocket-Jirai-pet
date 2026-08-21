from pathlib import Path
import json
import cv2
import numpy as np
from PIL import Image

ATLAS = Path('src/Jirai_Character_Asset.png')
OUT = Path('debug/face_part_map.json')
BASE_RECT = (6, 10, 320, 474)

rgba = np.array(Image.open(ATLAS).convert('RGBA'))
alpha = rgba[:, :, 3]
mask = (alpha > 12).astype(np.uint8)
count, labels, stats, centroids = cv2.connectedComponentsWithStats(mask, 8)
components = []
for i in range(1, count):
    x, y, w, h, area = [int(v) for v in stats[i]]
    if area < 30:
        continue
    components.append({'id': i, 'x': x, 'y': y, 'w': w, 'h': h, 'area': area})

bx, by, bw, bh = BASE_RECT
base = rgba[by:by+bh, bx:bx+bw, :3].copy()

# Face ROIs are intentionally broad; matching determines the exact anchor.
ROIS = {
    'eyes': (35, 55, 250, 150),
    'mouth': (70, 125, 180, 145),
}

def match_component(comp, roi_name, scales=(0.8, 0.9, 1.0, 1.1, 1.2)):
    x, y, w, h = comp['x'], comp['y'], comp['w'], comp['h']
    src = rgba[y:y+h, x:x+w]
    rgb = src[:, :, :3]
    a = src[:, :, 3]
    rx, ry, rw, rh = ROIS[roi_name]
    search = base[ry:ry+rh, rx:rx+rw]
    best = None
    for scale in scales:
        tw = max(2, int(round(w * scale)))
        th = max(2, int(round(h * scale)))
        if tw >= rw or th >= rh:
            continue
        tpl = cv2.resize(rgb, (tw, th), interpolation=cv2.INTER_AREA if scale < 1 else cv2.INTER_CUBIC)
        am = cv2.resize(a, (tw, th), interpolation=cv2.INTER_LINEAR)
        m = (am > 18).astype(np.uint8) * 255
        if int(np.count_nonzero(m)) < 18:
            continue
        try:
            res = cv2.matchTemplate(search, tpl, cv2.TM_SQDIFF_NORMED, mask=m)
        except cv2.error:
            continue
        # OpenCV can emit NaN/Inf on very low-variance templates.
        res = np.nan_to_num(res, nan=9.0, posinf=9.0, neginf=9.0)
        min_val, _, min_loc, _ = cv2.minMaxLoc(res)
        if best is None or min_val < best['score']:
            best = {
                'score': float(min_val),
                'scale': float(scale),
                'match_rect': [int(rx + min_loc[0]), int(ry + min_loc[1]), int(tw), int(th)],
            }
    if best is None:
        return None
    opaque = int(np.count_nonzero(a > 18))
    best.update({
        'source_rect': [x, y, w, h],
        'source_center': [round(x+w/2, 2), round(y+h/2, 2)],
        'opaque_pixels': opaque,
        'fill_ratio': round(opaque / max(1, w*h), 5),
        'aspect': round(w / max(1, h), 4),
    })
    return best

# Atlas layout: face-expression rows occupy the middle band. Keep filters broad.
eye_candidates = [c for c in components if 430 <= c['y'] <= 650 and 12 <= c['w'] <= 100 and 8 <= c['h'] <= 100]
mouth_candidates = [c for c in components if 545 <= c['y'] <= 790 and 10 <= c['w'] <= 110 and 6 <= c['h'] <= 70]

eyes = [m for c in eye_candidates if (m := match_component(c, 'eyes'))]
mouths = [m for c in mouth_candidates if (m := match_component(c, 'mouth', (0.7,0.8,0.9,1.0,1.1,1.2,1.3)))]
eyes.sort(key=lambda m: m['score'])
mouths.sort(key=lambda m: m['score'])

# Add shape rankings useful for choosing alternate mouth poses even if they do not match neutral.
by_open_area = sorted(mouths, key=lambda m: (m['fill_ratio'] * m['source_rect'][3], m['source_rect'][3]), reverse=True)
by_thin = sorted(mouths, key=lambda m: (m['fill_ratio'], m['source_rect'][3]))

result = {
    'atlas': {'path': str(ATLAS), 'size': [int(rgba.shape[1]), int(rgba.shape[0])]},
    'base_rect': list(BASE_RECT),
    'rois': ROIS,
    'component_count': len(components),
    'best_eye_matches': eyes[:18],
    'best_mouth_matches': mouths[:24],
    'mouth_open_shape_candidates': by_open_area[:16],
    'mouth_thin_shape_candidates': by_thin[:16],
}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps(result, indent=2))
