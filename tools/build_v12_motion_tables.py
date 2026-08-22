#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EMOTIONS_PATH = ROOT / "config" / "jirai-v12-emotions.json"
RUNTIME_CONFIG_PATH = ROOT / "config" / "jirai-v12-atlas.json"
OUTPUT_PATH = ROOT / "firmware" / "generated" / "jirai_v12_motion.h"

ARM_POSES = ["down", "open", "raised", "oneRaised", "crossed", "cheek", "palms", "clasped"]
LEG_POSES = ["straight", "bentLeft"]
GESTURES = ["settle", "happy", "bounce", "tease", "plead", "slow", "sick", "angry", "huff", "sad", "startle", "shy", "shiver", "smug", "tilt", "love"]
DEFAULTS = {
    "headAngle": 0.0,
    "headTurn": 0.0,
    "bodyLean": 0.0,
    "bodySquash": 0.0,
    "armL": 0.0,
    "armR": 0.0,
    "legL": 0.0,
    "legR": 0.0,
    "energy": 0.1,
    "blush": 0.0,
}


def upper_snake(value: str) -> str:
    value = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", value)
    return re.sub(r"[^A-Za-z0-9]+", "_", value).strip("_").upper()


def part_expr(part_id: str) -> str:
    if not re.fullmatch(r"[A-Z]\d{2}", part_id):
        raise ValueError(f"invalid semantic part id: {part_id}")
    return f"JIRAI_PART_{part_id}"


def q8(value: float) -> int:
    n = int(round(float(value) * 256.0))
    if not -32768 <= n <= 32767:
        raise ValueError(f"Q8.8 overflow: {value}")
    return n


def q14(value: float) -> int:
    n = int(round(float(value) * 16384.0))
    if not -32768 <= n <= 32767:
        raise ValueError(f"Q1.14 overflow: {value}")
    return n


def u8_unit(value: float) -> int:
    return max(0, min(255, int(round(float(value) * 255.0))))


def enum_block(name: str, prefix: str, values: list[str]) -> str:
    rows = [f"  {prefix}_{upper_snake(v)} = {i}," for i, v in enumerate(values)]
    rows.append(f"  {prefix}_COUNT = {len(values)}")
    return f"typedef enum {{\n" + "\n".join(rows) + f"\n}} {name};\n"


def main() -> None:
    emotions = json.loads(EMOTIONS_PATH.read_text(encoding="utf-8"))
    config = json.loads(RUNTIME_CONFIG_PATH.read_text(encoding="utf-8"))
    ids = list(emotions.keys())
    if len(ids) != 16:
        raise SystemExit(f"expected 16 emotions, got {len(ids)}")

    for emotion_id, definition in emotions.items():
        if len(definition["eyes"]) != 2 or len(definition["brows"]) != 2:
            raise SystemExit(f"invalid eye/brow pair: {emotion_id}")
        for part_id in [*definition["eyes"], *definition["brows"], definition["mouth"]]:
            part_expr(part_id)
        if definition["arms"] not in ARM_POSES:
            raise SystemExit(f"unknown arm pose: {definition['arms']}")
        if definition["legs"] not in LEG_POSES:
            raise SystemExit(f"unknown leg pose: {definition['legs']}")
        if definition["gesture"] not in GESTURES:
            raise SystemExit(f"unknown gesture: {definition['gesture']}")

    emotion_enum = enum_block("JiraiEmotionId", "JIRAI_EMOTION", ids)
    arm_enum = enum_block("JiraiArmPose", "JIRAI_ARM", ARM_POSES)
    leg_enum = enum_block("JiraiLegPose", "JIRAI_LEG", LEG_POSES)
    gesture_enum = enum_block("JiraiGesture", "JIRAI_GESTURE", GESTURES)

    rows = []
    for emotion_id, definition in emotions.items():
        pose = {**DEFAULTS, **definition.get("pose", {})}
        eye_l, eye_r = definition["eyes"]
        brow_l, brow_r = definition["brows"]
        fields = [
            f".eye_l={part_expr(eye_l)}",
            f".eye_r={part_expr(eye_r)}",
            f".brow_l={part_expr(brow_l)}",
            f".brow_r={part_expr(brow_r)}",
            f".mouth={part_expr(definition['mouth'])}",
            f".arm_pose=JIRAI_ARM_{upper_snake(definition['arms'])}",
            f".leg_pose=JIRAI_LEG_{upper_snake(definition['legs'])}",
            f".gesture=JIRAI_GESTURE_{upper_snake(definition['gesture'])}",
            f".head_angle_q8={q8(pose['headAngle'])}",
            f".head_turn_q14={q14(pose['headTurn'])}",
            f".body_lean_q8={q8(pose['bodyLean'])}",
            f".body_squash_q14={q14(pose['bodySquash'])}",
            f".arm_l_q8={q8(pose['armL'])}",
            f".arm_r_q8={q8(pose['armR'])}",
            f".leg_l_q8={q8(pose['legL'])}",
            f".leg_r_q8={q8(pose['legR'])}",
            f".energy_q8={u8_unit(pose['energy'])}",
            f".blush_q8={u8_unit(pose['blush'])}",
        ]
        rows.append(
            f"  [JIRAI_EMOTION_{upper_snake(emotion_id)}] = {{" + ",".join(fields) + "},"
        )

    idle = config.get("idle", {})
    motion = config.get("motion", {})
    breath_q16 = int(round(float(idle.get("breathHz", 0.22)) * 65536.0))

    text = f"""#pragma once
#include <stdint.h>
#include "jirai_v12_pack.h"

// Auto-generated from config/jirai-v12-emotions.json and config/jirai-v12-atlas.json.
// Browser/runtime equivalence is checked by tools/verify_v12_emotions.mjs.

{emotion_enum}
{arm_enum}
{leg_enum}
{gesture_enum}
typedef struct {{
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
}} JiraiEmotionPreset;

_Static_assert(sizeof(JiraiEmotionPreset) == 26, "Unexpected JiraiEmotionPreset packing");

static const JiraiEmotionPreset kJiraiEmotionPresets[JIRAI_EMOTION_COUNT] = {{
{chr(10).join(rows)}
}};

#define JIRAI_BREATH_HZ_Q16 {breath_q16}
#define JIRAI_BLINK_MIN_MS {int(idle.get('blinkMinMs', 2600))}
#define JIRAI_BLINK_MAX_MS {int(idle.get('blinkMaxMs', 6200))}
#define JIRAI_BLINK_DURATION_MS {int(idle.get('blinkDurationMs', 180))}
#define JIRAI_HEAD_TURN_MIN_MS {int(idle.get('headTurnMinMs', 4200))}
#define JIRAI_HEAD_TURN_MAX_MS {int(idle.get('headTurnMaxMs', 8500))}
#define JIRAI_TRANSITION_MS {int(motion.get('transitionMs', 420))}

static inline float jirai_q8_to_float(int16_t value) {{ return (float)value / 256.0f; }}
static inline float jirai_q14_to_float(int16_t value) {{ return (float)value / 16384.0f; }}
static inline float jirai_u8_unit_to_float(uint8_t value) {{ return (float)value / 255.0f; }}
"""

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(text, encoding="utf-8")
    print(json.dumps({
        "emotionCount": len(ids),
        "presetBytes": 26 * len(ids),
        "output": str(OUTPUT_PATH.relative_to(ROOT)),
        "transitionMs": int(motion.get("transitionMs", 420)),
        "breathHzQ16": breath_q16,
    }, indent=2))


if __name__ == "__main__":
    main()
