from __future__ import annotations

from collections import deque
from pathlib import Path
import json

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
POSE_PATH = ROOT / 'assets/generated/poses/pose_sheet_bunnyclip_chibi_girl_03.png'
HEAD_PATH = ROOT / 'assets/generated/expressions/expression_sheet_bunnypin_chibi_02.png'
MOUTH_PATH = ROOT / 'assets/generated/sprites/sprite_sheet_cute_expressions_and_blush_02.png'
OUT = ROOT / 'assets/runtime-v4'
STATES = OUT / 'states'
TALK = OUT / 'talk'
QA = ROOT / 'qa/runtime-v4'

CANVAS_W = 320
CANVAS_H = 440
CELL_W = 362
CELL_H = 543
FIXED_W = 286
FIXED_H = 429
FIXED_X = 17
FIXED_Y = 0


def border_alpha(im: Image.Image, tol: int = 38) -> Image.Image:
    arr = np.array(im.convert('RGBA'))
    rgb = arr[:, :, :3].astype(np.int16)
    h, w = rgb.shape[:2]
    candidate = (255 - rgb.min(axis=2)) < tol
    visited = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        for y in (0, h - 1):
            if candidate[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if candidate[y, x] and not visited[y, x]:
                visited[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            yy, xx = y + dy, x + dx
            if 0 <= yy < h and 0 <= xx < w and candidate[yy, xx] and not visited[yy, xx]:
                visited[yy, xx] = True
                q.append((yy, xx))
    arr[:, :, 3] = np.where(visited, 0, 255).astype(np.uint8)
    return Image.fromarray(arr, 'RGBA')


def quantized_save(im: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    q = im.convert('RGBA').quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    q.save(path, optimize=True)


def fixed_pose_cells() -> list[Image.Image]:
    pose = Image.open(POSE_PATH).convert('RGBA')
    x_edges = [0, 362, 724, 1086, 1448]
    y_edges = [0, 543, 1086]
    result: list[Image.Image] = []
    for row in range(2):
        for col in range(4):
            cell = pose.crop((x_edges[col], y_edges[row], x_edges[col + 1], y_edges[row + 1]))
            cell = border_alpha(cell)
            cell = cell.resize((FIXED_W, FIXED_H), Image.Resampling.LANCZOS)
            canvas = Image.new('RGBA', (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
            canvas.alpha_composite(cell, (FIXED_X, FIXED_Y))
            result.append(canvas)
    return result


def extract_head_cells() -> list[Image.Image]:
    src = Image.open(HEAD_PATH).convert('RGBA')
    head_x = [0, 360, 720, 1080, 1448]
    rows = [(360, 680), (690, 1010)]
    result: list[Image.Image] = []
    for y0, y1 in rows:
        for col in range(4):
            cell = src.crop((head_x[col], y0, head_x[col + 1], y1))
            cell = cell.resize((360, 320), Image.Resampling.LANCZOS)
            cell = border_alpha(cell)
            cell = cell.resize((276, 245), Image.Resampling.LANCZOS)
            result.append(cell.crop((38, 0, 238, 205)))
    return result


def expression_sprite(base: Image.Image, head: Image.Image, shift_x: int = 0) -> Image.Image:
    if shift_x:
        shifted = Image.new('RGBA', head.size, (0, 0, 0, 0))
        shifted.alpha_composite(head, (shift_x, 0))
        head = shifted
    polygon = [
        (50, 82), (150, 82), (174, 112), (174, 145),
        (160, 162), (150, 180), (135, 188), (65, 188),
        (50, 180), (40, 162), (26, 145), (26, 112),
    ]
    mask = Image.new('L', head.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.polygon(polygon, fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(1.0))
    patch = head.copy()
    patch.putalpha(mask)
    patch = patch.resize((158, 162), Image.Resampling.LANCZOS)
    out = base.copy()
    out.alpha_composite(patch, (105, 59))
    return out


def blink_sprite(base: Image.Image, closed_head: Image.Image) -> Image.Image:
    out = base.copy()
    base_arr = np.array(base.convert('RGBA'))
    eye_boxes = [(139, 145, 173, 175), (194, 145, 228, 175)]
    for x0, y0, x1, y1 in eye_boxes:
        sample = base_arr[y0:y1, x0:x1, :3]
        r, g, b = sample[:, :, 0], sample[:, :, 1], sample[:, :, 2]
        skin = (r > 205) & (g > 155) & (b > 130) & ((r - g) < 75)
        values = sample[skin]
        color = tuple(np.median(values, axis=0).astype(np.uint8)) if len(values) else (249, 217, 192)
        patch = Image.new('RGBA', (x1 - x0, y1 - y0), color + (255,))
        alpha = Image.new('L', patch.size, 0)
        draw = ImageDraw.Draw(alpha)
        draw.rounded_rectangle((1, 1, patch.width - 2, patch.height - 2), radius=7, fill=255)
        alpha = alpha.filter(ImageFilter.GaussianBlur(1.0))
        patch.putalpha(alpha)
        out.alpha_composite(patch, (x0, y0))

    arr = np.array(closed_head.convert('RGBA'))
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    feature = ((r < 110) & (g < 100) & (b < 110)) | ((r > 145) & (g < 120) & (b > 105) & ((r - g) > 25))
    yy, xx = np.ogrid[:arr.shape[0], :arr.shape[1]]
    feature &= (xx > 15) & (xx < 185) & (yy > 95) & (yy < 175)
    num, labels, stats, centers = cv2.connectedComponentsWithStats(feature.astype(np.uint8), 8)
    ids = [i for i in range(1, num) if stats[i, cv2.CC_STAT_AREA] > 100 and centers[i][1] > 140]
    ids = sorted(ids, key=lambda i: centers[i][0])[:2]
    if len(ids) != 2:
        raise RuntimeError('Could not isolate two closed-eye components')

    eyes: list[Image.Image] = []
    for i in ids:
        x, y, w, h, _ = stats[i]
        pad = 2
        x0, y0 = max(0, x - pad), max(0, y - pad)
        x1, y1 = min(arr.shape[1], x + w + pad), min(arr.shape[0], y + h + pad)
        crop = arr[y0:y1, x0:x1].copy()
        alpha = np.zeros((y1 - y0, x1 - x0), np.uint8)
        alpha[labels[y0:y1, x0:x1] == i] = 255
        alpha = cv2.dilate(alpha, np.ones((2, 2), np.uint8), iterations=1)
        crop[:, :, 3] = alpha
        eyes.append(Image.fromarray(crop, 'RGBA'))

    for eye, center_x in zip(eyes, [157, 211]):
        width = 25
        scale = width / eye.width
        eye = eye.resize((width, max(2, round(eye.height * scale))), Image.Resampling.LANCZOS)
        out.alpha_composite(eye, (center_x - eye.width // 2, 158 - eye.height // 2))
    return out


def clean_neutral_mouth(base: Image.Image) -> Image.Image:
    arr = np.array(base.convert('RGBA'))
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    yy, xx = np.ogrid[:arr.shape[0], :arr.shape[1]]
    roi = (xx > 168) & (xx < 199) & (yy > 174) & (yy < 192)
    pink = (r > 120) & (r > g + 20) & (g < 185) & (b < 200) & roi
    mask = np.zeros(arr.shape[:2], np.uint8)
    mask[pink] = 255
    mask = cv2.dilate(mask, np.ones((5, 5), np.uint8), iterations=1)
    bgr = cv2.cvtColor(arr[:, :, :3], cv2.COLOR_RGB2BGR)
    repaired = cv2.inpaint(bgr, mask, 3, cv2.INPAINT_TELEA)
    arr[:, :, :3] = cv2.cvtColor(repaired, cv2.COLOR_BGR2RGB)
    return Image.fromarray(arr, 'RGBA')


def mouth_shapes() -> list[Image.Image]:
    src = np.array(Image.open(MOUTH_PATH).convert('RGBA'))
    r = src[:, :, 0].astype(int)
    g = src[:, :, 1].astype(int)
    b = src[:, :, 2].astype(int)
    mask = (r > 130) & (g < 150) & (b > 55) & ((r - g) > 35) & ((r - b) > 5)
    mask[:560, :] = False
    mask[650:, :] = False
    num, labels, stats, centers = cv2.connectedComponentsWithStats(mask.astype(np.uint8), 8)
    target_x = [157, 381, 603, 828, 1054, 1280]
    output: list[Image.Image] = []
    for tx in target_x:
        best: tuple[float, int] | None = None
        for i in range(1, num):
            area = int(stats[i, cv2.CC_STAT_AREA])
            cx, cy = centers[i]
            if area < 50:
                continue
            score = abs(cx - tx) + 2 * abs(cy - 611)
            if best is None or score < best[0]:
                best = (float(score), i)
        if best is None:
            raise RuntimeError(f'Mouth component missing near x={tx}')
        i = best[1]
        x, y, w, h, _ = stats[i]
        x0, y0 = max(0, x - 3), max(0, y - 3)
        x1, y1 = min(src.shape[1], x + w + 3), min(src.shape[0], y + h + 3)
        crop = src[y0:y1, x0:x1].copy()
        alpha = np.zeros((y1 - y0, x1 - x0), np.uint8)
        alpha[labels[y0:y1, x0:x1] == i] = 255
        alpha = cv2.dilate(alpha, np.ones((2, 2), np.uint8), iterations=1)
        crop[:, :, 3] = alpha
        output.append(Image.fromarray(crop.astype(np.uint8), 'RGBA'))
    return output


def talking_frames(base: Image.Image) -> list[Image.Image]:
    clean = clean_neutral_mouth(base)
    shapes = mouth_shapes()
    target_widths = [16, 14, 17, 23, 27, 24]
    result: list[Image.Image] = []
    for shape, width in zip(shapes, target_widths):
        scale = width / shape.width
        shape = shape.resize((width, max(2, round(shape.height * scale))), Image.Resampling.LANCZOS)
        out = clean.copy()
        out.alpha_composite(shape, (184 - shape.width // 2, 184 - shape.height // 2))
        result.append(out)
    return result


def qa_contact(images: list[tuple[str, Image.Image]], path: Path, cols: int = 4) -> None:
    cell_w, cell_h = 330, 470
    rows = (len(images) + cols - 1) // cols
    sheet = Image.new('RGBA', (cell_w * cols, cell_h * rows), (240, 240, 240, 255))
    for idx, (label, image) in enumerate(images):
        card = Image.new('RGBA', (cell_w, cell_h), (255, 255, 255, 255))
        card.alpha_composite(image, (5, 5))
        ImageDraw.Draw(card).text((8, 445), label, fill=(0, 0, 0, 255))
        sheet.alpha_composite(card, ((idx % cols) * cell_w, (idx // cols) * cell_h))
    path.parent.mkdir(parents=True, exist_ok=True)
    sheet.convert('RGB').save(path, quality=92)


def main() -> None:
    if OUT.exists():
        import shutil
        shutil.rmtree(OUT)
    STATES.mkdir(parents=True, exist_ok=True)
    TALK.mkdir(parents=True, exist_ok=True)
    QA.mkdir(parents=True, exist_ok=True)

    poses = fixed_pose_cells()
    heads = extract_head_cells()
    expr_shifts = [0, 8, 15, 1, 0, 0, 0, 0]
    expr = [expression_sprite(poses[0], head, expr_shifts[i]) for i, head in enumerate(heads)]

    state_defs = [
        ('neutral', '기본', poses[0], {'motion': 'idle'}),
        ('happy', '행복', poses[4], {'motion': 'happy_bob'}),
        ('excited', '신남', poses[6], {'motion': 'bounce'}),
        ('teasing', '장난', expr[3], {'motion': 'tiny_sway'}),
        ('pleading', '울망', expr[6], {'motion': 'tiny_sway'}),
        ('relaxed', '느긋', poses[7], {'motion': 'slow_sway'}),
        ('sick', '힘빠짐', expr[1], {'motion': 'weak_sway'}),
        ('angry', '화남', expr[1], {'motion': 'micro_shake'}),
        ('annoyed', '삐짐', expr[1], {'motion': 'side_sway'}),
        ('sad', '슬픔', expr[6], {'motion': 'sad_sink'}),
        ('surprised', '놀람', expr[5], {'motion': 'startle'}),
        ('embarrassed', '부끄러움', poses[5], {'motion': 'shy_sway'}),
        ('scared', '겁남', expr[5], {'motion': 'shiver'}),
        ('smug', '의기양양', expr[3], {'motion': 'smug_hold'}),
        ('confused', '갸웃', poses[1], {'motion': 'head_tilt'}),
        ('love', '좋아!', expr[2], {'motion': 'heart_bob'}),
    ]

    qa_states: list[tuple[str, Image.Image]] = []
    manifest_states = []
    for index, (sid, label, image, extra) in enumerate(state_defs):
        name = f'{index:02d}_{sid}.png'
        quantized_save(image, STATES / name)
        qa_states.append((f'{index:02d} {sid}', image))
        manifest_states.append({'id': sid, 'label': label, 'src': f'assets/runtime-v4/states/{name}', **extra})

    blink = blink_sprite(poses[0], heads[2])
    quantized_save(blink, OUT / 'blink.png')

    talk_frames = talking_frames(poses[0])
    talk_paths = []
    for i, image in enumerate(talk_frames):
        name = f'mouth_{i}.png'
        quantized_save(image, TALK / name)
        talk_paths.append(f'assets/runtime-v4/talk/{name}')

    qa_contact(qa_states, QA / 'states_contact.jpg')
    qa_contact([('neutral', poses[0]), ('blink', blink)], QA / 'blink_contact.jpg', cols=2)
    qa_contact([(f'mouth {i}', im) for i, im in enumerate(talk_frames)], QA / 'talk_contact.jpg', cols=3)

    manifest = {
        'version': 4,
        'renderer': 'full-sprite-fixed-canvas',
        'canvas': [CANVAS_W, CANVAS_H],
        'display': {'width': 430, 'height': 591, 'x': 360, 'y': 370},
        'states': manifest_states,
        'blink': {
            'src': 'assets/runtime-v4/blink.png',
            'safe_states': ['neutral'],
            'min_interval_ms': 2800,
            'max_interval_ms': 6200,
            'duration_ms': 150,
        },
        'lip_sync': {
            'frames': talk_paths,
            'safe_states': ['neutral'],
            'thresholds': [0.08, 0.18, 0.34, 0.52, 0.72],
            'note': 'Pre-baked full sprites; no runtime mouth coordinate compositing.',
        },
        'qa': {
            'status': 'stable-prototype',
            'rules': [
                'Every runtime state is exactly 320x440.',
                'Runtime never rescales sprites based on their alpha bounding box.',
                'No independent arm/leg/skirt/head-part positioning is used.',
                'Blink and lip sync use pre-baked full sprites.',
            ],
        },
    }
    (OUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')

    problems: list[str] = []
    runtime_pngs = list(OUT.rglob('*.png'))
    for path in runtime_pngs:
        im = Image.open(path)
        if im.size != (CANVAS_W, CANVAS_H):
            problems.append(f'{path.name}: unexpected size {im.size}')
        bbox = im.convert('RGBA').getchannel('A').getbbox()
        if bbox is None:
            problems.append(f'{path.name}: empty alpha')
        elif bbox[0] < 0 or bbox[1] < 0 or bbox[2] > CANVAS_W or bbox[3] > CANVAS_H:
            problems.append(f'{path.name}: bbox outside canvas {bbox}')
    total = sum(p.stat().st_size for p in runtime_pngs)
    if total > 3 * 1024 * 1024:
        problems.append(f'asset budget exceeded: {total}')
    if problems:
        raise SystemExit('\n'.join(problems))

    report = {
        'runtime_png_count': len(runtime_pngs),
        'runtime_png_bytes': total,
        'runtime_png_kib': round(total / 1024, 1),
        'budget_bytes': 3 * 1024 * 1024,
        'budget_used_percent': round(total / (3 * 1024 * 1024) * 100, 1),
        'all_canvas_sizes_equal': True,
        'qa_pass': True,
    }
    (QA / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
