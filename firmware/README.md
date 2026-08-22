# Jirai Ver1.2 firmware assets

This directory contains the ESP32-S3-side storage and fixed-point motion data derived from the browser-authoring runtime.

## Current validated build

Primary asset package:

```text
firmware/generated/jirai_v12_active58_rgb565a8.jpak
```

Validated properties:

- pixel format: `RGB565_PLANAR_A8`
- semantic parts: `58`
- emotions: `16`
- package size: `2,631,893 bytes` (`2.51 MiB`)
- asset budget gate: `3 MiB`
- fixed-point motion header: `8,716 bytes` source text
- canvas reference: `600 x 900`
- source runtime: `1.2.3-active58-atlas`
- browser emotion parity: verified in CI
- portable reader compile: verified with `-Wall -Wextra -Werror`
- payload CRC32 validation: verified for all parts
- motion table validation: verified in the same C test
- SHA-256: `4118e5292a729f8160996735b7919bc3cc41f99c4fb74aec7df37e39012821f9`

The package is generated from `src/Jirai_Character_Active58.png`; the original eight high-resolution source sheets are not required by the embedded runtime.

## Files

```text
firmware/
  jirai_pack_reader.c
  jirai_pack_reader.h
  generated/
    jirai_v12_active58_rgb565a8.jpak
    jirai_v12_active58_manifest.json
    jirai_v12_pack.h
    jirai_v12_motion.h
    validation.json
  tests/
    test_jirai_pack.c
```

Generators and parity checks:

```text
tools/build_v12_esp32_pack.py
tools/build_v12_motion_tables.py
tools/verify_v12_emotions.mjs
config/jirai-v12-emotions.json
```

`.github/workflows/build-v12-esp32-pack.yml` verifies the browser emotion definitions against the canonical JSON, generates fixed-point motion tables, rebuilds the pixel package, compiles the C reader/test, validates every payload CRC, checks motion presets, and enforces the 3 MiB asset budget.

## Binary layout

The package begins with a 32-byte `JiraiPackHeader`, followed by 58 fixed 36-byte `JiraiPackEntry` rows, followed by pixel payloads.

Each part payload is stored as:

1. little-endian RGB565 plane: `trim_w * trim_h * 2` bytes
2. A8 alpha plane: `trim_w * trim_h` bytes

This is intentionally planar rather than a 3-byte interleaved pixel format. It permits DMA-friendly RGB565 access and independent alpha processing while keeping full 8-bit edge alpha.

The descriptor also stores the original semantic crop size, trim rectangle, and Q4 local-center offset. Therefore future atlas builds may trim transparent borders without changing the rig's semantic center/pivot math.

## Fixed-point motion table

`firmware/generated/jirai_v12_motion.h` contains all 16 browser-aligned emotion presets in a compact MCU-oriented structure.

The generated data includes:

- left/right eye semantic part indexes
- left/right brow semantic part indexes
- mouth semantic part index
- arm-pose enum
- leg-pose enum
- gesture enum
- head angle: signed Q8.8 degrees
- head turn: signed Q1.14
- body lean: signed Q8.8 degrees
- body squash: signed Q1.14
- arm and leg pose offsets: signed Q8.8 degrees
- energy and blush: unsigned 0..255
- blink/idle/transition timing constants

The 16 presets occupy only `16 * 26 = 416 bytes` as compiled constant data, excluding compiler alignment/section metadata.

## ESP-IDF loading strategy

Do not copy the complete 2.51 MiB package into internal RAM. Put it in a dedicated data partition and memory-map it from flash.

Example partition-table entry:

```text
jirai_assets,data,0x40,,0x300000,
```

The exact subtype can be changed to match the final application partition policy. A 3 MiB partition is sufficient for the currently validated package but leaves little growth margin; use a larger partition if later versions add more character data.

Minimal memory-mapped loader outline:

```c
#include "esp_partition.h"
#include "jirai_pack_reader.h"
#include "generated/jirai_v12_motion.h"

const esp_partition_t *part = esp_partition_find_first(
    ESP_PARTITION_TYPE_DATA,
    ESP_PARTITION_SUBTYPE_ANY,
    "jirai_assets");

const void *mapped = NULL;
esp_partition_mmap_handle_t handle = 0;
ESP_ERROR_CHECK(esp_partition_mmap(
    part,
    0,
    part->size,
    ESP_PARTITION_MMAP_DATA,
    &mapped,
    &handle));

JiraiPackView view;
if (jirai_pack_open(&view, mapped, part->size) != JIRAI_PACK_OK) {
    abort();
}
if (jirai_pack_validate_all(&view, 1) != JIRAI_PACK_OK) {
    abort();
}

const JiraiEmotionPreset *preset =
    &kJiraiEmotionPresets[JIRAI_EMOTION_NEUTRAL];

JiraiPackPartView eye;
if (jirai_pack_get(&view, preset->eye_l, &eye) == JIRAI_PACK_OK) {
    // eye.rgb565 -> little-endian RGB565 plane
    // eye.alpha8 -> full 8-bit alpha plane
}
```

CRC validation is appropriate once at asset startup. It should not be repeated every frame.

## Rendering adapter

The `.jpak` file and motion header are storage/animation inputs, not a complete LCD renderer. The embedded adapter should:

- retain the same 58 semantic IDs as the browser runtime;
- keep eyes, brows, mouth, arms, legs, shoes and twin-tails independently addressable;
- use shoulder, hip and hair-root pivots from the authoring data;
- use `E03/E04` for blink;
- use `M03/M04/M05` for lip-sync;
- apply only light deformation/mesh work on top of sprite transforms;
- avoid allocating a full 600x900 RGBA framebuffer;
- composite only the dirty/visible regions needed by the LCD frame;
- keep one reusable RGB565/A8 working buffer if the final graphics API requires an interleaved or transformed representation.

## Geometry note

For a part with semantic center `(cx, cy)`, the package's local trim center offset is:

```c
float dx = jirai_pack_center_dx_px(&part);
float dy = jirai_pack_center_dy_px(&part);
```

Apply `(dx, dy)` in part-local coordinates before scale/rotation around the semantic pivot. In the current build all active source rectangles already span their retained artwork, so the generated trim ratio is 1.0 and the offsets are zero; the descriptor fields are retained so future packing can become more aggressive without changing the format.
