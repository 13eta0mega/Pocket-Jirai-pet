# Pocket-Jirai-pet

Lightweight **Live2D-like** desk-pet runtime targeting browser first and ESP32-S3 next.

Current development branch: **`Jirai_Ver1.1`**

## Jirai Ver1.1

`src/Jirai_Character_Asset.png` is the single source texture atlas. The browser runtime no longer depends on the retired full-frame `runtime-v4/v5` sprites.

### Runtime architecture

- WebGL2 textured deformation mesh (Canvas2D fallback)
- 330 mesh control vertices over the source character
- Spring-smoothed parameter transitions instead of sprite cross-fades
- Local face deformation for eyes, brows and mouth
- Head angle / pseudo Y-turn deformation
- Body lean, breathing and squash/stretch
- Arm and leg local deformation
- Secondary twin-tail / hair follow physics
- 16 emotion presets with transient gesture envelopes
- Automatic blink with occasional double blink
- Random subtle idle head turns
- Synthetic lip-sync test mode
- Manual `MouthOpenY`
- Microphone RMS lip-sync input in supported browsers
- Lightweight 2D effects for blush, tears, anger, fear, love and sparkles

The runtime is intentionally raster/mesh based. It does **not** trace the character to SVG, so the original painted pixels remain the texture source.

## Browser test

Serve the repository root over HTTP and open `index.html`.

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000/
```

For a quick branch preview without cloning, a GitHub raw HTML proxy such as RawGitHack can also be used:

```text
https://raw.githack.com/13eta0mega/Pocket-Jirai-pet/Jirai_Ver1.1/index.html
```

Microphone input requires a browser context that allows `getUserMedia`; `localhost` is recommended for microphone QA.

## Controls

- 16 emotion buttons: smooth transition into each emotion and gesture
- `테스트 립싱크`: synthetic syllable envelope
- `마이크 입력`: live audio RMS -> mouth opening
- `MouthOpenY`: manual lip-sync control
- `숨쉬기`: idle breathing
- `눈 깜빡임`: automatic blink
- `메쉬 표시`: developer deformation-grid overlay
- `감정 자동 순환`: cycle through emotion states for motion QA

## Automated QA

`.github/workflows/qa-jirai-v11.yml` launches Chromium with Playwright and checks the real browser runtime.

Current checks include:

- character asset loads
- WebGL2/Canvas renderer initializes
- all 16 emotion controls exist
- emotion parameters actually transition
- mouth opens under test control
- blink reaches the closed-eye state
- all animation parameters remain finite/bounded
- render loop stays above the minimum interactive FPS threshold
- no browser console errors

The latest machine-readable report is written to `qa/jirai-v11/report.json`.

## Files

```text
index.html
styles.css
src/
  Jirai_Character_Asset.png
  app.js
  rig-engine.js
config/
  jirai-v11.json
tools/
  qa_browser.mjs
qa/
  jirai-v11/
.github/workflows/
  qa-jirai-v11.yml
  analyze-character-asset.yml
```

## ESP32-S3 direction

The browser implementation is the authoring/QA reference. For ESP32-S3, the same high-level parameters can be retained while the render data is reduced to fixed-point mesh coordinates, a compact texture atlas and a smaller subset of deformation points. This keeps PC and embedded animation behavior aligned without shipping a heavyweight Live2D engine on the MCU.
