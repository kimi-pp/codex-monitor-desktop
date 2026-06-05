import type { FacilityActionId } from "./facility-seats";
import type { IdleDestination } from "./scene-types";

export type FacilityActionSelection = {
  actionId: FacilityActionId;
  segmentIndex: number;
  segmentStartMs: number;
  segmentElapsedMs: number;
  holdDurationMs: number;
};

export const FACILITY_ACTION_HOLD_MIN_MS = 10_000;
export const FACILITY_ACTION_HOLD_MAX_MS = 30_000;

const FACILITY_ACTION_POOLS: Record<IdleDestination, FacilityActionKey[]> = {
  pantry: ["coffee", "snack", "device", "drink"],
  restroom: ["device", "meditate"],
  treadmill: ["run"]
};

type FacilityActionKey = FacilityActionId;

export function getFacilityActionPool(destination: IdleDestination): FacilityActionId[] {
  return FACILITY_ACTION_POOLS[destination];
}

export function selectFacilityAction(
  destination: IdleDestination,
  agentId: string,
  seed: number,
  elapsedMs: number
): FacilityActionSelection {
  const safeElapsedMs = Math.max(0, elapsedMs);
  let segmentStartMs = 0;
  let segmentIndex = 0;
  let holdDurationMs = getFacilityActionHoldDurationMs(destination, agentId, seed, segmentIndex);

  while (safeElapsedMs >= segmentStartMs + holdDurationMs) {
    segmentStartMs += holdDurationMs;
    segmentIndex += 1;
    holdDurationMs = getFacilityActionHoldDurationMs(destination, agentId, seed, segmentIndex);
  }

  return {
    actionId: getFacilityActionId(destination, agentId, seed, segmentIndex),
    segmentIndex,
    segmentStartMs,
    segmentElapsedMs: safeElapsedMs - segmentStartMs,
    holdDurationMs
  };
}

function getFacilityActionHoldDurationMs(
  destination: IdleDestination,
  agentId: string,
  seed: number,
  segmentIndex: number
) {
  const span = FACILITY_ACTION_HOLD_MAX_MS - FACILITY_ACTION_HOLD_MIN_MS;
  return FACILITY_ACTION_HOLD_MIN_MS + (positiveHash(`${destination}:${agentId}:${seed}:hold:${segmentIndex}`) % (span + 1));
}

function getFacilityActionId(
  destination: IdleDestination,
  agentId: string,
  seed: number,
  segmentIndex: number
): FacilityActionId {
  const pool = getFacilityActionPool(destination);
  if (pool.length <= 1) {
    return pool[0];
  }

  const rawIndex = positiveHash(`${destination}:${agentId}:${seed}:action:${segmentIndex}`) % pool.length;
  const candidate = pool[rawIndex];
  if (segmentIndex === 0) {
    return candidate;
  }

  const previous = getFacilityActionId(destination, agentId, seed, segmentIndex - 1);
  return candidate === previous ? pool[(rawIndex + 1) % pool.length] : candidate;
}

function positiveHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
