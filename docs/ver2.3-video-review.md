# Jirai Ver2.3 - video review

Source reviewed: `3d test1.mp4` (87.33 s, 30 FPS, 1382x1302).

## Problems visible in Ver2.2

1. Facial masks were horizontally too close to the nose, so eye/brow deformation did not track the actual large eyes.
2. The head weight started too low on the body. Head tilt therefore pulled the neck/upper shoulder region and made the character feel rubbery.
3. Arm masks were too wide toward the torso. Because the FBX has no skeleton, larger arm angles produced torso/garment deformation instead of clean joint motion.
4. Facial deformation was performed after head rotation against unrotated face pivots, which introduced additional shearing during head tilt.
5. Most emotional states were visually too similar; motion frequency was high while meaningful pose difference was small.
6. Test lip-sync and emotion transitions were too fast for a desk-pet presentation.
7. Stretching the original closed-mouth texture did not create a readable open mouth.
8. Hair secondary motion was over-broad for a static welded mesh.

## Ver2.3 changes

- Calibrated the face masks against the actual original FBX vertex projection.
- Eye centers changed from normalized X `0.425 / 0.575` to `0.379 / 0.623`.
- Eye Y moved from `0.805` to `0.782`; mouth center moved to `0.501 / 0.709`.
- Head mask starts at normalized Y `0.615` instead of `0.57`, excluding the shoulder/upper torso.
- Facial deformation is now evaluated before whole-head rotation so the eyes/mouth remain attached to the head.
- Arm influence is narrowed and emotion arm angles are reduced.
- Emotion transitions are slower and body motion is lower amplitude.
- Blink duration changed to ~260 ms with a less destructive minimum eye scale.
- Lip-sync uses slower attack/release and lower test frequencies.
- A front-only procedural mouth interior/tongue shader is added when the mouth opens; no source mesh or texture is replaced.
- Hair sway is reduced and moved toward outer-hair regions.

## Offline QA

- JS syntax checked with Node for `v23-config.js`, `v23-rig.js`, and `app3d-v23.js`.
- Original FBX was parsed directly: 166,066 source vertices / 332,128 triangles.
- Mask coverage was recalculated against the original vertex coordinates.
- V2.2 vs V2.3 mask comparison showed the eye masks moving outward to the actual eye geometry and the head mask removing lower shoulder coverage.
- Original FBX remains undecimated and is still loaded directly in the browser.

## Known limitation

This FBX contains no Skeleton/Skin/BlendShape animation data. Ver2.3 therefore deliberately keeps arm/body deformation conservative. True large arm poses and production-quality phoneme mouth shapes require adding a skeleton and/or facial morph targets to the original 3D asset.
