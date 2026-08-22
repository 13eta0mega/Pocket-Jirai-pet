#include "jirai_anim.h"

#include <limits.h>
#include <string.h>

#define JIRAI_BLINK_INACTIVE UINT32_MAX

static uint32_t rng_next(JiraiAnimState *state) {
  state->rng = state->rng * 1664525u + 1013904223u;
  return state->rng;
}

static uint32_t random_blink_delay(JiraiAnimState *state) {
  const uint32_t span = (uint32_t)(JIRAI_BLINK_MAX_MS - JIRAI_BLINK_MIN_MS);
  if (span == 0u) return JIRAI_BLINK_MIN_MS;
  return (uint32_t)JIRAI_BLINK_MIN_MS + (rng_next(state) % (span + 1u));
}

static int time_reached(uint32_t now_ms, uint32_t target_ms) {
  return (int32_t)(now_ms - target_ms) >= 0;
}

static uint8_t clamp_u8_u32(uint32_t value) {
  return value > 255u ? 255u : (uint8_t)value;
}

static uint8_t smoothstep_q8(uint8_t t) {
  const uint32_t x = t;
  const uint32_t x2 = x * x;
  const uint32_t numerator = x2 * (765u - 2u * x);
  const uint32_t denominator = 255u * 255u;
  return clamp_u8_u32((numerator + denominator / 2u) / denominator);
}

static int16_t lerp_i16(int16_t a, int16_t b, uint8_t t) {
  const int32_t delta = (int32_t)b - (int32_t)a;
  return (int16_t)((int32_t)a + (delta * t + (delta >= 0 ? 127 : -127)) / 255);
}

static uint8_t lerp_u8(uint8_t a, uint8_t b, uint8_t t) {
  const int32_t delta = (int32_t)b - (int32_t)a;
  const int32_t value = (int32_t)a + (delta * t + (delta >= 0 ? 127 : -127)) / 255;
  return (uint8_t)(value < 0 ? 0 : value > 255 ? 255 : value);
}

static JiraiAnimPose pose_from_preset(const JiraiEmotionPreset *preset) {
  JiraiAnimPose pose;
  pose.head_angle_q8 = preset->head_angle_q8;
  pose.head_turn_q14 = preset->head_turn_q14;
  pose.body_lean_q8 = preset->body_lean_q8;
  pose.body_squash_q14 = preset->body_squash_q14;
  pose.arm_l_q8 = preset->arm_l_q8;
  pose.arm_r_q8 = preset->arm_r_q8;
  pose.leg_l_q8 = preset->leg_l_q8;
  pose.leg_r_q8 = preset->leg_r_q8;
  pose.energy_q8 = preset->energy_q8;
  pose.blush_q8 = preset->blush_q8;
  return pose;
}

static JiraiAnimPose lerp_pose(const JiraiAnimPose *from, const JiraiEmotionPreset *to, uint8_t t) {
  JiraiAnimPose pose;
  pose.head_angle_q8 = lerp_i16(from->head_angle_q8, to->head_angle_q8, t);
  pose.head_turn_q14 = lerp_i16(from->head_turn_q14, to->head_turn_q14, t);
  pose.body_lean_q8 = lerp_i16(from->body_lean_q8, to->body_lean_q8, t);
  pose.body_squash_q14 = lerp_i16(from->body_squash_q14, to->body_squash_q14, t);
  pose.arm_l_q8 = lerp_i16(from->arm_l_q8, to->arm_l_q8, t);
  pose.arm_r_q8 = lerp_i16(from->arm_r_q8, to->arm_r_q8, t);
  pose.leg_l_q8 = lerp_i16(from->leg_l_q8, to->leg_l_q8, t);
  pose.leg_r_q8 = lerp_i16(from->leg_r_q8, to->leg_r_q8, t);
  pose.energy_q8 = lerp_u8(from->energy_q8, to->energy_q8, t);
  pose.blush_q8 = lerp_u8(from->blush_q8, to->blush_q8, t);
  return pose;
}

static uint8_t transition_progress(uint32_t now_ms, uint32_t started_ms) {
  const uint32_t elapsed = now_ms - started_ms;
  if (elapsed >= (uint32_t)JIRAI_TRANSITION_MS) return 255u;
  const uint32_t linear = (elapsed * 255u + JIRAI_TRANSITION_MS / 2u) / JIRAI_TRANSITION_MS;
  return smoothstep_q8((uint8_t)linear);
}

