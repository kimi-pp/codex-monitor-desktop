import type { AgentActivity, AgentStatus } from "../shared/types";
import {
  buildOrthogonalWalkRoute,
  sampleWalkRoute,
  type WalkRoute,
  type WalkRouteSample
} from "./agent-walk-route.ts";
import type { AgentVisualAction, AgentVisualSession, IdleBehavior, SourcePoint } from "./scene-types";

type VisualSessionInput = {
  agent: AgentActivity;
  now: number;
  stationAnchor: SourcePoint;
  destinationAnchor?: SourcePoint;
  idleBehavior?: IdleBehavior;
};

const VERTICAL_WALK_ANIMATION_FPS = 8;
const HORIZONTAL_WALK_ANIMATION_FPS = 6;
const DEFAULT_ACTION_FPS = 6;

export function createAgentVisualSessionStore() {
  const sessions = new Map<string, AgentVisualSession>();
  const lastStatuses = new Map<string, AgentStatus>();

  return {
    clear() {
      sessions.clear();
      lastStatuses.clear();
    },

    deleteAgent(agentId: string) {
      sessions.delete(agentId);
      lastStatuses.delete(agentId);
    },

    getSession(input: VisualSessionInput) {
      const previousStatus = lastStatuses.get(input.agent.id);
      const existing = sessions.get(input.agent.id);

      const session = getNextVisualSession(existing, previousStatus, input);
      sessions.set(input.agent.id, session);
      lastStatuses.set(input.agent.id, input.agent.status);
      return session;
    }
  };
}

function getNextVisualSession(
  existing: AgentVisualSession | undefined,
  previousStatus: AgentStatus | undefined,
  input: VisualSessionInput
): AgentVisualSession {
  const sampledExisting = existing ? updateVisualSessionFrame(existing, input.now) : undefined;
  const wantsFacility = input.agent.status === "idle" && input.destinationAnchor && input.idleBehavior;

  if (wantsFacility) {
    if (
      sampledExisting &&
      sampledExisting.visualPhase === "facility" &&
      sampledExisting.lockedIdleBehavior === input.idleBehavior &&
      sameSourcePoint(sampledExisting.to, input.destinationAnchor as SourcePoint)
    ) {
      sampledExisting.frameIndex = getFrameIndex(sampledExisting, input.now);
      return sampledExisting;
    }

    if (
      sampledExisting &&
      sampledExisting.visualPhase === "walkingToFacility" &&
      sampledExisting.lockedIdleBehavior === input.idleBehavior &&
      sameSourcePoint(sampledExisting.to, input.destinationAnchor as SourcePoint)
    ) {
      if ((sampledExisting.walkProgress ?? 0) >= 1) {
        return createSettledSession(input, "facility", input.destinationAnchor as SourcePoint, input.idleBehavior);
      }
      return sampledExisting;
    }

    const from = sampledExisting?.actorSourcePosition ?? input.stationAnchor;
    return createWalkingSession(
      input.agent.id,
      input.now,
      from,
      input.destinationAnchor as SourcePoint,
      "walkingToFacility",
      input.idleBehavior
    );
  }

  if (sampledExisting && sampledExisting.visualPhase === "walkingToStation") {
    if ((sampledExisting.walkProgress ?? 0) >= 1) {
      return createSettledSession(input, "station", input.stationAnchor);
    }
    return sampledExisting;
  }

  if (sampledExisting && sampledExisting.visualPhase === "station" && previousStatus === input.agent.status) {
    sampledExisting.action = getActionForAgent(input.agent.status, undefined);
    sampledExisting.frameIndex = getFrameIndex(sampledExisting, input.now);
    return sampledExisting;
  }

  if (sampledExisting && sampledExisting.visualPhase !== "station") {
    const from = sampledExisting.actorSourcePosition;
    if (!sameSourcePoint(from, input.stationAnchor)) {
      return createWalkingSession(input.agent.id, input.now, from, input.stationAnchor, "walkingToStation");
    }
  }

  return createSettledSession(input, "station", input.stationAnchor);
}

