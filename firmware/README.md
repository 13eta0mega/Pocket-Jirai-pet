# Jirai Ver1.2 firmware assets

This directory contains the ESP32-S3-side storage format derived from the browser-authoring runtime.

## Current generated package

```text
firmware/generated/jirai_v12_active58_rgb565a8.jpak
```

Validated build properties:

- format: `RGB565_PLANAR_A8`
- semantic parts: `58`
- package size: `2,631,893 bytes` (`2.51 MiB`)
- budget gate: `3 MiB`
- canvas reference: `600 x 900`
- source runtime: `1.2.3-active58-atlas`
- CRC32 is stored per part and checked by the portable C reader
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
    validation.json
  tests/
    test_jirai_pack.c
```

`tools/build_v12_esp32_pack.py` is the deterministic generator. `.github/workflows/build-v12-esp32-pack.yml` rebuilds the package, compiles the C reader with warnings-as-errors, validates every payload CRC, and enforces the 3 MiB asset budget.

## Binary layout

The package begins with a 32-byte `JiraiPackHeader`, followed by 58 fixed 36-byte `JiraiPackEntry` rows, followed by pixel payloads.

Each part payload is stored as:

1. little-endian RGB565 plane: `trim_w * trim_h * 2` bytes
2. A8 alpha plane: `trim_w * trim_h` bytes

This is intentionally planar rather than a 3-byte interleaved pixel format. It permits DMA-friendly RGB565 access and independent alpha processing while keeping full 8-bit edge alpha.

The descriptor also stores the original semantic crop size, trim rectangle, and Q4 local-center offset. Therefore future atlas builds may trim transparent borders without changing the rig's semantic center/pivot math.

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

JiraiPackPartView eye;
if (jirai_pack_find(&view, "E01", &eye) == JIRAI_PACK_OK) {
    // eye.rgb565 -> little-endian RGB565 plane
    // eye.alpha8 -> full 8-bit alpha plane
}
```

CRC validation is appropriate once at asset startup. It should not be repeated every frame.

## Rendering adapter

The `.jpak` file is a flash/storage format, not a complete renderer. The next embedded adapter should:

- retain the same 58 semantic IDs as the browser runtime;
- keep eyes, brows, mouth, arms, legs, shoes and twin-tails independently addressable;
- use shoulder, hip and hair-root pivots from the authoring data;
- use `E03/E04` for blink;
- use `M03/M04/M05` for lip-sync;
- apply only light deformation/mesh work on top of sprite transforms;
- avoid allocating a full 600x900 RGBA framebuffer;
- composite only the dirty/visible regions needed by the LCD frame.

If the final graphics layer expects a packed RGB565A8 representation, adapt one part at a time from the package's two planes into a reusable working buffer rather than expanding the whole package in RAM.

## Geometry note

For a part with semantic center `(cx, cy)`, the package's local trim center offset is:

```c
float dx = jirai_pack_center_dx_px(&part);
float dy = jirai_pack_center_dy_px(&part);
```

Apply `(dx, dy)` in part-local coordinates before scale/rotation around the semantic pivot. In the current build all active source rectangles already span their retained artwork, so the generated trim ratio is 1.0 and the offsets are zero; the descriptor fields are retained so future packing can become more aggressive without changing the format.
