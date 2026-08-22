# Jirai Ver1.2 Parts Index

## Policy

- Every meaningful sprite region in `Jirai_Character_Parts2.png` through `Jirai_Character_Parts9.png` is catalogued separately.
- Runtime rendering is restricted to the approved 58 semantic IDs only.
- A catalogued region is not automatically allowed in the renderer.
- New runtime parts must be explicitly promoted into the semantic allow-list.
- Draft03 enforces one indexed component for each of the 58 active semantic IDs.

## Full catalogue

The current component catalogue contains **754 indexed regions**:

| Sheet | Indexed regions | Active semantic regions |
| --- | ---: | ---: |
| Parts2 | 86 | 6 |
| Parts3 | 72 | 3 |
| Parts4 | 179 | 14 |
| Parts5 | 109 | 6 |
| Parts6 | 119 | 8 |
| Parts7 | 36 | 4 |
| Parts8 | 47 | 10 |
| Parts9 | 106 | 7 |
| **Total** | **754** | **58** |

The complete per-sheet CSV catalogues are stored in `docs/parts-index/Parts2.csv` through `Parts9.csv`. `selected_by_active_set=True` means that component is currently promoted into the runtime allow-list.

`docs/parts-index/ACTIVE58.csv` is the explicit semantic-to-component runtime map. It also records intentional runtime cleanup/crop differences such as `T01` shoulder-lobe removal and `A05` detached-component masking.

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
- `A01-A06` rotate about shoulder attachment pivots, not about the middle of the PNG crop.
- `L02/L03/L07` and their shoes move about hip pivots, avoiding the rubber-leg appearance of center-based mesh rotation.
- `H03/H04` twin tails use hair-root pivots for secondary motion.
- Composite arm poses `A07-A10` remain actual pre-drawn arm/hand sprites and may receive only subtle whole-pose offset/rotation.
- The renderer may crop/mask an approved semantic part for seam cleanup, but it may not import an unapproved atlas region.

## A05 cleanup

`A05` maps only to indexed component `P8-013`. Its source rectangle also contains a disconnected dark triangle outside the intended raised-arm artwork. Runtime cleanup keeps the largest alpha-connected component from the approved `A05` crop before rendering. This is a mask/cleanup of the same approved semantic part; it does not promote `P8-020` or any other inactive region.

Browser QA records the cleanup statistics and requires the crop to go from multiple alpha-connected components to a single retained component before the excited/raised-arm pose is accepted.
