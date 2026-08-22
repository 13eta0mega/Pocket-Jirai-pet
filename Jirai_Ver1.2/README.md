# Pocket-Jirai-pet

Lightweight **Live2D-like** desk-pet runtime targeting browser first and ESP32-S3 next.

Current development branch: **`Jirai_Ver1.2`**

## Jirai Ver1.2

Ver1.2 is rebuilt around split PNG sprite parts rather than a completed-character image.

### Runtime architecture

- 8 high-resolution source sheets: `src/Jirai_Character_Parts2.png` through `Parts9.png`
- 754 indexed source regions for catalogue/search
- strict 58-part semantic runtime allow-list
- generated single runtime atlas: `src/Jirai_Character_Active58.png`
- generated runtime config: `config/jirai-v12-atlas.json`
- runtime atlas is about 1.0 MB PNG and contains only the 58 approved parts
- disconnected source debris is removed offline before atlas packing
- head, face, hair, eyes, brows, mouth, torso, arms, skirt, legs and shoes remain separate sprites
- real closed-eye sprites `E03/E04` for blinking
- real mouth sprites `M03 -> M04 -> M05` for lip-sync
- actual arm and leg sprite swaps/rotations for gestures
- shoulder, hip and twin-tail root pivots for sprite motion
- Spring-smoothed pose parameters and cross-fades between emotion part sets
- micro-mesh/strip deformation only for subtle breathing, body lean and seam smoothing
- 16 emotion presets
- automatic blink and idle head movement
- synthetic lip-sync test mode
- manual `MouthOpenY`
- microphone RMS lip-sync input

The runtime intentionally does **not** trace the character to SVG and does not stretch a single completed-character PNG to fake limb motion.

## Source sheets vs runtime atlas

`config/jirai-v12.json` is the authoring/source mapping for the eight original part sheets. `tools/build_v12_active58_atlas.py` reads that source mapping, keeps the primary alpha-connected artwork for each approved semantic part, packs all 58 parts into one atlas, validates every packed region byte-for-byte, and emits:

```text
src/Jirai_Character_Active58.png
config/jirai-v12-atlas.json
```

The browser loads `jirai-v12-atlas.json` first and falls back to the source-sheet config only when the generated atlas is unavailable.

Current atlas build properties:

- atlas dimensions: `1280 x 896`
- padding: `2 px`
- active parts: `58`
- detached/noise pixels removed offline: `6948`
- PNG target: `< 1.5 MB`

This removes the previous need to download all eight source sheets during normal runtime while preserving the same semantic IDs and layout coordinates.

## Part index

The full component catalogue is stored in:

```text
docs/parts-index/Parts2.csv
...
docs/parts-index/Parts9.csv
```

The semantic/runtime policy is documented in `docs/PARTS_INDEX_V12.md`.

Current totals:

- indexed components: **754**
- active semantic runtime parts: **58**

A catalogued component is not automatically usable by the renderer. Runtime promotion is explicit.

## Browser test

Local:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

GitHub Pages versioned target:

```text
https://13eta0mega.github.io/Pocket-Jirai-pet/Jirai_Ver1.2/
```

Microphone input requires a secure/allowed `getUserMedia` context; localhost or GitHub Pages is appropriate.

## Controls

- 16 emotion buttons
- `테스트 립싱크`: synthetic syllable envelope
- `마이크 입력`: live RMS -> MouthOpenY
- `MouthOpenY`: manual lip-sync control
- `숨쉬기`: idle breathing
- `눈 깜빡임`: automatic real-sprite blink
- `파츠 ID 표시`: rig debugging
- `감정 자동 순환`: emotion-transition QA

## Automated QA

`.github/workflows/qa-jirai-v12.yml` launches Chromium with Playwright and checks the actual browser runtime.

Checks include:

- renderer initializes and assets load
- all 16 emotion controls exist
- exactly 58 active semantic parts
- generated runtime uses one offline-clean atlas
- neutral geometry remains inside the reference-frame tolerances
- all 16 emotion renders are measured, visible and not clipped
- different emotions select distinct eye/mouth/arm/leg combinations
- lip-sync selects M03 / M04 / M05
- blink selects E03/E04
- A05 detached source component is removed by the offline atlas build
- no browser console errors

The machine-readable report and browser captures are written to:

```text
qa/jirai-v12/report.json
qa/jirai-v12/neutral.png
qa/jirai-v12/excited.png
qa/jirai-v12/blink.png
```

## Key files

```text
index.html
styles.css
config/
  jirai-v12.json
  jirai-v12-atlas.json
src/
  Jirai_Character_Parts2.png ... Jirai_Character_Parts9.png
  Jirai_Character_Active58.png
  rig-engine.js
  part-cleanup.js
  pivot-motion.js
  app.js
  runtime-version.txt
tools/
  build_v12_active58_atlas.py
docs/
  PARTS_INDEX_V12.md
  ASSEMBLY_QA_V12.md
  parts-index/
qa/
  jirai-v12/
.github/workflows/
  build-v12-active58-atlas.yml
  qa-jirai-v12.yml
  deploy-jirai-v12-pages.yml
  hosted-probe-v12.yml
```

## ESP32-S3 direction

The browser implementation is the authoring and QA reference. The single Active58 atlas is also a better starting point for the embedded export pipeline: preserve the same semantic IDs, convert selected pixels to the target RGB565/RGB565A8 representation, and quantize the pivot/pose parameters to fixed-point tables. This keeps browser and ESP32 behavior aligned without shipping a heavyweight Cubism runtime on the MCU.
