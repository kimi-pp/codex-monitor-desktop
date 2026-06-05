import type { FlatAssetKey } from "./flat-assets";
import type { IdleDestination, SourcePoint } from "./scene-types";

export type FacilitySeatId = "pantrySeatA" | "pantrySeatB" | "restroomToilet" | "treadmillBelt";
export type FacilityFacingLabel =
  | "downLeft"
  | "downRight"
  | "upLeft"
  | "upRight"
  | "frontCamera"
  | "rightWorkstation"
  | "horizontalFront";
export type FacilityActionId = "coffee" | "snack" | "device" | "drink" | "meditate" | "run";

export type FacilityVector = {
  x: number;
  y: number;
};

export type FacilitySourceRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FacilitySeatDefinition = {
  seatId: FacilitySeatId;
  destination: IdleDestination;
  sourceAnchor: SourcePoint;
  seatBackPoint: FacilityVector;
  seatFrontPoint: FacilityVector;
  facingVector: FacilityVector;
  facingLabel: FacilityFacingLabel;
  frontOcclusionRect: FacilitySourceRect;
};

export type FacilitySeatAssignmentRequest = {
  agentId: string;
  destination: IdleDestination;
  rank: number;
  seed: number;
};

export type FacilitySeatAssignment = FacilitySeatAssignmentRequest & {
  seatId: FacilitySeatId;
  seat: FacilitySeatDefinition;
};

export type FacilitySeatSession = {
  agentId: string;
  destination: IdleDestination;
  seed: number;
  seatId: FacilitySeatId;
};

const FACILITY_SEAT_POINTS: Array<Omit<FacilitySeatDefinition, "facingVector" | "facingLabel"> & { facingLabel?: FacilityFacingLabel }> = [
  {
    seatId: "pantrySeatA",
    destination: "pantry",
    sourceAnchor: { x: 305.3039822513668, y: 752.3208373811838, scale: 1 },
    seatBackPoint: { x: 277.6779530258872, y: 664.8025601462941 },
    seatFrontPoint: { x: 321.9287673581348, y: 709.0533744785416 },
    frontOcclusionRect: {
      x: 224.57697582719015,
      y: 771.0045145436882,
      width: 194.70358306188928,
      height: 47.20086862106407
    }
  },
  {
    seatId: "pantrySeatB",
    destination: "pantry",
    sourceAnchor: { x: 447.4866118093654, y: 752.3208373811838, scale: 1 },
    seatBackPoint: { x: 522.532458997657, y: 664.8025601462941 },
    seatFrontPoint: { x: 478.2816446654095, y: 709.0533744785416 },
    frontOcclusionRect: {
      x: 369.12963597919884,
      y: 771.0045145436882,
      width: 194.70358306188928,
      height: 47.20086862106407
    }
  },
  {
    seatId: "restroomToilet",
    destination: "restroom",
    sourceAnchor: { x: 121, y: 909.4117647058823, scale: 1 },
    seatBackPoint: { x: 121, y: 880 },
    seatFrontPoint: { x: 121, y: 950 },
    frontOcclusionRect: { x: 82, y: 954, width: 78, height: 28 }
  },
  {
    seatId: "treadmillBelt",
    destination: "treadmill",
    sourceAnchor: { x: 275, y: 461.31288343558276, scale: 1 },
    seatBackPoint: { x: 208.00613496932516, y: 461.31288343558276 },
    seatFrontPoint: { x: 341.99386503067484, y: 461.31288343558276 },
    facingLabel: "horizontalFront",
    frontOcclusionRect: {
      x: 185.03680981595093,
      y: 470.8834355828221,
      width: 179.92638036809817,
      height: 12.760736196319018
    }
  }
];

export const FACILITY_SEATS: FacilitySeatDefinition[] = FACILITY_SEAT_POINTS.map((seat) => {
  const facingVector = normalizeVector({
    x: seat.seatFrontPoint.x - seat.seatBackPoint.x,
    y: seat.seatFrontPoint.y - seat.seatBackPoint.y
  });
  return {
    ...seat,
    facingVector,
    facingLabel: seat.facingLabel ?? resolveFacilityFacingLabel(facingVector)
  };
});

const FACILITY_SEATS_BY_ID = new Map(FACILITY_SEATS.map((seat) => [seat.seatId, seat]));

