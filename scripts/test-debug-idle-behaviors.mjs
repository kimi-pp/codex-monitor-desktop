import assert from "node:assert/strict";

import {
  getDebugIdleBehavior,
  getDebugIdleBehaviorSeed
} from "../src/animation/debug-idle-behaviors.ts";

const agents = [
  { id: "agent-aurora", name: "Aurora" },
  { id: "agent-binary", name: "Binary" },
  { id: "agent-cascade", name: "Cascade" }
];

const query = "Aurora:pantry,Binary:pantry,agent-cascade:treadmill,missing:pantry,Aurora:video";

assert.equal(getDebugIdleBehavior(query, agents[0]), "pantry");
assert.equal(getDebugIdleBehavior(query, agents[1]), "pantry");
assert.equal(getDebugIdleBehavior(query, agents[2]), "treadmill");
assert.equal(getDebugIdleBehavior("", agents[0]), undefined);
assert.equal(getDebugIdleBehavior("Aurora:working", agents[0]), undefined);

const firstSeed = getDebugIdleBehaviorSeed(agents[0].id, "pantry");
const secondSeed = getDebugIdleBehaviorSeed(agents[0].id, "pantry");
assert.equal(firstSeed, secondSeed, "forced idle behavior seed should be deterministic");
assert.ok(firstSeed >= 0 && firstSeed < 1, "forced idle behavior seed should be normalized");
assert.notEqual(
  getDebugIdleBehaviorSeed(agents[0].id, "treadmill"),
  firstSeed,
  "forced treadmill behavior should get its own deterministic seed"
);

console.log("debug idle behavior tests passed");
