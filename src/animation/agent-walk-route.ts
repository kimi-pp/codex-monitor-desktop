import type { SourcePoint } from "./scene-types";

export type WalkDirection = "walkUp" | "walkDown" | "walkLeft" | "walkRight";
export type WalkTargetKind = "toFacility" | "toStation";

export type WalkRoute = {
  points: SourcePoint[];
  segmentLengths: number[];
  totalLength: number;
  durationMs: number;
};

export type WalkRouteSample = {
  position: SourcePoint;
  segmentIndex: number;
  direction: WalkDirection;
  progress: number;
};

export const WALK_DURATION_MIN_MS = 7_000;
export const WALK_DURATION_MAX_MS = 10_000;
export const WALK_CORRIDOR_X_SOURCE = 510;
export const WALK_UPPER_AISLE_Y_SOURCE = 520;
export const WALK_LOWER_AISLE_Y_SOURCE = 690;

const WALK_SOURCE_UNITS_PER_SECOND = 180;

export function buildOrthogonalWalkRoute(
  from: SourcePoint,
  to: SourcePoint,
  targetKind: WalkTargetKind
): WalkRoute {
  const stationAisleY = getStationAisleY(targetKind === "toFacility" ? from : to);
  const points = targetKind === "toFacility"
    ? normalizeRoutePoints([
      from,
      { x: from.x, y: stationAisleY, scale: from.scale },
      { x: WALK_CORRIDOR_X_SOURCE, y: stationAisleY, scale: from.scale },
      { x: WALK_CORRIDOR_X_SOURCE, y: to.y, scale: to.scale ?? from.scale },
      to
    ])
    : normalizeRoutePoints([
      from,
      { x: WALK_CORRIDOR_X_SOURCE, y: from.y, scale: from.scale },
      { x: WALK_CORRIDOR_X_SOURCE, y: stationAisleY, scale: to.scale ?? from.scale },
      { x: to.x, y: stationAisleY, scale: to.scale },
      to
    ]);

  const segmentLengths = points.slice(1).map((point, index) => getSegmentLength(points[index], point));
  const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0);
  const durationMs = totalLength === 0
    ? 0
    : clamp(Math.round((totalLength / WALK_SOURCE_UNITS_PER_SECOND) * 1000), WALK_DURATION_MIN_MS, WALK_DURATION_MAX_MS);

  return {
    points,
    segmentLengths,
    totalLength,
    durationMs
  };
}

export function sampleWalkRoute(route: WalkRoute, elapsedMs: number): WalkRouteSample {
  if (route.points.length === 0) {
    throw new Error("Cannot sample an empty walk route");
  }
  if (route.points.length === 1 || route.totalLength === 0 || route.durationMs === 0) {
    return {
      position: route.points[0],
      segmentIndex: 0,
      direction: "walkDown",
      progress: 1
    };
  }

  const progress = clamp(elapsedMs / route.durationMs, 0, 1);
  const targetDistance = route.totalLength * progress;
  let traversed = 0;

  for (let index = 0; index < route.segmentLengths.length; index += 1) {
    const segmentLength = route.segmentLengths[index];
    const nextTraversed = traversed + segmentLength;
    if (targetDistance <= nextTraversed || index === route.segmentLengths.length - 1) {
      const localProgress = segmentLength === 0 ? 0 : clamp((targetDistance - traversed) / segmentLength, 0, 1);
      const start = route.points[index];
      const end = route.points[index + 1];
      return {
        position: interpolateSourcePoint(start, end, localProgress),
        segmentIndex: index,
        direction: getWalkRouteDirection(start, end),
        progress
      };
    }
    traversed = nextTraversed;
  }

  return {
    position: route.points.at(-1) as SourcePoint,
    segmentIndex: Math.max(0, route.points.length - 2),
    direction: getWalkRouteDirection(route.points.at(-2) as SourcePoint, route.points.at(-1) as SourcePoint),
    progress: 1
  };
}

export function getWalkRouteDirection(from: SourcePoint, to: SourcePoint): WalkDirection {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) {
    return dx > 0 ? "walkRight" : "walkLeft";
  }
  return dy >= 0 ? "walkDown" : "walkUp";
}

function getStationAisleY(stationAnchor: SourcePoint) {
  return stationAnchor.y <= 520 ? WALK_UPPER_AISLE_Y_SOURCE : WALK_LOWER_AISLE_Y_SOURCE;
}

function normalizeRoutePoints(points: SourcePoint[]) {
  const normalized: SourcePoint[] = [];
  points.forEach((point) => {
    const previous = normalized.at(-1);
    if (previous && previous.x === point.x && previous.y === point.y) {
      normalized[normalized.length - 1] = {
        ...point,
        scale: point.scale ?? previous.scale
      };
      return;
    }
    normalized.push(point);
  });
  return normalized;
}

function getSegmentLength(from: SourcePoint, to: SourcePoint) {
  return Math.abs(to.x - from.x) + Math.abs(to.y - from.y);
}

function interpolateSourcePoint(from: SourcePoint, to: SourcePoint, progress: number): SourcePoint {
  const fromScale = from.scale ?? to.scale;
  const toScale = to.scale ?? from.scale;
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
    scale: fromScale !== undefined && toScale !== undefined
      ? fromScale + (toScale - fromScale) * progress
      : fromScale ?? toScale
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
