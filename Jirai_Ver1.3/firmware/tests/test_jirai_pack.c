#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "../jirai_pack_reader.h"
#include "../generated/jirai_v12_motion.h"

static unsigned char *read_file(const char *path, size_t *size_out) {
  FILE *f = fopen(path, "rb");
  if (!f) return NULL;
  if (fseek(f, 0, SEEK_END) != 0) { fclose(f); return NULL; }
  const long end = ftell(f);
  if (end <= 0 || fseek(f, 0, SEEK_SET) != 0) { fclose(f); return NULL; }
  unsigned char *buf = (unsigned char *)malloc((size_t)end);
  if (!buf) { fclose(f); return NULL; }
  if (fread(buf, 1, (size_t)end, f) != (size_t)end) { free(buf); fclose(f); return NULL; }
  fclose(f);
  *size_out = (size_t)end;
  return buf;
}

static int check_id(const JiraiPackView *view, const char *id) {
  JiraiPackPartView part;
  const JiraiPackResult rc = jirai_pack_find(view, id, &part);
  if (rc != JIRAI_PACK_OK) {
    fprintf(stderr, "find %s failed: %d\n", id, rc);
    return 0;
  }
  if (!part.rgb565 || !part.alpha8 || part.entry.trim_w == 0 || part.entry.trim_h == 0) {
    fprintf(stderr, "invalid payload view for %s\n", id);
    return 0;
  }
  return 1;
}

static int check_motion_tables(void) {
  if (JIRAI_EMOTION_COUNT != 16) return 0;
  const JiraiEmotionPreset *neutral = &kJiraiEmotionPresets[JIRAI_EMOTION_NEUTRAL];
  const JiraiEmotionPreset *excited = &kJiraiEmotionPresets[JIRAI_EMOTION_EXCITED];
  const JiraiEmotionPreset *love = &kJiraiEmotionPresets[JIRAI_EMOTION_LOVE];
  if (neutral->eye_l != JIRAI_PART_E01 || neutral->eye_r != JIRAI_PART_E02 || neutral->mouth != JIRAI_PART_M01) return 0;
  if (neutral->arm_pose != JIRAI_ARM_DOWN || neutral->leg_pose != JIRAI_LEG_STRAIGHT) return 0;
  if (excited->eye_l != JIRAI_PART_E11 || excited->mouth != JIRAI_PART_M05 || excited->arm_pose != JIRAI_ARM_RAISED) return 0;
  if (love->eye_l != JIRAI_PART_E13 || love->eye_r != JIRAI_PART_E14 || love->gesture != JIRAI_GESTURE_LOVE) return 0;
  if (JIRAI_TRANSITION_MS != 420 || JIRAI_BLINK_DURATION_MS != 180) return 0;
  return 1;
}

int main(int argc, char **argv) {
  if (argc != 2) {
    fprintf(stderr, "usage: %s <jirai.jpak>\n", argv[0]);
    return 2;
  }

  size_t size = 0;
  unsigned char *bytes = read_file(argv[1], &size);
  if (!bytes) {
    fprintf(stderr, "failed to read %s\n", argv[1]);
    return 2;
  }

  JiraiPackView view;
  JiraiPackResult rc = jirai_pack_open(&view, bytes, size);
  if (rc != JIRAI_PACK_OK) {
    fprintf(stderr, "open failed: %d\n", rc);
    free(bytes);
    return 1;
  }
  rc = jirai_pack_validate_all(&view, 1);
  if (rc != JIRAI_PACK_OK) {
    fprintf(stderr, "validation failed: %d\n", rc);
    free(bytes);
    return 1;
  }

  if (view.header.part_count != 58 || !check_id(&view, "H01") || !check_id(&view, "A05") || !check_id(&view, "L07") || !check_motion_tables()) {
    free(bytes);
    return 1;
  }

  JiraiPackPartView a05;
  if (jirai_pack_find(&view, "A05", &a05) != JIRAI_PACK_OK) {
    free(bytes);
    return 1;
  }
  printf("OK parts=%u emotions=%u bytes=%zu A05=%ux%u rgb=%u alpha=%u crc=%08x\n",
         view.header.part_count,
         (unsigned)JIRAI_EMOTION_COUNT,
         size,
         a05.entry.trim_w,
         a05.entry.trim_h,
         a05.entry.rgb565_bytes,
         a05.entry.alpha8_bytes,
         a05.entry.crc32);
  free(bytes);
  return 0;
}
