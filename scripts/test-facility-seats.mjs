import assert from "node:assert/strict";
import {
  assignFacilitySeats,
  getFacilitySeatActionKey,
  getFacilitySeatDefinition,
  getFacilitySeatsForDestination,
  resolveFacilityFacingLabel
} from "../src/animation/facility-seats.ts";
import {
  FACILITY_RECTS_SOURCE,
  PANTRY_LAYER_RECTS_SOURCE,
  PANTRY_TABLE_CHAIRS_SOURCE
} from "../src/animation/scene-config.ts";
import { FLAT_ASSET_MANIFEST } from "../src/animation/flat-assets.ts";

const PANTRY_TABLE_CHAIRS_SOURCE_HEIGHT =
  PANTRY_LAYER_RECTS_SOURCE.tableChairs.width *
  PANTRY_TABLE_CHAIRS_SOURCE.height /
  PANTRY_TABLE_CHAIRS_SOURCE.width;

function assertAnchorNear(actual, expected, message) {
  assert.ok(
    Math.abs(actual.x - expected.x) <= 0.01 &&
      Math.abs(actual.y - expected.y) <= 0.01 &&
      actual.scale === expected.scale,
    `${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`
  );
}

function assertAnchorInsidePantryTableChairs(anchor, message) {
  const rect = PANTRY_LAYER_RECTS_SOURCE.tableChairs;
  assert.ok(anchor.x >= rect.x && anchor.x <= rect.x + rect.width, `${message} x outside table/chairs rect`);
  assert.ok(
    anchor.y >= rect.y && anchor.y <= rect.y + PANTRY_TABLE_CHAIRS_SOURCE_HEIGHT,
    `${message} y outside table/chairs rect`
  );
}

function assertPantryOcclusionStartsBelowCushion(seat) {
  const clearance = seat.frontOcclusionRect.y - seat.sourceAnchor.y;
  assert.ok(
    clearance >= 10,
    `${seat.seatId} frontOcclusionRect should start below the cushion anchor; clearance=${clearance.toFixed(2)}`
  );
}

function assertOcclusionStartsBelowCushion(seat, minClearance) {
  const clearance = seat.frontOcclusionRect.y - seat.sourceAnchor.y;
  assert.ok(
    clearance >= minClearance,
    `${seat.seatId} frontOcclusionRect should start below the cushion anchor; clearance=${clearance.toFixed(2)}`
  );
}

assert.equal(resolveFacilityFacingLabel({ x: 1, y: 1 }), "downRight");
assert.equal(resolveFacilityFacingLabel({ x: -1, y: 1 }), "downLeft");
assert.equal(resolveFacilityFacingLabel({ x: 1, y: -1 }), "upRight");
assert.equal(resolveFacilityFacingLabel({ x: -1, y: -1 }), "upLeft");
assert.equal(resolveFacilityFacingLabel({ x: 0, y: 1 }), "frontCamera");

const pantrySeats = getFacilitySeatsForDestination("pantry");
assert.deepEqual(
  pantrySeats.map((seat) => seat.seatId),
  ["pantrySeatA", "pantrySeatB"]
);
assert.equal(getFacilitySeatDefinition("pantrySeatA").facingLabel, "downRight");
assert.equal(getFacilitySeatDefinition("pantrySeatB").facingLabel, "downLeft");
assert.equal(getFacilitySeatDefinition("restroomToilet").facingLabel, "frontCamera");
assert.deepEqual(
  FACILITY_RECTS_SOURCE.restroom,
  { x: 55, y: 820, width: 132 },
  "restroom rect should match approved B position"
);
assert.equal(getFacilitySeatDefinition("treadmillBelt").destination, "treadmill");
assert.equal(getFacilitySeatDefinition("treadmillBelt").facingLabel, "horizontalFront");
assert.deepEqual(
  FACILITY_RECTS_SOURCE.treadmill,
  { x: 171, y: 324.7730061349693, width: 208 },
  "treadmill rect should match the approved B size while keeping the foot-contact anchor fixed"
);
assert.equal(
  getFacilitySeatDefinition("treadmillBelt").seatBackPoint.y,
  getFacilitySeatDefinition("treadmillBelt").seatFrontPoint.y,
  "treadmill rear/head points should stay on the same horizontal belt centerline"
);
assert.ok(
  getFacilitySeatDefinition("treadmillBelt").seatFrontPoint.x > getFacilitySeatDefinition("treadmillBelt").seatBackPoint.x,
  "treadmill rear-to-front vector should be source +X"
);
assertAnchorNear(
  getFacilitySeatDefinition("treadmillBelt").sourceAnchor,
  { x: 275, y: 461.31288343558276, scale: 1 },
  "treadmill sourceAnchor should map the Agent foot contact to the belt centerline"
);
assert.equal(
  getFacilitySeatDefinition("treadmillBelt").frontOcclusionRect.y,
  470.8834355828221,
  "treadmill occlusion should stay below the belt centerline foot-contact target"
);

