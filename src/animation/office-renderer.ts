import {
  Application,
  Assets,
  Container,
  Graphics,
  MeshSimple,
  Rectangle,
  Sprite,
  Text,
  Texture,
  type FederatedPointerEvent
} from "pixi.js";
import { STATUS_PIXI_COLORS } from "../shared/status-meta";
import type { AgentActivity, AgentStatus } from "../shared/types";
import {
  createAgentScreenSessionStore,
  isActiveScreenStatus,
  isIdleDeskActivity
} from "./agent-screen-session";
import { createAgentVisualSessionStore } from "./agent-visual-session";
import {
  selectFacilityAction,
  type FacilityActionSelection
} from "./facility-actions";
import {
  assignFacilitySeats,
  getFacilitySeatActionKey,
  getFacilitySeatDefinition,
  type FacilitySeatAssignment,
  type FacilitySeatSession,
  type FacilitySourceRect
} from "./facility-seats";
import { publishLayoutDebugMetricsPayload } from "./layout-debug-metrics";
import {
  FLAT_ASSET_MANIFEST,
  FLAT_WORKSTATION_SCREEN_SOURCE,
  READY_FLAT_ASSET_KEYS,
  type FlatAssetKey,
  type FlatSpriteSpec
} from "./flat-assets";
import { FULL_FRAME_MESH_UVS, getSpriteSheetFrameTexture } from "./sprite-frame-textures";
import {
  AGENT_WORKSTATION_SCREEN_SOURCE,
  FACILITY_RECTS_SOURCE,
  GENERATED_ASSETS,
  GENERATED_DESK_LOCAL_WIDTH,
  IDLE_ROOM_CAPACITY,
  OFFICE_BACKGROUND_SOURCE,
  OFFICE_DESK_SCREEN_SOURCE,
  PANTRY_COUNTER_FRIDGE_SOURCE,
  PANTRY_COUNTERTOP_SURFACE_SOURCE,
  PANTRY_LAYER_RECTS_SOURCE,
  PANTRY_ROOM_SOURCE,
  PANTRY_TABLE_CHAIRS_SOURCE,
  RESTROOM_PRIVACY_LAYER_RECTS_SOURCE,
  RESTROOM_ROOM_SOURCE,
  STATUS_SCREEN_COLORS,
  TREADMILL_HORIZONTAL_STATIC_SOURCE,
  WORKSTATION_DESKTOP_SURFACE_SOURCE,
  WORKSTATION_SOURCE_WIDTH,
  FACILITY_SCENE_PROP_Z_INDEX,
  getWorkstationAnchorSource
} from "./scene-config";
import {
  drawAwayScreenPanel,
  drawGeneratedScreenPanel,
  drawIdleDeskScreenPanel,
  drawScreenMask,
  drawSpriteSheetScreenPanel,
  mapSpriteSourceQuad
} from "./screen-renderer";
import type {
  AwayScreenSession,
  AgentVisualAction,
  AgentVisualSession,
  BackgroundLayout,
  GeneratedAssetKey,
  IdleAssignment,
  IdleBehavior,
  IdleBehaviorSession,
  IdleDeskActivity,
  IdleDestination,
  RoomLayout,
  ScenePoint,
  ScreenQuad,
  SourcePoint
} from "./scene-types";

type OfficeRendererOptions = {
  getAgents: () => AgentActivity[];
  getSelectedAgentId: () => string | undefined;
  onSelectAgent: (agentId: string) => void;
};

type StationDisplay = {
  stationContainer: Container;
  actorContainer: Container;
  stationSprites: Container;
  flatWorkstationMesh: MeshSimple;
  baseGraphics: Graphics;
  monitorGraphics: Graphics;
  screenMask: Graphics;
  awayScreenMesh: MeshSimple;
  screenText: Text;
  foregroundGraphics: Graphics;
  nameText: Text;
  statusText: Text;
  actorSprites: Container;
  facilityBeltSprite: Sprite;
  flatAgentMesh: Sprite;
  facilityOcclusionSprite: Sprite;
  facilityOcclusionMask: Graphics;
  flatDeskForegroundMesh: MeshSimple;
  flatDeskForegroundMask: Graphics;
  actorBaseGraphics: Graphics;
  actorScreenMesh: MeshSimple;
  actorScreenMask: Graphics;
  actorScreenText: Text;
  personGraphics: Graphics;
  actorForegroundGraphics: Graphics;
  actorNameText: Text;
  actorStatusText: Text;
};

type FacilityAgentRenderMetrics = {
  visualPhase: "facility";
  agentId: string;
  agentName: string;
  destination: IdleDestination;
  rank: number;
  seatId: string;
  siteId?: string;
  facingLabel: string;
  facingVector: { x: number; y: number };
  actionKey: string;
  actionId: string;
  currentFrame: number;
  holdDurationMs: number;
  segmentElapsedMs: number;
  rerollDurationMs?: number;
  beltFrame?: number;
  anchorKind?: "hip" | "footContact";
  screenPosition: ScenePoint;
  sourceAnchor: SourcePoint;
  seatCushionAnchor: SourcePoint;
  screenSeatCushion: ScenePoint;
  screenFootContact?: ScenePoint;
  agentAnchorScreen?: { x: number; y: number };
  agentHipScreen?: { x: number; y: number };
  seatDeltaPx?: { x: number; y: number; distance: number };
  frontOcclusionRect: FacilitySourceRect;
  occlusionBbox?: { x: number; y: number; width: number; height: number };
  localBbox?: { minX: number; minY: number; maxX: number; maxY: number };
  fallback: boolean;
};

type WalkingAgentRenderMetrics = {
  visualPhase: "walkingToFacility" | "walkingToStation";
  agentId: string;
  agentName: string;
  destination?: IdleDestination;
  actionKey: string;
  currentFrame: number;
  fallback: boolean;
  walkPath: SourcePoint[];
  walkSegmentIndex: number;
  walkDirection: string;
  walkProgress: number;
  walkDurationMs: number;
  fromSourcePosition: SourcePoint;
  toSourcePosition: SourcePoint;
  actorSourcePosition: SourcePoint;
  actorScreenPosition: ScenePoint;
};

type AgentLayoutDebugMetrics = FacilityAgentRenderMetrics | WalkingAgentRenderMetrics;

type FacilityAgentDrawMetrics = {
  currentFrame: number;
  beltFrame?: number;
  localBbox?: { minX: number; minY: number; maxX: number; maxY: number };
  agentHipLocal?: { x: number; y: number };
  agentAnchorLocal?: { x: number; y: number };
  anchorKind?: "hip" | "footContact";
  occlusionBbox?: { x: number; y: number; width: number; height: number };
  fallback: boolean;
};

type LayoutDebugMetrics = {
  canvas: { width: number; height: number };
  source: {
    pantry: typeof FACILITY_RECTS_SOURCE.pantry;
    pantryCounterFridge: typeof PANTRY_LAYER_RECTS_SOURCE.counterFridge;
    pantryTableChairs: typeof PANTRY_LAYER_RECTS_SOURCE.tableChairs;
    pantryCountertopSurface: typeof PANTRY_COUNTERTOP_SURFACE_SOURCE;
    workstationDesktopSurface: typeof WORKSTATION_DESKTOP_SURFACE_SOURCE;
    treadmill: typeof FACILITY_RECTS_SOURCE.treadmill;
    restroom: typeof FACILITY_RECTS_SOURCE.restroom;
    restroomPrivacy: typeof RESTROOM_PRIVACY_LAYER_RECTS_SOURCE;
  };
  screen: ReturnType<typeof getFacilityLayouts>;
  agents: AgentLayoutDebugMetrics[];
};

