# Pocket-Jirai-pet

Lightweight raster-rig desk pet runtime targeting **PC + ESP32-S3**.

## Current prototype

- Browser preview using Canvas 2D
- Dedicated `rig-lab.html` atlas-rig QA page
- 16 emotion states from shared JSON parameters
- Automatic blink
- Breathing / idle sway
- Independent twin-tail sway
- MouthOpenY and lip-sync test
- 15 / 30 / 60 FPS preview modes
- Reference overlay and part-bound QA modes
- Source-preserving raster workflow instead of PNG-to-SVG tracing

## Runtime asset pipeline

The generated character sheets under `assets/generated/` are **authoring/reference assets**. They are not loaded as animation frames on the embedded target.

GitHub Actions automatically runs:

1. `tools/build_runtime_assets.py`
2. `tools/repack_runtime_atlas.py`
3. `tools/generate_firmware_tables.py`

The output is:

- `assets/runtime/jirai_runtime_atlas_v0.png` — 1024×1024 indexed PNG atlas
- `assets/runtime/jirai_runtime_atlas_v0.json` — atlas rect map and QA metadata
- `assets/runtime/parts_v0/` — extracted working parts
- `firmware/generated/jirai_runtime_table.h` — ESP32-friendly asset rectangles and 16 emotion states

Atlas packing is bounds-checked in CI and the runtime asset directory is rejected if it exceeds the **3 MiB** project budget.

## Target

- ESP32-S3 LCD: **15–30 FPS**
- Total character assets: **<= 3 MiB**
- Shared animation-state model between PC and embedded runtime
- Avoid storing full animation frames
- Use independent small raster parts, pivots, parameters and later low-poly deformation where useful

## Browser test

Main preview:

`https://13eta0mega.github.io/Pocket-Jirai-pet/`

Atlas Rig Lab v3:

`https://13eta0mega.github.io/Pocket-Jirai-pet/rig-lab.html`

The Rig Lab renders the same atlas/parameter data intended for the MCU path. It includes reference overlay, part bounds, blink/lip QA and FPS limiting.

## Firmware status

The atlas and generated C table are available, but `firmware_ready` remains `false` while the face blank, part placement and twin-tail top edges are being visually tuned. Do not freeze the v0 artwork into production firmware yet.
