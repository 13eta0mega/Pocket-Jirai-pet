#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import struct
import zlib
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "config" / "jirai-v12-atlas.json"
OUT_DIR = ROOT / "firmware" / "generated"
PACK_PATH = OUT_DIR / "jirai_v12_active58_rgb565a8.jpak"
MANIFEST_PATH = OUT_DIR / "jirai_v12_active58_manifest.json"
HEADER_PATH = OUT_DIR / "jirai_v12_pack.h"

MAGIC = b"JRA1PKG\0"
FORMAT_VERSION = 1
FORMAT_NAME = "RGB565_PLANAR_A8"
MAX_PACKAGE_BYTES = 3 * 1024 * 1024
HEADER_STRUCT = struct.Struct("<8sHHIIHHII")  # 32 bytes
ENTRY_STRUCT = struct.Struct("<4s6H2h4I")     # 36 bytes


def rgb888_to_rgb565(rgb: np.ndarray) -> np.ndarray:
    r = rgb[:, :, 0].astype(np.uint16)
    g = rgb[:, :, 1].astype(np.uint16)
    b = rgb[:, :, 2].astype(np.uint16)
    r5 = (r * 31 + 127) // 255
    g6 = (g * 63 + 127) // 255
    b5 = (b * 31 + 127) // 255
    return ((r5 << 11) | (g6 << 5) | b5).astype("<u2")


def alpha_bbox(alpha: np.ndarray) -> tuple[int, int, int, int]:
    ys, xs = np.nonzero(alpha)
    if len(xs) == 0:
        return 0, 0, 1, 1
    x0 = int(xs.min())
    y0 = int(ys.min())
    x1 = int(xs.max()) + 1
    y1 = int(ys.max()) + 1
    return x0, y0, x1 - x0, y1 - y0


def q4(value: float) -> int:
    encoded = int(round(value * 16.0))
    if not -32768 <= encoded <= 32767:
        raise ValueError(f"Q4 value out of range: {value}")
    return encoded


