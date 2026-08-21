from __future__ import annotations

import json
from collections import deque
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PARTS = ROOT / "assets/generated/parts/parts_sheet_gothic_lolita_chibi_paperdoll_02.png"
FACE = ROOT / "assets/generated/sprites/sprite_sheet_chibi_expression_parts_01.png"
MOUTH = ROOT / "assets/generated/sprites/sprite_sheet_cute_expressions_and_blush_02.png"
OUT = ROOT / "assets/runtime"
WORK = OUT / "parts_v0"


def border_white_alpha(image: Image.Image, tol: int = 36, pad: int = 4) -> Image.Image:
    arr = np.array(image.convert("RGBA"))
    rgb = arr[:, :, :3].astype(np.int16)
    h, w = rgb.shape[:2]
    candidate = 255 - rgb.min(axis=2) < tol
    visited = np.zeros((h, w), dtype=bool)
    queue: deque[tuple[int, int]] = deque()

    for x in range(w):
        for y in (0, h - 1):
            if candidate[y, x] and not visited[y, x]:
                visited[y, x] = True
                queue.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if candidate[y, x] and not visited[y, x]:
                visited[y, x] = True
                queue.append((y, x))

    while queue:
        y, x = queue.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            yy, xx = y + dy, x + dx
            if 0 <= yy < h and 0 <= xx < w and candidate[yy, xx] and not visited[yy, xx]:
                visited[yy, xx] = True
                queue.append((yy, xx))

    arr[:, :, 3] = np.where(visited, 0, 255).astype(np.uint8)
    result = Image.fromarray(arr, "RGBA")
    bbox = result.getchannel("A").getbbox()
    if bbox:
        result = result.crop(bbox)
    if pad:
        padded = Image.new("RGBA", (result.width + 2 * pad, result.height + 2 * pad), (0, 0, 0, 0))
        padded.alpha_composite(result, (pad, pad))
        result = padded
    return result


def contour_sprite(image: Image.Image, pad: int = 4) -> Image.Image:
    arr = np.array(image.convert("RGBA"))
    rgb = arr[:, :, :3]
    mask = ((255 - rgb.min(axis=2)) > 12).astype(np.uint8) * 255
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    fill = np.zeros_like(mask)
    if contours:
        contour = max(contours, key=cv2.contourArea)
        cv2.drawContours(fill, [contour], -1, 255, -1)
    arr[:, :, 3] = fill
    result = Image.fromarray(arr, "RGBA")
    bbox = result.getchannel("A").getbbox()
    if bbox:
        result = result.crop(bbox)
    padded = Image.new("RGBA", (result.width + 2 * pad, result.height + 2 * pad), (0, 0, 0, 0))
    padded.alpha_composite(result, (pad, pad))
    return padded


def mouth_sprite(image: Image.Image, pad: int = 4) -> Image.Image:
    arr = np.array(image.convert("RGBA"))
    rgb = arr[:, :, :3].astype(np.int16)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    selected = (r > 135) & ((r - g) > 30) & ((r - b) > 20) & (g < 150)
    mask = selected.astype(np.uint8) * 255
    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask, 8)
    keep = np.zeros_like(mask)
    if count > 1:
        indexes = sorted(range(1, count), key=lambda i: stats[i, cv2.CC_STAT_AREA], reverse=True)[:2]
        for index in indexes:
            if stats[index, cv2.CC_STAT_AREA] >= 5:
                keep[labels == index] = 255
    arr[:, :, 3] = keep
    result = Image.fromarray(arr.astype(np.uint8), "RGBA")
    bbox = result.getchannel("A").getbbox()
    if bbox:
        result = result.crop(bbox)
    padded = Image.new("RGBA", (result.width + 2 * pad, result.height + 2 * pad), (0, 0, 0, 0))
    padded.alpha_composite(result, (pad, pad))
    return padded