static uint8_t blink_open(JiraiAnimState *state, uint32_t now_ms) {
  if (state->blink_started_ms == JIRAI_BLINK_INACTIVE) {
    if (time_reached(now_ms, state->next_blink_ms)) {
      state->blink_started_ms = now_ms;
    } else {
      return 255u;
    }
  }

  const uint32_t elapsed = now_ms - state->blink_started_ms;
  if (elapsed >= (uint32_t)JIRAI_BLINK_DURATION_MS) {
    state->blink_started_ms = JIRAI_BLINK_INACTIVE;
    state->next_blink_ms = now_ms + random_blink_delay(state);
    return 255u;
  }

  const uint32_t q = (elapsed * 255u) / JIRAI_BLINK_DURATION_MS;
  const uint32_t close_end = 92u;  // approximately 0.36
  const uint32_t hold_end = 148u;  // approximately 0.58
  if (q < close_end) {
    return (uint8_t)(255u - (q * 255u) / close_end);
  }
  if (q < hold_end) return 0u;
  return clamp_u8_u32(((q - hold_end) * 255u) / (255u - hold_end));
}

static void resolve_mouth(uint8_t mouth_open_q8, const JiraiEmotionPreset *preset, JiraiAnimFrame *frame) {
  const uint32_t low = 5u;    // approximately MouthOpenY 0.02
  const uint32_t mid = 122u;  // approximately MouthOpenY 0.48
  const uint32_t value = mouth_open_q8;
  if (value < low) {
    frame->mouth_override = 0u;
    frame->mouth_a = preset->mouth;
    frame->mouth_b = preset->mouth;
    frame->mouth_mix_q8 = 0u;
    return;
  }

  frame->mouth_override = 1u;
  if (value < mid) {
    frame->mouth_a = JIRAI_PART_M03;
    frame->mouth_b = JIRAI_PART_M04;
    frame->mouth_mix_q8 = clamp_u8_u32(((value - low) * 255u) / (mid - low));
  } else {
    frame->mouth_a = JIRAI_PART_M04;
    frame->mouth_b = JIRAI_PART_M05;
    frame->mouth_mix_q8 = clamp_u8_u32(((value - mid) * 255u) / (255u - mid));
  }
}

void jirai_anim_init(JiraiAnimState *state, uint32_t now_ms, uint32_t seed) {
  if (!state) return;
  memset(state, 0, sizeof(*state));
  state->previous_emotion = JIRAI_EMOTION_NEUTRAL;
  state->emotion = JIRAI_EMOTION_NEUTRAL;
  state->transition_started_ms = now_ms - JIRAI_TRANSITION_MS;
  state->gesture_started_ms = now_ms;
  state->blink_started_ms = JIRAI_BLINK_INACTIVE;
  state->rng = seed ? seed : 0x0051A17u;
  state->from_pose = pose_from_preset(&kJiraiEmotionPresets[JIRAI_EMOTION_NEUTRAL]);
  state->pose = state->from_pose;
  state->next_blink_ms = now_ms + random_blink_delay(state);
}

void jirai_anim_set_emotion(JiraiAnimState *state, JiraiEmotionId emotion, uint32_t now_ms) {
  if (!state || emotion < 0 || emotion >= JIRAI_EMOTION_COUNT) return;
  JiraiAnimFrame current;
  jirai_anim_update(state, now_ms, &current);
  if ((uint8_t)emotion == state->emotion) return;
  state->from_pose = current.pose;
  state->previous_emotion = state->emotion;
  state->emotion = (uint8_t)emotion;
  state->transition_started_ms = now_ms;
  state->gesture_started_ms = now_ms;
}

void jirai_anim_set_mouth_open(JiraiAnimState *state, uint8_t mouth_open_q8) {
  if (!state) return;
  state->mouth_open_q8 = mouth_open_q8;
}

void jirai_anim_force_blink(JiraiAnimState *state, uint32_t now_ms) {
  if (!state) return;
  state->blink_started_ms = now_ms;
}

void jirai_anim_update(JiraiAnimState *state, uint32_t now_ms, JiraiAnimFrame *frame) {
  if (!state || !frame) return;
  const JiraiEmotionPreset *preset = &kJiraiEmotionPresets[state->emotion];
  const uint8_t transition = transition_progress(now_ms, state->transition_started_ms);
  state->pose = lerp_pose(&state->from_pose, preset, transition);

  memset(frame, 0, sizeof(*frame));
  frame->previous_emotion = state->previous_emotion;
  frame->emotion = state->emotion;
  frame->transition_q8 = transition;
  frame->blink_open_q8 = blink_open(state, now_ms);
  frame->gesture = preset->gesture;
  const uint32_t gesture_elapsed = now_ms - state->gesture_started_ms;
  frame->gesture_elapsed_ms = gesture_elapsed > UINT16_MAX ? UINT16_MAX : (uint16_t)gesture_elapsed;
  frame->pose = state->pose;
  resolve_mouth(state->mouth_open_q8, preset, frame);
}
