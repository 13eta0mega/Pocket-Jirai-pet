# Pocket-Jirai-pet

Lightweight **Live2D-like** desk-pet runtime targeting browser first and ESP32-S3 next.

Current development branch: **`Jirai_Ver1.2`**

## Jirai Ver1.2

Ver1.2 is rebuilt around the user's split PNG sprite atlases rather than a completed-character image.

### Runtime architecture

- 8 source atlases: `src/Jirai_Character_Parts2.png` through `Parts9.png`
- 754 indexed atlas regions for catalogue/search
- strict 58-part semantic runtime allow-list
- head, face, hair, eyes, brows, mouth, torso, arms, skirt, legs and shoes assembled as separate sprites
- real closed-eye sprites `E03/E04` for blinking
- real mouth sprites `M03 -> M04 -> M05` for lip-sync
- actual arm and leg sprite swaps/rotations for gestures
- Spring-smoothed pose parameters and cross-fades between emotion part sets
- micro-mesh/strip deformation only for subtle breathing, body lean and seam smoothing
- secondary hair/twin-tail motion
- 16 emotion presets
- automatic blink and idle head movement
- synthetic lip-sync test mode
- manual `MouthOpenY`
- microphone RMS lip-sync input

The runtime intentionally does **not** trace the character to SVG and does not stretch a single completed-character PNG to fake limb motion.

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

## Sprite cleanup

Some approved source rectangles can contain disconnected neighbouring artwork. `src/part-cleanup.js` cleans only explicitly approved semantic crops before rendering. For example, `A05` keeps the main alpha-connected raised-arm component and removes the detached triangle inside the same crop; it does not substitute an inactive atlas region.

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

- all 8 atlases load
- renderer initializes
- all 16 emotion controls exist
- exactly 58 active semantic parts
- different emotions select distinct eye/mouth/arm/leg combinations
- lip-sync selects M03 / M04 / M05
- blink selects E03/E04
- A05 disconnected sprite artifact is actually removed at pixel/component level
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
src/
  Jirai_Character_Parts2.png ... Jirai_Character_Parts9.png
  rig-engine.js
  part-cleanup.js
  app.js
docs/
  PARTS_INDEX_V12.md
  ASSEMBLY_QA_V12.md
  parts-index/
qa/
  jirai-v12/
.github/workflows/
  qa-jirai-v12.yml
  deploy-jirai-v12-pages.yml
  hosted-probe-v12.yml
```

## ESP32-S3 direction

The browser implementation is the authoring and QA reference. The embedded build should preserve the same semantic part IDs and high-level animation parameters while converting sprite data into compact atlases/fixed-point transform tables. This keeps browser and ESP32 behavior aligned without shipping a heavyweight Cubism runtime on the MCU.