def save(name: str, image: Image.Image, max_dim: int | None = None) -> None:
    if max_dim and max(image.size) > max_dim:
        scale = max_dim / max(image.size)
        image = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    image.save(WORK / name, optimize=True)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    WORK.mkdir(parents=True, exist_ok=True)

    parts = Image.open(PARTS).convert("RGBA")
    face = Image.open(FACE).convert("RGBA")
    mouth = Image.open(MOUTH).convert("RGBA")

    def part_crop(box):
        return border_white_alpha(parts.crop(box))

    def face_crop(box):
        return border_white_alpha(face.crop(box))

    save("hair_front.png", part_crop((600, 65, 980, 410)), 340)
    save("body_dress.png", part_crop((120, 435, 545, 690)), 340)
    save("skirt_upperlegs.png", part_crop((575, 445, 940, 725)), 340)
    save("arm_left.png", part_crop((1000, 380, 1135, 595)), 220)
    save("arm_right.png", part_crop((1185, 380, 1325, 595)), 220)
    save("leg_left.png", part_crop((250, 700, 405, 1020)), 280)
    save("leg_right.png", part_crop((475, 700, 630, 1020)), 280)
    save("bunny_clip_left.png", contour_sprite(parts.crop((1015, 175, 1145, 310))), 120)
    save("bunny_clip_right.png", contour_sprite(parts.crop((1160, 175, 1310, 310))), 120)

    blank = mouth.crop((35, 735, 245, 900)).convert("RGBA")
    arr = np.array(blank)
    rgb = arr[:, :, :3]
    h, w = rgb.shape[:2]
    yy, xx = np.ogrid[:h, :w]
    ellipse = ((xx - w / 2) / (w * 0.38)) ** 2 + ((yy - h * 0.43) / (h * 0.55)) ** 2 < 1
    skin = rgb[
        ellipse
        & (rgb[:, :, 0] > 225)
        & (rgb[:, :, 1] > 175)
        & (rgb[:, :, 1] < 245)
        & (rgb[:, :, 2] > 150)
        & (rgb[:, :, 2] < 235)
    ]
    reference = np.median(skin, axis=0).astype(np.uint8) if len(skin) else np.array([252, 220, 196], dtype=np.uint8)
    holes = ellipse & (rgb.min(axis=2) > 247)
    rgb[holes] = reference
    arr[:, :, :3] = rgb
    save("face_blank.png", border_white_alpha(Image.fromarray(arr, "RGBA")), 230)

    save("eyes_open_pair.png", face_crop((445, 115, 720, 255)), 270)
    save("eyes_half_pair.png", face_crop((770, 115, 1050, 255)), 270)
    save("eyes_sparkle_pair.png", face_crop((735, 430, 975, 585)), 260)
    save("eyes_closed_pair.png", face_crop((1080, 435, 1330, 585)), 260)
    save("brows_neutral_pair.png", face_crop((60, 685, 350, 750)), 270)
    save("brows_angry_pair.png", face_crop((400, 680, 695, 750)), 270)
    save("brows_sad_pair.png", face_crop((1040, 680, 1330, 750)), 270)

    centers = [145, 355, 560, 770, 995, 1215]
    mouths = ["mouth_closed", "mouth_small", "mouth_medium", "mouth_open", "mouth_wide", "mouth_smile_open"]
    for x, name in zip(centers, mouths):
        save(f"{name}.png", mouth_sprite(mouth.crop((x - 45, 540, x + 45, 625))), 80)

    files = sorted(WORK.glob("*.png"))
    atlas_width = 1024
    padding = 8
    x = y = padding
    row_height = 0
    rects: dict[str, list[int]] = {}
    images: list[tuple[Path, Image.Image]] = []

    for path in files:
        image = Image.open(path).convert("RGBA")
        images.append((path, image))
        if x + image.width + padding > atlas_width:
            x = padding
            y += row_height + padding
            row_height = 0
        rects[path.stem] = [x, y, image.width, image.height]
        x += image.width + padding
        row_height = max(row_height, image.height)

    atlas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    for path, image in images:
        px, py, _, _ = rects[path.stem]
        atlas.alpha_composite(image, (px, py))

    indexed = atlas.quantize(colors=128, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    indexed.save(OUT / "jirai_runtime_atlas_v0.png", optimize=True)

    manifest = {
        "version": 0,
        "atlas": "jirai_runtime_atlas_v0.png",
        "size": [1024, 1024],
        "format": "indexed PNG RGBA",
        "target_fps": [15, 30, 60],
        "firmware_ready": False,
        "rects": rects,
        "source_map": {
            "body": str(PARTS.relative_to(ROOT)).replace("\\", "/"),
            "face": str(FACE.relative_to(ROOT)).replace("\\", "/"),
            "mouth": str(MOUTH.relative_to(ROOT)).replace("\\", "/"),
        },
        "qa": {
            "status": "prototype",
            "known_issues": [
                "face blank still needs final manual cleanup",
                "hair/twin-tail rig anchors are not finalized",
                "mouth and eye placement must be tuned on the assembled model",
            ],
        },
    }
    (OUT / "jirai_runtime_atlas_v0.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    total = sum(path.stat().st_size for path in WORK.glob("*.png"))
    print(f"Generated {len(files)} runtime parts; unpacked PNG total={total} bytes")
    print(f"Atlas={(OUT / 'jirai_runtime_atlas_v0.png').stat().st_size} bytes")


if __name__ == "__main__":
    main()
