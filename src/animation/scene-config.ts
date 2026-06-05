import type { AgentStatus } from "../shared/types";
import type {
  GeneratedAssetKey,
  IdleDestination,
  ScreenQuad,
  SourcePoint,
  SourceRect
} from "./scene-types";

export const STATUS_SCREEN_COLORS: Record<AgentStatus, number> = {
  working: 0x0f2c27,
  thinking: 0x13284d,
  blocked: 0x3a2d10,
  error: 0x411b17,
  idle: 0x23395f,
  offline: 0x141719
};

export const OFFICE_BACKGROUND_SOURCE = { width: 1536, height: 1024 };

// User-marked source-space geometry. Keep these values in the same 1536x1024
// background source coordinate system to avoid remeasuring assets.
export const OFFICE_FLOOR_BOUNDARY_SOURCE: SourcePoint[] = [
  { x: 449, y: 229 },
  { x: 1229, y: 547 },
  { x: 1232, y: 954 },
  { x: 100, y: 953 },
  { x: 96, y: 437 }
];

export const WORKSTATION_ROW_STARTS_SOURCE: SourcePoint[] = [
  { x: 599.52, y: 418.92 },
  { x: 593.78, y: 597.9 }
];

export const WORKSTATION_COLUMN_VECTOR_SOURCE: SourcePoint = { x: 255, y: 0 };
export const WORKSTATION_COLUMNS_PER_ROW = 3;

export function getWorkstationAnchorSource(index: number): SourcePoint {
  const rowCount = WORKSTATION_ROW_STARTS_SOURCE.length;
  const blockSize = WORKSTATION_COLUMNS_PER_ROW * rowCount;
  const blockIndex = Math.floor(index / blockSize);
  const indexInBlock = index % blockSize;
  const rowIndex = Math.floor(indexInBlock / WORKSTATION_COLUMNS_PER_ROW);
  const columnIndex = (indexInBlock % WORKSTATION_COLUMNS_PER_ROW) + blockIndex * WORKSTATION_COLUMNS_PER_ROW;
  const start = WORKSTATION_ROW_STARTS_SOURCE[rowIndex];

  return {
    x: start.x + WORKSTATION_COLUMN_VECTOR_SOURCE.x * columnIndex,
    y: start.y + WORKSTATION_COLUMN_VECTOR_SOURCE.y * columnIndex,
    scale: 0.96 + rowIndex * 0.04 + columnIndex * 0.01
  };
}

export const WORKSTATION_ANCHORS_SOURCE: SourcePoint[] = Array.from(
  { length: WORKSTATION_COLUMNS_PER_ROW * WORKSTATION_ROW_STARTS_SOURCE.length },
  (_, index) => getWorkstationAnchorSource(index)
);

// Functional zones follow the plan-left annotation supplied by the user: blue/gray
// lines define each zone floor line, green lines define height direction, and red
// lines are treated as the maximum height cap.
export const FACILITY_RECTS_SOURCE: Record<"pantry" | "treadmill" | "restroom", SourceRect> = {
  treadmill: { x: 171, y: 324.7730061349693, width: 208 },
  pantry: { x: 58, y: 502, width: 440 },
  restroom: { x: 55, y: 820, width: 132 }
};

export const RESTROOM_PRIVACY_LAYER_RECTS_SOURCE: SourceRect = { x: -25, y: 716, width: 300 };

export const GENERATED_DESK_LOCAL_WIDTH = 210;
export const WORKSTATION_SOURCE_WIDTH = 160;
export const PANTRY_ROOM_SOURCE = { width: 1485, height: 594 };
export const PANTRY_COUNTER_FRIDGE_SOURCE = { width: 1672, height: 941 };
export const PANTRY_TABLE_CHAIRS_SOURCE = { width: 1536, height: 1024 };
export const RESTROOM_ROOM_SOURCE = { width: 1122, height: 1402 };
export const TREADMILL_HORIZONTAL_STATIC_SOURCE = { width: 326, height: 386 };