export function createOfficeRenderer() {
  let app: Application | undefined;
  let resizeObserver: ResizeObserver | undefined;
  let options: OfficeRendererOptions | undefined;
  let mountToken = 0;
  const stations = new Map<string, StationDisplay>();
  const stationSlots = new Map<string, number>();
  const screenSessions = createAgentScreenSessionStore();
  const visualSessions = createAgentVisualSessionStore();
  let facilitySeatSessions = new Map<string, FacilitySeatSession>();
  let generatedTextures: Partial<Record<GeneratedAssetKey, Texture>> = {};
  let flatTextures: Partial<Record<FlatAssetKey, Texture>> = {};
  let generatedAssetsLoading = false;

  const FLAT_WORKSTATION_LOCAL_WIDTH = 190;
  const FLAT_WORKSTATION_LOCAL_X = 0;
  const FLAT_WORKSTATION_LOCAL_Y = 64;
  // Canonical flat Agent body width. Interactive environment assets should be scaled around this baseline.
  const FLAT_AGENT_VISIBLE_WIDTH_TARGET = 80;
  const FLAT_CHAIR_CUSHION_SOURCE = { x: 182, y: 318 };
  const FLAT_CHAIR_SUPPORT_LINE_SOURCE_Y = 345;

  async function mount(host: HTMLDivElement, rendererOptions: OfficeRendererOptions) {
    const token = ++mountToken;
    options = rendererOptions;
    const nextApp = new Application();
    await nextApp.init({
      backgroundColor: 0xf2f4ef,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      preserveDrawingBuffer: shouldPreserveDrawingBufferForQa(),
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      width: host.clientWidth,
      height: host.clientHeight
    });

    if (token !== mountToken || !options) {
      safeDestroy(nextApp);
      return;
    }

    app = nextApp;
    host.appendChild(nextApp.canvas);
    nextApp.canvas.className = "office-canvas";
    nextApp.stage.eventMode = "static";
    nextApp.stage.sortableChildren = true;

    void loadGeneratedAssets();

    resizeObserver = new ResizeObserver(() => {
      if (!app) {
        return;
      }
      const bounds = host.getBoundingClientRect();
      app.renderer.resize(Math.max(bounds.width, 320), Math.max(bounds.height, 320));
    });
    resizeObserver.observe(host);

    nextApp.ticker.add(() => render(performance.now()));
  }

  function shouldPreserveDrawingBufferForQa() {
    return new URLSearchParams(window.location.search).has("debugLayoutMetrics");
  }

  async function loadGeneratedAssets() {
    if (generatedAssetsLoading || (Object.keys(generatedTextures).length > 0 && Object.keys(flatTextures).length > 0)) {
      return;
    }

    generatedAssetsLoading = true;
    try {
      const flatAssetTasks = READY_FLAT_ASSET_KEYS.map(async (key) => {
          if (flatTextures[key]) {
            return;
          }
          const spec = FLAT_ASSET_MANIFEST[key];
          try {
            const texture = await Assets.load<Texture>(spec.path);
            flatTextures = {
              ...flatTextures,
              [key]: texture
            };
          } catch (error) {
            console.warn(`Flat asset failed to load: ${key} (${spec.path})`, error);
          }
        });
      const generatedAssetTasks = (Object.entries(GENERATED_ASSETS) as Array<[GeneratedAssetKey, string]>).map(async ([key, path]) => {
          if (generatedTextures[key]) {
            return;
          }
          try {
            const texture = await Assets.load<Texture>(path);
            generatedTextures = {
              ...generatedTextures,
              [key]: texture
            };
          } catch (error) {
            console.warn(`Generated asset failed to load: ${key} (${path})`, error);
          }
        });
      await Promise.all([...flatAssetTasks, ...generatedAssetTasks]);
    } catch (error) {
      console.warn("Generated asset loading failed; falling back to vector models.", error);
    } finally {
      generatedAssetsLoading = false;
    }
  }

  function destroy() {
    mountToken += 1;
    resizeObserver?.disconnect();
    resizeObserver = undefined;
    stations.clear();
    stationSlots.clear();
    screenSessions.clear();
    visualSessions.clear();
    facilitySeatSessions.clear();
    safeDestroy(app);
    app = undefined;
    options = undefined;
  }

  function render(time: number) {
    if (!app || !options) {
      return;
    }

    const currentApp = app;
    const currentOptions = options;
    const agents = currentOptions.getAgents();
    screenSessions.pruneIdleBehaviorSessions(agents);
    const idleAssignments = getIdleAssignments(agents, (agent) => screenSessions.getIdleBehaviorSession(agent, time).behavior);
    const facilitySeatRequests = agents.flatMap((agent) => {
      const idleAssignment = idleAssignments.get(agent.id);
      if (!idleAssignment || agent.status !== "idle") {
        return [];
      }
      const idleSession = screenSessions.getIdleBehaviorSession(agent);
      return [{
        agentId: agent.id,
        destination: idleAssignment.destination,
        rank: idleAssignment.rank,
        seed: idleSession.seed
      }];
    });
    const facilitySeatAssignmentList = assignFacilitySeats(facilitySeatRequests, [...facilitySeatSessions.values()]);
    facilitySeatSessions = new Map(
      facilitySeatAssignmentList.map((assignment) => [
        assignment.agentId,
        {
          agentId: assignment.agentId,
          destination: assignment.destination,
          seed: assignment.seed,
          seatId: assignment.seatId
        }
      ])
    );
    const facilitySeatAssignments = new Map(
      facilitySeatAssignmentList.map((assignment) => [assignment.agentId, assignment])
    );
    syncStations(agents);
    drawBackdrop(currentApp.stage, currentApp.renderer.width, currentApp.renderer.height, idleAssignments);

    const layout = getLayout(
      Math.max(stationSlots.size, agents.length),
      currentApp.renderer.width,
      currentApp.renderer.height
    );
    const agentLayoutMetrics: AgentLayoutDebugMetrics[] = [];
    agents.forEach((agent, index) => {
      const station = stations.get(agent.id);
      if (!station) {
        return;
      }
      const idleAssignment = idleAssignments.get(agent.id);
      const facilitySeatAssignment = facilitySeatAssignments.get(agent.id);
      const idleBehaviorSession = agent.status === "idle"
        ? screenSessions.getIdleBehaviorSession(agent, time)
        : undefined;
      const idleDeskActivity = agent.status === "idle" && !idleAssignment
        ? screenSessions.getIdleDeskActivity(agent.id)
        : undefined;
      const awayScreenSession = idleAssignment ? screenSessions.getAwayScreenSession(agent.id) : undefined;
      if (!idleAssignment) {
        screenSessions.clearAwayScreenSession(agent.id);
      }
      if (!isActiveScreenStatus(agent.status)) {
        screenSessions.clearWorkScreenSession(agent.id);
      }
      const stationSlot = getStationSlot(agent.id);
      const stationPoint = layout[stationSlot] ?? layout[index];
      const visualSession = visualSessions.getSession({
        agent,
        now: time,
        stationAnchor: getWorkstationAnchorSource(stationSlot),
        destinationAnchor: facilitySeatAssignment?.seat.sourceAnchor ??
          (idleAssignment ? getIdleDestinationAnchorSource(idleAssignment) : undefined),
        idleBehavior: idleAssignment ? idleBehaviorSession?.behavior : undefined
      });
      const isFacilityPhase = visualSession.visualPhase === "facility";
      const walkingPhase =
        visualSession.visualPhase === "walkingToFacility" ||
        visualSession.visualPhase === "walkingToStation"
          ? visualSession.visualPhase
          : undefined;
      const facilityAction = idleAssignment && idleBehaviorSession && isFacilityPhase
        ? selectFacilityAction(
          idleAssignment.destination,
          agent.id,
          idleBehaviorSession.seed,
          time - visualSession.phaseStartedAt
        )
        : undefined;
      const facilityActionKey = facilitySeatAssignment && facilityAction
        ? getFacilitySeatActionKey(facilitySeatAssignment.seatId, facilityAction.actionId)
        : undefined;
      const actorPoint = visualSession.visualPhase === "station"
        ? stationPoint
        : getScenePointFromSourcePoint(
          visualSession.actorSourcePosition,
          currentApp.renderer.width,
          currentApp.renderer.height
        );
      const baseScale = getStationScale(currentApp.renderer.width, currentApp.renderer.height);
      const stationScale = baseScale * (stationPoint.scale ?? 1);
      const actorScale = visualSession.visualPhase === "station"
        ? stationScale
        : baseScale * (actorPoint.scale ?? 1);
      const selected = currentOptions.getSelectedAgentId() === agent.id;

      station.stationContainer.position.set(stationPoint.x, stationPoint.y);
      station.actorContainer.position.set(actorPoint.x, actorPoint.y);
      station.stationContainer.zIndex = Math.round(stationPoint.y);
      station.actorContainer.zIndex = Math.round(actorPoint.y + 38);

      drawStation(
        station,
        agent,
        time,
        selected,
        stationScale,
        visualSession.visualPhase === "station",
        awayScreenSession,
        idleDeskActivity
      );
      const facilityDrawMetrics = drawAgent(
        station,
        agent,
        time,
        selected,
        actorScale,
        idleAssignment,
        idleDeskActivity,
        facilityAction,
        facilityActionKey,
        facilitySeatAssignment,
        actorPoint,
        visualSession,
        currentApp.renderer.width,
        currentApp.renderer.height
      );
      if (walkingPhase) {
        agentLayoutMetrics.push({
          visualPhase: walkingPhase,
          agentId: agent.id,
          agentName: agent.name,
          destination: idleAssignment?.destination,
          actionKey: getWalkActionKey(visualSession.action) ?? "unknown",
          currentFrame: facilityDrawMetrics?.currentFrame ?? visualSession.frameIndex,
          fallback: facilityDrawMetrics?.fallback ?? true,
          walkPath: visualSession.walkRoute?.points ?? visualSession.path,
          walkSegmentIndex: visualSession.walkSegmentIndex ?? 0,
          walkDirection: visualSession.walkDirection ?? visualSession.action,
          walkProgress: visualSession.walkProgress ?? 0,
          walkDurationMs: visualSession.walkDurationMs ?? 0,
          fromSourcePosition: visualSession.from,
          toSourcePosition: visualSession.to,
          actorSourcePosition: visualSession.actorSourcePosition,
          actorScreenPosition: actorPoint
        });
      }
      if (idleAssignment && idleBehaviorSession && facilityAction && facilitySeatAssignment && facilityActionKey) {
        const screenSeatCushion = actorPoint;
        const agentAnchorScreen = getFacilityAgentAnchorScreen(actorPoint, actorScale, facilityDrawMetrics);
        const agentHipScreen = facilityDrawMetrics?.anchorKind === "footContact"
          ? undefined
          : agentAnchorScreen;
        const seatDeltaPx = agentAnchorScreen
          ? {
            x: agentAnchorScreen.x - screenSeatCushion.x,
            y: agentAnchorScreen.y - screenSeatCushion.y,
            distance: Math.hypot(agentAnchorScreen.x - screenSeatCushion.x, agentAnchorScreen.y - screenSeatCushion.y)
          }
          : undefined;
        agentLayoutMetrics.push({
          visualPhase: "facility",
          agentId: agent.id,
          agentName: agent.name,
          destination: idleAssignment.destination,
          rank: idleAssignment.rank,
          seatId: facilitySeatAssignment.seatId,
          siteId: facilitySeatAssignment.seatId,
          facingLabel: facilitySeatAssignment.seat.facingLabel,
          facingVector: facilitySeatAssignment.seat.facingVector,
          actionKey: facilityActionKey,
          actionId: facilityAction.actionId,
          currentFrame: facilityDrawMetrics?.currentFrame ?? 0,
          holdDurationMs: facilityAction.holdDurationMs,
          segmentElapsedMs: facilityAction.segmentElapsedMs,
          rerollDurationMs: idleBehaviorSession.locked ? 0 : idleBehaviorSession.rerollDurationMs,
          beltFrame: facilitySeatAssignment.destination === "treadmill" ? undefined : facilityDrawMetrics?.beltFrame,
          anchorKind: facilityDrawMetrics?.anchorKind,
          screenPosition: actorPoint,
          sourceAnchor: facilitySeatAssignment.seat.sourceAnchor,
          seatCushionAnchor: facilitySeatAssignment.seat.sourceAnchor,
          screenSeatCushion,
          screenFootContact: facilityDrawMetrics?.anchorKind === "footContact" ? screenSeatCushion : undefined,
          agentAnchorScreen,
          agentHipScreen,
          seatDeltaPx,
          frontOcclusionRect: facilitySeatAssignment.seat.frontOcclusionRect,
          occlusionBbox: facilityDrawMetrics?.occlusionBbox,
          localBbox: facilityDrawMetrics?.localBbox,
          fallback: facilityDrawMetrics?.fallback ?? true
        });
      }
    });
    publishLayoutDebugMetrics(
      currentApp.renderer.width,
      currentApp.renderer.height,
      agentLayoutMetrics
    );
  }

  function syncStations(agents: AgentActivity[]) {
    if (!app) {
      return;
    }
    const currentApp = app;

    const liveIds = new Set(agents.map((agent) => agent.id));
    for (const [id, station] of stations) {
      if (!liveIds.has(id)) {
        station.stationContainer.destroy({ children: true });
        station.actorContainer.destroy({ children: true });
        stations.delete(id);
        screenSessions.deleteAgent(id);
        visualSessions.deleteAgent(id);
        facilitySeatSessions.delete(id);
      }
    }

    agents.forEach((agent) => {
      if (stations.has(agent.id)) {
        return;
      }

      getStationSlot(agent.id);

      const stationContainer = new Container();
      stationContainer.eventMode = "static";
      stationContainer.cursor = "pointer";
      stationContainer.hitArea = new Rectangle(-118, -112, 236, 230);
      stationContainer.on("pointertap", (event: FederatedPointerEvent) => {
        event.stopPropagation();
        options?.onSelectAgent(agent.id);
      });

      const actorContainer = new Container();
      actorContainer.eventMode = "static";
      actorContainer.cursor = "pointer";
      actorContainer.hitArea = new Rectangle(-108, -128, 216, 228);
      actorContainer.on("pointertap", (event: FederatedPointerEvent) => {
        event.stopPropagation();
        options?.onSelectAgent(agent.id);
      });

      const baseGraphics = new Graphics();
      const stationSprites = new Container();
      const flatWorkstationMesh = new MeshSimple({
        texture: Texture.EMPTY,
        vertices: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
        uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
        indices: new Uint32Array([0, 1, 2, 0, 2, 3])
      });
      flatWorkstationMesh.visible = false;
      const monitorGraphics = new Graphics();
      const screenMask = new Graphics();
      const awayScreenMesh = new MeshSimple({
        texture: Texture.EMPTY,
        vertices: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
        uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
        indices: new Uint32Array([0, 1, 2, 0, 2, 3])
      });
      awayScreenMesh.visible = false;
      const screenText = new Text({
        text: "",
        style: {
          fontFamily: "Consolas, monospace",
          fontSize: 8,
          lineHeight: 10,
          fill: 0xc9f4e9
        }
      });
      screenText.mask = screenMask;
      const foregroundGraphics = new Graphics();
      const nameText = new Text({
        text: "",
        style: {
          fontFamily: "Inter, Segoe UI, sans-serif",
          fontSize: 13,
          fontWeight: "700",
          fill: 0x17211f
        }
      });
      const statusText = new Text({
        text: "",
        style: {
          fontFamily: "Inter, Segoe UI, sans-serif",
          fontSize: 10,
          fontWeight: "700",
          fill: 0xffffff
        }
      });

      const actorBaseGraphics = new Graphics();
      const actorSprites = new Container();
      const facilityBeltSprite = new Sprite(Texture.EMPTY);
      facilityBeltSprite.visible = false;
      facilityBeltSprite.eventMode = "none";
      const flatAgentMesh = new Sprite(Texture.EMPTY);
      flatAgentMesh.anchor.set(0, 0);
      flatAgentMesh.visible = false;
      const facilityOcclusionSprite = new Sprite(Texture.EMPTY);
      facilityOcclusionSprite.visible = false;
      facilityOcclusionSprite.eventMode = "none";
      const facilityOcclusionMask = new Graphics();
      facilityOcclusionSprite.mask = facilityOcclusionMask;
      const flatDeskForegroundMesh = new MeshSimple({
        texture: Texture.EMPTY,
        vertices: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
        uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
        indices: new Uint32Array([0, 1, 2, 0, 2, 3])
      });
      flatDeskForegroundMesh.visible = false;
      const flatDeskForegroundMask = new Graphics();
      flatDeskForegroundMesh.mask = flatDeskForegroundMask;
      const actorScreenMesh = new MeshSimple({
        texture: Texture.EMPTY,
        vertices: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
        uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
        indices: new Uint32Array([0, 1, 2, 0, 2, 3])
      });
      actorScreenMesh.visible = false;
      const actorScreenMask = new Graphics();
      const actorScreenText = new Text({
        text: "",
        style: {
          fontFamily: "Consolas, monospace",
          fontSize: 6,
          lineHeight: 8,
          fill: 0xc9f4e9
        }
      });
      actorScreenText.mask = actorScreenMask;
      const personGraphics = new Graphics();
      const actorForegroundGraphics = new Graphics();
      const actorNameText = new Text({
        text: "",
        style: {
          fontFamily: "Inter, Segoe UI, sans-serif",
          fontSize: 13,
          fontWeight: "700",
          fill: 0x17211f
        }
      });
      const actorStatusText = new Text({
        text: "",
        style: {
          fontFamily: "Inter, Segoe UI, sans-serif",
          fontSize: 10,
          fontWeight: "700",
          fill: 0xffffff
        }
      });

      stationContainer.addChild(
        baseGraphics,
        stationSprites,
        flatWorkstationMesh,
        awayScreenMesh,
        monitorGraphics,
        screenMask,
        screenText,
        foregroundGraphics,
        nameText,
        statusText
      );
      actorContainer.addChild(
        actorBaseGraphics,
        actorSprites,
        facilityBeltSprite,
        flatAgentMesh,
        facilityOcclusionSprite,
        facilityOcclusionMask,
        flatDeskForegroundMesh,
        flatDeskForegroundMask,
        actorScreenMesh,
        personGraphics,
        actorForegroundGraphics,
        actorScreenMask,
        actorScreenText,
        actorNameText,
        actorStatusText
      );
      currentApp.stage.addChild(stationContainer, actorContainer);
      stations.set(agent.id, {
        stationContainer,
        actorContainer,
        stationSprites,
        flatWorkstationMesh,
        baseGraphics,
        monitorGraphics,
        screenMask,
        awayScreenMesh,
        screenText,
        foregroundGraphics,
        nameText,
        statusText,
        actorSprites,
        facilityBeltSprite,
        flatAgentMesh,
        facilityOcclusionSprite,
        facilityOcclusionMask,
        flatDeskForegroundMesh,
        flatDeskForegroundMask,
        actorBaseGraphics,
        actorScreenMesh,
        actorScreenMask,
        actorScreenText,
        personGraphics,
        actorForegroundGraphics,
        actorNameText,
        actorStatusText
      });
    });
  }

  function drawBackdrop(
    stage: Container,
    width: number,
    height: number,
    idleAssignments: Map<string, IdleAssignment>
  ) {
    const hasGeneratedBackground = Boolean(generatedTextures.officeBackground);
    drawGeneratedOfficeBackground(stage, width, height, hasGeneratedBackground);

    const key = "__backdrop";
    let backdrop = stage.getChildByName(key) as Graphics | undefined;
    if (!backdrop) {
      backdrop = new Graphics();
      backdrop.name = key;
      backdrop.zIndex = -1000;
      stage.addChildAt(backdrop, 0);
    }

    backdrop.clear();
    if (!hasGeneratedBackground) {
      backdrop.rect(0, 0, width, height).fill(0xf7f7f2);
      return;
    }

    drawStageMatte(backdrop, width, height);
    drawGeneratedSceneProps(stage, width, height);
    drawGeneratedSceneForeground(stage);
  }

  function drawStageMatte(backdrop: Graphics, width: number, height: number) {
    const layout = getBackgroundLayout(width, height);
    const topHeight = Math.max(0, layout.y);
    const bottomY = Math.min(height, layout.y + layout.height);
    const bottomHeight = Math.max(0, height - bottomY);

    if (topHeight <= 1 && bottomHeight <= 1) {
      return;
    }

    const matte = getStageMatteColor("--stage-matte-tint", { color: 0x102025, alpha: 0.72 });
    const sheen = getStageMatteColor("--stage-matte-sheen", { color: 0xffffff, alpha: 0.16 });
    const shade = getStageMatteColor("--stage-matte-vignette", { color: 0x000000, alpha: 0.2 });

    drawStageMatteBand(backdrop, 0, topHeight, width, matte, sheen, shade, "top");
    drawStageMatteBand(backdrop, bottomY, bottomHeight, width, matte, sheen, shade, "bottom");
  }

  function drawStageMatteBand(
    backdrop: Graphics,
    y: number,
    height: number,
    width: number,
    matte: { color: number; alpha: number },
    sheen: { color: number; alpha: number },
    shade: { color: number; alpha: number },
    edge: "top" | "bottom"
  ) {
    if (height <= 1) {
      return;
    }

    backdrop.rect(0, y, width, height).fill({ color: matte.color, alpha: matte.alpha });

    const steps = 5;
    for (let step = 0; step < steps; step += 1) {
      const bandHeight = height / steps;
      const bandY = y + step * bandHeight;
      const distanceFromScene = edge === "top" ? steps - step : step + 1;
      const alpha = (shade.alpha * distanceFromScene) / (steps * 2.8);
      backdrop.rect(0, bandY, width, bandHeight + 1).fill({ color: shade.color, alpha });
    }

    const sceneEdgeY = edge === "top" ? y + height - 1 : y;
    backdrop.rect(0, sceneEdgeY, width, 1.5).fill({ color: sheen.color, alpha: Math.min(0.34, sheen.alpha + 0.08) });
  }

  function getStageMatteColor(variableName: string, fallback: { color: number; alpha: number }) {
    const host = document.querySelector(".app-shell") ?? document.documentElement;
    const raw = getComputedStyle(host).getPropertyValue(variableName).trim();
    const match = raw.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (!match) {
      return fallback;
    }

    const r = clamp(Math.round(Number(match[1])), 0, 255);
    const g = clamp(Math.round(Number(match[2])), 0, 255);
    const b = clamp(Math.round(Number(match[3])), 0, 255);
    const alpha = match[4] === undefined ? 1 : clamp(Number(match[4]), 0, 1);
    return {
      color: (r << 16) | (g << 8) | b,
      alpha
    };
  }

  function drawGeneratedOfficeBackground(stage: Container, width: number, height: number, visible: boolean) {
    const key = "__generated_office_background";
    let background = stage.getChildByName(key) as Sprite | undefined;
    const texture = generatedTextures.officeBackground;

    if (!background) {
      background = new Sprite(Texture.EMPTY);
      background.name = key;
      background.zIndex = -1200;
      background.eventMode = "none";
      background.anchor.set(0.5);
      stage.addChild(background);
    }

    if (!texture || !visible) {
      background.visible = false;
      return;
    }

    background.texture = texture;
    background.visible = true;
    const layout = getBackgroundLayout(width, height);
    background.position.set(layout.x + layout.width / 2, layout.y + layout.height / 2);
    background.scale.set(layout.scale);
  }

  function drawGeneratedSceneProps(
    stage: Container,
    width: number,
    height: number
  ) {
    const key = "__generated_scene_props";
    let layer = stage.getChildByName(key) as Container | undefined;
    if (!layer) {
      layer = new Container();
      layer.name = key;
      layer.zIndex = -850;
      layer.sortableChildren = true;
      stage.addChild(layer);
    }

    hideSpriteChildren(layer);

    const layout = getFacilityLayouts(width, height);
    const pantryCounterFridge = layout.pantryCounterFridge;
    const pantryTableChairs = layout.pantryTableChairs;
    const restroomRoom = layout.restroom;
    const restroomPrivacy = layout.restroomPrivacy;
    const treadmill = layout.treadmill;

    const pantryCounterFridgeSprite = setSprite(
      layer,
      "pantry-counter-fridge",
      generatedTextures.pantryCounterFridge,
      true,
      pantryCounterFridge.x,
      pantryCounterFridge.y,
      pantryCounterFridge.width,
      0,
      0
    );
    if (pantryCounterFridgeSprite) {
      pantryCounterFridgeSprite.zIndex = FACILITY_SCENE_PROP_Z_INDEX.pantryCounterFridge;
    }
    const pantryTableChairsSprite = setSprite(
      layer,
      "pantry-table-chairs",
      generatedTextures.pantryTableChairsBack,
      true,
      pantryTableChairs.x,
      pantryTableChairs.y,
      pantryTableChairs.width,
      0,
      0
    );
    if (pantryTableChairsSprite) {
      pantryTableChairsSprite.zIndex = FACILITY_SCENE_PROP_Z_INDEX.pantryTableChairsBack;
    }
    const treadmillSprite = setSprite(
      layer,
      "treadmill",
      generatedTextures.treadmillHorizontalStatic,
      true,
      treadmill.x + treadmill.width * 0.5,
      treadmill.y + treadmill.height * 0.82,
      treadmill.width,
      0.5,
      0.82
    );
    if (treadmillSprite) {
      treadmillSprite.zIndex = FACILITY_SCENE_PROP_Z_INDEX.treadmillStatic;
    }
    const restroomPrivacySprite = setSprite(
      layer,
      "restroom-privacy-back",
      generatedTextures.restroomPrivacyBack,
      true,
      restroomPrivacy.x,
      restroomPrivacy.y,
      restroomPrivacy.width,
      0,
      0
    );
    if (restroomPrivacySprite) {
      restroomPrivacySprite.zIndex = FACILITY_SCENE_PROP_Z_INDEX.restroomPrivacyBack;
    }
    const restroomSprite = setSprite(
      layer,
      "restroom-room",
      generatedTextures.restroomToiletBack,
      true,
      restroomRoom.x,
      restroomRoom.y,
      restroomRoom.width,
      0,
      0
    );
    if (restroomSprite) {
      restroomSprite.zIndex = FACILITY_SCENE_PROP_Z_INDEX.restroomToiletBack;
    }
  }

  function drawGeneratedSceneForeground(stage: Container) {
    const key = "__generated_scene_foreground";
    let layer = stage.getChildByName(key) as Container | undefined;
    if (!layer) {
      layer = new Container();
      layer.name = key;
      layer.zIndex = 5000;
      layer.sortableChildren = true;
      stage.addChild(layer);
    }

    hideSpriteChildren(layer);
  }

  function drawSamplePantry(graphics: Graphics, x: number, y: number, width: number, height: number) {
    drawSoftShadow(graphics, x + width * 0.5, y + height - 6, width * 0.48, 13, 0.14);
    drawPantryRoom(graphics, x, y, width, height);
  }

  function drawSampleTreadmill(graphics: Graphics, x: number, y: number) {
    if (generatedTextures.treadmillHorizontalStatic) {
      return;
    }

    drawSoftShadow(graphics, x + 55, y + 70, 80, 18, 0.14);

    graphics
      .moveTo(x + 3, y + 39)
      .lineTo(x + 44, y + 19)
      .lineTo(x + 120, y + 38)
      .lineTo(x + 78, y + 61)
      .closePath()
      .fill(0xe7e9e6)
      .stroke({ color: 0xb6bbb7, width: 2 })
      .moveTo(x + 22, y + 41)
      .lineTo(x + 54, y + 27)
      .lineTo(x + 102, y + 39)
      .lineTo(x + 70, y + 54)
      .closePath()
      .fill(0xbfc5c2)
      .stroke({ color: 0x8d9692, width: 2 })
      .roundRect(x - 5, y + 1, 21, 55, 5)
      .fill(0xf2f2ef)
      .stroke({ color: 0xbfc3c0, width: 2 })
      .moveTo(x + 14, y + 11)
      .lineTo(x + 39, y + 1)
      .lineTo(x + 55, y + 8)
      .stroke({ color: 0xb4b9b7, width: 4, cap: "round" })
      .moveTo(x + 14, y + 29)
      .lineTo(x + 41, y + 18)
      .stroke({ color: 0xb4b9b7, width: 4, cap: "round" })
      .roundRect(x - 2, y - 11, 28, 21, 5)
      .fill(0x656e72)
      .stroke({ color: 0x394246, width: 2 })
      .rect(x + 3, y - 5, 18, 10)
      .fill(0x22292d);
  }

  function drawSampleRestroom(graphics: Graphics, x: number, y: number, width: number, height: number) {
    drawSoftShadow(graphics, x + width * 0.46, y + height - 2, width * 0.45, 15, 0.14);
    drawRestroomRoom(graphics, x, y, width, height);
  }

  function drawPantryRoom(graphics: Graphics, x: number, y: number, width: number, height: number) {
    const leftWall = Math.max(28, Math.min(38, width * 0.18));
    const wallHeight = 36;
    const floorTop = y + wallHeight;
    const floorBottom = y + height - 8;
    const right = x + width;

    graphics
      .roundRect(x + 3, y + 5, width, height, 10)
      .fill({ color: 0x314f55, alpha: 0.18 });

    graphics
      .moveTo(x + leftWall, y)
      .lineTo(right - 5, y)
      .lineTo(right - 9, floorTop)
      .lineTo(x + leftWall, floorTop)
      .closePath()
      .fill(0xe8f0cd)
      .stroke({ color: 0x6f8a76, width: 2 });

    graphics
      .moveTo(x, y + 13)
      .lineTo(x + leftWall, y)
      .lineTo(x + leftWall, floorTop)
      .lineTo(x + 8, floorBottom)
      .lineTo(x, floorBottom - 12)
      .closePath()
      .fill(0xc7dfbe)
      .stroke({ color: 0x66806e, width: 2 });

    graphics
      .moveTo(x + leftWall, floorTop)
      .lineTo(right - 9, floorTop)
      .lineTo(right - 24, floorBottom)
      .lineTo(x + 8, floorBottom)
      .closePath()
      .fill(0xe5f2c6)
      .stroke({ color: 0x789276, width: 2 });

    drawPantryFloorGrid(graphics, x + leftWall, floorTop, right - 9, right - 24, x + 8, floorBottom);

    graphics
      .moveTo(x + leftWall, floorTop)
      .lineTo(x + leftWall, y + 4)
      .stroke({ color: 0x536f67, width: 2, alpha: 0.9 })
      .moveTo(x + leftWall + 10, floorTop + 1)
      .lineTo(right - 21, floorTop + 1)
      .stroke({ color: 0xffffff, width: 1, alpha: 0.78 });

    drawPantryCounter(graphics, x + leftWall + 9, floorTop + 8, width - leftWall - 47);
    drawWaterCooler(graphics, x + 17, floorTop + 20);
    drawCoffeeMachine(graphics, x + leftWall + width * 0.25, floorTop + 26);
    drawSnackRack(graphics, right - 55, floorTop + 20);
    drawBreakTable(graphics, x + leftWall + width * 0.22, floorTop + 65);
  }

  function drawPantryFloorGrid(
    graphics: Graphics,
    backLeftX: number,
    backY: number,
    backRightX: number,
    frontRightX: number,
    frontLeftX: number,
    frontY: number
  ) {
    for (let step = 0.25; step < 1; step += 0.25) {
      const leftX = backLeftX + (frontLeftX - backLeftX) * step;
      const rightX = backRightX + (frontRightX - backRightX) * step;
      const y = backY + (frontY - backY) * step;
      graphics
        .moveTo(leftX, y)
        .lineTo(rightX, y)
        .stroke({ color: 0x96b9ac, width: 1, alpha: 0.95 });
    }

    for (let step = 0.22; step < 1; step += 0.22) {
      const topX = backLeftX + (backRightX - backLeftX) * step;
      const bottomX = frontLeftX + (frontRightX - frontLeftX) * step;
      graphics
        .moveTo(topX, backY)
        .lineTo(bottomX, frontY)
        .stroke({ color: 0xf6f8dc, width: 1, alpha: 0.82 });
    }
  }

  function drawSoftShadow(graphics: Graphics, x: number, y: number, width: number, height: number, alpha: number) {
    graphics
      .ellipse(x, y, width, height)
      .fill({ color: 0x5e6462, alpha })
      .ellipse(x - width * 0.12, y - height * 0.25, width * 0.62, height * 0.52)
      .fill({ color: 0xffffff, alpha: 0.18 });
  }

  function drawIsoBlock(
    graphics: Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
    depthX: number,
    depthY: number,
    top: number,
    front: number,
    side: number,
    stroke: number
  ) {
    graphics
      .moveTo(x, y)
      .lineTo(x + depthX, y + depthY)
      .lineTo(x + width + depthX, y + depthY)
      .lineTo(x + width, y)
      .closePath()
      .fill(top)
      .stroke({ color: stroke, width: 2 })
      .moveTo(x + width, y)
      .lineTo(x + width + depthX, y + depthY)
      .lineTo(x + width + depthX, y + depthY + height)
      .lineTo(x + width, y + height)
      .closePath()
      .fill(side)
      .stroke({ color: stroke, width: 2 })
      .moveTo(x, y)
      .lineTo(x + width, y)
      .lineTo(x + width, y + height)
      .lineTo(x, y + height)
      .closePath()
      .fill(front)
      .stroke({ color: stroke, width: 2 });
  }

  function drawIsoTopFace(
    graphics: Graphics,
    x: number,
    y: number,
    width: number,
    depthX: number,
    depthY: number,
    fill: number,
    stroke: number
  ) {
    graphics
      .moveTo(x, y)
      .lineTo(x + depthX, y + depthY)
      .lineTo(x + width + depthX, y + depthY)
      .lineTo(x + width, y)
      .closePath()
      .fill(fill)
      .stroke({ color: stroke, width: 2 });
  }

  function drawPantryCounter(graphics: Graphics, x: number, y: number, width: number) {
    const counterWidth = Math.max(56, width);

    drawIsoBlock(graphics, x - 8, y + 8, counterWidth, 23, 11, -8, 0xcbd8d1, 0x9fb2aa, 0x879c94, 0x879b91);

    graphics
      .roundRect(x + 5, y + 21, 25, 5, 2)
      .fill(0xdce7e1)
      .roundRect(x + 39, y + 21, 21, 5, 2)
      .fill(0xdce7e1)
      .roundRect(x + counterWidth - 45, y + 20, 24, 6, 3)
      .fill(0xd4b45d);
  }

  function drawWaterCooler(graphics: Graphics, x: number, y: number) {
    graphics
      .ellipse(x + 21, y + 62, 25, 7)
      .fill({ color: 0x384844, alpha: 0.18 })
      .roundRect(x + 5, y + 20, 31, 43, 5)
      .fill(0xf2f6f3)
      .stroke({ color: 0x91a79d, width: 2 })
      .moveTo(x + 36, y + 22)
      .lineTo(x + 45, y + 27)
      .lineTo(x + 45, y + 60)
      .lineTo(x + 36, y + 63)
      .closePath()
      .fill(0xcbd8d1)
      .stroke({ color: 0x9aacaa, width: 1 })
      .roundRect(x + 11, y + 28, 20, 22, 4)
      .fill(0x8dc7d9)
      .roundRect(x + 14, y + 31, 15, 7, 3)
      .fill({ color: 0xffffff, alpha: 0.35 })
      .ellipse(x + 20, y + 13, 17, 6)
      .fill(0x91d1e2)
      .stroke({ color: 0x6eaaba, width: 1 })
      .roundRect(x + 8, y + 4, 25, 17, 7)
      .fill(0xb9e1eb)
      .stroke({ color: 0x7eb7c5, width: 1 })
      .ellipse(x + 20, y + 4, 12, 4)
      .fill(0xe5f7fb)
      .circle(x + 19, y + 57, 5)
      .fill(0x70aab8);
  }

  function drawCoffeeMachine(graphics: Graphics, x: number, y: number) {
    graphics
      .ellipse(x + 26, y + 36, 30, 7)
      .fill({ color: 0x243034, alpha: 0.18 });

    drawIsoBlock(graphics, x + 4, y + 12, 47, 31, 10, -8, 0x747f82, 0x4e5f61, 0x3b494c, 0x2b3638);

    graphics
      .moveTo(x + 11, y - 2)
      .lineTo(x + 32, y - 5)
      .lineTo(x + 39, y + 2)
      .lineTo(x + 18, y + 6)
      .closePath()
      .fill({ color: 0xdfe8ea, alpha: 0.92 })
      .stroke({ color: 0x8b9ca2, width: 1 })
      .moveTo(x + 18, y + 6)
      .lineTo(x + 39, y + 2)
      .lineTo(x + 39, y + 12)
      .lineTo(x + 18, y + 16)
      .closePath()
      .fill({ color: 0xaebdc2, alpha: 0.86 })
      .stroke({ color: 0x8b9ca2, width: 1 })
      .roundRect(x + 12, y + 18, 27, 10, 3)
      .fill(0x122025)
      .stroke({ color: 0x6c7c7e, width: 1 })
      .rect(x + 16, y + 21, 18, 2)
      .fill(0x75d5bf)
      .rect(x + 39, y + 18, 4, 4)
      .fill(0xf4c95d)
      .circle(x + 46, y + 21, 2)
      .fill(0xff7f64)
      .rect(x + 20, y + 29, 16, 4)
      .fill(0x141b1e)
      .rect(x + 25, y + 32, 6, 8)
      .fill(0x10181b)
      .moveTo(x + 18, y + 40)
      .lineTo(x + 37, y + 39)
      .lineTo(x + 41, y + 43)
      .lineTo(x + 22, y + 45)
      .closePath()
      .fill(0x263238)
      .stroke({ color: 0x11191c, width: 1 })
      .roundRect(x + 21, y + 35, 18, 9, 4)
      .fill(0xf6f5ef)
      .stroke({ color: 0x8b9693, width: 1 })
      .rect(x + 25, y + 34, 9, 2)
      .fill(0xd6d3c9)
      .moveTo(x + 43, y + 31)
      .bezierCurveTo(x + 53, y + 30, x + 53, y + 42, x + 42, y + 41)
      .stroke({ color: 0xf6f5ef, width: 3, cap: "round" });
  }

  function drawSnackRack(graphics: Graphics, x: number, y: number) {
    graphics
      .ellipse(x + 23, y + 61, 27, 8)
      .fill({ color: 0x2d3a36, alpha: 0.15 });

    drawIsoBlock(graphics, x + 4, y + 12, 36, 51, 9, -7, 0xc2b58a, 0xa9b4ac, 0x899991, 0x829089);

    for (let shelf = 0; shelf < 3; shelf += 1) {
      const shelfY = y + 18 + shelf * 14;
      graphics
        .roundRect(x + 10, shelfY, 24, 6, 3)
        .fill(shelf === 0 ? 0xf1c75f : shelf === 1 ? 0x72b48f : 0xd97965)
        .rect(x + 10, shelfY + 7, 26, 1)
        .fill({ color: 0x465650, alpha: 0.28 });
    }
  }

  function drawBreakTable(graphics: Graphics, x: number, y: number) {
    graphics
      .ellipse(x + 2, y + 20, 34, 9)
      .fill({ color: 0x273732, alpha: 0.16 })
      .ellipse(x, y, 29, 12)
      .fill(0xc9b783)
      .stroke({ color: 0x998867, width: 1 })
      .ellipse(x - 3, y - 2, 20, 6)
      .fill({ color: 0xf2e7bd, alpha: 0.45 })
      .rect(x - 4, y + 6, 8, 18)
      .fill(0x807462)
      .ellipse(x, y + 24, 18, 5)
      .fill(0x766d63);
  }

  function drawRestroomRoom(graphics: Graphics, x: number, y: number, width: number, height: number) {
    const sideWall = Math.max(26, Math.min(36, width * 0.17));
    const wallHeight = 36;
    const floorTop = y + wallHeight;
    const floorBottom = y + height - 8;
    const right = x + width;

    graphics
      .roundRect(x + 3, y + 5, width, height, 10)
      .fill({ color: 0x314f62, alpha: 0.18 });

    graphics
      .moveTo(x + 6, y)
      .lineTo(right - sideWall, y)
      .lineTo(right - sideWall - 8, floorTop)
      .lineTo(x + 10, floorTop)
      .closePath()
      .fill(0xdce9f2)
      .stroke({ color: 0x607f92, width: 2 });

    graphics
      .moveTo(right - sideWall, y)
      .lineTo(right, y + 12)
      .lineTo(right, floorBottom - 12)
      .lineTo(right - 17, floorBottom)
      .lineTo(right - sideWall - 8, floorTop)
      .closePath()
      .fill(0xc3d8e6)
      .stroke({ color: 0x5b7889, width: 2 });

    graphics
      .moveTo(x + 10, floorTop)
      .lineTo(right - sideWall - 8, floorTop)
      .lineTo(right - 17, floorBottom)
      .lineTo(x + 24, floorBottom)
      .closePath()
      .fill(0xe8f1f5)
      .stroke({ color: 0x6f8999, width: 2 });

    drawPantryFloorGrid(graphics, x + 10, floorTop, right - sideWall - 8, right - 17, x + 24, floorBottom);

    graphics
      .moveTo(right - sideWall - 8, floorTop)
      .lineTo(right - sideWall, y + 5)
      .stroke({ color: 0x506b7a, width: 2, alpha: 0.9 })
      .moveTo(x + 22, floorTop + 1)
      .lineTo(right - sideWall - 21, floorTop + 1)
      .stroke({ color: 0xffffff, width: 1, alpha: 0.78 });

    drawRestroomVanity(graphics, x + 20, floorTop + 12);
    drawRestroomStall(graphics, x + width * 0.42, floorTop + 17, width * 0.42);
    drawWallToilet(graphics, x + width * 0.61, floorTop + 57);
    drawHandDryer(graphics, right - sideWall + 2, floorTop + 25);
  }

  function drawRestroomVanity(graphics: Graphics, x: number, y: number) {
    graphics
      .ellipse(x + 28, y + 32, 31, 7)
      .fill({ color: 0x2d3a3e, alpha: 0.14 });

    drawIsoTopFace(graphics, x + 4, y - 6, 42, 7, -5, 0xa9c0c8, 0x7f99a2);
    graphics
      .moveTo(x + 10, y - 4)
      .lineTo(x + 39, y - 8)
      .lineTo(x + 43, y + 5)
      .lineTo(x + 14, y + 9)
      .closePath()
      .fill(0xd9edf1)
      .stroke({ color: 0x8eadb6, width: 1 });

    drawIsoBlock(graphics, x + 5, y + 9, 45, 27, 9, -7, 0xf2f6f5, 0xc7d6d9, 0xaebfc4, 0x9fb2b7);

    graphics
      .ellipse(x + 28, y + 16, 14, 5)
      .fill(0xcfe2e3)
      .stroke({ color: 0x9ab0b5, width: 1 })
      .rect(x + 28, y + 8, 4, 8)
      .fill(0x738990)
      .roundRect(x + 24, y + 6, 12, 4, 2)
      .fill(0x849ba3);
  }

  function drawRestroomStall(graphics: Graphics, x: number, y: number, width: number) {
    const stallWidth = Math.max(72, width);

    graphics
      .ellipse(x + stallWidth * 0.5, y + 71, stallWidth * 0.54, 9)
      .fill({ color: 0x26383d, alpha: 0.13 });

    drawIsoTopFace(graphics, x + 7, y + 14, stallWidth * 0.84, 10, -7, 0x9eb1b8, 0x6f838a);

    graphics
      .roundRect(x + 7, y + 16, stallWidth * 0.45, 55, 4)
      .fill(0x8298a1)
      .stroke({ color: 0x5e737a, width: 2 })
      .roundRect(x + stallWidth * 0.48, y + 12, stallWidth * 0.43, 58, 4)
      .fill(0x8fa3aa)
      .stroke({ color: 0x62777f, width: 2 })
      .moveTo(x + stallWidth * 0.48, y + 12)
      .lineTo(x + stallWidth * 0.48 + 10, y + 5)
      .lineTo(x + stallWidth * 0.91 + 10, y + 5)
      .lineTo(x + stallWidth * 0.91, y + 12)
      .closePath()
      .fill(0xa6b9bf)
      .stroke({ color: 0x637981, width: 1 })
      .moveTo(x + stallWidth * 0.91, y + 12)
      .lineTo(x + stallWidth * 0.91 + 10, y + 5)
      .lineTo(x + stallWidth * 0.91 + 10, y + 63)
      .lineTo(x + stallWidth * 0.91, y + 70)
      .closePath()
      .fill(0x718891)
      .stroke({ color: 0x5d737b, width: 1 })
      .circle(x + stallWidth * 0.79, y + 43, 3)
      .fill(0xf1f6f6)
      .circle(x + stallWidth * 0.33, y + 44, 3)
      .fill(0xf1f6f6)
      .rect(x + stallWidth * 0.47, y + 17, 2, 52)
      .fill(0x5e747c);
  }

  function drawWallToilet(graphics: Graphics, x: number, y: number) {
    graphics
      .ellipse(x + 4, y + 29, 35, 9)
      .fill({ color: 0x223238, alpha: 0.15 });

    drawIsoBlock(graphics, x - 20, y - 34, 42, 25, 8, -6, 0xffffff, 0xe5e8e5, 0xd0d5d3, 0xaeb7b6);

    graphics
      .roundRect(x - 14, y - 29, 30, 5, 2)
      .fill(0xf8faf7)
      .rect(x + 12, y - 31, 5, 3)
      .fill(0xa8b5b7)
      .moveTo(x - 24, y - 7)
      .lineTo(x + 18, y - 13)
      .lineTo(x + 35, y + 0)
      .lineTo(x - 3, y + 10)
      .closePath()
      .fill(0xffffff)
      .stroke({ color: 0xaeb8b9, width: 2 })
      .moveTo(x - 4, y + 10)
      .lineTo(x + 35, y)
      .lineTo(x + 27, y + 16)
      .lineTo(x - 8, y + 26)
      .closePath()
      .fill(0xdfe7e8)
      .stroke({ color: 0xa6b3b5, width: 2 })
      .ellipse(x + 3, y + 3, 28, 13)
      .fill(0xf9fbf8)
      .stroke({ color: 0xa7b4b6, width: 2 })
      .ellipse(x + 4, y + 3, 16, 7)
      .fill(0xc9e2e8)
      .stroke({ color: 0x9bb6bf, width: 1 })
      .rect(x - 10, y + 15, 24, 22)
      .fill(0xe2e8e7)
      .stroke({ color: 0xb3bebf, width: 1 })
      .roundRect(x - 19, y + 32, 39, 8, 4)
      .fill(0xc1cdcf)
      .stroke({ color: 0xa7b2b4, width: 1 });
  }

  function drawHandDryer(graphics: Graphics, x: number, y: number) {
    graphics
      .roundRect(x + 2, y - 2, 26, 24, 6)
      .fill(0xf0f4f4)
      .stroke({ color: 0x9aacb2, width: 1 })
      .ellipse(x + 15, y + 3, 10, 3)
      .fill(0xd3e1e3)
      .rect(x + 9, y + 19, 11, 16)
      .fill(0xcbd9dc)
      .roundRect(x + 7, y + 34, 15, 5, 3)
      .fill(0xa9bcc2);
  }

  function drawRoomShell(
    graphics: Graphics,
    x: number,
    y: number,
    width: number,
    height: number,
    fill: number,
    stroke: number
  ) {
    graphics
      .roundRect(x, y, width, height, 10)
      .fill(fill)
      .stroke({ color: stroke, width: 2 })
      .rect(x + 6, y + 6, width - 12, 28)
      .fill({ color: 0xffffff, alpha: 0.26 })
      .rect(x + 8, y + height - 26, width - 16, 1)
      .fill({ color: 0x6d7d7a, alpha: 0.2 });
  }

  function drawStation(
    station: StationDisplay,
    agent: AgentActivity,
    time: number,
    selected: boolean,
    viewScale: number,
    agentAtStation: boolean,
    awayScreenSession: AwayScreenSession | undefined,
    idleDeskActivity: IdleDeskActivity | undefined
  ) {
    const {
      stationSprites,
      flatWorkstationMesh,
      baseGraphics,
      monitorGraphics,
      screenMask,
      awayScreenMesh,
      screenText,
      foregroundGraphics,
      nameText,
      statusText
    } = station;
    const phase = time / 420;
    const typing = agent.status === "working" ? Math.sin(phase * 3) * 5 : 0;
    const offlineAlpha = agent.status === "offline" ? 0.48 : 1;

    baseGraphics.clear();
    monitorGraphics.clear();
    screenMask.clear();
    foregroundGraphics.clear();
    hideSpriteChildren(stationSprites);
    flatWorkstationMesh.visible = false;
    awayScreenMesh.visible = false;
    station.stationContainer.alpha = offlineAlpha;
    station.stationContainer.scale.set(viewScale * (selected ? 1.04 : 1));

    const flatWorkstation = getFlatWorkstationSpec(agent.status, agentAtStation);
    const useFlatStation = Boolean(flatWorkstation?.texture);
    const generatedWorkstationReady = Boolean(generatedTextures.agentWorkstation);
    const useGeneratedStation = Boolean(generatedTextures.officeDesk);
    const drawStaticDesk = !agentAtStation || !generatedWorkstationReady;

    if (useFlatStation || useGeneratedStation) {
      drawGeneratedWorkspaceBase(baseGraphics, selected);
    } else {
      drawWorkspaceBase(baseGraphics, selected);
    }
    if (flatWorkstation?.texture) {
      const deskX = FLAT_WORKSTATION_LOCAL_X;
      const deskY = FLAT_WORKSTATION_LOCAL_Y;
      const deskWidth = FLAT_WORKSTATION_LOCAL_WIDTH;
      drawFlatSheetMesh(
        flatWorkstationMesh,
        flatWorkstation.texture,
        flatWorkstation.spec,
        time,
        deskX,
        deskY,
        deskWidth
      );
      const screenQuad = mapFlatFrameSourceQuad(
        insetScreenSourceQuad(FLAT_WORKSTATION_SCREEN_SOURCE, 2),
        deskX,
        deskY,
        deskWidth,
        flatWorkstation.spec
      );
      drawWorkstationScreenContent(
        monitorGraphics,
        awayScreenMesh,
        agent,
        time,
        screenQuad,
        agentAtStation,
        awayScreenSession,
        idleDeskActivity
      );
      drawScreenMask(screenMask, screenQuad);
    } else if (useGeneratedStation && drawStaticDesk) {
      const deskX = 0;
      const deskY = 64;
      const deskWidth = 210;
      setSprite(stationSprites, "office-desk", generatedTextures.officeDesk, true, deskX, deskY, deskWidth, 0.5, 0.78);
      const screenQuad = mapSpriteSourceQuad(
        generatedTextures.officeDesk,
        OFFICE_DESK_SCREEN_SOURCE,
        deskX,
        deskY,
        deskWidth,
        0.5,
        0.78
      );
      drawWorkstationScreenContent(
        monitorGraphics,
        awayScreenMesh,
        agent,
        time,
        screenQuad,
        agentAtStation,
        awayScreenSession,
        idleDeskActivity
      );
      drawScreenMask(screenMask, screenQuad);
    } else if (!useFlatStation && !useGeneratedStation) {
      drawDeskBase(baseGraphics);
      drawMonitor(monitorGraphics, agent.status);
      if (agent.status === "idle") {
        drawLeisureScreen(monitorGraphics, time);
      }
    }
    if (!useFlatStation && !useGeneratedStation) {
      screenMask.roundRect(-49, -83, 98, 43, 4).fill(0xffffff);
      drawDeskForeground(foregroundGraphics, typing);
    }

    const usesImageStation = useFlatStation || useGeneratedStation;
    screenText.text = agent.status === "idle"
      ? formatLeisureScreenLines(time, agent.id, usesImageStation ? 13 : 17, usesImageStation ? 3 : 4)
      : formatScreenLines(agent.screenLines ?? [], usesImageStation ? 3 : 4, usesImageStation ? 13 : 17);
    screenText.style.fontSize = usesImageStation ? 6 : 8;
    screenText.style.lineHeight = usesImageStation ? 7 : 10;
    if (!usesImageStation) {
      screenText.position.set(-45, -80);
      screenText.rotation = -0.02;
    }
    screenText.alpha = usesImageStation ? 0 : agent.status === "offline" ? 0.45 : 1;
    screenText.visible = !usesImageStation;

    nameText.text = agent.name;
    nameText.anchor.set(0.5, 0);
    nameText.position.set(0, 70);

    statusText.text = agent.status.toUpperCase();
    statusText.anchor.set(0.5, 0.5);
    statusText.position.set(0, 97);
  }

  function drawWorkstationScreenContent(
    graphics: Graphics,
    mesh: MeshSimple,
    agent: AgentActivity,
    time: number,
    screenQuad: ScreenQuad,
    agentAtStation: boolean,
    awayScreenSession: AwayScreenSession | undefined,
    idleDeskActivity: IdleDeskActivity | undefined
  ) {
    if (!agentAtStation && awayScreenSession) {
      drawAwayScreenPanel(
        graphics,
        mesh,
        generatedTextures.idleScreensaverSheet,
        time,
        screenQuad,
        awayScreenSession
      );
      return;
    }

    if (agentAtStation && agent.status === "idle" && idleDeskActivity) {
      const idleSession = screenSessions.getIdleBehaviorSession(agent);
      drawIdleDeskScreenPanel(graphics, idleDeskActivity, time, screenQuad, idleSession.seed);
      return;
    }

    if (agentAtStation && isActiveScreenStatus(agent.status)) {
      const session = screenSessions.getWorkScreenSession(agent.id, agent.status);
      const texture = generatedTextures[session.textureKey];
      if (texture) {
        drawSpriteSheetScreenPanel(graphics, mesh, texture, time, screenQuad, {
          columns: 5,
          rows: 3,
          fps: 5,
          seed: session.seed
        });
      } else {
        drawGeneratedScreenPanel(graphics, agent.status, time, screenQuad);
      }
      return;
    }

    drawGeneratedScreenPanel(graphics, agent.status, time, screenQuad);
  }

  function drawAgent(
    station: StationDisplay,
    agent: AgentActivity,
    time: number,
    selected: boolean,
    viewScale: number,
    idleAssignment: IdleAssignment | undefined,
    idleDeskActivity: IdleDeskActivity | undefined,
    facilityAction: FacilityActionSelection | undefined,
    facilityActionKey: FlatAssetKey | undefined,
    facilitySeatAssignment: FacilitySeatAssignment | undefined,
    actorPoint: ScenePoint,
    visualSession: AgentVisualSession,
    rendererWidth: number,
    rendererHeight: number
  ): FacilityAgentDrawMetrics | undefined {
    const {
      actorBaseGraphics,
      actorSprites,
      facilityBeltSprite,
      flatAgentMesh,
      facilityOcclusionSprite,
      facilityOcclusionMask,
      flatDeskForegroundMesh,
      flatDeskForegroundMask,
      actorScreenMesh,
      actorScreenMask,
      actorScreenText,
      personGraphics,
      actorForegroundGraphics,
      actorNameText,
      actorStatusText
    } = station;
    const phase = time / 420;
    const bob = Math.sin(phase) * 2;
    const typing = agent.status === "working" ? Math.sin(phase * 3) * 5 : 0;
    const thinking = agent.status === "thinking" ? Math.sin(phase * 1.4) * 3 : 0;
    const idleLean = agent.status === "idle" ? Math.sin(phase * 0.8) * 4 : 0;
    const offlineAlpha = agent.status === "offline" ? 0.48 : 1;
    const statusColor = STATUS_PIXI_COLORS[agent.status];

    actorBaseGraphics.clear();
    actorScreenMask.clear();
    flatDeskForegroundMask.clear();
    personGraphics.clear();
    actorForegroundGraphics.clear();
    hideSpriteChildren(actorSprites);
    flatAgentMesh.visible = false;
    facilityOcclusionSprite.visible = false;
    facilityBeltSprite.visible = false;
    facilityOcclusionMask.clear();
    flatDeskForegroundMesh.visible = false;
    actorScreenMesh.visible = false;
    actorScreenText.visible = false;
    station.actorContainer.alpha = offlineAlpha;
    station.actorContainer.scale.set(viewScale * (selected ? 1.04 : 1));

    if (visualSession.visualPhase === "walkingToFacility" || visualSession.visualPhase === "walkingToStation") {
      const walkingMetrics = drawWalkingAgentScene(
        flatAgentMesh,
        personGraphics,
        actorForegroundGraphics,
        agent,
        statusColor,
        visualSession
      );
      actorNameText.text = agent.name;
      actorNameText.anchor.set(0.5, 0);
      actorNameText.position.set(0, 68);
      actorStatusText.text = visualSession.visualPhase === "walkingToStation"
        ? "RETURNING"
        : idleAssignment?.destination === "pantry"
          ? "BREAK ROOM"
          : idleAssignment?.destination === "restroom"
            ? "RESTROOM"
            : idleAssignment?.destination === "treadmill"
              ? "TREADMILL"
              : "WALKING";
      actorStatusText.anchor.set(0.5, 0.5);
      actorStatusText.position.set(0, 94);
      return walkingMetrics;
    }

    if (idleAssignment) {
      const facilityDrawMetrics = drawFacilityAgentScene(
        flatAgentMesh,
        personGraphics,
        actorForegroundGraphics,
        agent,
        statusColor,
        idleAssignment,
        facilityAction,
        facilityActionKey,
        facilitySeatAssignment,
        actorPoint,
        station.actorContainer.scale.x,
        rendererWidth,
        rendererHeight,
        facilityBeltSprite,
        facilityOcclusionSprite,
        facilityOcclusionMask
      );
      actorNameText.text = agent.name;
      actorNameText.anchor.set(0.5, 0);
      actorNameText.position.set(0, 68);
      actorStatusText.text = idleAssignment.destination === "pantry"
        ? "BREAK ROOM"
        : idleAssignment.destination === "restroom"
          ? "RESTROOM"
          : "TREADMILL";
      actorStatusText.anchor.set(0.5, 0.5);
      actorStatusText.position.set(0, 94);
      return facilityDrawMetrics;
    }

    const flatAgentSpec = getFlatAgentBodySpec(agent.status);
    const flatAgentTexture = flatAgentSpec ? flatTextures[flatAgentSpec.key] : undefined;
    if (flatAgentSpec && flatAgentTexture) {
      const anchorDebug = drawFlatAgentBody(
        flatAgentMesh,
        flatAgentTexture,
        flatAgentSpec.key,
        flatAgentSpec.spec,
        agent.id,
        time
      );
      drawFlatDeskForeground(
        flatDeskForegroundMesh,
        flatDeskForegroundMask,
        flatTextures.flatOfficeDeskLayer,
        FLAT_ASSET_MANIFEST.flatOfficeDeskLayer,
        FLAT_WORKSTATION_LOCAL_WIDTH
      );
      if (anchorDebug && isFlatAnchorDebugEnabled()) {
        drawFlatAnchorDebug(actorForegroundGraphics, anchorDebug);
      }
    } else if (generatedTextures.agentWorkstation) {
      const workstationX = idleLean * 0.08;
      const workstationY = 64 + bob * 0.18;
      const workstationWidth = 214;
      setSprite(
        actorSprites,
        "agent-workstation",
        generatedTextures.agentWorkstation,
        true,
        workstationX,
        workstationY,
        workstationWidth,
        0.5,
        0.78
      );
      const screenQuad = mapSpriteSourceQuad(
        generatedTextures.agentWorkstation,
        AGENT_WORKSTATION_SCREEN_SOURCE,
        workstationX,
        workstationY,
        workstationWidth,
        0.5,
        0.78
      );
      if (agent.status === "idle" && idleDeskActivity) {
        const idleSession = screenSessions.getIdleBehaviorSession(agent);
        drawIdleDeskScreenPanel(actorForegroundGraphics, idleDeskActivity, time, screenQuad, idleSession.seed);
      } else if (isActiveScreenStatus(agent.status)) {
        const session = screenSessions.getWorkScreenSession(agent.id, agent.status);
        const texture = generatedTextures[session.textureKey];
        if (texture) {
          drawSpriteSheetScreenPanel(actorForegroundGraphics, actorScreenMesh, texture, time, screenQuad, {
            columns: 5,
            rows: 3,
            fps: 5,
            seed: session.seed
          });
        } else {
          drawGeneratedScreenPanel(actorForegroundGraphics, agent.status, time, screenQuad);
        }
      } else {
        drawGeneratedScreenPanel(actorForegroundGraphics, agent.status, time, screenQuad);
      }
      drawScreenMask(actorScreenMask, screenQuad);
      actorScreenText.text = agent.status === "idle"
        ? formatLeisureScreenLines(time, agent.id, 12, 3)
        : formatScreenLines(agent.screenLines ?? [], 3, 12);
      actorScreenText.alpha = 0;
      actorScreenText.visible = false;
    } else {
      drawPerson(personGraphics, agent.status, bob, typing, thinking, idleLean, statusColor);
      drawDeskForeground(actorForegroundGraphics, typing);
    }
    drawStatusBadge(actorForegroundGraphics, agent.status, statusColor);
    actorNameText.text = "";
    actorStatusText.text = "";
    return undefined;
  }

  function drawWalkingAgentScene(
    flatAgentMesh: Sprite,
    fallbackGraphics: Graphics,
    foregroundGraphics: Graphics,
    agent: AgentActivity,
    statusColor: number,
    visualSession: AgentVisualSession
  ): FacilityAgentDrawMetrics {
    const actionKey = getWalkActionKey(visualSession.action);
    if (actionKey) {
      const spec = FLAT_ASSET_MANIFEST[actionKey];
      const texture = flatTextures[actionKey];
      const registrationAnchors = spec.registration?.contactAnchors;
      const frame = visualSession.frameIndex % (spec.columns * spec.rows);
      const registrationAnchor = registrationAnchors?.[frame] ?? registrationAnchors?.[0];
      if (spec.status === "ready" && spec.registration && texture && registrationAnchor) {
        const agentScale = FLAT_AGENT_VISIBLE_WIDTH_TARGET / spec.registration.visibleWidth;
        const localBbox = drawRegisteredFlatSheetSprite(flatAgentMesh, texture, spec, frame, 0, 0, registrationAnchor, agentScale);
        const agentAnchorLocal = {
          x: localBbox.minX + registrationAnchor.x * agentScale,
          y: localBbox.minY + registrationAnchor.y * agentScale
        };
        drawStatusBadge(foregroundGraphics, agent.status, statusColor);
        return {
          currentFrame: frame,
          localBbox,
          agentAnchorLocal,
          anchorKind: "footContact",
          fallback: false
        };
      }
    }

    const bob = Math.sin((visualSession.frameIndex / 16) * Math.PI * 2) * 2;
    drawPerson(fallbackGraphics, agent.status, bob, 0, 0, 0, statusColor);
    drawStatusBadge(foregroundGraphics, agent.status, statusColor);
    return {
      currentFrame: visualSession.frameIndex,
      fallback: true
    };
  }

  function drawFacilityAgentScene(
    flatAgentMesh: Sprite,
    fallbackGraphics: Graphics,
    foregroundGraphics: Graphics,
    agent: AgentActivity,
    statusColor: number,
    idleAssignment: IdleAssignment,
    facilityAction: FacilityActionSelection | undefined,
    facilityActionKey: FlatAssetKey | undefined,
    facilitySeatAssignment: FacilitySeatAssignment | undefined,
    actorPoint: ScenePoint,
    actorScale: number,
    rendererWidth: number,
    rendererHeight: number,
    facilityBeltSprite: Sprite,
    facilityOcclusionSprite: Sprite,
    facilityOcclusionMask: Graphics
  ): FacilityAgentDrawMetrics {
    let occlusionBbox: { x: number; y: number; width: number; height: number } | undefined;
    if (facilitySeatAssignment) {
      facilityBeltSprite.visible = false;
      occlusionBbox = drawFacilityOcclusionLayer(
        facilityOcclusionSprite,
        facilityOcclusionMask,
        facilitySeatAssignment,
        actorPoint,
        actorScale,
        rendererWidth,
        rendererHeight
      );
    }

    if (facilityAction && facilityActionKey) {
      const spec = FLAT_ASSET_MANIFEST[facilityActionKey];
      const texture = flatTextures[facilityActionKey];
      if (spec.status === "ready" && spec.registration && texture) {
        const frame = getFlatFrameIndex(facilityAction.segmentElapsedMs, spec);
        const anchorKind = facilitySeatAssignment?.destination === "treadmill"
          ? "footContact"
          : spec.registration.anchorKind ?? "hip";
        const registrationAnchors = anchorKind === "footContact"
          ? spec.registration.contactAnchors
          : spec.registration.hipAnchors;
        const registrationAnchor = registrationAnchors?.[frame] ?? registrationAnchors?.[0];
        if (registrationAnchor) {
          const agentScale = FLAT_AGENT_VISIBLE_WIDTH_TARGET / spec.registration.visibleWidth;
          const localBbox = drawRegisteredFlatSheetSprite(flatAgentMesh, texture, spec, frame, 0, 0, registrationAnchor, agentScale);
          const agentAnchorLocal = {
            x: localBbox.minX + registrationAnchor.x * agentScale,
            y: localBbox.minY + registrationAnchor.y * agentScale
          };
          drawStatusBadge(foregroundGraphics, agent.status, statusColor);
          return {
            currentFrame: frame,
            localBbox,
            agentHipLocal: anchorKind === "hip" ? agentAnchorLocal : undefined,
            agentAnchorLocal,
            anchorKind,
            occlusionBbox,
            fallback: false
          };
        }
      }
    }

    const bob = Math.sin((facilityAction?.segmentElapsedMs ?? 0) / 420) * 1.5;
    drawPerson(fallbackGraphics, agent.status, bob, 0, 0, 0, statusColor);
    drawStatusBadge(foregroundGraphics, agent.status, statusColor);
    return {
      currentFrame: 0,
      occlusionBbox,
      fallback: true
    };
  }

  function drawFacilityOcclusionLayer(
    sprite: Sprite,
    mask: Graphics,
    seatAssignment: FacilitySeatAssignment,
    actorPoint: ScenePoint,
    actorScale: number,
    rendererWidth: number,
    rendererHeight: number
  ) {
    const textureKey: GeneratedAssetKey = seatAssignment.destination === "pantry"
      ? "pantryTableChairsFront"
      : seatAssignment.destination === "restroom"
        ? "restroomToiletFront"
        : "treadmillHorizontalStatic";
    const texture = generatedTextures[textureKey];
    if (!texture || actorScale === 0) {
      sprite.visible = false;
      mask.clear();
      return undefined;
    }

    const layerLayout = seatAssignment.destination === "pantry"
      ? getFacilityLayouts(rendererWidth, rendererHeight).pantryTableChairs
      : seatAssignment.destination === "restroom"
        ? getFacilityLayouts(rendererWidth, rendererHeight).restroom
        : getFacilityLayouts(rendererWidth, rendererHeight).treadmill;
    const localX = (layerLayout.x - actorPoint.x) / actorScale;
    const localY = (layerLayout.y - actorPoint.y) / actorScale;
    const localWidth = layerLayout.width / actorScale;
    const localScale = localWidth / texture.width;
    const occlusionBbox = mapSourceRectToScreen(
      seatAssignment.seat.frontOcclusionRect,
      rendererWidth,
      rendererHeight
    );
    const localMask = {
      x: (occlusionBbox.x - actorPoint.x) / actorScale,
      y: (occlusionBbox.y - actorPoint.y) / actorScale,
      width: occlusionBbox.width / actorScale,
      height: occlusionBbox.height / actorScale
    };

    sprite.texture = texture;
    sprite.visible = true;
    sprite.anchor.set(0, 0);
    sprite.position.set(localX, localY);
    sprite.scale.set(localScale);
    mask
      .clear()
      .rect(localMask.x, localMask.y, localMask.width, localMask.height)
      .fill(0xffffff);
    return occlusionBbox;
  }

  function getFlatAgentBodySpec(status: AgentStatus): { key: FlatAssetKey; spec: FlatSpriteSpec } | undefined {
    const key = getFlatAgentBodyKey(status);
    const spec = FLAT_ASSET_MANIFEST[key];
    return spec.status === "ready" ? { key, spec } : undefined;
  }

  function getFlatAgentBodyKey(status: AgentStatus): FlatAssetKey {
    return status === "working"
      ? "flatAgentTypingBodySheet"
      : status === "thinking"
        ? "flatAgentThinkingBodySheet"
        : "flatAgentIdleDeskBodySheet";
  }

  function getFlatWorkstationSpec(
    status: AgentStatus,
    agentAtStation: boolean
  ): { key: FlatAssetKey; spec: FlatSpriteSpec; texture: Texture | undefined } | undefined {
    const key: FlatAssetKey = "flatOfficeDeskLayer";
    const spec = FLAT_ASSET_MANIFEST[key];
    if (spec.status !== "ready") {
      return undefined;
    }
    if (agentAtStation && !flatTextures[getFlatAgentBodyKey(status)]) {
      return undefined;
    }

    return {
      key,
      spec,
      texture: flatTextures[key]
    };
  }

  function drawFlatAgentBody(
    mesh: Sprite,
    texture: Texture,
    key: FlatAssetKey,
    spec: FlatSpriteSpec,
    agentId: string,
    time: number
  ) {
    if (!spec.registration) {
      drawFlatSheetSprite(
        mesh,
        texture,
        spec,
        time,
        FLAT_WORKSTATION_LOCAL_X,
        FLAT_WORKSTATION_LOCAL_Y,
        FLAT_AGENT_VISIBLE_WIDTH_TARGET
      );
      return;
    }

    const frame = getFlatBodyFrame(agentId, key, spec, time);
    const hipAnchor = spec.registration.hipAnchors?.[frame] ?? spec.registration.hipAnchors?.[0];
    if (!hipAnchor) {
      drawFlatSheetSprite(
        mesh,
        texture,
        spec,
        time,
        FLAT_WORKSTATION_LOCAL_X,
        FLAT_WORKSTATION_LOCAL_Y,
        FLAT_AGENT_VISIBLE_WIDTH_TARGET
      );
      return undefined;
    }
    const agentScale = FLAT_AGENT_VISIBLE_WIDTH_TARGET / spec.registration.visibleWidth;
    const target = mapFlatSourcePoint(
      FLAT_CHAIR_CUSHION_SOURCE,
      FLAT_WORKSTATION_LOCAL_X,
      FLAT_WORKSTATION_LOCAL_Y,
      FLAT_WORKSTATION_LOCAL_WIDTH,
      FLAT_ASSET_MANIFEST.flatOfficeDeskLayer
    );
    const origin = drawRegisteredFlatSheetSprite(mesh, texture, spec, frame, target.x, target.y, hipAnchor, agentScale);
    const supportLineStart = mapFlatSourcePoint(
      { x: 70, y: FLAT_CHAIR_SUPPORT_LINE_SOURCE_Y },
      FLAT_WORKSTATION_LOCAL_X,
      FLAT_WORKSTATION_LOCAL_Y,
      FLAT_WORKSTATION_LOCAL_WIDTH,
      FLAT_ASSET_MANIFEST.flatOfficeDeskLayer
    );
    const supportLineEnd = mapFlatSourcePoint(
      { x: 315, y: FLAT_CHAIR_SUPPORT_LINE_SOURCE_Y },
      FLAT_WORKSTATION_LOCAL_X,
      FLAT_WORKSTATION_LOCAL_Y,
      FLAT_WORKSTATION_LOCAL_WIDTH,
      FLAT_ASSET_MANIFEST.flatOfficeDeskLayer
    );
    return {
      cushion: target,
      hip: {
        x: origin.minX + hipAnchor.x * agentScale,
        y: origin.minY + hipAnchor.y * agentScale
      },
      supportLineStart,
      supportLineEnd
    };
  }

  function drawFlatAnchorDebug(
    graphics: Graphics,
    debug: {
      cushion: { x: number; y: number };
      hip: { x: number; y: number };
      supportLineStart: { x: number; y: number };
      supportLineEnd: { x: number; y: number };
    }
  ) {
    graphics
      .moveTo(debug.supportLineStart.x, debug.supportLineStart.y)
      .lineTo(debug.supportLineEnd.x, debug.supportLineEnd.y)
      .stroke({ color: 0xe5484d, width: 1.5, alpha: 0.9 });
    drawDebugCross(graphics, debug.cushion.x, debug.cushion.y, 0x2fb344, 7);
    drawDebugCross(graphics, debug.hip.x, debug.hip.y, 0x00c7f2, 5);
  }

  function drawDebugCross(graphics: Graphics, x: number, y: number, color: number, radius: number) {
    graphics
      .moveTo(x - radius, y)
      .lineTo(x + radius, y)
      .moveTo(x, y - radius)
      .lineTo(x, y + radius)
      .stroke({ color, width: 1.5, alpha: 0.95 })
      .circle(x, y, 1.8)
      .fill(color);
  }

  function isFlatAnchorDebugEnabled() {
    return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debugFlatAnchors") === "1";
  }

  function isLayoutDebugEnabled() {
    return typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debugLayoutMetrics") === "1";
  }

  function publishLayoutDebugMetrics(width: number, height: number, agents: AgentLayoutDebugMetrics[]) {
    const metrics: LayoutDebugMetrics = {
      canvas: { width, height },
      source: {
        pantry: FACILITY_RECTS_SOURCE.pantry,
        pantryCounterFridge: PANTRY_LAYER_RECTS_SOURCE.counterFridge,
        pantryTableChairs: PANTRY_LAYER_RECTS_SOURCE.tableChairs,
        pantryCountertopSurface: PANTRY_COUNTERTOP_SURFACE_SOURCE,
        workstationDesktopSurface: WORKSTATION_DESKTOP_SURFACE_SOURCE,
        treadmill: FACILITY_RECTS_SOURCE.treadmill,
        restroom: FACILITY_RECTS_SOURCE.restroom,
        restroomPrivacy: RESTROOM_PRIVACY_LAYER_RECTS_SOURCE
      },
      screen: getFacilityLayouts(width, height),
      agents
    };

    publishLayoutDebugMetricsPayload(metrics, {
      enabled: isLayoutDebugEnabled()
    });
  }

  function getFacilityAgentAnchorScreen(
    actorPoint: ScenePoint,
    actorScale: number,
    metrics: FacilityAgentDrawMetrics | undefined
  ) {
    if (!metrics?.agentAnchorLocal) {
      return undefined;
    }

    return {
      x: actorPoint.x + metrics.agentAnchorLocal.x * actorScale,
      y: actorPoint.y + metrics.agentAnchorLocal.y * actorScale
    };
  }

  function drawFlatDeskForeground(
    mesh: MeshSimple,
    mask: Graphics,
    texture: Texture | undefined,
    spec: FlatSpriteSpec,
    renderedWidth: number
  ) {
    if (!texture || spec.status !== "ready") {
      return;
    }

    const deskX = FLAT_WORKSTATION_LOCAL_X;
    const deskY = FLAT_WORKSTATION_LOCAL_Y;
    drawFlatSheetMesh(mesh, texture, spec, 0, deskX, deskY, renderedWidth);
    drawFlatDeskForegroundMask(mask, deskX, deskY, renderedWidth, spec);
  }

  function drawFlatDeskForegroundMask(
    mask: Graphics,
    x: number,
    y: number,
    renderedWidth: number,
    spec: FlatSpriteSpec
  ) {
    const foregroundRects = [
      { x: 126, y: 244, width: 132, height: 106, radius: 18 },
      { x: 88, y: 292, width: 42, height: 90, radius: 14 },
      { x: 254, y: 292, width: 42, height: 90, radius: 14 },
      { x: 92, y: 345, width: 200, height: 130, radius: 26 }
    ];

    foregroundRects.forEach((rect) => {
      const mapped = mapFlatSourceRect(rect, x, y, renderedWidth, spec);
      mask
        .roundRect(mapped.x, mapped.y, mapped.width, mapped.height, mapped.radius)
        .fill(0xffffff);
    });
  }

  function drawFlatSheetMesh(
    mesh: MeshSimple,
    texture: Texture,
    spec: FlatSpriteSpec,
    time: number,
    x: number,
    y: number,
    renderedWidth: number
  ) {
    const frame = getFlatFrameIndex(time, spec);
    const frameTexture = getSpriteSheetFrameTexture(texture, {
      frame,
      columns: spec.columns,
      rows: spec.rows
    });
    const scale = renderedWidth / spec.frameWidth;
    const renderedHeight = spec.frameHeight * scale;
    const minX = x - renderedWidth * spec.anchorX;
    const minY = y - renderedHeight * spec.anchorY;
    const maxX = minX + renderedWidth;
    const maxY = minY + renderedHeight;

    mesh.texture = frameTexture;
    mesh.vertices = new Float32Array([minX, minY, maxX, minY, maxX, maxY, minX, maxY]);
    setMeshFullFrameUvs(mesh);
    mesh.visible = true;
    return { minX, minY, maxX, maxY };
  }

  function drawFlatSheetSprite(
    sprite: Sprite,
    texture: Texture,
    spec: FlatSpriteSpec,
    time: number,
    x: number,
    y: number,
    renderedWidth: number
  ) {
    const frame = getFlatFrameIndex(time, spec);
    const frameTexture = getSpriteSheetFrameTexture(texture, {
      frame,
      columns: spec.columns,
      rows: spec.rows
    });
    const scale = renderedWidth / spec.frameWidth;
    const renderedHeight = spec.frameHeight * scale;
    const minX = x - renderedWidth * spec.anchorX;
    const minY = y - renderedHeight * spec.anchorY;
    const maxX = minX + renderedWidth;
    const maxY = minY + renderedHeight;

    sprite.texture = frameTexture;
    sprite.anchor.set(0, 0);
    sprite.position.set(minX, minY);
    sprite.scale.set(renderedWidth / frameTexture.width, renderedHeight / frameTexture.height);
    sprite.visible = true;
    return { minX, minY, maxX, maxY };
  }

  function drawRegisteredFlatSheetMesh(
    mesh: MeshSimple,
    texture: Texture,
    spec: FlatSpriteSpec,
    frame: number,
    targetX: number,
    targetY: number,
    frameAnchor: { x: number; y: number },
    scale: number
  ) {
    const frameTexture = getSpriteSheetFrameTexture(texture, {
      frame,
      columns: spec.columns,
      rows: spec.rows
    });
    const renderedWidth = spec.frameWidth * scale;
    const renderedHeight = spec.frameHeight * scale;
    const minX = targetX - frameAnchor.x * scale;
    const minY = targetY - frameAnchor.y * scale;
    const maxX = minX + renderedWidth;
    const maxY = minY + renderedHeight;

    mesh.texture = frameTexture;
    mesh.vertices = new Float32Array([minX, minY, maxX, minY, maxX, maxY, minX, maxY]);
    setMeshFullFrameUvs(mesh);
    mesh.visible = true;
    return { minX, minY, maxX, maxY };
  }

  function drawRegisteredFlatSheetSprite(
    sprite: Sprite,
    texture: Texture,
    spec: FlatSpriteSpec,
    frame: number,
    targetX: number,
    targetY: number,
    frameAnchor: { x: number; y: number },
    scale: number
  ) {
    const frameTexture = getSpriteSheetFrameTexture(texture, {
      frame,
      columns: spec.columns,
      rows: spec.rows
    });
    const renderedWidth = spec.frameWidth * scale;
    const renderedHeight = spec.frameHeight * scale;
    const minX = targetX - frameAnchor.x * scale;
    const minY = targetY - frameAnchor.y * scale;
    const maxX = minX + renderedWidth;
    const maxY = minY + renderedHeight;

    sprite.texture = frameTexture;
    sprite.anchor.set(0, 0);
    sprite.position.set(minX, minY);
    sprite.scale.set(renderedWidth / frameTexture.width, renderedHeight / frameTexture.height);
    sprite.visible = true;
    return { minX, minY, maxX, maxY };
  }

  function setMeshFullFrameUvs(mesh: MeshSimple) {
    const uvBuffer = mesh.geometry.getBuffer("aUV");
    uvBuffer.data = FULL_FRAME_MESH_UVS;
    uvBuffer.update();
  }

  function getFlatFrameIndex(time: number, spec: FlatSpriteSpec) {
    const frameCount = spec.columns * spec.rows;
    return Math.floor(time / (1000 / spec.fps)) % frameCount;
  }

  function getFlatBodyFrame(agentId: string, key: FlatAssetKey, spec: FlatSpriteSpec, time: number) {
    const registration = spec.registration;
    if (registration?.poseMode !== "randomHold") {
      return getFlatFrameIndex(time, spec);
    }

    const frameCount = spec.columns * spec.rows;
    const poseFrames = getValidPoseFrames(registration.poseFrames, frameCount);
    if (poseFrames.length <= 1) {
      return poseFrames[0] ?? 0;
    }

    const holdMs = Math.max(1, registration.poseHoldMs ?? 6000);
    const bucket = Math.floor(time / holdMs);
    const cycle = Math.floor(bucket / poseFrames.length);
    const cycleSlot = bucket % poseFrames.length;
    const permutation = getSeededFramePermutation(poseFrames, `${agentId}:${key}:${cycle}`);

    if (cycle > 0 && cycleSlot === 0) {
      const previousPermutation = getSeededFramePermutation(poseFrames, `${agentId}:${key}:${cycle - 1}`);
      const previousFrame = previousPermutation[previousPermutation.length - 1];
      if (permutation[0] === previousFrame) {
        const swapIndex = permutation.findIndex((frame, index) => index > 0 && frame !== previousFrame);
        if (swapIndex > 0) {
          [permutation[0], permutation[swapIndex]] = [permutation[swapIndex], permutation[0]];
        }
      }
    }

    return permutation[cycleSlot] ?? poseFrames[0];
  }

  function getValidPoseFrames(frames: number[] | undefined, frameCount: number) {
    const seen = new Set<number>();
    const candidates = frames ?? Array.from({ length: frameCount }, (_value, index) => index);
    return candidates.filter((frame) => {
      if (!Number.isInteger(frame) || frame < 0 || frame >= frameCount || seen.has(frame)) {
        return false;
      }
      seen.add(frame);
      return true;
    });
  }

  function getSeededFramePermutation(frames: number[], seed: string) {
    const permutation = [...frames];
    for (let index = permutation.length - 1; index > 0; index -= 1) {
      const swapIndex = positiveHash(`${seed}:${index}`) % (index + 1);
      [permutation[index], permutation[swapIndex]] = [permutation[swapIndex], permutation[index]];
    }
    return permutation;
  }

  function positiveHash(value: string) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function mapFlatSourceRect(
    rect: { x: number; y: number; width: number; height: number; radius: number },
    x: number,
    y: number,
    renderedWidth: number,
    spec: FlatSpriteSpec
  ) {
    const scale = renderedWidth / spec.frameWidth;
    const origin = mapFlatSourcePoint({ x: rect.x, y: rect.y }, x, y, renderedWidth, spec);
    return {
      x: origin.x,
      y: origin.y,
      width: rect.width * scale,
      height: rect.height * scale,
      radius: rect.radius * scale
    };
  }

  function mapFlatSourcePoint(
    point: { x: number; y: number },
    x: number,
    y: number,
    renderedWidth: number,
    spec: FlatSpriteSpec
  ) {
    const scale = renderedWidth / spec.frameWidth;
    const renderedHeight = spec.frameHeight * scale;
    return {
      x: x - renderedWidth * spec.anchorX + point.x * scale,
      y: y - renderedHeight * spec.anchorY + point.y * scale
    };
  }

  function mapFlatFrameSourceQuad(
    sourceQuad: ScreenQuad,
    x: number,
    y: number,
    renderedWidth: number,
    spec: FlatSpriteSpec
  ): ScreenQuad {
    const scale = renderedWidth / spec.frameWidth;
    return sourceQuad.map((point) => ({
      x: x + (point.x - spec.frameWidth * spec.anchorX) * scale,
      y: y + (point.y - spec.frameHeight * spec.anchorY) * scale
    })) as ScreenQuad;
  }

  function insetScreenSourceQuad(quad: ScreenQuad, inset: number): ScreenQuad {
    return [
      { x: quad[0].x + inset, y: quad[0].y + inset },
      { x: quad[1].x - inset, y: quad[1].y + inset },
      { x: quad[2].x - inset, y: quad[2].y - inset },
      { x: quad[3].x + inset, y: quad[3].y - inset }
    ];
  }

  function drawActorPresence(graphics: Graphics, selected: boolean, destination: IdleDestination) {
    const accent = destination === "pantry" ? 0x7dbb97 : 0x7caabe;

    graphics
      .ellipse(0, 32, 46, 12)
      .fill({ color: 0x17211f, alpha: 0.13 });

    if (selected) {
      graphics
        .circle(0, 17, 34)
        .stroke({ color: accent, width: 2, alpha: 0.5 })
        .circle(0, 17, 25)
        .stroke({ color: accent, width: 1, alpha: 0.25 });
    }
  }

  function drawPantryProps(graphics: Graphics) {
    graphics
      .ellipse(18, 4, 15, 5)
      .fill({ color: 0x1e2d2a, alpha: 0.14 })
      .moveTo(9, -7)
      .lineTo(26, -9)
      .lineTo(31, -4)
      .lineTo(14, -2)
      .closePath()
      .fill(0xffffff)
      .stroke({ color: 0x8b9a96, width: 1 })
      .roundRect(12, -2, 16, 11, 4)
      .fill(0xf4f7f4)
      .stroke({ color: 0x83928e, width: 1 })
      .moveTo(28, 0)
      .bezierCurveTo(38, -2, 38, 8, 29, 7)
      .stroke({ color: 0x83928e, width: 2 })
      .ellipse(-17, 3, 22, 6)
      .fill({ color: 0x1e2d2a, alpha: 0.12 })
      .moveTo(-38, -5)
      .lineTo(-10, -9)
      .lineTo(2, -3)
      .lineTo(-25, 2)
      .closePath()
      .fill(0xd9a563)
      .stroke({ color: 0x9f7542, width: 1 })
      .moveTo(-30, -11)
      .lineTo(-12, -14)
      .lineTo(-6, -9)
      .lineTo(-24, -6)
      .closePath()
      .fill(0xf0cf79)
      .stroke({ color: 0xb88f45, width: 1 });
  }

  function drawBreakPerson(graphics: Graphics, bob: number, idleLean: number, statusColor: number) {
    const bodyX = idleLean * 0.25;
    const bodyY = -2 + bob * 0.45;
    const headY = -42 + bob * 0.35;

    graphics
      .ellipse(bodyX, bodyY + 31, 36, 10)
      .fill({ color: 0x17211f, alpha: 0.16 })
      .roundRect(bodyX - 21, bodyY - 21, 42, 48, 12)
      .fill(0x050708)
      .stroke({ color: 0x161f23, width: 3 })
      .roundRect(bodyX - 17, bodyY - 18, 34, 37, 10)
      .fill(statusColor)
      .roundRect(bodyX - 17, bodyY - 4, 34, 7, 1)
      .fill(statusColor)
      .rect(bodyX - 6, bodyY - 31, 12, 11)
      .fill(0x050708)
      .circle(bodyX, headY, 15)
      .fill(0x050708)
      .stroke({ color: 0x1b2326, width: 3 })
      .moveTo(bodyX - 15, headY - 11)
      .lineTo(bodyX - 4, headY - 25)
      .lineTo(bodyX + 1, headY - 12)
      .lineTo(bodyX + 13, headY - 23)
      .lineTo(bodyX + 9, headY - 10)
      .closePath()
      .fill(0x050708)
      .roundRect(bodyX - 15, headY - 16, 30, 9, 6)
      .fill(0x050708)
      .circle(bodyX - 5, headY - 1, 3.3)
      .fill(0xffffff)
      .circle(bodyX + 6, headY - 1, 3.3)
      .fill(0xffffff)
      .circle(bodyX - 4, headY, 1.2)
      .fill(0x050708)
      .circle(bodyX + 7, headY, 1.2)
      .fill(0x050708)
      .roundRect(bodyX - 5, headY + 8, 12, 2, 1)
      .fill(0xffffff)
      .roundRect(bodyX - 37, bodyY - 8, 30, 8, 4)
      .fill(0x050708)
      .roundRect(bodyX + 8, bodyY - 10, 29, 8, 4)
      .fill(0x050708)
      .roundRect(bodyX + 30, bodyY - 17, 13, 18, 5)
      .fill(0xf5f7f3)
      .stroke({ color: 0x7b8b87, width: 2 });
  }

  function drawRestroomStation(graphics: Graphics) {
    graphics
      .roundRect(-78, -58, 156, 107, 8)
      .fill(0xb7c6cc)
      .stroke({ color: 0x7e929a, width: 2 })
      .rect(-1, -58, 2, 107)
      .fill(0x778b94)
      .roundRect(-69, -49, 58, 88, 4)
      .fill(0x8da0a7)
      .roundRect(11, -49, 58, 88, 4)
      .fill(0x8da0a7)
      .circle(-18, -6, 3)
      .fill(0xf2f6f4)
      .circle(62, -6, 3)
      .fill(0xf2f6f4)
      .ellipse(0, 25, 39, 15)
      .fill(0xf2f6f4)
      .stroke({ color: 0xa9b9bd, width: 2 })
      .rect(-16, 29, 32, 23)
      .fill(0xd7e1e0)
      .roundRect(-20, 47, 40, 8, 4)
      .fill(0xb6c7ca);
  }

  function drawRestroomSeatBase(graphics: Graphics) {
    graphics
      .ellipse(0, 38, 46, 12)
      .fill({ color: 0x17252b, alpha: 0.14 });

    drawIsoBlock(graphics, -22, -27, 42, 24, 8, -6, 0xffffff, 0xe5e8e5, 0xd0d5d3, 0xaeb7b6);

    graphics
      .roundRect(-15, -22, 31, 5, 2)
      .fill(0xf8faf7)
      .rect(12, -24, 5, 3)
      .fill(0xa8b5b7)
      .moveTo(-25, -4)
      .lineTo(17, -11)
      .lineTo(34, 2)
      .lineTo(-4, 13)
      .closePath()
      .fill(0xffffff)
      .stroke({ color: 0xaeb8b9, width: 2 })
      .moveTo(-5, 13)
      .lineTo(34, 2)
      .lineTo(25, 20)
      .lineTo(-8, 30)
      .closePath()
      .fill(0xdfe7e8)
      .stroke({ color: 0xa6b3b5, width: 2 })
      .ellipse(3, 16, 33, 15)
      .fill(0xf8fbfa)
      .stroke({ color: 0xa1b5bb, width: 2 })
      .ellipse(4, 16, 19, 8)
      .fill(0xc8e1e6)
      .stroke({ color: 0x9ab4bc, width: 1 });
  }

  function drawRestroomProps(graphics: Graphics) {
    graphics
      .ellipse(4, 31, 38, 13)
      .fill(0xf8fbfa)
      .stroke({ color: 0xa3b7bd, width: 2 })
      .ellipse(5, 30, 21, 7)
      .fill(0xc9e2e8)
      .stroke({ color: 0x9db8c0, width: 1 })
      .rect(-10, 38, 27, 18)
      .fill(0xdce7e8)
      .stroke({ color: 0xb2bfc1, width: 1 })
      .roundRect(-17, 53, 39, 8, 4)
      .fill(0xb9c9cd)
      .stroke({ color: 0xa6b3b5, width: 1 })
      .roundRect(26, -27, 23, 15, 4)
      .fill(0x1d282b)
      .stroke({ color: 0x5fd0bd, width: 1 })
      .rect(31, -24, 13, 2)
      .fill(0x5fd0bd)
      .rect(31, -20, 9, 2)
      .fill(0x5fd0bd);
  }

  function drawRestroomPerson(graphics: Graphics, bob: number, idleLean: number, statusColor: number) {
    const bodyX = idleLean * 0.1;
    const bodyY = -12 + bob * 0.18;
    const headY = -51 + bob * 0.18;

    graphics
      .roundRect(bodyX - 24, bodyY - 22, 48, 44, 13)
      .fill(0x050708)
      .stroke({ color: 0x161f23, width: 3 })
      .roundRect(bodyX - 19, bodyY - 19, 38, 34, 11)
      .fill(statusColor)
      .roundRect(bodyX - 19, bodyY - 5, 38, 7, 1)
      .fill(statusColor)
      .roundRect(bodyX - 33, bodyY + 12, 28, 11, 5)
      .fill(0x263035)
      .roundRect(bodyX + 5, bodyY + 12, 28, 11, 5)
      .fill(0x263035)
      .roundRect(bodyX - 38, bodyY + 21, 23, 8, 4)
      .fill(0x222a2d)
      .roundRect(bodyX + 15, bodyY + 21, 23, 8, 4)
      .fill(0x222a2d)
      .rect(bodyX - 6, bodyY - 31, 12, 12)
      .fill(0x050708)
      .circle(bodyX, headY, 15)
      .fill(0x050708)
      .stroke({ color: 0x1b2326, width: 3 })
      .moveTo(bodyX - 15, headY - 11)
      .lineTo(bodyX - 4, headY - 25)
      .lineTo(bodyX + 1, headY - 12)
      .lineTo(bodyX + 13, headY - 23)
      .lineTo(bodyX + 9, headY - 10)
      .closePath()
      .fill(0x050708)
      .roundRect(bodyX - 15, headY - 16, 30, 9, 6)
      .fill(0x050708)
      .circle(bodyX - 5, headY - 1, 3.3)
      .fill(0xffffff)
      .circle(bodyX + 6, headY - 1, 3.3)
      .fill(0xffffff)
      .circle(bodyX - 4, headY, 1.2)
      .fill(0x050708)
      .circle(bodyX + 7, headY, 1.2)
      .fill(0x050708)
      .roundRect(bodyX - 5, headY + 8, 12, 2, 1)
      .fill(0xffffff)
      .roundRect(bodyX - 37, bodyY - 2, 30, 8, 4)
      .fill(0x050708)
      .roundRect(bodyX + 7, bodyY - 5, 30, 8, 4)
      .fill(0x050708)
      .roundRect(bodyX + 26, bodyY - 17, 16, 24, 4)
      .fill(0x1f2b2f)
      .stroke({ color: 0x58c8b7, width: 1 })
      .rect(bodyX + 30, bodyY - 12, 8, 2)
      .fill(0x58c8b7);
  }

  function drawWorkspaceBase(graphics: Graphics, selected: boolean) {
    graphics
      .ellipse(0, 46, 104, 31)
      .fill({ color: 0x284247, alpha: 0.18 });

    diamond(graphics, 0, 26, 238, 124, selected ? 0xfff3b2 : 0xcfe7d2, selected ? 0x0b9f93 : 0x76958c);
    diamond(graphics, 0, 22, 198, 94, selected ? 0xfff8c8 : 0xe9f2d3, selected ? 0x5ed8cd : 0x9bb8a9);

    graphics
      .moveTo(-99, 22)
      .lineTo(0, -25)
      .lineTo(99, 22)
      .stroke({ color: selected ? 0x008a86 : 0x86a09a, width: 2, alpha: 0.72 });
  }

  function drawGeneratedWorkspaceBase(graphics: Graphics, selected: boolean) {
    graphics
      .ellipse(0, 44, 98, 27)
      .fill({ color: 0x253235, alpha: 0.12 });

    if (!selected) {
      return;
    }

    graphics
      .ellipse(0, 43, 112, 32)
      .stroke({ color: 0x0b9f93, width: 2, alpha: 0.58 })
      .ellipse(0, 43, 96, 25)
      .stroke({ color: 0xf1d979, width: 1, alpha: 0.66 });
  }

  function drawDeskBase(graphics: Graphics) {
    graphics
      .ellipse(0, 58, 92, 22)
      .fill({ color: 0x263b40, alpha: 0.2 });

    graphics
      .ellipse(0, 31, 46, 15)
      .fill({ color: 0x384a4f, alpha: 0.16 })
      .moveTo(-21, -13)
      .lineTo(16, -26)
      .lineTo(35, -16)
      .lineTo(-1, -2)
      .closePath()
      .fill(0xf7f7f3)
      .stroke({ color: 0xc8ccc8, width: 2 })
      .moveTo(-1, -2)
      .lineTo(35, -16)
      .lineTo(35, 28)
      .lineTo(1, 42)
      .closePath()
      .fill(0xe4e5e0)
      .stroke({ color: 0xc4c8c5, width: 2 })
      .moveTo(-21, -13)
      .lineTo(-1, -2)
      .lineTo(1, 42)
      .lineTo(-18, 31)
      .closePath()
      .fill(0xd0d3ce)
      .stroke({ color: 0xb8bcb8, width: 2 })
      .roundRect(-13, 6, 22, 6, 3)
      .fill(0xffffff)
      .roundRect(10, 9, 12, 18, 4)
      .fill(0xd9dcd7)
      .stroke({ color: 0xbec2be, width: 1 });

    graphics
      .roundRect(-80, 8, 10, 47, 3)
      .fill(0xd8dbd6)
      .stroke({ color: 0xaab0ad, width: 2 })
      .roundRect(66, 8, 10, 47, 3)
      .fill(0xd8dbd6)
      .stroke({ color: 0xaab0ad, width: 2 })
      .roundRect(-43, 13, 8, 38, 3)
      .fill(0xe5e7e3)
      .stroke({ color: 0xbcc2be, width: 1 })
      .roundRect(36, 13, 8, 38, 3)
      .fill(0xe5e7e3)
      .stroke({ color: 0xbcc2be, width: 1 });

    graphics
      .moveTo(-92, -17)
      .lineTo(88, -17)
      .lineTo(72, 18)
      .lineTo(-76, 18)
      .closePath()
      .fill(0xf4f5ef)
      .stroke({ color: 0x9fa7a4, width: 3 })
      .moveTo(-84, -11)
      .lineTo(77, -11)
      .lineTo(65, 11)
      .lineTo(-68, 11)
      .closePath()
      .fill(0xffffff)
      .stroke({ color: 0xd1d5d0, width: 2 })
      .moveTo(72, 18)
      .lineTo(88, -17)
      .lineTo(90, -5)
      .lineTo(78, 24)
      .lineTo(-72, 24)
      .lineTo(-76, 18)
      .closePath()
      .fill(0xd9ddd8)
      .stroke({ color: 0xaab1ad, width: 2 });

    graphics
      .roundRect(-59, -1, 116, 7, 3)
      .fill(0xe9ece6)
      .roundRect(-51, 0, 42, 4, 2)
      .fill(0xffffff)
      .roundRect(16, 0, 30, 4, 2)
      .fill(0xffffff)
      .rect(-66, 21, 132, 2)
      .fill(0xb9c2bd);
  }

  function drawDeskForeground(graphics: Graphics, typing: number) {
    graphics
      .roundRect(-81, 17, 162, 43, 7)
      .fill(0xe7e9e3)
      .stroke({ color: 0x9fa7a4, width: 3 })
      .roundRect(-72, 22, 62, 12, 3)
      .fill(0xffffff)
      .stroke({ color: 0xc3c9c4, width: 1 })
      .roundRect(-5, 22, 32, 12, 3)
      .fill(0xffffff)
      .stroke({ color: 0xc3c9c4, width: 1 })
      .roundRect(33, 22, 32, 12, 3)
      .fill(0xffffff)
      .stroke({ color: 0xc3c9c4, width: 1 })
      .circle(-18, 28, 2)
      .fill(0xa0aaa5)
      .circle(18, 28, 2)
      .fill(0xa0aaa5)
      .circle(55, 28, 2)
      .fill(0xa0aaa5)
      .roundRect(-66, 45, 132, 9, 5)
      .fill(0xb7c0bb)
      .roundRect(-35, 13 + typing * 0.08, 70, 8, 4)
      .fill(0x243238)
      .roundRect(43, 9, 19, 8, 4)
      .fill(0x43575f)
      .circle(60, 7, 3)
      .fill(0x5fd6c8)
      .moveTo(52, 9)
      .bezierCurveTo(58, -2, 68, -8, 76, -12)
      .stroke({ color: 0x4f6563, width: 2, alpha: 0.55 });
  }

  function drawMonitor(graphics: Graphics, status: AgentStatus) {
    const screenColor = STATUS_SCREEN_COLORS[status];
    graphics
      .ellipse(1, -13, 52, 9)
      .fill({ color: 0x243034, alpha: 0.28 })
      .moveTo(-61, -92)
      .lineTo(62, -96)
      .lineTo(66, -31)
      .lineTo(58, -27)
      .lineTo(-58, -27)
      .lineTo(-64, -34)
      .closePath()
      .fill(0x273a43)
      .stroke({ color: 0x13252d, width: 3 })
      .moveTo(58, -27)
      .lineTo(66, -31)
      .lineTo(66, -88)
      .lineTo(62, -96)
      .lineTo(62, -34)
      .closePath()
      .fill(0x182830)
      .stroke({ color: 0x13252d, width: 2 })
      .roundRect(-58, -93, 118, 63, 6)
      .fill(0x10181c)
      .stroke({ color: 0x324855, width: 2 })
      .roundRect(-50, -84, 100, 45, 3)
      .fill(screenColor)
      .stroke({ color: 0x071216, width: 2 })
      .moveTo(-43, -78)
      .lineTo(38, -78)
      .stroke({ color: 0x9fe7d8, width: 1, alpha: 0.25 })
      .moveTo(-48, -43)
      .lineTo(48, -83)
      .stroke({ color: 0xffffff, width: 2, alpha: 0.08 })
      .rect(-11, -29, 22, 20)
      .fill(0xc9cfcb)
      .stroke({ color: 0x87928f, width: 1 })
      .moveTo(11, -29)
      .lineTo(17, -25)
      .lineTo(17, -8)
      .lineTo(11, -9)
      .closePath()
      .fill(0xa9b3b1)
      .roundRect(-37, -13, 74, 10, 4)
      .fill(0xdfe2dc)
      .stroke({ color: 0x87928f, width: 2 })
      .roundRect(-29, -10, 58, 4, 2)
      .fill(0xffffff)
      .circle(53, -32, 2)
      .fill(0x7bdcc8);

    if (status === "error") {
      graphics.rect(-42, -78, 84, 4).fill(0xe76f51).rect(-36, -63, 58, 4).fill(0xe76f51);
    } else if (status === "blocked") {
      graphics
        .moveTo(0, -78)
        .lineTo(19, -46)
        .lineTo(-19, -46)
        .closePath()
        .fill(0xf4c95d);
    } else if (status === "offline") {
      graphics.rect(-28, -64, 56, 2).fill(0x758184);
    }
  }

  function drawLeisureScreen(graphics: Graphics, time: number) {
    const blink = Math.sin(time / 220) > 0 ? 1 : 0;

    graphics
      .roundRect(-45, -80, 90, 36, 3)
      .fill(0x213b72)
      .rect(-42, -77, 84, 5)
      .fill(0xf1c94c)
      .rect(-39, -68, 28, 16)
      .fill(0x59c16d)
      .rect(-9, -66, 22, 12)
      .fill(0x91d7f2)
      .rect(18, -68, 19, 3)
      .fill(0xfff2a6)
      .rect(18, -62, 15, 3)
      .fill(0xff8a65)
      .rect(18, -56, 21, 3)
      .fill(0x7bdcba)
      .rect(-34 + blink * 8, -60, 5, 5)
      .fill(0xffffff)
      .rect(-22, -55, 18, 3)
      .fill(0x224c38);
  }

  function drawPerson(
    graphics: Graphics,
    status: AgentStatus,
    bob: number,
    typing: number,
    thinking: number,
    idleLean: number,
    statusColor: number
  ) {
    const bodyX = 0 + idleLean;
    const bodyY = -1 + bob;
    const headY = -38 + bob + thinking;

    graphics
      .ellipse(bodyX, bodyY + 23, 42, 10)
      .fill({ color: 0x17211f, alpha: 0.18 })
      .roundRect(bodyX - 24, bodyY - 30, 48, 58, 13)
      .fill(0x050708)
      .stroke({ color: 0x151f23, width: 3 })
      .roundRect(bodyX - 20, bodyY - 27, 40, 45, 11)
      .fill(status === "offline" ? 0x657076 : statusColor)
      .roundRect(bodyX - 20, bodyY - 8, 40, 8, 1)
      .fill(status === "offline" ? 0x3f474a : statusColor)
      .rect(bodyX - 7, bodyY - 34, 14, 13)
      .fill(0x050708)
      .circle(bodyX - 17, headY + 2, 4)
      .fill(0x050708)
      .circle(bodyX + 17, headY + 2, 4)
      .fill(0x050708)
      .circle(bodyX, headY, 16)
      .fill(0x050708)
      .stroke({ color: 0x1b2326, width: 3 })
      .moveTo(bodyX - 16, headY - 13)
      .lineTo(bodyX - 3, headY - 28)
      .lineTo(bodyX + 3, headY - 13)
      .lineTo(bodyX + 14, headY - 25)
      .lineTo(bodyX + 10, headY - 11)
      .closePath()
      .fill(0x050708)
      .ellipse(bodyX - 5, headY - 13, 15, 8)
      .fill(0x050708)
      .roundRect(bodyX - 16, headY - 17, 32, 9, 6)
      .fill(0x050708)
      .circle(bodyX - 5, headY - 1, 3.5)
      .fill(0xffffff)
      .circle(bodyX + 7, headY - 1, 3.5)
      .fill(0xffffff)
      .circle(bodyX - 4, headY, 1.3)
      .fill(0x050708)
      .circle(bodyX + 8, headY, 1.3)
      .fill(0x050708)
      .roundRect(bodyX - 5, headY + 9, 12, 2, 1)
      .fill(0xffffff);

    if (status === "idle") {
      graphics
        .circle(bodyX - 18, headY + 1, 5)
        .fill(0x253840)
        .circle(bodyX + 18, headY + 1, 5)
        .fill(0x253840)
        .moveTo(bodyX - 16, headY - 11)
        .bezierCurveTo(bodyX - 9, headY - 22, bodyX + 9, headY - 22, bodyX + 16, headY - 11)
        .stroke({ color: 0x253840, width: 3, cap: "round" })
        .roundRect(bodyX + 22, bodyY + 0, 21, 10, 5)
        .fill(0x253840)
        .circle(bodyX + 27, bodyY + 5, 2)
        .fill(0x74dfc8)
        .circle(bodyX + 36, bodyY + 5, 2)
        .fill(0xf7d35d);
    } else if (status === "thinking") {
      graphics.circle(bodyX + 26, headY - 18, 4).fill(0xffffff).circle(bodyX + 39, headY - 30, 6).fill(0xffffff);
    } else if (status === "blocked") {
      graphics
        .moveTo(bodyX + 19, bodyY - 8)
        .lineTo(bodyX + 32, bodyY - 36)
        .stroke({ color: 0xf2b79a, width: 9, cap: "round" });
    }

    graphics
      .roundRect(bodyX - 38, bodyY - 5 + typing, 31, 8, 4)
      .fill(0x050708)
      .stroke({ color: 0x1b2326, width: 1 })
      .roundRect(bodyX + 7, bodyY - 5 - typing, 31, 8, 4)
      .fill(0x050708)
      .stroke({ color: 0x1b2326, width: 1 })
      .roundRect(bodyX - 37, bodyY + 17, 74, 9, 5)
      .fill(0x2d363a)
      .roundRect(bodyX - 30, bodyY + 25, 60, 8, 4)
      .fill(0x222a2d);
  }

  function drawStatusBadge(graphics: Graphics, status: AgentStatus, statusColor: number) {
    graphics
      .circle(66, -74, 13)
      .fill(statusColor)
      .stroke({ color: 0xffffff, width: 3 });

    if (status === "working") {
      graphics.rect(61, -79, 4, 10).fill(0xffffff).rect(68, -79, 4, 10).fill(0xffffff);
    } else if (status === "idle") {
      graphics.circle(62, -75, 2).fill(0xffffff).circle(70, -75, 2).fill(0xffffff);
    } else if (status === "thinking") {
      graphics.circle(66, -75, 5).fill(0xffffff).circle(72, -81, 2).fill(0xffffff);
    } else if (status === "blocked") {
      graphics.rect(64, -82, 4, 10).fill(0xffffff).circle(66, -68, 2).fill(0xffffff);
    } else if (status === "error") {
      graphics.moveTo(61, -79).lineTo(71, -69).stroke({ color: 0xffffff, width: 3 });
      graphics.moveTo(71, -79).lineTo(61, -69).stroke({ color: 0xffffff, width: 3 });
    } else {
      graphics.rect(59, -76, 14, 4).fill(0xffffff);
    }
  }

  function getLayout(count: number, width: number, height: number) {
    const background = getBackgroundLayout(width, height);

    return Array.from({ length: count }, (_, index) => {
      const anchor = getWorkstationAnchorSource(index);
      const point = mapBackgroundSourcePoint(background, anchor);
      return {
        x: point.x,
        y: point.y,
        scale: anchor.scale ?? 1
      };
    });
  }

  function getStationSlot(agentId: string) {
    const existing = stationSlots.get(agentId);
    if (existing !== undefined) {
      return existing;
    }

    const nextSlot = stationSlots.size;
    stationSlots.set(agentId, nextSlot);
    return nextSlot;
  }

  return { mount, destroy };
}

