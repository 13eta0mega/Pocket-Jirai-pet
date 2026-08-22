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

The reference silhouette measurements used as a coarse geometry gate are approximately:

- normalized character width: `0.888`
- normalized character height: `0.897`
- normalized center X: `0.511`
- normalized center Y: `0.495`

These values are not treated as a pixel-identical target. They prevent the rig from drifting back to the previous tall/narrow assembly while visual inspection remains the final criterion.

## Current neutral layout (1.2.2)

Internal rig canvas: `600 x 900`.

Key anchors:

- head pivot: `(300, 275)`
- face center: `(300, 258)`
- eyes: `(225, 260)` / `(375, 260)`
- brows: `(226, 216)` / `(374, 216)`
- mouth center: `(300, 314)`
- twin-tail centers: `(100, 238)` / `(500, 238)`
- bunny clips: `(135, 126)` / `(465, 126)`
- body pivot: `(300, 365)`
- skirt center: `(300, 550)`
- hip/leg pivots: `(244, 598)` / `(356, 598)`
- shoe centers: `(244, 805)` / `(356, 805)`

The reference-matching pass widens the head/twin-tail silhouette, slightly flattens the back/front hair vertically, spreads the eyes, widens the neutral arm stance, and shortens the lower-body vertical extent. The selected active semantic parts are unchanged.

### Latest Chromium geometry result

The actual transparent pixels rendered in Chromium currently occupy:

- bounds: `x=38..564`, `y=45..849`
- width: `527 / 600 = 0.8783`
- height: `805 / 900 = 0.8944`
- center X: `0.5025`
- center Y: `0.4972`

This passes the current reference-frame geometry gate and is substantially closer to the supplied neutral reference than the earlier tall/narrow assembly.

`T01` is still the approved torso semantic part, but the runtime renders only its center section to remove bare shoulder lobes; independently animated sleeve/arm sprites provide the shoulder silhouette. No unapproved atlas part is introduced by this seam cleanup.

`A05` remains the approved raised-left-arm semantic part. Its source crop contains a disconnected neighbouring triangle, so `src/part-cleanup.js` keeps only the main alpha-connected component. Browser QA currently measures `14564` opaque source pixels, keeps `12001`, removes `2563`, and reduces the crop to one retained component.

## Pivot motion

Major sprite movement is now attachment-point based:

- `A01-A06`: shoulder pivots
- `L02/L03/L07` and shoes: hip pivots
- `H03/H04`: twin-tail root pivots
- `A07-A10`: actual pre-drawn two-arm composites with only subtle whole-pose offsets

This avoids rotating long limb sprites around their visual center, which was one of the main causes of the earlier unnatural motion.

## Runtime QA requirements

- 58 and only 58 semantic IDs are available to the renderer.
- Every referenced semantic ID must exist in the runtime config.
- Source rectangles must stay within the 1254 x 1254 atlas bounds.
- Neutral assembly must stay inside the reference-frame geometry tolerances used by browser QA.
- Neutral blink must visibly swap to `E03/E04`.
- `MouthOpenY > 0` must use `M03/M04/M05` instead of stretching `M01`.
- Emotion transitions crossfade sprite state changes while spring motion handles pivots/pose movement.
- Actual arm/hand and leg sprites provide major pose changes; micro-mesh deformation is secondary only.
- A05 cleanup must remove disconnected pixels/components before the raised-arm sprite is rendered.
- Browser QA must report `pivotSpriteMotion`, `shoulderPivotMotion`, `hipPivotMotion`, and `hairRootPivotMotion` as enabled.
