# Runtime asset pipeline

This directory is intentionally generated from the curated image sheets under `assets/generated/`.

The runtime does **not** ship the large generated sheets directly. `tools/build_runtime_assets.py` extracts only the parts needed by the raster rig and packs them into a single 1024 x 1024 indexed RGBA PNG atlas.

## Current prototype target

- ESP32-S3 LCD: 15-30 FPS
- PC browser: up to 60 FPS for preview
- Total firmware asset budget: 3 MiB maximum
- Animation method: sprite swap + pivots + light mesh/bone deformation
- Full-frame animation sequences are avoided

## Selected source sheets

- `assets/generated/parts/parts_sheet_gothic_lolita_chibi_paperdoll_02.png`
- `assets/generated/sprites/sprite_sheet_chibi_expression_parts_01.png`
- `assets/generated/sprites/sprite_sheet_cute_expressions_and_blush_02.png`

The remaining generated sheets are kept as references/pose ideas and are not considered firmware assets.

## Generate

```bash
python tools/build_runtime_assets.py
```

Expected outputs:

```text
assets/runtime/
  jirai_runtime_atlas_v0.png
  jirai_runtime_atlas_v0.json
  parts_v0/
```

In the current prototype extraction, the individual PNG parts total roughly 0.45 MiB and the packed indexed PNG atlas is roughly 60 KiB. Exact sizes can change as cleanup and anchors are finalized.

## QA gate

`firmware_ready` remains `false` until these are checked visually:

1. Face blank has no visible eye/mouth remnants.
2. Eye, brow and mouth anchors align with the face at 1x pixel scale.
3. Hair/twin-tail pivots produce natural idle motion.
4. Alpha edges survive RGB565A8 conversion without halos.
5. 15 FPS and 30 FPS modes remain visually acceptable on the target LCD.

Do not treat automatically extracted `parts_v0` as final production art.
