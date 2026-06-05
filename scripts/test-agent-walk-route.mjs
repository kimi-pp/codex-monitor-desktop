import assert from "node:assert/strict";

import {
  WALK_DURATION_MAX_MS,
  WALK_DURATION_MIN_MS,
  buildOrthogonalWalkRoute,
  getWalkRouteDirection,
  sampleWalkRoute
} from "../src/animation/agent-walk-route.ts";

const station = { x: 599.52, y: 418.92, scale: 0.96 };
const pantry = { x: 305.3039822513668, y: 752.3208373811838, scale: 1 };
const restroom = { x: 121, y: 909.4117647058823, scale: 1 };

for (const route of [
  buildOrthogonalWalkRoute(station, pantry, "toFacility"),
  buildOrthogonalWalkRoute(restroom, station, "toStation")
]) {
  assert.ok(
    route.durationMs >= WALK_DURATION_MIN_MS && route.durationMs <= WALK_DURATION_MAX_MS,
    `route duration should stay within 7-10s, received ${route.durationMs}`
  );
  assert.ok(route.points.length >= 2, "walking route should contain at least start and target points");
  for (let index = 1; index < route.points.length; index += 1) {
    const previous = route.points[index - 1];
    const current = route.points[index];
    assert.ok(
      previous.x === current.x || previous.y === current.y,
      `route segment ${index - 1}->${index} should be orthogonal: ${JSON.stringify(previous)} -> ${JSON.stringify(current)}`
    );
  }
}

const toPantry = buildOrthogonalWalkRoute(station, pantry, "toFacility");
assert.deepEqual(toPantry.points[0], station, "route should start at workstation source anchor");
assert.deepEqual(toPantry.points.at(-1), pantry, "route should end at facility source anchor");
assert.ok(
  toPantry.points.some((point) => point.x === 510),
  "route should use the shared vertical corridor x=510"
);
assert.ok(
  toPantry.points.some((point) => point.y === 520),
  "top workstation row should exit through the upper aisle y=520"
);

const sample = sampleWalkRoute(toPantry, toPantry.durationMs * 0.25);
assert.ok(sample.progress > 0 && sample.progress < 1, "sampled walk progress should be inside the route");
assert.match(sample.direction, /^walk(Up|Down|Left|Right)$/);
assert.equal(sample.direction, getWalkRouteDirection(toPantry.points[sample.segmentIndex], toPantry.points[sample.segmentIndex + 1]));

const atEnd = sampleWalkRoute(toPantry, toPantry.durationMs + 1);
assert.equal(atEnd.progress, 1, "route sample should clamp progress at the end");
assert.deepEqual(atEnd.position, pantry, "route end sample should return target point");

console.log("agent walk route tests passed");
