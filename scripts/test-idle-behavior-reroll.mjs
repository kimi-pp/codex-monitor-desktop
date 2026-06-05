import assert from "node:assert/strict";

import {
  chooseWeightedIdleBehavior,
  getIdleBehaviorWeights,
  getIdleRerollDurationMs
} from "../src/animation/idle-behavior-selection.ts";

assert.deepEqual(
  getIdleBehaviorWeights(),
  [
    { behavior: "video", weight: 27 },
    { behavior: "music", weight: 22 },
    { behavior: "game", weight: 23 },
    { behavior: "pantry", weight: 11 },
    { behavior: "restroom", weight: 7 },
    { behavior: "treadmill", weight: 10 }
  ],
  "idle behavior weights should reserve 10% for treadmill"
);

assert.equal(chooseWeightedIdleBehavior(0.95), "treadmill", "top 10% idle draw should choose treadmill");
assert.notEqual(
  chooseWeightedIdleBehavior(0.95, "treadmill"),
  "treadmill",
  "idle reroll should avoid repeating the previous behavior when alternatives exist"
);

const firstDuration = getIdleRerollDurationMs("agent-aurora", 0.12345, 0);
const secondDuration = getIdleRerollDurationMs("agent-aurora", 0.12345, 0);
assert.equal(secondDuration, firstDuration, "reroll duration should be deterministic for the same segment seed");
assert.ok(firstDuration >= 120_000 && firstDuration <= 300_000, "reroll duration should stay within 2-5 minutes");

console.log("idle behavior reroll tests passed");