function createSettledSession(
  input: VisualSessionInput,
  phase: "station" | "facility",
  point: SourcePoint,
  idleBehavior?: IdleBehavior
): AgentVisualSession {
  const action = phase === "facility"
    ? getActionForAgent(input.agent.status, idleBehavior)
    : getActionForAgent(input.agent.status, undefined);

  return {
    agentId: input.agent.id,
    action,
    startedAt: input.now,
    phaseStartedAt: input.now,
    visualPhase: phase,
    from: point,
    to: point,
    path: [point],
    actorSourcePosition: point,
    lockedIdleBehavior: idleBehavior,
    frameIndex: 0
  };
}

function createWalkingSession(
  agentId: string,
  now: number,
  from: SourcePoint,
  to: SourcePoint,
  phase: "walkingToFacility" | "walkingToStation",
  idleBehavior?: IdleBehavior
): AgentVisualSession {
  const walkRoute = buildOrthogonalWalkRoute(from, to, phase === "walkingToFacility" ? "toFacility" : "toStation");
  const sample = sampleWalkRoute(walkRoute, 0);
  return {
    agentId,
    action: sample.direction,
    startedAt: now,
    phaseStartedAt: now,
    visualPhase: phase,
    from,
    to,
    path: walkRoute.points,
    actorSourcePosition: sample.position,
    walkRoute,
    walkSegmentIndex: sample.segmentIndex,
    walkDirection: sample.direction,
    walkProgress: sample.progress,
    walkDurationMs: walkRoute.durationMs,
    lockedIdleBehavior: idleBehavior,
    frameIndex: 0
  };
}

function getActionForAgent(status: AgentStatus, idleBehavior: IdleBehavior | undefined): AgentVisualAction {
  if (status === "working") {
    return "workstationWorking";
  }
  if (status === "thinking") {
    return "workstationThinking";
  }
  if (status === "idle") {
    if (idleBehavior === "pantry") {
      return "pantryUse";
    }
    if (idleBehavior === "restroom") {
      return "restroomUse";
    }
    if (idleBehavior === "treadmill") {
      return "treadmillRun";
    }
    return "workstationIdle";
  }
  return "workstationIdle";
}

function getFrameIndex(session: AgentVisualSession, now: number) {
  const elapsed = Math.max(0, now - session.phaseStartedAt);
  const fps = getActionFps(session.action);
  return Math.floor(elapsed / (1000 / fps));
}

function getActionFps(action: AgentVisualAction) {
  if (action === "walkLeft" || action === "walkRight") {
    return HORIZONTAL_WALK_ANIMATION_FPS;
  }
  if (action === "walkUp" || action === "walkDown") {
    return VERTICAL_WALK_ANIMATION_FPS;
  }
  return DEFAULT_ACTION_FPS;
}

function updateVisualSessionFrame(session: AgentVisualSession, now: number): AgentVisualSession {
  if (session.visualPhase !== "walkingToFacility" && session.visualPhase !== "walkingToStation") {
    return {
      ...session,
      frameIndex: getFrameIndex(session, now)
    };
  }

  const walkSample = session.walkRoute
    ? sampleWalkRoute(session.walkRoute, now - session.phaseStartedAt)
    : createFinishedWalkSample(session.to);
  return {
    ...session,
    action: walkSample.direction,
    actorSourcePosition: walkSample.position,
    walkSegmentIndex: walkSample.segmentIndex,
    walkDirection: walkSample.direction,
    walkProgress: walkSample.progress,
    frameIndex: getFrameIndex({ ...session, action: walkSample.direction }, now)
  };
}

function createFinishedWalkSample(position: SourcePoint): WalkRouteSample {
  return {
    position,
    segmentIndex: 0,
    direction: "walkDown",
    progress: 1
  };
}

function sameSourcePoint(left: SourcePoint, right: SourcePoint) {
  return left.x === right.x && left.y === right.y && (left.scale ?? 1) === (right.scale ?? 1);
}
