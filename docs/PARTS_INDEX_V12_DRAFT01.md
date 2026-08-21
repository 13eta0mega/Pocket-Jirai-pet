# Jirai Ver1.2 Selected Parts Index — Draft 01

This document freezes the **selected runtime parts only** before the v1.2 rig is rewritten.

## Runtime policy

- Actual sprite parts are the primary motion source.
- Mesh deformation is secondary and limited to seam smoothing, mild squash/stretch, small perspective correction, and secondary hair motion.
- Blink must use the closed-eye sprites (`E03`, `E04`).
- Lip sync must use actual mouth sprites (`M03` → `M04` → `M05`) instead of mesh-only mouth deformation.
- Arm gestures must swap/move the arm sprites (`A01`–`A10`); mesh is used only for local deformation and transition smoothing.
- Legs use separate leg and shoe sprites (`L02`–`L07`) with pivot motion and limited mesh correction.
- Final assembly must be visually checked against the user's 8-pose assembled reference before emotion/animation code is accepted.

## Index families

| Prefix | Family | Source sheet |
|---|---|---|
| H | hair / bunny clips | Parts2 |
| F | face / blush | Parts3 |
| E | eyes | Parts4 |
| B | brows | Parts5 |
| M | mouth / lip-sync | Parts6 |
| T | torso / outfit | Parts7 |
| A | arms / arm poses | Parts8 |
| L | skirt / legs / shoes | Parts9 |

The exact crop rectangles are stored in `config/parts-index-v12-draft01.json`.

## Current selected set

- Hair: `H01`–`H06`
- Face: `F01`–`F03`
- Eyes: `E01`–`E14`
- Brows: `B01`–`B06`
- Mouth: `M01`–`M08`
- Torso: `T01`–`T04`
- Arms: `A01`–`A10`
- Lower body: `L01`–`L07`

Total: **58 selected parts**.

## Items intentionally left as candidates

The following were indexed but not assigned a final semantic state yet, so the user can confirm them before runtime code changes:

- `B03` / `B04`: brow variant A
- `B05` / `B06`: brow variant B
- `A09`: arm-pose candidate C
- `L06` / `L07`: dynamic leg-pose candidate pair

## Assembly QA gates

Before v1.2 animation work proceeds, the neutral assembled character must pass all of these checks:

1. Head/body/leg proportions match the final 8-pose reference.
2. Face stays centered in the hair without exposed blank gaps.
3. Twin-tail roots align to the head and can move independently.
4. Both arms meet the shoulder seam without detached skin/sleeve artifacts.
5. Skirt/torso seam does not reveal gaps during breathing or body lean.
6. Legs start from the skirt/hip line and shoes remain attached while rotating.
7. Eye swap does not change perceived eye center or scale unexpectedly.
8. Blink uses `E03/E04` and returns exactly to `E01/E02`.
9. Lip-sync uses real mouth sprites and keeps a stable mouth center.
10. Candidate parts are not used until confirmed.

No emotion-state rewrite should be treated as approved until the neutral assembly passes the visual reference comparison first.
