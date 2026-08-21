# Jirai Ver1.2 Parts Index

## Policy

- Every meaningful sprite region in `Jirai_Character_Parts2.png` through `Jirai_Character_Parts9.png` is catalogued separately.
- Runtime rendering is restricted to the approved 58 semantic IDs only.
- A catalogued region is not automatically allowed in the renderer.
- New runtime parts must be explicitly promoted into the semantic allow-list.

## Runtime allow-list (58)

- Hair: `H01`-`H06`
- Face: `F01`-`F03`
- Eyes: `E01`-`E14`
- Brows: `B01`-`B06`
- Mouth: `M01`-`M08`
- Torso: `T01`-`T04`
- Arms: `A01`-`A10`
- Lower body: `L01`-`L07`

## Mandatory behavior

- Blink uses real closed-eye sprites `E03/E04`.
- Lip sync uses real mouth sprites `M03 -> M04 -> M05` and keeps a stable mouth center.
- Arm gestures swap and move actual arm sprites. Mesh-like deformation is secondary only.
- Legs and shoes remain separate so hip/ankle motion can be animated without stretching a completed-character image.
- The renderer may crop/mask an approved semantic part for seam cleanup, but it may not import an unapproved atlas region.
