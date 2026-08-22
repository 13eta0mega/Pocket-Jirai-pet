#pragma once
#include <stdint.h>
#include "jirai_v12_pack.h"

// Auto-generated from config/jirai-v12-emotions.json and config/jirai-v12-atlas.json.
// Browser/runtime equivalence is checked by tools/verify_v12_emotions.mjs.

typedef enum {
  JIRAI_EMOTION_NEUTRAL = 0,
  JIRAI_EMOTION_HAPPY = 1,
  JIRAI_EMOTION_EXCITED = 2,
  JIRAI_EMOTION_TEASING = 3,
  JIRAI_EMOTION_PLEADING = 4,
  JIRAI_EMOTION_RELAXED = 5,
  JIRAI_EMOTION_SICK = 6,
  JIRAI_EMOTION_ANGRY = 7,
  JIRAI_EMOTION_ANNOYED = 8,
  JIRAI_EMOTION_SAD = 9,
  JIRAI_EMOTION_SURPRISED = 10,
  JIRAI_EMOTION_EMBARRASSED = 11,
  JIRAI_EMOTION_SCARED = 12,
  JIRAI_EMOTION_SMUG = 13,
  JIRAI_EMOTION_CONFUSED = 14,
  JIRAI_EMOTION_LOVE = 15,
  JIRAI_EMOTION_COUNT = 16
} JiraiEmotionId;

typedef enum {
  JIRAI_ARM_DOWN = 0,
  JIRAI_ARM_OPEN = 1,
  JIRAI_ARM_RAISED = 2,
  JIRAI_ARM_ONE_RAISED = 3,
  JIRAI_ARM_CROSSED = 4,
  JIRAI_ARM_CHEEK = 5,
  JIRAI_ARM_PALMS = 6,
  JIRAI_ARM_CLASPED = 7,
  JIRAI_ARM_COUNT = 8
} JiraiArmPose;

typedef enum {
  JIRAI_LEG_STRAIGHT = 0,
  JIRAI_LEG_BENT_LEFT = 1,
  JIRAI_LEG_COUNT = 2
} JiraiLegPose;

typedef enum {
  JIRAI_GESTURE_SETTLE = 0,
  JIRAI_GESTURE_HAPPY = 1,
  JIRAI_GESTURE_BOUNCE = 2,
  JIRAI_GESTURE_TEASE = 3,
  JIRAI_GESTURE_PLEAD = 4,
  JIRAI_GESTURE_SLOW = 5,
  JIRAI_GESTURE_SICK = 6,
  JIRAI_GESTURE_ANGRY = 7,
  JIRAI_GESTURE_HUFF = 8,
  JIRAI_GESTURE_SAD = 9,
  JIRAI_GESTURE_STARTLE = 10,
  JIRAI_GESTURE_SHY = 11,
  JIRAI_GESTURE_SHIVER = 12,
  JIRAI_GESTURE_SMUG = 13,
  JIRAI_GESTURE_TILT = 14,
  JIRAI_GESTURE_LOVE = 15,
  JIRAI_GESTURE_COUNT = 16
} JiraiGesture;

typedef struct {
  uint8_t eye_l;
  uint8_t eye_r;
  uint8_t brow_l;
  uint8_t brow_r;
  uint8_t mouth;
  uint8_t arm_pose;
  uint8_t leg_pose;
  uint8_t gesture;
  int16_t head_angle_q8;
  int16_t head_turn_q14;
  int16_t body_lean_q8;
  int16_t body_squash_q14;
  int16_t arm_l_q8;
  int16_t arm_r_q8;
  int16_t leg_l_q8;
  int16_t leg_r_q8;
  uint8_t energy_q8;
  uint8_t blush_q8;
} JiraiEmotionPreset;

_Static_assert(sizeof(JiraiEmotionPreset) == 26, "Unexpected JiraiEmotionPreset packing");

