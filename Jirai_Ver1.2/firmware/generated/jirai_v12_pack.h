#pragma once
#include <stdint.h>

// Auto-generated binary format contract for firmware/generated/jirai_v12_active58_rgb565a8.jpak.
// Pixels are stored per part as a little-endian RGB565 plane followed by an A8 plane.
#define JIRAI_PACK_MAGIC "JRA1PKG"
#define JIRAI_PACK_VERSION 1
#define JIRAI_PACK_PART_COUNT 58
#define JIRAI_PACK_HEADER_BYTES 32
#define JIRAI_PACK_ENTRY_BYTES 36
#define JIRAI_PACK_CANVAS_W 600
#define JIRAI_PACK_CANVAS_H 900

typedef enum {
  JIRAI_PART_H01 = 0,
  JIRAI_PART_H02 = 1,
  JIRAI_PART_H03 = 2,
  JIRAI_PART_H04 = 3,
  JIRAI_PART_H05 = 4,
  JIRAI_PART_H06 = 5,
  JIRAI_PART_F01 = 6,
  JIRAI_PART_F02 = 7,
  JIRAI_PART_F03 = 8,
  JIRAI_PART_E01 = 9,
  JIRAI_PART_E02 = 10,
  JIRAI_PART_E03 = 11,
  JIRAI_PART_E04 = 12,
  JIRAI_PART_E05 = 13,
  JIRAI_PART_E06 = 14,
  JIRAI_PART_E07 = 15,
  JIRAI_PART_E08 = 16,
  JIRAI_PART_E09 = 17,
  JIRAI_PART_E10 = 18,
  JIRAI_PART_E11 = 19,
  JIRAI_PART_E12 = 20,
  JIRAI_PART_E13 = 21,
  JIRAI_PART_E14 = 22,
  JIRAI_PART_B01 = 23,
  JIRAI_PART_B02 = 24,
  JIRAI_PART_B03 = 25,
  JIRAI_PART_B04 = 26,
  JIRAI_PART_B05 = 27,
  JIRAI_PART_B06 = 28,
  JIRAI_PART_M01 = 29,
  JIRAI_PART_M02 = 30,
  JIRAI_PART_M03 = 31,
  JIRAI_PART_M04 = 32,
  JIRAI_PART_M05 = 33,
  JIRAI_PART_M06 = 34,
  JIRAI_PART_M07 = 35,
  JIRAI_PART_M08 = 36,
  JIRAI_PART_T01 = 37,
  JIRAI_PART_T02 = 38,
  JIRAI_PART_T03 = 39,
  JIRAI_PART_T04 = 40,
  JIRAI_PART_A01 = 41,
  JIRAI_PART_A02 = 42,
  JIRAI_PART_A03 = 43,
  JIRAI_PART_A04 = 44,
  JIRAI_PART_A05 = 45,
  JIRAI_PART_A06 = 46,
  JIRAI_PART_A07 = 47,
  JIRAI_PART_A08 = 48,
  JIRAI_PART_A09 = 49,
  JIRAI_PART_A10 = 50,
  JIRAI_PART_L01 = 51,
  JIRAI_PART_L02 = 52,
  JIRAI_PART_L03 = 53,
  JIRAI_PART_L04 = 54,
  JIRAI_PART_L05 = 55,
  JIRAI_PART_L06 = 56,
  JIRAI_PART_L07 = 57,
} JiraiPartIndex;

#pragma pack(push, 1)
typedef struct {
  char magic[8];
  uint16_t version;
  uint16_t part_count;
  uint32_t table_offset;
  uint32_t data_offset;
  uint16_t canvas_w;
  uint16_t canvas_h;
  uint32_t flags;
  uint32_t reserved;
} JiraiPackHeader;

typedef struct {
  char id[4];
  uint16_t original_w;
  uint16_t original_h;
  uint16_t trim_x;
  uint16_t trim_y;
  uint16_t trim_w;
  uint16_t trim_h;
  int16_t center_dx_q4;
  int16_t center_dy_q4;
  uint32_t data_offset;
  uint32_t rgb565_bytes;
  uint32_t alpha8_bytes;
  uint32_t crc32;
} JiraiPackEntry;
#pragma pack(pop)

static inline float jirai_q4_to_float(int16_t q4) { return (float)q4 / 16.0f; }