function getBackgroundLayout(width: number, height: number): BackgroundLayout {
  const scale = Math.min(width / OFFICE_BACKGROUND_SOURCE.width, height / OFFICE_BACKGROUND_SOURCE.height);
  const backgroundWidth = OFFICE_BACKGROUND_SOURCE.width * scale;
  const backgroundHeight = OFFICE_BACKGROUND_SOURCE.height * scale;
  return {
    x: (width - backgroundWidth) / 2,
    y: (height - backgroundHeight) / 2,
    width: backgroundWidth,
    height: backgroundHeight,
    scale
  };
}

function mapBackgroundSourcePoint(layout: BackgroundLayout, point: SourcePoint): ScenePoint {
  return {
    x: layout.x + point.x * layout.scale,
    y: layout.y + point.y * layout.scale,
    scale: point.scale ?? 1
  };
}

function mapSourceRectToScreen(rect: FacilitySourceRect, width: number, height: number) {
  const background = getBackgroundLayout(width, height);
  return {
    x: background.x + rect.x * background.scale,
    y: background.y + rect.y * background.scale,
    width: rect.width * background.scale,
    height: rect.height * background.scale
  };
}

function getStationScale(width: number, height: number) {
  const background = getBackgroundLayout(width, height);
  return clamp((background.scale * WORKSTATION_SOURCE_WIDTH) / GENERATED_DESK_LOCAL_WIDTH, 0.72, 3.4);
}