const FACILITY_SEAT_ACTION_KEYS: Record<FacilitySeatId, Partial<Record<FacilityActionId, FlatAssetKey>>> = {
  pantrySeatA: {
    coffee: "flatAgentPantrySeatACoffeeSheet",
    snack: "flatAgentPantrySeatASnackSheet",
    device: "flatAgentPantrySeatADeviceSheet",
    drink: "flatAgentPantrySeatADrinkSheet"
  },
  pantrySeatB: {
    coffee: "flatAgentPantrySeatBCoffeeSheet",
    snack: "flatAgentPantrySeatBSnackSheet",
    device: "flatAgentPantrySeatBDeviceSheet",
    drink: "flatAgentPantrySeatBDrinkSheet"
  },
  restroomToilet: {
    device: "flatAgentRestroomToiletDeviceSheet",
    meditate: "flatAgentRestroomToiletMeditateSheet"
  },
  treadmillBelt: {
    run: "flatAgentTreadmillHorizontalRunSheet"
  }
};

export function getFacilitySeatDefinition(seatId: FacilitySeatId): FacilitySeatDefinition {
  const seat = FACILITY_SEATS_BY_ID.get(seatId);
  if (!seat) {
    throw new Error(`Unknown facility seat: ${seatId}`);
  }
  return seat;
}

export function getFacilitySeatsForDestination(destination: IdleDestination): FacilitySeatDefinition[] {
  return FACILITY_SEATS.filter((seat) => seat.destination === destination);
}

export function resolveFacilityFacingLabel(vector: FacilityVector): FacilityFacingLabel {
  if (vector.x > 0 && vector.y === 0) {
    return "horizontalFront";
  }
  if (vector.x === 0 && vector.y >= 0) {
    return "frontCamera";
  }
  if (vector.x < 0 && vector.y < 0) {
    return "upLeft";
  }
  if (vector.x >= 0 && vector.y < 0) {
    return "upRight";
  }
  if (vector.x < 0 && vector.y >= 0) {
    return "downLeft";
  }
  return "downRight";
}

export function assignFacilitySeats(
  requests: FacilitySeatAssignmentRequest[],
  lockedSessions: FacilitySeatSession[] = []
): FacilitySeatAssignment[] {
  const occupied = new Set<FacilitySeatId>();
  const assignments = new Map<string, FacilitySeatAssignment>();
  const locksByAgent = new Map(lockedSessions.map((session) => [session.agentId, session]));
  const orderedRequests = [...requests]
    .sort((left, right) => left.destination.localeCompare(right.destination) || left.rank - right.rank);

  orderedRequests.forEach((request) => {
    const lockedSeat = getValidLockedSeat(request, locksByAgent.get(request.agentId));
    if (!lockedSeat || occupied.has(lockedSeat.seatId)) {
      return;
    }

    occupied.add(lockedSeat.seatId);
    assignments.set(request.agentId, {
      ...request,
      seatId: lockedSeat.seatId,
      seat: lockedSeat
    });
  });

  orderedRequests.forEach((request) => {
    if (assignments.has(request.agentId)) {
      return;
    }

    const seat = chooseFacilitySeat(request, occupied);
    if (!seat) {
      return;
    }
    occupied.add(seat.seatId);
    assignments.set(request.agentId, {
      ...request,
      seatId: seat.seatId,
      seat
    });
  });

  return orderedRequests
    .map((request) => assignments.get(request.agentId))
    .filter((assignment): assignment is FacilitySeatAssignment => Boolean(assignment));
}

export function getFacilitySeatActionKey(
  seatId: FacilitySeatId,
  actionId: FacilityActionId
): FlatAssetKey | undefined {
  return FACILITY_SEAT_ACTION_KEYS[seatId][actionId];
}

function normalizeVector(vector: FacilityVector): FacilityVector {
  const length = Math.hypot(vector.x, vector.y);
  if (length === 0) {
    return { x: 0, y: 1 };
  }
  return {
    x: vector.x / length,
    y: vector.y / length
  };
}

function getValidLockedSeat(
  request: FacilitySeatAssignmentRequest,
  session: FacilitySeatSession | undefined
) {
  if (!session || session.destination !== request.destination || session.seed !== request.seed) {
    return undefined;
  }

  const seat = FACILITY_SEATS_BY_ID.get(session.seatId);
  return seat?.destination === request.destination ? seat : undefined;
}

function chooseFacilitySeat(
  request: FacilitySeatAssignmentRequest,
  occupied: Set<FacilitySeatId>
) {
  const seats = getFacilitySeatsForDestination(request.destination);
  const openSeats = seats.filter((seat) => !occupied.has(seat.seatId));
  if (openSeats.length === 0) {
    return undefined;
  }
  const preferredIndex = seats.length <= 1
    ? 0
    : positiveHash(`${request.destination}:${request.agentId}:${request.seed}:seat`) % seats.length;
  for (let offset = 0; offset < seats.length; offset += 1) {
    const candidate = seats[(preferredIndex + offset) % seats.length];
    if (!occupied.has(candidate.seatId)) {
      return candidate;
    }
  }
  return undefined;
}

function positiveHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
