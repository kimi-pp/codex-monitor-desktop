export type FlatAssetKey =
  | "flatOfficeDeskLayer"
  | "flatAgentTypingBodySheet"
  | "flatAgentThinkingBodySheet"
  | "flatAgentIdleDeskBodySheet"
  | "flatAgentTypingSheet"
  | "flatAgentThinkingSheet"
  | "flatAgentIdleDeskSheet"
  | "flatPantryRoom"
  | "flatRestroomRoom"
  | "flatAgentWalkUpSheet"
  | "flatAgentWalkDownSheet"
  | "flatAgentWalkLeftSheet"
  | "flatAgentWalkRightSheet"
  | "flatAgentWalkNESheet"
  | "flatAgentWalkNWSheet"
  | "flatAgentWalkSESheet"
  | "flatAgentWalkSWSheet"
  | "flatAgentPantryUseSheet"
  | "flatAgentRestroomUseSheet"
  | "flatAgentPantryCoffeeSheet"
  | "flatAgentPantrySnackSheet"
  | "flatAgentPantryDeviceSheet"
  | "flatAgentPantryDrinkSheet"
  | "flatAgentRestroomDeviceSheet"
  | "flatAgentRestroomMeditateSheet"
  | "flatAgentPantrySeatACoffeeSheet"
  | "flatAgentPantrySeatASnackSheet"
  | "flatAgentPantrySeatADeviceSheet"
  | "flatAgentPantrySeatADrinkSheet"
  | "flatAgentPantrySeatBCoffeeSheet"
  | "flatAgentPantrySeatBSnackSheet"
  | "flatAgentPantrySeatBDeviceSheet"
  | "flatAgentPantrySeatBDrinkSheet"
  | "flatAgentRestroomToiletDeviceSheet"
  | "flatAgentRestroomToiletMeditateSheet"
  | "flatAgentTreadmillRunSheet"
  | "flatAgentTreadmillRightRunSheet"
  | "flatAgentTreadmillHorizontalRunSheet";

export type FlatSpriteSpec = {
  path: string;
  columns: number;
  rows: number;
  fps: number;
  anchorX: number;
  anchorY: number;
  frameWidth: number;
  frameHeight: number;
  status: "ready" | "planned";
  registration?: {
    visibleWidth: number;
    anchorKind?: "hip" | "footContact";
    hipAnchors?: Array<{ x: number; y: number }>;
    contactAnchors?: Array<{ x: number; y: number }>;
    poseMode?: "randomHold";
    poseFrames?: number[];
    poseHoldMs?: number;
  };
};

export const FLAT_ASSET_ROOT = "./assets/generated/flat";

function createFacilityAgentSheetSpec(
  fileName: string,
  visibleWidth: number,
  hipAnchors: Array<{ x: number; y: number }>
): FlatSpriteSpec {
  return {
    path: `${FLAT_ASSET_ROOT}/${fileName}`,
    columns: 8,
    rows: 1,
    fps: 6,
    anchorX: 0.5,
    anchorY: 0.9,
    frameWidth: 272,
    frameHeight: 724,
    status: "ready",
    registration: {
      visibleWidth,
      anchorKind: "hip",
      hipAnchors
    }
  };
}

function createFootContactAgentSheetSpec(
  fileName: string,
  visibleWidth: number,
  contactAnchors: Array<{ x: number; y: number }>
): FlatSpriteSpec {
  return {
    path: `${FLAT_ASSET_ROOT}/${fileName}`,
    columns: 8,
    rows: 1,
    fps: 8,
    anchorX: 0.5,
    anchorY: 0.9,
    frameWidth: 272,
    frameHeight: 724,
    status: "ready",
    registration: {
      visibleWidth,
      anchorKind: "footContact",
      contactAnchors
    }
  };
}

function createPlannedWalkAgentSheetSpec(fileName: string): FlatSpriteSpec {
  return {
    path: `${FLAT_ASSET_ROOT}/${fileName}`,
    columns: 16,
    rows: 1,
    fps: 15,
    anchorX: 0.5,
    anchorY: 0.9,
    frameWidth: 272,
    frameHeight: 724,
    status: "planned"
  };
}