function getIdleAssignments(
  agents: AgentActivity[],
  getIdleBehavior: (agent: AgentActivity) => IdleBehavior
) {
  const counts: Record<IdleDestination, number> = {
    pantry: 0,
    restroom: 0,
    treadmill: 0
  };
  const assignments = new Map<string, IdleAssignment>();

  agents.forEach((agent) => {
    if (agent.status !== "idle") {
      return;
    }

    const behavior = getIdleBehavior(agent);
    if (isIdleDeskActivity(behavior) || counts[behavior] >= IDLE_ROOM_CAPACITY[behavior]) {
      return;
    }

    assignments.set(agent.id, {
      destination: behavior,
      rank: counts[behavior]
    });
    counts[behavior] += 1;
  });

  return assignments;
}

function getFacilityLayouts(width: number, height: number) {
  const background = getBackgroundLayout(width, height);
  const pantrySource = FACILITY_RECTS_SOURCE.pantry;
  const pantryCounterFridgeSource = PANTRY_LAYER_RECTS_SOURCE.counterFridge;
  const pantryTableChairsSource = PANTRY_LAYER_RECTS_SOURCE.tableChairs;
  const treadmillSource = FACILITY_RECTS_SOURCE.treadmill;
  const restroomSource = FACILITY_RECTS_SOURCE.restroom;
  const restroomPrivacySource = RESTROOM_PRIVACY_LAYER_RECTS_SOURCE;
  const pantryWidth = pantrySource.width * background.scale;
  const pantryHeight = pantryWidth * (PANTRY_ROOM_SOURCE.height / PANTRY_ROOM_SOURCE.width);
  const pantryCounterFridgeWidth = pantryCounterFridgeSource.width * background.scale;
  const pantryCounterFridgeHeight =
    pantryCounterFridgeWidth * (PANTRY_COUNTER_FRIDGE_SOURCE.height / PANTRY_COUNTER_FRIDGE_SOURCE.width);
  const pantryTableChairsWidth = pantryTableChairsSource.width * background.scale;
  const pantryTableChairsHeight =
    pantryTableChairsWidth * (PANTRY_TABLE_CHAIRS_SOURCE.height / PANTRY_TABLE_CHAIRS_SOURCE.width);
  const treadmillWidth = treadmillSource.width * background.scale;
  const treadmillHeight =
    treadmillWidth * (TREADMILL_HORIZONTAL_STATIC_SOURCE.height / TREADMILL_HORIZONTAL_STATIC_SOURCE.width);
  const restroomWidth = restroomSource.width * background.scale;
  const restroomHeight = restroomWidth * (RESTROOM_ROOM_SOURCE.height / RESTROOM_ROOM_SOURCE.width);
  const restroomPrivacyWidth = restroomPrivacySource.width * background.scale;
  const restroomPrivacyHeight = restroomPrivacyWidth * (RESTROOM_ROOM_SOURCE.height / RESTROOM_ROOM_SOURCE.width);

  return {
    pantry: {
      x: background.x + pantrySource.x * background.scale,
      y: background.y + pantrySource.y * background.scale,
      width: pantryWidth,
      height: pantryHeight
    },
    pantryCounterFridge: {
      x: background.x + pantryCounterFridgeSource.x * background.scale,
      y: background.y + pantryCounterFridgeSource.y * background.scale,
      width: pantryCounterFridgeWidth,
      height: pantryCounterFridgeHeight
    },
    pantryTableChairs: {
      x: background.x + pantryTableChairsSource.x * background.scale,
      y: background.y + pantryTableChairsSource.y * background.scale,
      width: pantryTableChairsWidth,
      height: pantryTableChairsHeight
    },
    treadmill: {
      x: background.x + treadmillSource.x * background.scale,
      y: background.y + treadmillSource.y * background.scale,
      width: treadmillWidth,
      height: treadmillHeight
    },
    restroom: {
      x: background.x + restroomSource.x * background.scale,
      y: background.y + restroomSource.y * background.scale,
      width: restroomWidth,
      height: restroomHeight
    },
    restroomPrivacy: {
      x: background.x + restroomPrivacySource.x * background.scale,
      y: background.y + restroomPrivacySource.y * background.scale,
      width: restroomPrivacyWidth,
      height: restroomPrivacyHeight
    }
  };
}

