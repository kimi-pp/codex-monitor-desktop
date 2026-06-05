import type { AgentActivity, AgentStatus } from "../shared/types";
import type {
  AwayScreenSession,
  GeneratedAssetKey,
  IdleBehavior,
  IdleBehaviorSession,
  IdleDeskActivity
} from "./scene-types";
import {
  getDebugIdleBehavior,
  getDebugIdleBehaviorSeed
} from "./debug-idle-behaviors";
import {
  chooseWeightedIdleBehavior,
  getIdleRerollDurationMs
} from "./idle-behavior-selection";

export type ActiveScreenStatus = Extract<AgentStatus, "working" | "thinking">;

export type WorkScreenSession = {
  status: ActiveScreenStatus;
  textureKey: GeneratedAssetKey;
  seed: number;
};

const WORK_SCREEN_TEXTURE_KEYS: Record<ActiveScreenStatus, GeneratedAssetKey[]> = {
  working: ["workingTerminalBuildRun", "workingCodeEditorActive", "workingDiffReviewActive"],
  thinking: ["thinkingPlanningBoard", "thinkingSearchAnalysis", "thinkingArchitectureMap"]
};

export function createAgentScreenSessionStore() {
  const awayScreenSessions = new Map<string, AwayScreenSession>();
  const workScreenSessions = new Map<string, WorkScreenSession>();
  const idleBehaviorSessions = new Map<string, IdleBehaviorSession>();

  return {
    clear() {
      awayScreenSessions.clear();
      workScreenSessions.clear();
      idleBehaviorSessions.clear();
    },

    deleteAgent(agentId: string) {
      awayScreenSessions.delete(agentId);
      workScreenSessions.delete(agentId);
      idleBehaviorSessions.delete(agentId);
    },

    clearAwayScreenSession(agentId: string) {
      awayScreenSessions.delete(agentId);
    },

    clearWorkScreenSession(agentId: string) {
      workScreenSessions.delete(agentId);
    },

    getAwayScreenSession(agentId: string) {
      const existing = awayScreenSessions.get(agentId);
      if (existing) {
        return existing;
      }

      const session: AwayScreenSession = {
        mode: Math.random() < 0.5 ? "screensaver" : "desktop",
        seed: Math.random()
      };
      awayScreenSessions.set(agentId, session);
      return session;
    },

    getWorkScreenSession(agentId: string, status: ActiveScreenStatus) {
      const existing = workScreenSessions.get(agentId);
      if (existing?.status === status) {
        return existing;
      }

      const textureKeys = WORK_SCREEN_TEXTURE_KEYS[status];
      const session: WorkScreenSession = {
        status,
        textureKey: textureKeys[Math.floor(Math.random() * textureKeys.length)] ?? textureKeys[0],
        seed: Math.random()
      };
      workScreenSessions.set(agentId, session);
      return session;
    },

    getIdleBehaviorSession(agent: AgentActivity, now = 0) {
      const debugBehavior = readDebugIdleBehavior(agent);
      if (debugBehavior) {
        const existing = idleBehaviorSessions.get(agent.id);
        if (existing?.behavior === debugBehavior && existing.locked) {
          return existing;
        }

        const session: IdleBehaviorSession = {
          behavior: debugBehavior,
          seed: getDebugIdleBehaviorSeed(agent.id, debugBehavior),
          segmentIndex: 0,
          segmentStartedAt: now,
          rerollDurationMs: Number.POSITIVE_INFINITY,
          nextRerollAt: Number.POSITIVE_INFINITY,
          locked: true
        };
        idleBehaviorSessions.set(agent.id, session);
        return session;
      }

      const existing = idleBehaviorSessions.get(agent.id);
      if (existing && existing.locked) {
        idleBehaviorSessions.delete(agent.id);
      } else if (existing && now < (existing.nextRerollAt ?? Number.POSITIVE_INFINITY)) {
        return existing;
      } else if (existing) {
        const seed = Math.random();
        const segmentIndex = (existing.segmentIndex ?? 0) + 1;
        const rerollDurationMs = getIdleRerollDurationMs(agent.id, seed, segmentIndex);
        const session: IdleBehaviorSession = {
          behavior: chooseWeightedIdleBehavior(seed, existing.behavior),
          seed,
          segmentIndex,
          segmentStartedAt: now,
          rerollDurationMs,
          nextRerollAt: now + rerollDurationMs
        };
        idleBehaviorSessions.set(agent.id, session);
        return session;
      }

      const seed = Math.random();
      const rerollDurationMs = getIdleRerollDurationMs(agent.id, seed, 0);
      const session: IdleBehaviorSession = {
        behavior: chooseWeightedIdleBehavior(seed),
        seed,
        segmentIndex: 0,
        segmentStartedAt: now,
        rerollDurationMs,
        nextRerollAt: now + rerollDurationMs
      };
      idleBehaviorSessions.set(agent.id, session);
      return session;
    },

    getIdleDeskActivity(agentId: string): IdleDeskActivity {
      const session = idleBehaviorSessions.get(agentId);
      if (!session) {
        return "video";
      }
      return isIdleDeskActivity(session.behavior)
        ? session.behavior
        : chooseDeskFallbackActivity(session.seed);
    },

    pruneIdleBehaviorSessions(agents: AgentActivity[]) {
      const idleIds = new Set(agents.filter((agent) => agent.status === "idle").map((agent) => agent.id));
      for (const agentId of idleBehaviorSessions.keys()) {
        if (!idleIds.has(agentId)) {
          idleBehaviorSessions.delete(agentId);
        }
      }
    }
  };
}

export function isActiveScreenStatus(status: AgentStatus): status is ActiveScreenStatus {
  return status === "working" || status === "thinking";
}

export function isIdleDeskActivity(behavior: IdleBehavior): behavior is IdleDeskActivity {
  return behavior === "video" || behavior === "music" || behavior === "game";
}

function chooseDeskFallbackActivity(seed: number): IdleDeskActivity {
  const activities: IdleDeskActivity[] = ["video", "music", "game"];
  return activities[Math.floor(seed * activities.length) % activities.length];
}

function readDebugIdleBehavior(agent: AgentActivity): IdleBehavior | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return getDebugIdleBehavior(new URLSearchParams(window.location.search).get("debugIdleBehaviors"), agent);
}
