#pragma once

#include <stdint.h>

#include "generated/jirai_v12_motion.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
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
} JiraiAnimPose;

typedef struct {
  uint8_t previous_emotion;
  uint8_t emotion;
  uint8_t transition_q8;
  uint8_t blink_open_q8;
  uint8_t mouth_override;
  uint8_t mouth_a;
  uint8_t mouth_b;
  uint8_t mouth_mix_q8;
  uint8_t gesture;
  uint16_t gesture_elapsed_ms;
  JiraiAnimPose pose;
} JiraiAnimFrame;

typedef struct {
  uint8_t previous_emotion;
  uint8_t emotion;
  uint8_t mouth_open_q8;
  uint8_t reserved;
  uint32_t transition_started_ms;
  uint32_t gesture_started_ms;
  uint32_t blink_started_ms;
  uint32_t next_blink_ms;
  uint32_t rng;
  JiraiAnimPose from_pose;
  JiraiAnimPose pose;
} JiraiAnimState;

void jirai_anim_init(JiraiAnimState *state, uint32_t now_ms, uint32_t seed);
void jirai_anim_set_emotion(JiraiAnimState *state, JiraiEmotionId emotion, uint32_t now_ms);
void jirai_anim_set_mouth_open(JiraiAnimState *state, uint8_t mouth_open_q8);
void jirai_anim_force_blink(JiraiAnimState *state, uint32_t now_ms);
void jirai_anim_update(JiraiAnimState *state, uint32_t now_ms, JiraiAnimFrame *frame);

#ifdef __cplusplus
}
#endif
