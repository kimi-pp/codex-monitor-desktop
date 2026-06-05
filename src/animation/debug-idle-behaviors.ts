import type { AgentActivity } from "../shared/types";
import type { IdleBehavior } from "./scene-types";

const DEBUG_IDLE_BEHAVIORS: IdleBehavior[] = ["video", "music", "game", "pantry", "restroom", "treadmill"];

type DebugAgentRef = Pick<AgentActivity, "id" | "name">;

export function getDebugIdleBehavior(value: string | null, agent: DebugAgentRef): IdleBehavior | undefined {
  if (!value) {
    return undefined;
  }

  for (const item of value.split(",")) {
    const [agentRef = "", behaviorRef = ""] = item.split(":").map((part) => part.trim());
    const behavior = resolveIdleBehavior(behaviorRef);
    if (behavior && matchesAgentRef(agentRef, agent)) {
      return behavior;
    }
  }

  return undefined;
}

export function getDebugIdleBehaviorSeed(agentId: string, behavior: IdleBehavior) {
  return (positiveHash(`${agentId}:${behavior}`) % 1_000_000) / 1_000_000;
}

function resolveIdleBehavior(value: string): IdleBehavior | undefined {
  const normalized = value.trim().toLowerCase();
  return DEBUG_IDLE_BEHAVIORS.find((behavior) => behavior === normalized);
}

function matchesAgentRef(value: string, agent: DebugAgentRef) {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.length > 0 &&
    (
      agent.id.toLowerCase() === normalized ||
      agent.name.toLowerCase() === normalized ||
      agent.id.toLowerCase().endsWith(`-${normalized}`)
    )
  );
}

function positiveHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