const WALK_AGENT_CONTACT_ANCHORS = Array.from({ length: 16 }, () => ({ x: 136, y: 610 }));

function createWalkAgentSheetSpec(fileName: string, fps = 8): FlatSpriteSpec {
  return {
    path: `${FLAT_ASSET_ROOT}/${fileName}`,
    columns: 16,
    rows: 1,
    fps,
    anchorX: 0.5,
    anchorY: 0.9,
    frameWidth: 272,
    frameHeight: 724,
    status: "ready",
    registration: {
      visibleWidth: 80,
      anchorKind: "footContact",
      contactAnchors: WALK_AGENT_CONTACT_ANCHORS
    }
  };
}

// Fixed-view Marvis-style sprite contract. Ready entries reflect Cicero's
// delivered files; planned entries should not be loaded until generated.
export const FLAT_ASSET_MANIFEST: Record<FlatAssetKey, FlatSpriteSpec> = {
  flatOfficeDeskLayer: {
    path: `${FLAT_ASSET_ROOT}/flatOfficeDeskLayer.png`,
    columns: 1,
    rows: 1,
    fps: 1,
    anchorX: 0.5,
    anchorY: 0.92,
    frameWidth: 384,
    frameHeight: 512,
    status: "ready"
  },
  flatAgentTypingBodySheet: {
    path: `${FLAT_ASSET_ROOT}/flatAgentTypingBodySheet.png`,
    columns: 4,
    rows: 2,
    fps: 5,
    anchorX: 0.5,
    anchorY: 0.92,
    frameWidth: 384,
    frameHeight: 512,
    status: "ready",
    registration: {
      visibleWidth: 245,
      hipAnchors: [
        { x: 202.5, y: 402.6 },
        { x: 200, y: 402.6 },
        { x: 189.5, y: 402.6 },
        { x: 168, y: 402.6 },
        { x: 206, y: 359.6 },
        { x: 196, y: 358.7 },
        { x: 183.5, y: 359.6 },
        { x: 168, y: 358.7 }
      ]
    }
  },
  flatAgentThinkingBodySheet: {
    path: `${FLAT_ASSET_ROOT}/flatAgentThinkingBodySheet.png`,
    columns: 4,
    rows: 2,
    fps: 5,
    anchorX: 0.5,
    anchorY: 0.92,
    frameWidth: 384,
    frameHeight: 512,
    status: "ready",
    registration: {
      visibleWidth: 246,
      poseMode: "randomHold",
      poseFrames: [0, 1, 2, 3, 4, 5, 6, 7],
      poseHoldMs: 6000,
      hipAnchors: [
        { x: 208.5, y: 417.8 },
        { x: 194.5, y: 418.2 },
        { x: 182, y: 417.7 },
        { x: 178.5, y: 418.2 },
        { x: 201.5, y: 366.8 },
        { x: 186, y: 366.5 },
        { x: 183, y: 367.2 },
        { x: 173, y: 369 }
      ]
    }
  },
  flatAgentIdleDeskBodySheet: {
    path: `${FLAT_ASSET_ROOT}/flatAgentIdleDeskBodySheet.png`,
    columns: 4,
    rows: 2,
    fps: 5,
    anchorX: 0.5,
    anchorY: 0.92,
    frameWidth: 384,
    frameHeight: 512,
    status: "ready",
    registration: {
      visibleWidth: 270,
      poseMode: "randomHold",
      poseFrames: [0, 1, 2, 3, 4, 5, 6, 7],
      poseHoldMs: 6000,
      hipAnchors: [
        { x: 213, y: 440.6 },
        { x: 200, y: 440.6 },
        { x: 191.5, y: 440.7 },
        { x: 187, y: 440.7 },
        { x: 206.5, y: 381.7 },
        { x: 202, y: 382.7 },
        { x: 188, y: 381.6 },
        { x: 189.5, y: 382.6 }
      ]
    }
  },
  flatAgentTypingSheet: {
    path: `${FLAT_ASSET_ROOT}/flatAgentTypingSheet.png`,
    columns: 4,
    rows: 2,
    fps: 5,
    anchorX: 0.5,
    anchorY: 0.92,
    frameWidth: 384,
    frameHeight: 512,
    status: "ready"
  },
  flatAgentThinkingSheet: {
    path: `${FLAT_ASSET_ROOT}/flatAgentThinkingSheet.png`,
    columns: 4,
    rows: 2,
    fps: 5,
    anchorX: 0.5,
    anchorY: 0.92,
    frameWidth: 384,
    frameHeight: 512,
    status: "ready"
  },
  flatAgentIdleDeskSheet: {
    path: `${FLAT_ASSET_ROOT}/flatAgentIdleDeskSheet.png`,
    columns: 4,
    rows: 2,
    fps: 5,
    anchorX: 0.5,
    anchorY: 0.92,
    frameWidth: 384,
    frameHeight: 512,
    status: "ready"
  },
  flatPantryRoom: {
    path: `${FLAT_ASSET_ROOT}/flatPantryRoom.png`,
    columns: 1,
    rows: 1,
    fps: 1,
    anchorX: 0.5,
    anchorY: 0.88,
    frameWidth: 420,
    frameHeight: 330,
    status: "planned"
  },
  flatRestroomRoom: {
    path: `${FLAT_ASSET_ROOT}/flatRestroomRoom.png`,
    columns: 1,
    rows: 1,
    fps: 1,
    anchorX: 0.5,
    anchorY: 0.9,
    frameWidth: 340,
    frameHeight: 320,
    status: "planned"
  },
  flatAgentWalkUpSheet: createWalkAgentSheetSpec("flatAgentWalkUpSheet.png"),
  flatAgentWalkDownSheet: createWalkAgentSheetSpec("flatAgentWalkDownSheet.png"),
  flatAgentWalkLeftSheet: createWalkAgentSheetSpec("flatAgentWalkLeftSheet.png", 6),
  flatAgentWalkRightSheet: createWalkAgentSheetSpec("flatAgentWalkRightSheet.png", 6),
  flatAgentWalkNESheet: {
    path: `${FLAT_ASSET_ROOT}/flatAgentWalkNESheet.png`,
    columns: 6,
    rows: 1,
    fps: 8,
    anchorX: 0.5,
    anchorY: 0.94,
    frameWidth: 180,
    frameHeight: 220,
    status: "planned"
  },
  flatAgentWalkNWSheet: {
    path: `${FLAT_ASSET_ROOT}/flatAgentWalkNWSheet.png`,
    columns: 6,
    rows: 1,
    fps: 8,
    anchorX: 0.5,
    anchorY: 0.94,
    frameWidth: 180,
    frameHeight: 220,
    status: "planned"
  },
  flatAgentWalkSESheet: {
    path: `${FLAT_ASSET_ROOT}/flatAgentWalkSESheet.png`,
    columns: 6,
    rows: 1,
    fps: 8,
    anchorX: 0.5,
    anchorY: 0.94,
    frameWidth: 180,
    frameHeight: 220,
    status: "planned"
  },
  flatAgentWalkSWSheet: {
    path: `${FLAT_ASSET_ROOT}/flatAgentWalkSWSheet.png`,
    columns: 6,
    rows: 1,
    fps: 8,
    anchorX: 0.5,
    anchorY: 0.94,
    frameWidth: 180,
    frameHeight: 220,
    status: "planned"
  },
  flatAgentPantryUseSheet: {
    path: `${FLAT_ASSET_ROOT}/flatAgentPantryUseSheet.png`,
    columns: 6,
    rows: 1,
    fps: 6,
    anchorX: 0.5,
    anchorY: 0.94,
    frameWidth: 220,
    frameHeight: 240,
    status: "planned"
  },
  flatAgentRestroomUseSheet: {
    path: `${FLAT_ASSET_ROOT}/flatAgentRestroomUseSheet.png`,
    columns: 6,
    rows: 1,
    fps: 6,
    anchorX: 0.5,
    anchorY: 0.94,
    frameWidth: 220,
    frameHeight: 240,
    status: "planned"
  },
  flatAgentPantryCoffeeSheet: {
    path: `${FLAT_ASSET_ROOT}/flatAgentPantryCoffeeSheet.png`,
    columns: 8,
    rows: 1,
    fps: 6,
    anchorX: 0.5,
    anchorY: 0.9,
    frameWidth: 272,
    frameHeight: 724,
    status: "ready",
    registration: {
      visibleWidth: 213,
      hipAnchors: [
        { x: 148.5, y: 442.3 },
        { x: 150.5, y: 442 },
        { x: 143.5, y: 442.6 },
        { x: 144, y: 441.8 },
        { x: 140.5, y: 443.2 },
        { x: 140.5, y: 443.2 },
        { x: 135.5, y: 442.6 },
        { x: 131.5, y: 443.4 }
      ]
    }
  },
  flatAgentPantrySnackSheet: {
    path: `${FLAT_ASSET_ROOT}/flatAgentPantrySnackSheet.png`,
    columns: 8,
    rows: 1,
    fps: 6,
    anchorX: 0.5,
    anchorY: 0.9,
    frameWidth: 272,
    frameHeight: 724,
    status: "ready",
    registration: {
      visibleWidth: 214,
      hipAnchors: [
        { x: 148, y: 437.3 },
        { x: 146, y: 436.6 },
        { x: 146, y: 439.2 },
        { x: 146.5, y: 437.9 },
        { x: 146, y: 437.6 },
        { x: 144, y: 437.3 },
        { x: 138, y: 438.9 },
        { x: 127.5, y: 438.6 }
      ]
    }
  },
  flatAgentPantryDeviceSheet: {
    path: `${FLAT_ASSET_ROOT}/flatAgentPantryDeviceSheet.png`,
    columns: 8,
    rows: 1,
    fps: 6,
    anchorX: 0.5,
    anchorY: 0.9,
    frameWidth: 272,
    frameHeight: 724,
    status: "ready",
    registration: {
      visibleWidth: 210,
      hipAnchors: [
        { x: 148, y: 436.3 },
        { x: 149.5, y: 436.3 },
        { x: 150.5, y: 438 },
        { x: 148.5, y: 438.2 },
        { x: 144.5, y: 438 },
        { x: 146.5, y: 436.6 },
        { x: 139.5, y: 438.2 },
        { x: 132.5, y: 438.2 }
      ]
    }
  },
  flatAgentPantryDrinkSheet: {
    path: `${FLAT_ASSET_ROOT}/flatAgentPantryDrinkSheet.png`,
    columns: 8,
    rows: 1,
    fps: 6,
    anchorX: 0.5,
    anchorY: 0.9,
    frameWidth: 272,
    frameHeight: 724,
    status: "ready",
    registration: {
      visibleWidth: 203,
      hipAnchors: [
        { x: 153.5, y: 441.4 },
        { x: 148, y: 442.1 },
        { x: 144, y: 441.6 },
        { x: 145, y: 441.4 },
        { x: 144.5, y: 441.4 },
        { x: 137.5, y: 441.6 },
        { x: 131.5, y: 442.1 },
        { x: 124.5, y: 441.4 }
      ]
    }
  },
  flatAgentRestroomDeviceSheet: {
    path: `${FLAT_ASSET_ROOT}/flatAgentRestroomDeviceSheet.png`,
    columns: 8,
    rows: 1,
    fps: 6,
    anchorX: 0.5,
    anchorY: 0.9,
    frameWidth: 272,
    frameHeight: 724,
    status: "ready",
    registration: {
      visibleWidth: 234,
      hipAnchors: [
        { x: 153, y: 426.4 },
        { x: 143.5, y: 428.2 },
        { x: 135, y: 431.3 },
        { x: 138.5, y: 429.8 },
        { x: 132.5, y: 429.7 },
        { x: 141, y: 434.8 },
        { x: 136, y: 431.7 },
        { x: 113.5, y: 428.3 }
      ]
    }
  },
  flatAgentRestroomMeditateSheet: {
    path: `${FLAT_ASSET_ROOT}/flatAgentRestroomMeditateSheet.png`,
    columns: 8,
    rows: 1,
    fps: 6,
    anchorX: 0.5,
    anchorY: 0.9,
    frameWidth: 272,
    frameHeight: 724,
    status: "ready",
    registration: {
      visibleWidth: 209,
      hipAnchors: [
        { x: 143, y: 431.7 },
        { x: 142, y: 432.4 },
        { x: 141, y: 433.2 },
        { x: 140.5, y: 434.6 },
        { x: 140.5, y: 433.5 },
        { x: 138.5, y: 432.7 },
        { x: 138, y: 433.2 },
        { x: 137.5, y: 432.7 }
      ]
    }
  },
  flatAgentPantrySeatACoffeeSheet: createFacilityAgentSheetSpec("flatAgentPantrySeatACoffeeSheet.png", 207, [
    { x: 136, y: 417.5 },
    { x: 135.5, y: 417.5 },
    { x: 135.5, y: 417.5 },
    { x: 135.5, y: 417.6 },
    { x: 135.5, y: 417.5 },
    { x: 135.5, y: 417.5 },
    { x: 135.5, y: 417.5 },
    { x: 135.5, y: 417.5 }
  ]),
  flatAgentPantrySeatASnackSheet: createFacilityAgentSheetSpec("flatAgentPantrySeatASnackSheet.png", 205, [
    { x: 136, y: 417.3 },
    { x: 135.5, y: 417.3 },
    { x: 136, y: 417.3 },
    { x: 135.5, y: 417.5 },
    { x: 136, y: 417.5 },
    { x: 136, y: 417.5 },
    { x: 136, y: 417.5 },
    { x: 135.5, y: 417.5 }
  ]),
  flatAgentPantrySeatADeviceSheet: createFacilityAgentSheetSpec("flatAgentPantrySeatADeviceSheet.png", 204, [
    { x: 136, y: 418.6 },
    { x: 135.5, y: 418.3 },
    { x: 136, y: 418.6 },
    { x: 135.5, y: 418.4 },
    { x: 136, y: 418.4 },
    { x: 135.5, y: 418.4 },
    { x: 136, y: 418.4 },
    { x: 135.5, y: 418.4 }
  ]),
  flatAgentPantrySeatADrinkSheet: createFacilityAgentSheetSpec("flatAgentPantrySeatADrinkSheet.png", 208, [
    { x: 135.5, y: 417.6 },
    { x: 135.5, y: 417.6 },
    { x: 136, y: 417.6 },
    { x: 135.5, y: 417.6 },
    { x: 136, y: 417.7 },
    { x: 135.5, y: 417.7 },
    { x: 136, y: 417.6 },
    { x: 135.5, y: 417.7 }
  ]),
  flatAgentPantrySeatBCoffeeSheet: createFacilityAgentSheetSpec("flatAgentPantrySeatBCoffeeSheet.png", 210, [
    { x: 141.2, y: 433.2 },
    { x: 141.9, y: 433.4 },
    { x: 141.4, y: 433.5 },
    { x: 141.7, y: 433.4 },
    { x: 141.8, y: 433.5 },
    { x: 141.4, y: 433.1 },
    { x: 141, y: 433.1 },
    { x: 141.6, y: 433.1 }
  ]),
  flatAgentPantrySeatBSnackSheet: createFacilityAgentSheetSpec("flatAgentPantrySeatBSnackSheet.png", 210, [
    { x: 139.7, y: 435.9 },
    { x: 140, y: 436.2 },
    { x: 139.6, y: 435.9 },
    { x: 139.8, y: 436.2 },
    { x: 140.2, y: 436.2 },
    { x: 139.5, y: 435.8 },
    { x: 139.4, y: 435.9 },
    { x: 138.4, y: 435.4 }
  ]),
  flatAgentPantrySeatBDeviceSheet: createFacilityAgentSheetSpec("flatAgentPantrySeatBDeviceSheet.png", 210, [
    { x: 139.6, y: 434.7 },
    { x: 139.5, y: 434.9 },
    { x: 137.9, y: 434.6 },
    { x: 140.5, y: 434.6 },
    { x: 138, y: 434.8 },
    { x: 138.2, y: 434.9 },
    { x: 140.1, y: 434.3 },
    { x: 138.2, y: 434.4 }
  ]),
  flatAgentPantrySeatBDrinkSheet: createFacilityAgentSheetSpec("flatAgentPantrySeatBDrinkSheet.png", 210, [
    { x: 138.4, y: 434.6 },
    { x: 141.6, y: 436.2 },
    { x: 141.6, y: 436.6 },
    { x: 141.7, y: 436.8 },
    { x: 142.1, y: 436.6 },
    { x: 139, y: 434.7 },
    { x: 138, y: 434.2 },
    { x: 138.3, y: 434.2 }
  ]),
  flatAgentRestroomToiletDeviceSheet: createFacilityAgentSheetSpec("flatAgentRestroomToiletDeviceSheet.png", 177, [
    { x: 146.5, y: 453.3 },
    { x: 149.5, y: 453.3 },
    { x: 147, y: 455 },
    { x: 140, y: 453.6 },
    { x: 137.5, y: 453.6 },
    { x: 136, y: 456.4 },
    { x: 127, y: 453.3 },
    { x: 130.5, y: 453.6 }
  ]),
  flatAgentRestroomToiletMeditateSheet: createFacilityAgentSheetSpec("flatAgentRestroomToiletMeditateSheet.png", 203, [
    { x: 137.5, y: 457.2 },
    { x: 137.5, y: 457.2 },
    { x: 137, y: 457.2 },
    { x: 136.5, y: 457.2 },
    { x: 136.5, y: 457.2 },
    { x: 136.5, y: 457.2 },
    { x: 135.5, y: 457.2 },
    { x: 135.5, y: 457.2 }
  ]),
  flatAgentTreadmillRunSheet: createFacilityAgentSheetSpec("flatAgentTreadmillRunSheet.png", 216, [
    { x: 149, y: 404.8 },
    { x: 149.5, y: 401.3 },
    { x: 138.5, y: 393.1 },
    { x: 135, y: 391.2 },
    { x: 127.5, y: 395.6 },
    { x: 112.5, y: 393.5 },
    { x: 124.5, y: 401.7 },
    { x: 106.5, y: 404.8 }
  ]),
  flatAgentTreadmillRightRunSheet: createFacilityAgentSheetSpec("flatAgentTreadmillRightRunSheet.png", 218, [
    { x: 139.8, y: 379.8 },
    { x: 139.7, y: 382.9 },
    { x: 140.3, y: 387.4 },
    { x: 139.2, y: 377.9 },
    { x: 140, y: 388.6 },
    { x: 140, y: 377.3 },
    { x: 139.5, y: 380.4 },
    { x: 140.4, y: 388.6 }
  ]),
  flatAgentTreadmillHorizontalRunSheet: createFootContactAgentSheetSpec("flatAgentTreadmillHorizontalRunSheet.png", 203, [
    { x: 112, y: 581 },
    { x: 116, y: 581 },
    { x: 122, y: 581 },
    { x: 159, y: 581 },
    { x: 144, y: 581 },
    { x: 159, y: 581 },
    { x: 136, y: 581 },
    { x: 141, y: 581 }
  ])
};

export const READY_FLAT_ASSET_KEYS = (Object.keys(FLAT_ASSET_MANIFEST) as FlatAssetKey[]).filter(
  (key) => FLAT_ASSET_MANIFEST[key].status === "ready"
);

export const FLAT_WORKSTATION_SCREEN_SOURCE: ScreenQuad = [
  { x: 111, y: 72 },
  { x: 273, y: 72 },
  { x: 273, y: 160 },
  { x: 111, y: 160 }
];
import type { ScreenQuad } from "./scene-types";
