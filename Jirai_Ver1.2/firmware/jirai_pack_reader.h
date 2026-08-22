#pragma once

#include <stddef.h>
#include <stdint.h>

#include "generated/jirai_v12_pack.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef enum {
  JIRAI_PACK_OK = 0,
  JIRAI_PACK_ERR_ARGUMENT = -1,
  JIRAI_PACK_ERR_HEADER = -2,
  JIRAI_PACK_ERR_BOUNDS = -3,
  JIRAI_PACK_ERR_FORMAT = -4,
  JIRAI_PACK_ERR_CRC = -5,
  JIRAI_PACK_ERR_NOT_FOUND = -6,
} JiraiPackResult;

typedef struct {
  const uint8_t *bytes;
  size_t size;
  JiraiPackHeader header;
} JiraiPackView;

typedef struct {
  JiraiPackEntry entry;
  const uint8_t *rgb565;
  const uint8_t *alpha8;
} JiraiPackPartView;

JiraiPackResult jirai_pack_open(JiraiPackView *view, const void *bytes, size_t size);
JiraiPackResult jirai_pack_get(const JiraiPackView *view, uint16_t index, JiraiPackPartView *part);
JiraiPackResult jirai_pack_find(const JiraiPackView *view, const char id[4], JiraiPackPartView *part);
JiraiPackResult jirai_pack_validate_all(const JiraiPackView *view, int verify_crc);
uint32_t jirai_pack_crc32(const void *data, size_t size, uint32_t seed);

// The trimmed sprite center is offset from the original semantic crop center.
// Apply this local offset before the part's scale/rotation around its semantic pivot.
static inline float jirai_pack_center_dx_px(const JiraiPackPartView *part) {
  return jirai_q4_to_float(part->entry.center_dx_q4);
}
static inline float jirai_pack_center_dy_px(const JiraiPackPartView *part) {
  return jirai_q4_to_float(part->entry.center_dy_q4);
}

#ifdef __cplusplus
}
#endif
