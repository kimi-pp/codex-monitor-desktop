import assert from "node:assert/strict";

import {
  getFacilityActionPool,
  selectFacilityAction
} from "../src/animation/facility-actions.ts";

const pantryPool = getFacilityActionPool("pantry");
assert.deepEqual(
  pantryPool,
  ["coffee", "snack", "device", "drink"],
  "pantry should expose all four dynamic use actions"
);

const restroomPool = getFacilityActionPool("restroom");
assert.deepEqual(
  restroomPool,
  ["device", "meditate"],
  "restroom should expose both dynamic use actions"
);

const treadmillPool = getFacilityActionPool("treadmill");
assert.deepEqual(
  treadmillPool,
  ["run"],
  "treadmill should expose the run action"
);

for (const destination of ["pantry", "restroom", "treadmill"]) {
  for (let elapsedMs = 0; elapsedMs <= 180_000; elapsedMs += 1_000) {
    const selection = selectFacilityAction(destination, "agent-aurora", 0.314159, elapsedMs);
    assert.ok(
      selection.holdDurationMs >= 10_000 && selection.holdDurationMs <= 30_000,
      `${destination} hold duration should stay within 10-30 seconds`
    );
    assert.ok(
      getFacilityActionPool(destination).includes(selection.actionId),
      `${destination} selected action should belong to its action pool`
    );
  }
}

for (const destination of ["pantry", "restroom"]) {
  const samples = [];
  for (let elapsedMs = 0; elapsedMs <= 240_000; elapsedMs += 1_000) {
    const current = selectFacilityAction(destination, "agent-binary", 0.8128, elapsedMs);
    const last = samples[samples.length - 1];
    if (!last || last.actionId !== current.actionId || last.segmentIndex !== current.segmentIndex) {
      samples.push(current);
    }
  }

  for (let index = 1; index < samples.length; index += 1) {
    assert.notEqual(
      samples[index].actionId,
      samples[index - 1].actionId,
      `${destination} should not repeat the same action in adjacent segments`
    );
  }
}

const first = selectFacilityAction("pantry", "agent-cascade", 0.42, 57_500);
const second = selectFacilityAction("pantry", "agent-cascade", 0.42, 57_500);
assert.deepEqual(second, first, "selection should be deterministic for the same seed and elapsed time");

const treadmillFirst = selectFacilityAction("treadmill", "agent-cascade", 0.42, 57_500);
assert.equal(treadmillFirst.actionId, "run", "treadmill should always select run");
assert.deepEqual(
  selectFacilityAction("treadmill", "agent-cascade", 0.42, 57_500),
  treadmillFirst,
  "treadmill selection should be deterministic for the same seed and elapsed time"
);

console.log("facility action selection tests passed");
