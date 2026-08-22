#include <stdio.h>

#include "../jirai_anim.h"

static int near_i16(int value, int target, int tolerance) {
  const int delta = value - target;
  return delta >= -tolerance && delta <= tolerance;
}

int main(void) {
  JiraiAnimState state;
  JiraiAnimFrame frame;

  jirai_anim_init(&state, 1000u, 0x12345678u);
  jirai_anim_update(&state, 1000u, &frame);
  if (frame.emotion != JIRAI_EMOTION_NEUTRAL || frame.transition_q8 != 255u || frame.blink_open_q8 != 255u) return 1;
  if (frame.mouth_override || frame.mouth_a != JIRAI_PART_M01) return 1;

  jirai_anim_set_emotion(&state, JIRAI_EMOTION_EXCITED, 1100u);
  jirai_anim_update(&state, 1100u, &frame);
  if (frame.previous_emotion != JIRAI_EMOTION_NEUTRAL || frame.emotion != JIRAI_EMOTION_EXCITED || frame.transition_q8 != 0u) return 1;

  jirai_anim_update(&state, 1520u, &frame);
  if (frame.transition_q8 != 255u) return 1;
  if (!near_i16(frame.pose.head_angle_q8, 384, 1)) return 1;   // +1.5 deg Q8.8
  if (!near_i16(frame.pose.arm_l_q8, -1536, 1)) return 1;     // -6 deg Q8.8
  if (!near_i16(frame.pose.arm_r_q8, 1536, 1)) return 1;

  jirai_anim_set_mouth_open(&state, 38u); // ~0.15
  jirai_anim_update(&state, 1600u, &frame);
  if (!frame.mouth_override || frame.mouth_a != JIRAI_PART_M03 || frame.mouth_b != JIRAI_PART_M04 || frame.mouth_mix_q8 >= 128u) return 1;

  jirai_anim_set_mouth_open(&state, 140u); // ~0.55
  jirai_anim_update(&state, 1601u, &frame);
  if (frame.mouth_a != JIRAI_PART_M04 || frame.mouth_b != JIRAI_PART_M05 || frame.mouth_mix_q8 >= 128u) return 1;

  jirai_anim_set_mouth_open(&state, 242u); // ~0.95
  jirai_anim_update(&state, 1602u, &frame);
  if (frame.mouth_a != JIRAI_PART_M04 || frame.mouth_b != JIRAI_PART_M05 || frame.mouth_mix_q8 <= 128u) return 1;

  jirai_anim_set_mouth_open(&state, 0u);
  jirai_anim_force_blink(&state, 2000u);
  jirai_anim_update(&state, 2065u, &frame);
  if (frame.blink_open_q8 > 10u) return 1;
  jirai_anim_update(&state, 2100u, &frame);
  if (frame.blink_open_q8 != 0u) return 1;
  jirai_anim_update(&state, 2180u, &frame);
  if (frame.blink_open_q8 != 255u) return 1;

  printf("OK emotion=%u transition=%u headAngleQ8=%d blink=%u mouthOverride=%u\n",
         frame.emotion,
         frame.transition_q8,
         frame.pose.head_angle_q8,
         frame.blink_open_q8,
         frame.mouth_override);
  return 0;
}