function getPantryRoomLayout(width: number, height: number): RoomLayout {
  return getFacilityLayouts(width, height).pantry;
}

function getRestroomRoomLayout(width: number, height: number): RoomLayout {
  return getFacilityLayouts(width, height).restroom;
}

function getFacilitySeatPosition(assignment: FacilitySeatAssignment, width: number, height: number): ScenePoint {
  const point = mapBackgroundSourcePoint(getBackgroundLayout(width, height), assignment.seat.sourceAnchor);
  return {
    ...point,
    scale: width < 560 ? 0.82 : point.scale ?? 1
  };
}

function getScenePointFromSourcePoint(sourcePoint: SourcePoint, width: number, height: number): ScenePoint {
  const point = mapBackgroundSourcePoint(getBackgroundLayout(width, height), sourcePoint);
  return {
    ...point,
    scale: width < 560 ? 0.82 : point.scale ?? 1
  };
}

function getIdlePosition(assignment: IdleAssignment, width: number, height: number): ScenePoint {
  const lane = assignment.rank % 2;

  if (assignment.destination === "pantry") {
    const pantry = getPantryRoomLayout(width, height);
    return {
      x: pantry.x + pantry.width * (lane === 0 ? 0.78 : 0.92),
      y: pantry.y + pantry.height * 0.78,
      scale: width < 560 ? 0.82 : 1
    };
  }

  if (assignment.destination === "treadmill") {
    const treadmill = getFacilityLayouts(width, height).treadmill;
    return {
      x: treadmill.x + treadmill.width * 0.5,
      y: treadmill.y + treadmill.height * 0.74,
      scale: width < 560 ? 0.82 : 1
    };
  }

  const restroom = getRestroomRoomLayout(width, height);
  return {
    x: restroom.x + restroom.width * 0.5,
    y: restroom.y + restroom.height * 0.84,
    scale: width < 560 ? 0.82 : 1
  };
}

