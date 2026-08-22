#include "jirai_pack_reader.h"

#include <string.h>

#define JIRAI_REQUIRED_FLAGS 0x00000007u

static int add_overflows_size(size_t a, size_t b, size_t limit) {
  return a > limit || b > limit - a;
}

uint32_t jirai_pack_crc32(const void *data, size_t size, uint32_t seed) {
  const uint8_t *p = (const uint8_t *)data;
  uint32_t crc = ~seed;
  for (size_t i = 0; i < size; ++i) {
    crc ^= p[i];
    for (unsigned bit = 0; bit < 8; ++bit) {
      const uint32_t mask = (uint32_t)-(int32_t)(crc & 1u);
      crc = (crc >> 1) ^ (0xEDB88320u & mask);
    }
  }
  return ~crc;
}

JiraiPackResult jirai_pack_open(JiraiPackView *view, const void *bytes, size_t size) {
  if (!view || !bytes) return JIRAI_PACK_ERR_ARGUMENT;
  memset(view, 0, sizeof(*view));
  if (size < sizeof(JiraiPackHeader)) return JIRAI_PACK_ERR_HEADER;

  memcpy(&view->header, bytes, sizeof(view->header));
  if (memcmp(view->header.magic, "JRA1PKG\0", 8) != 0) return JIRAI_PACK_ERR_HEADER;
  if (view->header.version != JIRAI_PACK_VERSION) return JIRAI_PACK_ERR_FORMAT;
  if (view->header.part_count != JIRAI_PACK_PART_COUNT) return JIRAI_PACK_ERR_FORMAT;
  if ((view->header.flags & JIRAI_REQUIRED_FLAGS) != JIRAI_REQUIRED_FLAGS) return JIRAI_PACK_ERR_FORMAT;
  if (view->header.canvas_w != JIRAI_PACK_CANVAS_W || view->header.canvas_h != JIRAI_PACK_CANVAS_H) {
    return JIRAI_PACK_ERR_FORMAT;
  }

  const size_t table_bytes = (size_t)view->header.part_count * sizeof(JiraiPackEntry);
  if (view->header.table_offset < sizeof(JiraiPackHeader)) return JIRAI_PACK_ERR_BOUNDS;
  if (add_overflows_size(view->header.table_offset, table_bytes, size)) return JIRAI_PACK_ERR_BOUNDS;
  if (view->header.data_offset < view->header.table_offset + table_bytes || view->header.data_offset > size) {
    return JIRAI_PACK_ERR_BOUNDS;
  }

  view->bytes = (const uint8_t *)bytes;
  view->size = size;
  return JIRAI_PACK_OK;
}

JiraiPackResult jirai_pack_get(const JiraiPackView *view, uint16_t index, JiraiPackPartView *part) {
  if (!view || !view->bytes || !part) return JIRAI_PACK_ERR_ARGUMENT;
  if (index >= view->header.part_count) return JIRAI_PACK_ERR_BOUNDS;

  const size_t row_offset = (size_t)view->header.table_offset + (size_t)index * sizeof(JiraiPackEntry);
  if (add_overflows_size(row_offset, sizeof(JiraiPackEntry), view->size)) return JIRAI_PACK_ERR_BOUNDS;
  memcpy(&part->entry, view->bytes + row_offset, sizeof(part->entry));

  const uint32_t pixels = (uint32_t)part->entry.trim_w * (uint32_t)part->entry.trim_h;
  if (part->entry.trim_w == 0 || part->entry.trim_h == 0) return JIRAI_PACK_ERR_FORMAT;
  if ((uint32_t)part->entry.trim_x + part->entry.trim_w > part->entry.original_w) return JIRAI_PACK_ERR_FORMAT;
  if ((uint32_t)part->entry.trim_y + part->entry.trim_h > part->entry.original_h) return JIRAI_PACK_ERR_FORMAT;
  if (part->entry.rgb565_bytes != pixels * 2u || part->entry.alpha8_bytes != pixels) return JIRAI_PACK_ERR_FORMAT;

  const size_t payload_bytes = (size_t)part->entry.rgb565_bytes + part->entry.alpha8_bytes;
  if (part->entry.data_offset < view->header.data_offset) return JIRAI_PACK_ERR_BOUNDS;
  if (add_overflows_size(part->entry.data_offset, payload_bytes, view->size)) return JIRAI_PACK_ERR_BOUNDS;
  part->rgb565 = view->bytes + part->entry.data_offset;
  part->alpha8 = part->rgb565 + part->entry.rgb565_bytes;
  return JIRAI_PACK_OK;
}

JiraiPackResult jirai_pack_find(const JiraiPackView *view, const char id[4], JiraiPackPartView *part) {
  if (!view || !id || !part) return JIRAI_PACK_ERR_ARGUMENT;
  char padded[4] = {0, 0, 0, 0};
  for (size_t i = 0; i < 4 && id[i]; ++i) padded[i] = id[i];
  for (uint16_t i = 0; i < view->header.part_count; ++i) {
    JiraiPackPartView candidate;
    const JiraiPackResult rc = jirai_pack_get(view, i, &candidate);
    if (rc != JIRAI_PACK_OK) return rc;
    if (memcmp(candidate.entry.id, padded, sizeof(padded)) == 0) {
      *part = candidate;
      return JIRAI_PACK_OK;
    }
  }
  return JIRAI_PACK_ERR_NOT_FOUND;
}

JiraiPackResult jirai_pack_validate_all(const JiraiPackView *view, int verify_crc) {
  if (!view || !view->bytes) return JIRAI_PACK_ERR_ARGUMENT;
  size_t previous_end = view->header.data_offset;
  for (uint16_t i = 0; i < view->header.part_count; ++i) {
    JiraiPackPartView part;
    const JiraiPackResult rc = jirai_pack_get(view, i, &part);
    if (rc != JIRAI_PACK_OK) return rc;
    if (part.entry.data_offset < previous_end) return JIRAI_PACK_ERR_BOUNDS;
    const size_t payload_bytes = (size_t)part.entry.rgb565_bytes + part.entry.alpha8_bytes;
    previous_end = (size_t)part.entry.data_offset + payload_bytes;
    if (verify_crc) {
      const uint32_t crc = jirai_pack_crc32(part.rgb565, payload_bytes, 0);
      if (crc != part.entry.crc32) return JIRAI_PACK_ERR_CRC;
    }
  }
  return previous_end <= view->size ? JIRAI_PACK_OK : JIRAI_PACK_ERR_BOUNDS;
}
