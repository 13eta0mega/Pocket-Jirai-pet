# Pocket-Jirai-pet

Reference-preserving desk-pet animation runtime for **PC + ESP32-S3**.

## Current runtime: v5

The earlier dynamic cutout/paper-doll renderer was retired after visual QA found alpha, coordinate, scale, and body-proportion errors. Runtime v5 locks the character to the six original reference PNGs supplied for the project and uses a fixed **320×320** sprite canvas.

- Six original reference PNGs stored in `assets/original/`
- 16 full pre-baked emotion/pose states
- Six pre-baked full-sprite lip-sync frames
- Pre-baked blink frame
- No runtime arm/leg/skirt/hair/face-part coordinates
- Only whole-sprite breathing, sway, rotation, bounce, and cross-fade are calculated at runtime
- Browser targets: 15 / 30 / 60 FPS
- ESP32-S3 asset budget gate: **<= 3 MiB**
- GitHub Actions rebuilds and validates the runtime automatically

Generated outputs:

- `assets/runtime-v5/`
- `qa/runtime-v5/states_contact.jpg`
- `qa/runtime-v5/blink_contact.jpg`
- `qa/runtime-v5/talk_contact.jpg`
- `qa/runtime-v5/report.json`

The QA pipeline rejects non-320×320 runtime sprites, empty images, an over-3-MiB asset set, a wrong state count, and duplicate emotion sprite files. It also records SHA-256 hashes of the six original source PNGs.

## Run

Open `index.html` through GitHub Pages or any static HTTP server.

## Embedded direction

PC and ESP32-S3 should consume the same state IDs and fixed-canvas sprite model. This intentionally avoids SVG tracing and dynamic cutout placement so the original raster character appearance remains stable on both targets.