def c_id(part_id: str) -> str:
    return "JIRAI_PART_" + part_id


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    cfg = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    parts = cfg.get("parts", {})
    if len(parts) != 58:
        raise SystemExit(f"expected 58 active parts, got {len(parts)}")
    if not cfg.get("atlas", {}).get("offlineClean"):
        raise SystemExit("ESP32 pack must be built from the offline-clean Active58 atlas")
    if set(cfg.get("sheets", {})) != {"atlas"}:
        raise SystemExit("ESP32 pack expects exactly one generated atlas sheet")

    atlas_path = ROOT / cfg["sheets"]["atlas"]
    with Image.open(atlas_path) as atlas_image:
        atlas = atlas_image.convert("RGBA")

    ordered_ids = list(parts.keys())
    payloads: list[tuple[bytes, bytes]] = []
    manifest_parts = []
    total_trimmed_pixels = 0
    total_original_pixels = 0

    for index, part_id in enumerate(ordered_ids):
        part = parts[part_id]
        sx, sy, sw, sh = map(int, part["src"])
        if sx < 0 or sy < 0 or sx + sw > atlas.width or sy + sh > atlas.height:
            raise SystemExit(f"source rect out of atlas bounds: {part_id}")
        crop = np.array(atlas.crop((sx, sy, sx + sw, sy + sh)), dtype=np.uint8)
        tx, ty, tw, th = alpha_bbox(crop[:, :, 3])
        trimmed = crop[ty:ty + th, tx:tx + tw].copy()
        alpha = trimmed[:, :, 3]
        rgb565 = rgb888_to_rgb565(trimmed[:, :, :3])
        rgb565[alpha == 0] = 0
        rgb_bytes = rgb565.tobytes(order="C")
        alpha_bytes = alpha.tobytes(order="C")
        crc = zlib.crc32(rgb_bytes + alpha_bytes) & 0xFFFFFFFF
        dx = (tx + tw / 2.0) - sw / 2.0
        dy = (ty + th / 2.0) - sh / 2.0
        payloads.append((rgb_bytes, alpha_bytes))
        total_trimmed_pixels += tw * th
        total_original_pixels += sw * sh
        manifest_parts.append({
            "index": index,
            "id": part_id,
            "originalSize": [sw, sh],
            "trim": [tx, ty, tw, th],
            "centerOffsetQ4": [q4(dx), q4(dy)],
            "centerOffsetPx": [dx, dy],
            "rgbBytes": len(rgb_bytes),
            "alphaBytes": len(alpha_bytes),
            "crc32": f"{crc:08x}",
        })

    table_offset = HEADER_STRUCT.size
    data_offset = table_offset + ENTRY_STRUCT.size * len(ordered_ids)
    entries = []
    cursor = data_offset
    for meta, (rgb_bytes, alpha_bytes) in zip(manifest_parts, payloads):
        part_id = meta["id"]
        sw, sh = meta["originalSize"]
        tx, ty, tw, th = meta["trim"]
        dx_q4, dy_q4 = meta["centerOffsetQ4"]
        crc = int(meta["crc32"], 16)
        encoded_id = part_id.encode("ascii")
        if len(encoded_id) > 4:
            raise SystemExit(f"part ID too long for binary table: {part_id}")
        entries.append(ENTRY_STRUCT.pack(
            encoded_id.ljust(4, b"\0"),
            sw, sh, tx, ty, tw, th,
            dx_q4, dy_q4,
            cursor, len(rgb_bytes), len(alpha_bytes), crc,
        ))
        meta["dataOffset"] = cursor
        cursor += len(rgb_bytes) + len(alpha_bytes)

    canvas_w, canvas_h = map(int, cfg.get("canvas", [600, 900]))
    flags = 0x00000001 | 0x00000002 | 0x00000004  # LE | RGB565 | A8
    header = HEADER_STRUCT.pack(
        MAGIC,
        FORMAT_VERSION,
        len(ordered_ids),
        table_offset,
        data_offset,
        canvas_w,
        canvas_h,
        flags,
        0,
    )

    with PACK_PATH.open("wb") as f:
        f.write(header)
        for entry in entries:
            f.write(entry)
        for rgb_bytes, alpha_bytes in payloads:
            f.write(rgb_bytes)
            f.write(alpha_bytes)

    package_bytes = PACK_PATH.stat().st_size
    if package_bytes != cursor:
        raise SystemExit(f"size accounting mismatch: file={package_bytes}, expected={cursor}")
    if package_bytes > MAX_PACKAGE_BYTES:
        raise SystemExit(f"package exceeds 3 MiB target: {package_bytes} bytes")

    # Parse every descriptor back from the produced binary and verify CRCs.
    blob = PACK_PATH.read_bytes()
    unpacked_header = HEADER_STRUCT.unpack_from(blob, 0)
    if unpacked_header[0] != MAGIC or unpacked_header[2] != 58:
        raise SystemExit("header round-trip validation failed")
    for i, expected in enumerate(manifest_parts):
        offset = table_offset + i * ENTRY_STRUCT.size
        row = ENTRY_STRUCT.unpack_from(blob, offset)
        part_id = row[0].rstrip(b"\0").decode("ascii")
        if part_id != expected["id"]:
            raise SystemExit(f"descriptor order mismatch at {i}: {part_id}")
        data_pos, rgb_len, alpha_len, expected_crc = row[-4:]
        payload = blob[data_pos:data_pos + rgb_len + alpha_len]
        if (zlib.crc32(payload) & 0xFFFFFFFF) != expected_crc:
            raise SystemExit(f"payload CRC mismatch: {part_id}")

    sha256 = hashlib.sha256(blob).hexdigest()
    manifest = {
        "format": FORMAT_NAME,
        "magic": MAGIC.rstrip(b"\0").decode("ascii"),
        "formatVersion": FORMAT_VERSION,
        "runtimeVersion": cfg.get("version"),
        "canvas": [canvas_w, canvas_h],
        "partCount": len(ordered_ids),
        "headerBytes": HEADER_STRUCT.size,
        "entryBytes": ENTRY_STRUCT.size,
        "packageBytes": package_bytes,
        "packageMiB": round(package_bytes / (1024 * 1024), 4),
        "limitBytes": MAX_PACKAGE_BYTES,
        "sourceAtlasBytes": atlas_path.stat().st_size,
        "sourceAtlasSize": [atlas.width, atlas.height],
        "originalRectPixels": total_original_pixels,
        "trimmedRectPixels": total_trimmed_pixels,
        "trimmedPixelRatio": round(total_trimmed_pixels / total_original_pixels, 6),
        "rgb565Bytes": total_trimmed_pixels * 2,
        "alpha8Bytes": total_trimmed_pixels,
        "sha256": sha256,
        "parts": manifest_parts,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    enum_lines = [f"  {c_id(pid)} = {i}," for i, pid in enumerate(ordered_ids)]
    header_text = f"""#pragma once
#include <stdint.h>

// Auto-generated binary format contract for firmware/generated/jirai_v12_active58_rgb565a8.jpak.
// Pixels are stored per part as a little-endian RGB565 plane followed by an A8 plane.
#define JIRAI_PACK_MAGIC \"JRA1PKG\"
#define JIRAI_PACK_VERSION {FORMAT_VERSION}
#define JIRAI_PACK_PART_COUNT {len(ordered_ids)}
#define JIRAI_PACK_HEADER_BYTES {HEADER_STRUCT.size}
#define JIRAI_PACK_ENTRY_BYTES {ENTRY_STRUCT.size}
#define JIRAI_PACK_CANVAS_W {canvas_w}
#define JIRAI_PACK_CANVAS_H {canvas_h}

typedef enum {{
{chr(10).join(enum_lines)}
}} JiraiPartIndex;

#pragma pack(push, 1)
typedef struct {{
  char magic[8];
  uint16_t version;
  uint16_t part_count;
  uint32_t table_offset;
  uint32_t data_offset;
  uint16_t canvas_w;
  uint16_t canvas_h;
  uint32_t flags;
  uint32_t reserved;
}} JiraiPackHeader;

typedef struct {{
  char id[4];
  uint16_t original_w;
  uint16_t original_h;
  uint16_t trim_x;
  uint16_t trim_y;
  uint16_t trim_w;
  uint16_t trim_h;
  int16_t center_dx_q4;
  int16_t center_dy_q4;
  uint32_t data_offset;
  uint32_t rgb565_bytes;
  uint32_t alpha8_bytes;
  uint32_t crc32;
}} JiraiPackEntry;
#pragma pack(pop)

static inline float jirai_q4_to_float(int16_t q4) {{ return (float)q4 / 16.0f; }}
"""
    HEADER_PATH.write_text(header_text, encoding="utf-8")

    print(json.dumps({
        "format": FORMAT_NAME,
        "parts": len(ordered_ids),
        "packageBytes": package_bytes,
        "packageMiB": manifest["packageMiB"],
        "trimmedRectPixels": total_trimmed_pixels,
        "trimmedPixelRatio": manifest["trimmedPixelRatio"],
        "sha256": sha256,
    }, indent=2))


if __name__ == "__main__":
    main()
