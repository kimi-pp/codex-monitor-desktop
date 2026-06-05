import assert from "node:assert/strict";

import { createAgentVisualSessionStore } from "../src/animation/agent-visual-session.ts";
import { WALK_DURATION_MAX_MS, WALK_DURATION_MIN_MS } from "../src/animation/agent-walk-route.ts";

const stationAnchor = { x: 599.52, y: 418.92, scale: 0.96 };
const pantryAnchor = { x: 305.3039822513668, y: 752.3208373811838, scale: 1 };

function createAgent(status) {
  return {
    id: "agent-aurora",
    name: "Aurora",
    status,
    mode: "summary",
    currentTask: "test",
    progress: 0,
    updatedAt: new Date().toISOString(),
    screenLines: []
  };
}

function assertOrthogonalPath(session) {
  assert.ok(session.walkRoute, `${session.visualPhase} should expose a walk route`);
  for (let index = 1; index < session.walkRoute.points.length; index += 1) {
    const previous = session.walkRoute.points[index - 1];
    const current = session.walkRoute.points[index];
    assert.ok(
      previous.x === current.x || previous.y === current.y,
      `visual route segment ${index - 1}->${index} should be orthogonal`
    );
  }
}

const store = createAgentVisualSessionStore();
const first = store.getSession({
  agent: createAgent("idle"),
  now: 1_000,
  stationAnchor,
  destinationAnchor: pantryAnchor,
  idleBehavior: "pantry"
});

assert.equal(first.visualPhase, "walkingToFacility");
assert.match(first.action, /^walk(Up|Down|Left|Right)$/);
assert.ok(first.walkDurationMs >= WALK_DURATION_MIN_MS && first.walkDurationMs <= WALK_DURATION_MAX_MS);
assertOrthogonalPath(first);
assert.deepEqual(first.actorSourcePosition, stationAnchor);
assert.ok(first.walkProgress === 0);

const earlyFrame = store.getSession({
  agent: createAgent("idle"),
  now: 1_150,
  stationAnchor,
  destinationAnchor: pantryAnchor,
  idleBehavior: "pantry"
});
assert.equal(earlyFrame.frameIndex, 1, "walking frame pacing should use 8fps instead of the previous fast 15fps");

const horizontalStore = createAgentVisualSessionStore();
const horizontalStation = { x: 420, y: 520, scale: 1 };
const horizontalTarget = { x: 660, y: 520, scale: 1 };
const horizontalStart = horizontalStore.getSession({
  agent: createAgent("idle"),
  now: 2_000,
  stationAnchor: horizontalStation,
  destinationAnchor: horizontalTarget,
  idleBehavior: "treadmill"
});
assert.equal(horizontalStart.action, "walkRight");

const horizontalEarlyFrame = horizontalStore.getSession({
  agent: createAgent("idle"),
  now: 2_150,
  stationAnchor: horizontalStation,
  destinationAnchor: horizontalTarget,
  idleBehavior: "treadmill"
});
assert.equal(horizontalEarlyFrame.action, "walkRight");
assert.equal(horizontalEarlyFrame.frameIndex, 0, "horizontal walking should be slower than vertical walking at 6fps");

const horizontalNextFrame = horizontalStore.getSession({
  agent: createAgent("idle"),
  now: 2_200,
  stationAnchor: horizontalStation,
  destinationAnchor: horizontalTarget,
  idleBehavior: "treadmill"
});
assert.equal(horizontalNextFrame.frameIndex, 1, "horizontal walking should advance after roughly 167ms");

const mid = store.getSession({
  agent: createAgent("idle"),
  now: 4_000,
  stationAnchor,
  destinationAnchor: pantryAnchor,
  idleBehavior: "pantry"
});
assert.equal(mid.visualPhase, "walkingToFacility");
assert.ok(mid.walkProgress > 0 && mid.walkProgress < 1);
assert.notDeepEqual(mid.actorSourcePosition, stationAnchor, "walking actor should move away from the station");

const settledFacility = store.getSession({
  agent: createAgent("idle"),
  now: 1_000 + first.walkDurationMs + 50,
  stationAnchor,
  destinationAnchor: pantryAnchor,
  idleBehavior: "pantry"
});
assert.equal(settledFacility.visualPhase, "facility");
assert.equal(settledFacility.action, "pantryUse");
assert.deepEqual(settledFacility.actorSourcePosition, pantryAnchor);

const returning = store.getSession({
  agent: createAgent("working"),
  now: 1_000 + first.walkDurationMs + 100,
  stationAnchor
});
assert.equal(returning.visualPhase, "walkingToStation");
assert.match(returning.action, /^walk(Up|Down|Left|Right)$/);
assertOrthogonalPath(returning);
assert.deepEqual(returning.walkRoute?.points[0], pantryAnchor, "return route should start from current facility position");

const settledStation = store.getSession({
  agent: createAgent("working"),
  now: 1_000 + first.walkDurationMs + 100 + returning.walkDurationMs + 50,
  stationAnchor
});
assert.equal(settledStation.visualPhase, "station");
assert.equal(settledStation.action, "workstationWorking");
assert.deepEqual(settledStation.actorSourcePosition, stationAnchor);

console.log("agent visual session walking tests passed");
