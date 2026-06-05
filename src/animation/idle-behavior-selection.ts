import type { IdleBehavior } from "./scene-types";

export const IDLE_REROLL_MIN_MS = 120_000;
export const IDLE_REROLL_MAX_MS = 300_000;

const IDLE_BEHAVIOR_WEIGHTS: Array<{ behavior: IdleBehavior; weight: number }> = [
  { behavior: "video", weight: 27 },
  { behavior: "music", weight: 22 },
  { behavior: "game", weight: 23 },
  { behavior: "pantry", weight: 11 },
  { behavior: "restroom", weight: 7 },
  { behavior: "treadmill", weight: 10 }
];

export function getIdleBehaviorWeights() {
  return IDLE_BEHAVIOR_WEIGHTS.map((item) => ({ ...item }));
}

export function chooseWeightedIdleBehavior(randomValue: number, previousBehavior?: IdleBehavior): IdleBehavior {
  const total = IDLE_BEHAVIOR_WEIGHTS.reduce((sum, item) => sum + item.weight, 0);
  let cursor = clamp01(randomValue) * total;
  for (let index = 0; index < IDLE_BEHAVIOR_WEIGHTS.length; index += 1) {
    const item = IDLE_BEHAVIOR_WEIGHTS[index];
    cursor -= item.weight;
    if (cursor <= 0) {
      return item.behavior === previousBehavior
        ? IDLE_BEHAVIOR_WEIGHTS[(index + 1) % IDLE_BEHAVIOR_WEIGHTS.length].behavior
        : item.behavior;
    }
  }

  const fallback = IDLE_BEHAVIOR_WEIGHTS[IDLE_BEHAVIOR_WEIGHTS.length - 1].behavior;
  return fallback === previousBehavior ? IDLE_BEHAVIOR_WEIGHTS[0].behavior : fallback;
}

export function getIdleRerollDurationMs(agentId: string, seed: number, segmentIndex: number) {
  const span = IDLE_REROLL_MAX_MS - IDLE_REROLL_MIN_MS;
  return IDLE_REROLL_MIN_MS + (positiveHash(`${agentId}:${seed}:idle-reroll:${segmentIndex}`) % (span + 1));
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(Math.max(value, 0), 0.999999999);
}

function positiveHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
