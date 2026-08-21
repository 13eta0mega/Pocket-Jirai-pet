# Pocket-Jirai-pet

Lightweight desk-pet animation runtime targeting **PC + ESP32-S3**.

## Stable Runtime v4

The previous runtime paper-doll composition has been retired after visual QA found cutout, coordinate and scale mismatches. Runtime v4 uses a fixed **320×440** sprite canvas for every character state.

- 16 pre-baked emotion/pose states
- Fixed sprite geometry: no runtime arm/leg/skirt/hair coordinates
- Breathing and small idle motions are whole-sprite transforms only
- Blink is a pre-baked full character sprite
- Lip-sync uses six pre-baked full character mouth frames
- Browser targets: 15 / 30 / 60 FPS
- Embedded asset budget gate: <= 3 MiB
- GitHub Actions rebuilds and validates runtime assets from the generated source sheets

Generated outputs live in `assets/runtime-v4/` and QA contact sheets/reports live in `qa/runtime-v4/`.

## Run

Use GitHub Pages or any static HTTP server and open `index.html`.

## ESP32-S3 direction

The browser and firmware should consume the same fixed-canvas state model. The current browser prototype intentionally avoids SVG tracing and dynamic cutout positioning so the original raster character appearance is preserved and the embedded renderer can remain simple.