export const WORKSTATION_DESKTOP_SURFACE_SOURCE = {
  width: WORKSTATION_SOURCE_WIDTH,
  depth: 53.990228013029316
};

export const PANTRY_COUNTERTOP_SURFACE_SOURCE = {
  x: 117.21052631578948,
  y: 525.6842105263158,
  width: 325,
  depth: 53.990228013029316
};

export const PANTRY_LAYER_RECTS_SOURCE = {
  counterFridge: { x: 29.873392765300878, y: 490.7493571061204, width: 442.5081433224756 },
  tableChairs: { x: 215.72681296074063, y: 644.1521801245785, width: 324.50597176981546 }
};

export const FACILITY_SCENE_PROP_Z_INDEX = {
  pantryCounterFridge: 10,
  restroomPrivacyBack: 15,
  pantryTableChairsBack: 20,
  treadmillStatic: 30,
  restroomToiletBack: 40
};

// Locked from the user's manual red 3px monitor-boundary overlays.
export const AGENT_WORKSTATION_SCREEN_SOURCE: ScreenQuad = [
  { x: 184, y: 49 },
  { x: 280, y: 88 },
  { x: 282, y: 158 },
  { x: 184, y: 117 }
];

export const OFFICE_DESK_SCREEN_SOURCE: ScreenQuad = [
  { x: 149, y: 21 },
  { x: 285, y: 68 },
  { x: 285, y: 148 },
  { x: 149, y: 99 }
];

export const IDLE_ROOM_CAPACITY: Record<IdleDestination, number> = {
  pantry: 2,
  restroom: 1,
  treadmill: 1
};

export const GENERATED_ASSETS: Record<GeneratedAssetKey, string> = {
  officeBackground: "./assets/generated/office-background-2d-v1.png",
  officeDesk: "./assets/generated/office-desk.png",
  agentWorkstation: "./assets/generated/agent-workstation.png",
  idleScreensaverSheet: "./assets/generated/idle-screensaver-sheet.png",
  workingTerminalBuildRun: "./assets/generated/screen-animations/working-terminal-build-run-sheet.png",
  workingCodeEditorActive: "./assets/generated/screen-animations/working-code-editor-active-sheet.png",
  workingDiffReviewActive: "./assets/generated/screen-animations/working-diff-review-active-sheet.png",
  thinkingPlanningBoard: "./assets/generated/screen-animations/thinking-planning-board-sheet.png",
  thinkingSearchAnalysis: "./assets/generated/screen-animations/thinking-search-analysis-sheet.png",
  thinkingArchitectureMap: "./assets/generated/screen-animations/thinking-architecture-map-sheet.png",
  pantryCounterFridge: "./assets/generated/pantry-counter-fridge-2d-v2.png",
  pantryTableChairs: "./assets/generated/pantry-table-chairs-2d-v2.png",
  pantryTableChairsBack: "./assets/generated/pantry-table-chairs-back-2d-v3.png",
  pantryTableChairsFront: "./assets/generated/pantry-table-chairs-front-occlusion-2d-v3.png",
  pantryRoom: "./assets/generated/pantry-integrated-2d-v1.png",
  pantryRoomOccupiedLeft: "./assets/generated/pantry-integrated-2d-v1.png",
  pantryRoomOccupiedRight: "./assets/generated/pantry-integrated-2d-v1.png",
  pantryRoomOccupiedBoth: "./assets/generated/pantry-integrated-2d-v1.png",
  restroomRoom: "./assets/generated/restroom-toilet-2d-v2.png",
  restroomPrivacyBack: "./assets/generated/restroom-privacy-back-2d-v1.png",
  restroomToiletBack: "./assets/generated/restroom-toilet-back-2d-v3.png",
  restroomToiletFront: "./assets/generated/restroom-toilet-front-occlusion-2d-v3.png",
  restroomRoomOccupied: "./assets/generated/restroom-toilet-2d-v2.png",
  treadmillHorizontalStatic: "./assets/generated/treadmill-horizontal-static-2d-v4.png"
};