static const JiraiEmotionPreset kJiraiEmotionPresets[JIRAI_EMOTION_COUNT] = {
  [JIRAI_EMOTION_NEUTRAL] = {.eye_l=JIRAI_PART_E01,.eye_r=JIRAI_PART_E02,.brow_l=JIRAI_PART_B01,.brow_r=JIRAI_PART_B02,.mouth=JIRAI_PART_M01,.arm_pose=JIRAI_ARM_DOWN,.leg_pose=JIRAI_LEG_STRAIGHT,.gesture=JIRAI_GESTURE_SETTLE,.head_angle_q8=0,.head_turn_q14=0,.body_lean_q8=0,.body_squash_q14=0,.arm_l_q8=0,.arm_r_q8=0,.leg_l_q8=0,.leg_r_q8=0,.energy_q8=26,.blush_q8=0},
  [JIRAI_EMOTION_HAPPY] = {.eye_l=JIRAI_PART_E03,.eye_r=JIRAI_PART_E04,.brow_l=JIRAI_PART_B03,.brow_r=JIRAI_PART_B04,.mouth=JIRAI_PART_M02,.arm_pose=JIRAI_ARM_OPEN,.leg_pose=JIRAI_LEG_STRAIGHT,.gesture=JIRAI_GESTURE_HAPPY,.head_angle_q8=-384,.head_turn_q14=0,.body_lean_q8=0,.body_squash_q14=0,.arm_l_q8=-1024,.arm_r_q8=1024,.leg_l_q8=0,.leg_r_q8=0,.energy_q8=115,.blush_q8=64},
  [JIRAI_EMOTION_EXCITED] = {.eye_l=JIRAI_PART_E11,.eye_r=JIRAI_PART_E12,.brow_l=JIRAI_PART_B03,.brow_r=JIRAI_PART_B04,.mouth=JIRAI_PART_M05,.arm_pose=JIRAI_ARM_RAISED,.leg_pose=JIRAI_LEG_STRAIGHT,.gesture=JIRAI_GESTURE_BOUNCE,.head_angle_q8=384,.head_turn_q14=0,.body_lean_q8=0,.body_squash_q14=0,.arm_l_q8=-1536,.arm_r_q8=1536,.leg_l_q8=-768,.leg_r_q8=768,.energy_q8=255,.blush_q8=0},
  [JIRAI_EMOTION_TEASING] = {.eye_l=JIRAI_PART_E01,.eye_r=JIRAI_PART_E04,.brow_l=JIRAI_PART_B05,.brow_r=JIRAI_PART_B06,.mouth=JIRAI_PART_M08,.arm_pose=JIRAI_ARM_ONE_RAISED,.leg_pose=JIRAI_LEG_BENT_LEFT,.gesture=JIRAI_GESTURE_TEASE,.head_angle_q8=-1024,.head_turn_q14=1311,.body_lean_q8=-512,.body_squash_q14=0,.arm_l_q8=0,.arm_r_q8=0,.leg_l_q8=0,.leg_r_q8=0,.energy_q8=140,.blush_q8=0},
  [JIRAI_EMOTION_PLEADING] = {.eye_l=JIRAI_PART_E09,.eye_r=JIRAI_PART_E10,.brow_l=JIRAI_PART_B03,.brow_r=JIRAI_PART_B04,.mouth=JIRAI_PART_M07,.arm_pose=JIRAI_ARM_CLASPED,.leg_pose=JIRAI_LEG_STRAIGHT,.gesture=JIRAI_GESTURE_PLEAD,.head_angle_q8=896,.head_turn_q14=0,.body_lean_q8=256,.body_squash_q14=0,.arm_l_q8=0,.arm_r_q8=0,.leg_l_q8=0,.leg_r_q8=0,.energy_q8=31,.blush_q8=38},
  [JIRAI_EMOTION_RELAXED] = {.eye_l=JIRAI_PART_E05,.eye_r=JIRAI_PART_E06,.brow_l=JIRAI_PART_B01,.brow_r=JIRAI_PART_B02,.mouth=JIRAI_PART_M02,.arm_pose=JIRAI_ARM_DOWN,.leg_pose=JIRAI_LEG_STRAIGHT,.gesture=JIRAI_GESTURE_SLOW,.head_angle_q8=-640,.head_turn_q14=-819,.body_lean_q8=307,.body_squash_q14=0,.arm_l_q8=0,.arm_r_q8=0,.leg_l_q8=0,.leg_r_q8=0,.energy_q8=13,.blush_q8=0},
  [JIRAI_EMOTION_SICK] = {.eye_l=JIRAI_PART_E05,.eye_r=JIRAI_PART_E06,.brow_l=JIRAI_PART_B03,.brow_r=JIRAI_PART_B04,.mouth=JIRAI_PART_M07,.arm_pose=JIRAI_ARM_DOWN,.leg_pose=JIRAI_LEG_STRAIGHT,.gesture=JIRAI_GESTURE_SICK,.head_angle_q8=1152,.head_turn_q14=0,.body_lean_q8=563,.body_squash_q14=328,.arm_l_q8=0,.arm_r_q8=0,.leg_l_q8=0,.leg_r_q8=0,.energy_q8=5,.blush_q8=0},
  [JIRAI_EMOTION_ANGRY] = {.eye_l=JIRAI_PART_E07,.eye_r=JIRAI_PART_E08,.brow_l=JIRAI_PART_B05,.brow_r=JIRAI_PART_B06,.mouth=JIRAI_PART_M07,.arm_pose=JIRAI_ARM_CROSSED,.leg_pose=JIRAI_LEG_STRAIGHT,.gesture=JIRAI_GESTURE_ANGRY,.head_angle_q8=-256,.head_turn_q14=0,.body_lean_q8=-512,.body_squash_q14=0,.arm_l_q8=0,.arm_r_q8=0,.leg_l_q8=0,.leg_r_q8=0,.energy_q8=217,.blush_q8=0},
  [JIRAI_EMOTION_ANNOYED] = {.eye_l=JIRAI_PART_E05,.eye_r=JIRAI_PART_E06,.brow_l=JIRAI_PART_B05,.brow_r=JIRAI_PART_B06,.mouth=JIRAI_PART_M07,.arm_pose=JIRAI_ARM_CROSSED,.leg_pose=JIRAI_LEG_STRAIGHT,.gesture=JIRAI_GESTURE_HUFF,.head_angle_q8=-1280,.head_turn_q14=-1311,.body_lean_q8=384,.body_squash_q14=0,.arm_l_q8=0,.arm_r_q8=0,.leg_l_q8=0,.leg_r_q8=0,.energy_q8=31,.blush_q8=0},
  [JIRAI_EMOTION_SAD] = {.eye_l=JIRAI_PART_E09,.eye_r=JIRAI_PART_E10,.brow_l=JIRAI_PART_B03,.brow_r=JIRAI_PART_B04,.mouth=JIRAI_PART_M07,.arm_pose=JIRAI_ARM_DOWN,.leg_pose=JIRAI_LEG_STRAIGHT,.gesture=JIRAI_GESTURE_SAD,.head_angle_q8=1280,.head_turn_q14=0,.body_lean_q8=358,.body_squash_q14=0,.arm_l_q8=0,.arm_r_q8=0,.leg_l_q8=0,.leg_r_q8=0,.energy_q8=8,.blush_q8=0},
  [JIRAI_EMOTION_SURPRISED] = {.eye_l=JIRAI_PART_E11,.eye_r=JIRAI_PART_E12,.brow_l=JIRAI_PART_B03,.brow_r=JIRAI_PART_B04,.mouth=JIRAI_PART_M06,.arm_pose=JIRAI_ARM_PALMS,.leg_pose=JIRAI_LEG_STRAIGHT,.gesture=JIRAI_GESTURE_STARTLE,.head_angle_q8=0,.head_turn_q14=0,.body_lean_q8=0,.body_squash_q14=-328,.arm_l_q8=0,.arm_r_q8=0,.leg_l_q8=0,.leg_r_q8=0,.energy_q8=217,.blush_q8=0},
  [JIRAI_EMOTION_EMBARRASSED] = {.eye_l=JIRAI_PART_E03,.eye_r=JIRAI_PART_E04,.brow_l=JIRAI_PART_B03,.brow_r=JIRAI_PART_B04,.mouth=JIRAI_PART_M03,.arm_pose=JIRAI_ARM_CHEEK,.leg_pose=JIRAI_LEG_STRAIGHT,.gesture=JIRAI_GESTURE_SHY,.head_angle_q8=768,.head_turn_q14=983,.body_lean_q8=0,.body_squash_q14=0,.arm_l_q8=0,.arm_r_q8=0,.leg_l_q8=0,.leg_r_q8=0,.energy_q8=46,.blush_q8=255},
  [JIRAI_EMOTION_SCARED] = {.eye_l=JIRAI_PART_E11,.eye_r=JIRAI_PART_E12,.brow_l=JIRAI_PART_B03,.brow_r=JIRAI_PART_B04,.mouth=JIRAI_PART_M06,.arm_pose=JIRAI_ARM_CLASPED,.leg_pose=JIRAI_LEG_STRAIGHT,.gesture=JIRAI_GESTURE_SHIVER,.head_angle_q8=512,.head_turn_q14=0,.body_lean_q8=0,.body_squash_q14=410,.arm_l_q8=0,.arm_r_q8=0,.leg_l_q8=0,.leg_r_q8=0,.energy_q8=184,.blush_q8=0},
  [JIRAI_EMOTION_SMUG] = {.eye_l=JIRAI_PART_E05,.eye_r=JIRAI_PART_E06,.brow_l=JIRAI_PART_B05,.brow_r=JIRAI_PART_B06,.mouth=JIRAI_PART_M02,.arm_pose=JIRAI_ARM_CROSSED,.leg_pose=JIRAI_LEG_STRAIGHT,.gesture=JIRAI_GESTURE_SMUG,.head_angle_q8=-1152,.head_turn_q14=1311,.body_lean_q8=-307,.body_squash_q14=0,.arm_l_q8=0,.arm_r_q8=0,.leg_l_q8=0,.leg_r_q8=0,.energy_q8=56,.blush_q8=0},
  [JIRAI_EMOTION_CONFUSED] = {.eye_l=JIRAI_PART_E01,.eye_r=JIRAI_PART_E06,.brow_l=JIRAI_PART_B03,.brow_r=JIRAI_PART_B06,.mouth=JIRAI_PART_M01,.arm_pose=JIRAI_ARM_CHEEK,.leg_pose=JIRAI_LEG_STRAIGHT,.gesture=JIRAI_GESTURE_TILT,.head_angle_q8=1792,.head_turn_q14=-819,.body_lean_q8=0,.body_squash_q14=0,.arm_l_q8=0,.arm_r_q8=0,.leg_l_q8=0,.leg_r_q8=0,.energy_q8=51,.blush_q8=0},
  [JIRAI_EMOTION_LOVE] = {.eye_l=JIRAI_PART_E13,.eye_r=JIRAI_PART_E14,.brow_l=JIRAI_PART_B03,.brow_r=JIRAI_PART_B04,.mouth=JIRAI_PART_M02,.arm_pose=JIRAI_ARM_CLASPED,.leg_pose=JIRAI_LEG_STRAIGHT,.gesture=JIRAI_GESTURE_LOVE,.head_angle_q8=-512,.head_turn_q14=0,.body_lean_q8=0,.body_squash_q14=0,.arm_l_q8=0,.arm_r_q8=0,.leg_l_q8=0,.leg_r_q8=0,.energy_q8=184,.blush_q8=140},
};

#define JIRAI_BREATH_HZ_Q16 14418
#define JIRAI_BLINK_MIN_MS 2600
#define JIRAI_BLINK_MAX_MS 6200
#define JIRAI_BLINK_DURATION_MS 180
#define JIRAI_HEAD_TURN_MIN_MS 4200
#define JIRAI_HEAD_TURN_MAX_MS 8500
#define JIRAI_TRANSITION_MS 420

static inline float jirai_q8_to_float(int16_t value) { return (float)value / 256.0f; }
static inline float jirai_q14_to_float(int16_t value) { return (float)value / 16384.0f; }
static inline float jirai_u8_unit_to_float(uint8_t value) { return (float)value / 255.0f; }
