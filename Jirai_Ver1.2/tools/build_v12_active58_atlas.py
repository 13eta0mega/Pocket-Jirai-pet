#!/usr/bin/env python3
from __future__ import annotations

import copy
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE_CONFIG = ROOT / "config" / "jirai-v12.json"
OUTPUT_CONFIG = ROOT / "config" / "jirai-v12-atlas.json"
OUTPUT_ATLAS = ROOT / "src" / "Jirai_Character_Active58.png"
ATLAS_WIDTH = 1280
PADDING = 2
ALPHA_THRESHOLD = 4


def keep_largest_alpha_component(image: Image.Image) -> tuple[Image.Image, dict]:
    arr = np.array(image.convert("RGBA"), dtype=np.uint8)
    alpha = arr[:, :, 3]
    mask = alpha > ALPHA_THRESHOLD
    h, w = mask.shape
    visited = np.zeros((h, w), dtype=np.uint8)
    components: list[list[int]] = []

    for y in range(h):
        for x in range(w):
            if not mask[y, x] or visited[y, x]:
                continue
            stack = [y * w + x]
            visited[y, x] = 1
            pixels: list[int] = []
            while stack:
                idx = stack.pop()
                pixels.append(idx)
                cy, cx = divmod(idx, w)
                if cx > 0 and mask[cy, cx - 1] and not visited[cy, cx - 1]:
                    visited[cy, cx - 1] = 1
                    stack.append(idx - 1)
                if cx + 1 < w and mask[cy, cx + 1] and not visited[cy, cx + 1]:
                    visited[cy, cx + 1] = 1
                    stack.append(idx + 1)
                if cy > 0 and mask[cy - 1, cx] and not visited[cy - 1, cx]:
                    visited[cy - 1, cx] = 1
                    stack.append(idx - w)
                if cy + 1 < h and mask[cy + 1, cx] and not visited[cy + 1, cx]:
                    visited[cy + 1, cx] = 1
                    stack.append(idx + w)
            components.append(pixels)

    opaque_before = int(mask.sum())
    if not components:
        arr[:] = 0
        return Image.fromarray(arr, "RGBA"), {
            "opaqueBefore": opaque_before,
            "keptPixels": 0,
            "removedPixels": opaque_before,
            "componentsBefore": 0,
            "componentsAfter": 0,
        }

    largest = max(components, key=len)
    keep = np.zeros(h * w, dtype=np.uint8)
    keep[largest] = 1
    keep = keep.reshape(h, w)
    arr[keep == 0] = 0
    return Image.fromarray(arr, "RGBA"), {
        "opaqueBefore": opaque_before,
        "keptPixels": len(largest),
        "removedPixels": max(0, opaque_before - len(largest)),
        "componentsBefore": len(components),
        "componentsAfter": 1,
    }


def main() -> None:
    source = json.loads(SOURCE_CONFIG.read_text(encoding="utf-8"))
    if len(source.get("parts", {})) != 58:
        raise SystemExit(f"expected 58 active parts, got {len(source.get('parts', {}))}")

    prepared = []
    cleanup_stats = {}
    for part_id, part in source["parts"].items():
        sheet_key = str(part["sheet"])
        sheet_path = ROOT / source["sheets"][sheet_key]
        sx, sy, sw, sh = part["src"]
        with Image.open(sheet_path) as sheet:
            crop = sheet.convert("RGBA").crop((sx, sy, sx + sw, sy + sh))
        cleaned, stats = keep_largest_alpha_component(crop)
        cleanup_stats[part_id] = stats
        prepared.append((part_id, part, cleaned))

    prepared.sort(key=lambda item: item[2].height, reverse=True)
    x = y = row_height = max_y = 0
    placements = {}
    for part_id, part, crop in prepared:
        packed_w = crop.width + PADDING * 2
        packed_h = crop.height + PADDING * 2
        if x + packed_w > ATLAS_WIDTH:
            y += row_height
            x = 0
            row_height = 0
        placements[part_id] = [x + PADDING, y + PADDING, crop.width, crop.height]
        x += packed_w
        row_height = max(row_height, packed_h)
        max_y = max(max_y, y + row_height)

    atlas_height = ((max_y + 31) // 32) * 32
    atlas = Image.new("RGBA", (ATLAS_WIDTH, atlas_height), (0, 0, 0, 0))
    for part_id, part, crop in prepared:
        px, py, _, _ = placements[part_id]
        atlas.alpha_composite(crop, (px, py))
    atlas.save(OUTPUT_ATLAS, optimize=True, compress_level=9)

    runtime = copy.deepcopy(source)
    runtime["version"] = "1.2.3-active58-atlas"
    runtime["sheets"] = {"atlas": "src/Jirai_Character_Active58.png"}
    for part_id, part in runtime["parts"].items():
        part["sheet"] = "atlas"
        part["src"] = placements[part_id]
    runtime["atlas"] = {
        "size": [ATLAS_WIDTH, atlas_height],
        "padding": PADDING,
        "offlineClean": True,
        "sourcePartCount": len(runtime["parts"]),
        "removedDetachedPixels": sum(v["removedPixels"] for v in cleanup_stats.values()),
        "cleanupStats": cleanup_stats,
    }
    OUTPUT_CONFIG.write_text(
        json.dumps(runtime, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    # Exact region round-trip check: every generated config rectangle must match
    # the cleaned source crop byte-for-byte.
    with Image.open(OUTPUT_ATLAS) as built:
        built = built.convert("RGBA")
        for part_id, _, crop in prepared:
            px, py, pw, ph = placements[part_id]
            restored = built.crop((px, py, px + pw, py + ph))
            if np.array_equal(np.array(restored), np.array(crop)) is False:
                raise SystemExit(f"atlas round-trip mismatch: {part_id}")

    size = OUTPUT_ATLAS.stat().st_size
    if size > 1_500_000:
        raise SystemExit(f"atlas too large: {size} bytes")
    print(json.dumps({
        "parts": len(runtime["parts"]),
        "atlasSize": [ATLAS_WIDTH, atlas_height],
        "pngBytes": size,
        "removedDetachedPixels": runtime["atlas"]["removedDetachedPixels"],
    }, indent=2))


if __name__ == "__main__":
    main()
