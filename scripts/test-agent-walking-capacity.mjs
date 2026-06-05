import assert from "node:assert/strict";

import { createAgentVisualSessionStore } from "../src/animation/agent-visual-session.ts";
import { assignFacilitySeats } from "../src/animation/facility-seats.ts";

const stationA = { x: 599.52, y: 418.92, scale: 0.96 };
const stationB = { x: 854.52, y: 418.92, scale: 0.97 };
const treadmill = { x: 275, y: 461.31288343558276, scale: 1 };

function createAgent(id, status) {
  return {
    id,
    name: id,
    status,
    mode: "summary",
    currentTask: "test",
    progress: 0,
    updatedAt: new Date().toISOString(),
    screenLines: []
  };
}

let seatSessions = [];
let requests = [{ agentId: "agent-a", destination: "treadmill", rank: 0, seed: 0.25 }];
let assignments = assignFacilitySeats(requests, seatSessions);
assert.deepEqual(assignments.map((assignment) => assignment.agentId), ["agent-a"]);
seatSessions = assignments.map((assignment) => ({
  agentId: assignment.agentId,
  destination: assignment.destination,
  seed: assignment.seed,
  seatId: assignment.seatId
}));

const visualStore = createAgentVisualSessionStore();
const walkingToFacility = visualStore.getSession({
  agent: createAgent("agent-a", "idle"),
  now: 1_000,
  stationAnchor: stationA,
  destinationAnchor: treadmill,
  idleBehavior: "treadmill"
});
assert.equal(walkingToFacility.visualPhase, "walkingToFacility");

requests = [
  { agentId: "agent-a", destination: "treadmill", rank: 0, seed: 0.25 },
  { agentId: "agent-b", destination: "treadmill", rank: 1, seed: 0.75 }
];
assignments = assignFacilitySeats(requests, seatSessions);
assert.deepEqual(
  assignments.map((assignment) => assignment.agentId),
  ["agent-a"],
  "walkingToFacility should pre-occupy the single-capacity treadmill"
);

const returning = visualStore.getSession({
  agent: createAgent("agent-a", "working"),
  now: 2_000,
  stationAnchor: stationA
});
assert.equal(returning.visualPhase, "walkingToStation");

requests = [{ agentId: "agent-b", destination: "treadmill", rank: 0, seed: 0.75 }];
assignments = assignFacilitySeats(requests, []);
assert.deepEqual(
  assignments.map((assignment) => assignment.agentId),
  ["agent-b"],
  "walkingToStation should release the facility seat for the next idle Agent"
);

const nextAgentWalk = visualStore.getSession({
  agent: createAgent("agent-b", "idle"),
  now: 2_100,
  stationAnchor: stationB,
  destinationAnchor: assignments[0].seat.sourceAnchor,
  idleBehavior: "treadmill"
});
assert.equal(nextAgentWalk.visualPhase, "walkingToFacility");
assert.equal(assignments[0].seatId, "treadmillBelt");

console.log("agent walking capacity lifecycle tests passed");