function getIdleDestinationAnchorSource(assignment: IdleAssignment): SourcePoint {
  const lane = assignment.rank % 2;

  if (assignment.destination === "pantry") {
    const pantry = FACILITY_RECTS_SOURCE.pantry;
    const pantryHeight = pantry.width * (PANTRY_ROOM_SOURCE.height / PANTRY_ROOM_SOURCE.width);
    return {
      x: pantry.x + pantry.width * (lane === 0 ? 0.78 : 0.92),
      y: pantry.y + pantryHeight * 0.78,
      scale: 1
    };
  }

  if (assignment.destination === "treadmill") {
    return getFacilitySeatDefinition("treadmillBelt").sourceAnchor;
  }

  const restroom = FACILITY_RECTS_SOURCE.restroom;
  const restroomHeight = restroom.width * (RESTROOM_ROOM_SOURCE.height / RESTROOM_ROOM_SOURCE.width);
  return {
    x: restroom.x + restroom.width * 0.5,
    y: restroom.y + restroomHeight * 0.84,
    scale: 1
  };
}

function getWalkActionKey(action: AgentVisualAction): FlatAssetKey | undefined {
  if (action === "walkUp") {
    return "flatAgentWalkUpSheet";
  }
  if (action === "walkDown") {
    return "flatAgentWalkDownSheet";
  }
  if (action === "walkLeft") {
    return "flatAgentWalkLeftSheet";
  }
  if (action === "walkRight") {
    return "flatAgentWalkRightSheet";
  }
  return undefined;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatScreenLines(lines: string[], maxLines = 4, maxChars = 17) {
  return lines
    .slice(0, maxLines)
    .map((line) => {
      const compact = line.replace(/\s+/g, " ").trim();
      return compact.length > maxChars ? `${compact.slice(0, Math.max(1, maxChars - 3))}...` : compact;
    })
    .join("\n");
}

function formatLeisureScreenLines(time: number, agentId: string, maxChars = 17, maxLines = 4) {
  const sets = [
    ["pixel golf", "round 03", "score: +2", "boss key ready"],
    ["video stream", "episode queue", "volume low", "chat muted"],
    ["retro puzzle", "level 12", "combo x4", "window hidden"],
    ["shopping tab", "cart saved", "coupon found", "standby"]
  ];
  const seed = agentId.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const index = Math.floor(time / 2400 + seed) % sets.length;
  return sets[index]
    .slice(0, maxLines)
    .map((line) => line.length > maxChars ? `${line.slice(0, Math.max(1, maxChars - 3))}...` : line)
    .join("\n");
}

function hideSpriteChildren(container: Container) {
  container.children.forEach((child) => {
    child.visible = false;
  });
}

function setSprite(
  container: Container,
  name: string,
  texture: Texture | undefined,
  visible: boolean,
  x: number,
  y: number,
  width: number,
  anchorX: number,
  anchorY: number
): Sprite | undefined {
  const existing = container.getChildByName(name) as Sprite | undefined;
  if (!texture || !visible) {
    if (existing) {
      existing.visible = false;
    }
    return existing;
  }

  const sprite = existing ?? new Sprite(texture);
  if (!existing) {
    sprite.name = name;
    sprite.eventMode = "none";
    container.addChild(sprite);
  }

  sprite.texture = texture;
  sprite.visible = true;
  sprite.anchor.set(anchorX, anchorY);
  sprite.position.set(x, y);
  const scale = width / texture.width;
  sprite.scale.set(scale);
  return sprite;
}

function safeDestroy(target: Application | undefined) {
  if (!target) {
    return;
  }

  target.canvas?.parentElement?.removeChild(target.canvas);
  target.destroy({ removeView: true }, { children: true });
}

function diamond(graphics: Graphics, x: number, y: number, width: number, height: number, fill: number, stroke: number) {
  graphics
    .moveTo(x, y - height / 2)
    .lineTo(x + width / 2, y)
    .lineTo(x, y + height / 2)
    .lineTo(x - width / 2, y)
    .closePath()
    .fill(fill)
    .stroke({ color: stroke, width: 1 });
}
