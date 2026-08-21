# Jirai Ver1.2 Neutral Assembly QA

The neutral assembly is rebuilt from semantic parts instead of a completed character PNG.

## Reference gate

The first character in the supplied 8-pose reference is the visual target for neutral assembly. The following are checked before accepting motion work:

- head/body/leg proportions
- face centering inside front/back hair
- eye and brow spacing
- mouth center
- bunny clip placement
- shoulder-to-sleeve connection
- torso/bib/bow/collar stacking
- skirt-to-torso seam
- hip-to-leg start position
- shoe attachment and left/right spacing

## Current neutral layout

Internal rig canvas: `600 x 900`.

Key anchors:

- head pivot: `(300, 270)`
- face center: `(300, 252)`
- eyes: `(240, 255)` / `(360, 255)`
- mouth center: `(300, 309)`
- body pivot: `(300, 365)`
- skirt center: `(300, 550)`
- hip/leg pivots: `(250, 607)` / `(350, 607)`

`T01` is still the approved torso semantic part, but the runtime renders only its center section to remove bare shoulder lobes; independently animated sleeve/arm sprites provide the shoulder silhouette. No unapproved atlas part is introduced by this seam cleanup.

## Runtime QA requirements

- 58 and only 58 semantic IDs are available to the renderer.
- Every referenced semantic ID must exist in the runtime config.
- Source rectangles must stay within the 1254 x 1254 atlas bounds.
- Neutral blink must visibly swap to `E03/E04`.
- `MouthOpenY > 0` must use `M03/M04/M05` instead of stretching `M01`.
- Emotion transitions crossfade sprite state changes while spring motion handles pivots/pose movement.
- Micro-mesh deformation is limited to torso/skirt breathing and seam smoothing.
