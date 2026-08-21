from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PARTS = ROOT / "assets/runtime/parts_v0"


def keep_hair_pixels(path: Path, pad: int = 4) -> None:
    image = Image.open(path).convert("RGBA")
    arr = np.array(image)
    rgb = arr[:, :, :3].astype(np.int16)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]

    # Preserve the dark brown/black hair and the saturated pink accent stripe.
    core = ((r < 115) & (g < 95) & (b < 105)) | (
        (r > 145) & ((r - g) > 45) & ((r - b) > 15) & (g < 155)
    )
    dilated = cv2.dilate(core.astype(np.uint8), np.ones((3, 3), np.uint8), iterations=1).astype(bool)
    non_white = rgb.min(axis=2) < 245
    mask = core | (dilated & non_white)

    count, labels, stats, _ = cv2.connectedComponentsWithStats(mask.astype(np.uint8), 8)
    keep = np.zeros(mask.shape, dtype=np.uint8)
    for index in range(1, count):
        if stats[index, cv2.CC_STAT_AREA] >= 10:
            keep[labels == index] = 255

    arr[:, :, 3] = keep
    result = Image.fromarray(arr.astype(np.uint8), "RGBA")
    bbox = result.getchannel("A").getbbox()
    if bbox:
        result = result.crop(bbox)

    padded = Image.new("RGBA", (result.width + pad * 2, result.height + pad * 2), (0, 0, 0, 0))
    padded.alpha_composite(result, (pad, pad))
    padded.save(path, optimize=True)


def main() -> None:
    for name in ("hair_front.png", "twin_tail_left.png", "twin_tail_right.png"):
        path = PARTS / name
        if not path.exists():
            raise SystemExit(f"Missing runtime part: {path}")
        keep_hair_pixels(path)
        print(f"Refined {path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
