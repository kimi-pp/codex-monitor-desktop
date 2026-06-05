export type GeneratedAssetKey =
  | "officeBackground"
  | "officeDesk"
  | "agentWorkstation"
  | "idleScreensaverSheet"
  | "workingTerminalBuildRun"
  | "workingCodeEditorActive"
  | "workingDiffReviewActive"
  | "thinkingPlanningBoard"
  | "thinkingSearchAnalysis"
  | "thinkingArchitectureMap"
  | "pantryCounterFridge"
  | "pantryTableChairs"
  | "pantryTableChairsBack"
  | "pantryTableChairsFront"
  | "pantryRoom"
  | "pantryRoomOccupiedLeft"
  | "pantryRoomOccupiedRight"
  | "pantryRoomOccupiedBoth"
  | "restroomRoom"
  | "restroomPrivacyBack"
  | "restroomToiletBack"
  | "restroomToiletFront"
  | "restroomRoomOccupied"
  | "treadmillHorizontalStatic";

export type IdleDestination = "pantry" | "restroom" | "treadmill";

export type IdleDeskActivity = "video" | "music" | "game";

export type IdleBehavior = IdleDestination | IdleDeskActivity;

export type IdleAssignment = {
  destination: IdleDestination;
  rank: number;
};

export type IdleBehaviorSession = {
  behavior: IdleBehavior;
  seed: number;
  segmentIndex?: number;
  segmentStartedAt?: number;
  rerollDurationMs?: number;
  nextRerollAt?: number;
  locked?: boolean;
};

export type AgentVisualAction =
  | "workstationWorking"
  | "workstationThinking"
  | "workstationIdle"
  | "walkUp"
  | "walkDown"
  | "walkLeft"
  | "walkRight"
  | "pantryUse"
  | "restroomUse"
  | "treadmillRun";

export type AgentVisualPhase = "station" | "walkingToFacility" | "facility" | "walkingToStation";

export type AgentVisualSession = {
  agentId: string;
  action: AgentVisualAction;
  startedAt: number;
  phaseStartedAt: number;
  visualPhase: AgentVisualPhase;
  from: SourcePoint;
  to: SourcePoint;
  path: SourcePoint[];
  actorSourcePosition: SourcePoint;
  walkRoute?: import("./agent-walk-route").WalkRoute;
  walkSegmentIndex?: number;
  walkDirection?: Extract<AgentVisualAction, "walkUp" | "walkDown" | "walkLeft" | "walkRight">;
  walkProgress?: number;
  walkDurationMs?: number;
  lockedIdleBehavior?: IdleBehavior;
  frameIndex: number;
};

export type AwayScreenMode = "desktop" | "screensaver";

export type AwayScreenSession = {
  mode: AwayScreenMode;
  seed: number;
};

export type RoomLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ScenePoint = {
  x: number;
  y: number;
  scale: number;
};

export type ScreenPoint = {
  x: number;
  y: number;
};

export type ScreenQuad = [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint];

export type BackgroundLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
};

export type SourcePoint = {
  x: number;
  y: number;
  scale?: number;
};

export type SourceRect = {
  x: number;
  y: number;
  width: number;
};

export type SourceLine = [SourcePoint, SourcePoint];
