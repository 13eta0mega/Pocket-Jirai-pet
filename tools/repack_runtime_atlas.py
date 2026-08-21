from __future__ import annotations

import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets/runtime"
PARTS = OUT / "parts_v0"
MANIFEST = OUT / "jirai_runtime_atlas_v0.json"
ATLAS = OUT / "jirai_runtime_atlas_v0.png"
ATLAS_WIDTH = 1024
ATLAS_HEIGHT = 1024
PADDING = 8


def main() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    sprites: list[tuple[Path, Image.Image]] = []
    for path in PARTS.glob("*.png"):
        sprites.append((path, Image.open(path).convert("RGBA")))

    # Shelf packing works well for this small character set when the tallest
    # sprites are placed first. It also keeps the output deterministic.
    sprites.sort(key=lambda item: (-item[1].height, -item[1].width, item[0].name))

    x = PADDING
    y = PADDING
    row_height = 0
    rects: dict[str, list[int]] = {}

    for path, image in sprites:
        if x + image.width + PADDING > ATLAS_WIDTH:
            x = PADDING
            y += row_height + PADDING
            row_height = 0
        if y + image.height + PADDING > ATLAS_HEIGHT:
            raise SystemExit(
                f"Atlas overflow while placing {path.name}: "
                f"required y={y + image.height + PADDING}, max={ATLAS_HEIGHT}"
            )
        rects[path.stem] = [x, y, image.width, image.height]
        x += image.width + PADDING
        row_height = max(row_height, image.height)

    used_height = y + row_height + PADDING
    atlas = Image.new("RGBA", (ATLAS_WIDTH, ATLAS_HEIGHT), (0, 0, 0, 0))
    by_name = {path.stem: image for path, image in sprites}
    for name, (px, py, _, _) in rects.items():
        atlas.alpha_composite(by_name[name], (px, py))

    indexed = atlas.quantize(colors=128, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    indexed.save(ATLAS, optimize=True)

    manifest["size"] = [ATLAS_WIDTH, ATLAS_HEIGHT]
    manifest["rects"] = rects
    manifest["packing"] = {
        "algorithm": "height-sorted-shelf",
        "padding": PADDING,
        "used_height": used_height,
        "overflow_checked": True,
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print(f"Packed {len(sprites)} parts into {ATLAS_WIDTH}x{ATLAS_HEIGHT}; used height={used_height}")
    print(f"Atlas size={ATLAS.stat().st_size} bytes")


if __name__ == "__main__":
    main()