assertAnchorNear(
  getFacilitySeatDefinition("pantrySeatA").sourceAnchor,
  { x: 305.3039822513668, y: 752.3208373811838, scale: 1 },
  "pantrySeatA sourceAnchor should target the chair cushion center"
);
assertAnchorNear(
  getFacilitySeatDefinition("pantrySeatB").sourceAnchor,
  { x: 447.4866118093654, y: 752.3208373811838, scale: 1 },
  "pantrySeatB sourceAnchor should target the chair cushion center"
);
assertAnchorInsidePantryTableChairs(getFacilitySeatDefinition("pantrySeatA").sourceAnchor, "pantrySeatA sourceAnchor");
assertAnchorInsidePantryTableChairs(getFacilitySeatDefinition("pantrySeatB").sourceAnchor, "pantrySeatB sourceAnchor");
assertPantryOcclusionStartsBelowCushion(getFacilitySeatDefinition("pantrySeatA"));
assertPantryOcclusionStartsBelowCushion(getFacilitySeatDefinition("pantrySeatB"));

const restroomToilet = getFacilitySeatDefinition("restroomToilet");
assertAnchorNear(
  restroomToilet.sourceAnchor,
  { x: 121, y: 909.4117647058823, scale: 1 },
  "restroomToilet sourceAnchor should target the toilet seat center"
);
assert.equal(restroomToilet.seatBackPoint.x, 121);
assert.equal(restroomToilet.seatBackPoint.y, 880);
assert.equal(restroomToilet.seatFrontPoint.x, 121);
assert.equal(restroomToilet.seatFrontPoint.y, 950);
assertOcclusionStartsBelowCushion(restroomToilet, 40);

assert.deepEqual(
  assignFacilitySeats([{ agentId: "agent-a", destination: "pantry", rank: 0, seed: 0.125 }])
    .map((assignment) => assignment.seatId),
  ["pantrySeatB"],
  "single pantry occupant should honor its seeded preferred seat"
);

assert.deepEqual(
  assignFacilitySeats([{ agentId: "agent-b", destination: "pantry", rank: 0, seed: 0.125 }])
    .map((assignment) => assignment.seatId),
  ["pantrySeatA"],
  "different agent seeds should be able to prefer the opposite pantry seat"
);

const conflictingPantryAssignments = assignFacilitySeats([
  { agentId: "a", destination: "pantry", rank: 0, seed: 0.125 },
  { agentId: "agent-a", destination: "pantry", rank: 1, seed: 0.125 }
]);
assert.equal(conflictingPantryAssignments.length, 2);
assert.equal(new Set(conflictingPantryAssignments.map((assignment) => assignment.seatId)).size, 2);

const stablePantryAssignments = assignFacilitySeats([
  { agentId: "a", destination: "pantry", rank: 0, seed: 0.125 },
  { agentId: "agent-a", destination: "pantry", rank: 1, seed: 0.125 }
]);
assert.deepEqual(stablePantryAssignments, conflictingPantryAssignments);

const displacedPantryAgent = conflictingPantryAssignments.find((assignment) => assignment.agentId === "agent-a");
assert.equal(displacedPantryAgent?.seatId, "pantrySeatA");
const stickyPantryAssignment = assignFacilitySeats(
  [{ agentId: "agent-a", destination: "pantry", rank: 0, seed: 0.125 }],
  conflictingPantryAssignments
);
assert.deepEqual(
  stickyPantryAssignment.map((assignment) => assignment.seatId),
  ["pantrySeatA"],
  "facility seat should remain fixed for the same destination and seed even after another occupant leaves"
);

const unlockedPantryAssignment = assignFacilitySeats(
  [{ agentId: "agent-a", destination: "pantry", rank: 0, seed: 0.42 }],
  conflictingPantryAssignments
);
assert.deepEqual(
  unlockedPantryAssignment.map((assignment) => assignment.seatId),
  ["pantrySeatB"],
  "new seed starts a new facility stay and is allowed to recompute the preferred seat"
);

const restroomAssignments = assignFacilitySeats([
  { agentId: "agent-c", destination: "restroom", rank: 0, seed: 0.875 }
]);
assert.deepEqual(restroomAssignments.map((assignment) => assignment.seatId), ["restroomToilet"]);

const treadmillAssignments = assignFacilitySeats([
  { agentId: "agent-d", destination: "treadmill", rank: 0, seed: 0.25 },
  { agentId: "agent-e", destination: "treadmill", rank: 1, seed: 0.75 }
]);
assert.deepEqual(
  treadmillAssignments.map((assignment) => assignment.seatId),
  ["treadmillBelt"],
  "treadmill should admit only one idle Agent"
);

assert.equal(getFacilitySeatActionKey("pantrySeatA", "coffee"), "flatAgentPantrySeatACoffeeSheet");
assert.equal(getFacilitySeatActionKey("pantrySeatB", "device"), "flatAgentPantrySeatBDeviceSheet");
assert.equal(getFacilitySeatActionKey("restroomToilet", "meditate"), "flatAgentRestroomToiletMeditateSheet");
assert.equal(getFacilitySeatActionKey("treadmillBelt", "run"), "flatAgentTreadmillHorizontalRunSheet");
assert.equal(getFacilitySeatActionKey("restroomToilet", "coffee"), undefined);

const treadmillRunSpec = FLAT_ASSET_MANIFEST.flatAgentTreadmillHorizontalRunSheet;
assert.equal(treadmillRunSpec.registration?.anchorKind, "footContact");
assert.equal(
  treadmillRunSpec.registration?.contactAnchors?.length,
  8,
  "treadmill run sheet should register by 8 foot-contact anchors"
);

console.log("facility seat metadata tests passed");
