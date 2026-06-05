import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { captureCanvasScreenshot } from "./lib/canvas-screenshot.mjs";

const root = "D:/codex_Animation";
const chromePath = "C:/Users/34927/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe";
const artifactsDir = `${root}/artifacts`;
const summaryPath = `${artifactsDir}/facility-qa-summary.json`;
const agentOnlySummaryPath = `${artifactsDir}/facility-agent-only-assets-summary.json`;
const restroomPrivacyAuditPath = `${artifactsDir}/restroom-privacy-back-asset-audit.json`;
const baseUrl = process.env.FACILITY_QA_BASE_URL ?? "http://127.0.0.1:5175/";
const query = "debugPaused=1&debugFlatAnchors=1&debugLayoutMetrics=1&debugAgents=Aurora:idle,Binary:idle,Cascade:idle,Delta:working,Echo:thinking,Forge:offline&debugIdleBehaviors=Aurora:pantry,Binary:pantry,Cascade:restroom";
const url = `${baseUrl}?${query}`;
const viewports = [
  { label: "1080p", width: 1920, height: 1080, out: `${artifactsDir}/facility-qa-1080p.png` },
  { label: "2k", width: 2560, height: 1440, out: `${artifactsDir}/facility-qa-2k.png` },
  { label: "4k", width: 3840, height: 2160, out: `${artifactsDir}/facility-qa-4k.png` }
];

if (!existsSync(chromePath)) {
  throw new Error(`Chrome not found: ${chromePath}`);
}

mkdirSync(artifactsDir, { recursive: true });
const agentOnlyAssets = JSON.parse(readFileSync(agentOnlySummaryPath, "utf8"));
const restroomPrivacyAudit = JSON.parse(readFileSync(restroomPrivacyAuditPath, "utf8"));
const captures = [];
for (const viewport of viewports) {
  captures.push(await captureViewport(viewport));
}

const screenshots = captures.map(({ viewport, metrics }) => ({
  label: viewport.label,
  ...pngInfo(viewport.out),
  facilityAgents: metrics.agents.map((agent) => ({
    agentId: agent.agentId,
    destination: agent.destination,
    rank: agent.rank,
    seatId: agent.seatId,
    facingLabel: agent.facingLabel,
    actionId: agent.actionId,
    actionKey: agent.actionKey,
    currentFrame: agent.currentFrame,
    holdDurationMs: agent.holdDurationMs,
    segmentElapsedMs: Math.round(agent.segmentElapsedMs),
    fallback: agent.fallback,
    screenPosition: agent.screenPosition,
    sourceAnchor: agent.sourceAnchor,
    seatCushionAnchor: agent.seatCushionAnchor,
    screenSeatCushion: agent.screenSeatCushion,
    agentHipScreen: agent.agentHipScreen,
    seatDeltaPx: agent.seatDeltaPx,
    frontOcclusionRect: agent.frontOcclusionRect,
    occlusionBbox: agent.occlusionBbox,
    localBbox: agent.localBbox
  })),
  facilityScreen: metrics.screen,
  facilitySource: metrics.source
}));

function rectsOverlap(left, right) {
  return Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x)) > 0 &&
    Math.max(0, Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y)) > 0;
}

function horizontalGap(left, right) {
  if (left.x + left.width <= right.x) {
    return right.x - (left.x + left.width);
  }
  if (right.x + right.width <= left.x) {
    return left.x - (right.x + right.width);
  }
  return 0;
}

function projectPrivacyAlphaBbox(sourceRect) {
  const alpha = restroomPrivacyAudit.alphaBbox;
  const scale = sourceRect.width / restroomPrivacyAudit.width;
  return {
    x: sourceRect.x + alpha.x * scale,
    y: sourceRect.y + alpha.y * scale,
    width: alpha.width * scale,
    height: alpha.height * scale
  };
}

function pantryTableSourceBbox(sourceRect) {
  return {
    ...sourceRect,
    height: sourceRect.width * (1024 / 1536)
  };
}

const checks = {
  expectedFacilityAgents: 3,
  screenshots: screenshots.map((item) => ({
    label: item.label,
    path: item.path,
    width: item.width,
    height: item.height,
    sha256: item.sha256
  })),
  holdDurationsWithin10To30Seconds: screenshots.every((item) => item.facilityAgents.every((agent) => agent.holdDurationMs >= 10000 && agent.holdDurationMs <= 30000)),
  allFacilityAgentsUseSeatSheets: screenshots.every((item) => item.facilityAgents.every((agent) => agent.fallback === false && (agent.actionKey.includes("Seat") || agent.actionKey.includes("Toilet")))),
  pantrySeatsUnique: screenshots.every((item) => new Set(item.facilityAgents.filter((agent) => agent.destination === "pantry").map((agent) => agent.seatId)).size === 2),
  restroomSeatIsToilet: screenshots.every((item) => item.facilityAgents.filter((agent) => agent.destination === "restroom").every((agent) => agent.seatId === "restroomToilet")),
  allFacilityAgentsHaveOcclusionBbox: screenshots.every((item) => item.facilityAgents.every((agent) => Boolean(agent.occlusionBbox))),
  allFacilityAgentsHaveSeatDeltaMetrics: screenshots.every((item) => item.facilityAgents.every((agent) => Boolean(agent.seatCushionAnchor && agent.screenSeatCushion && agent.agentHipScreen && agent.seatDeltaPx))),
  pantrySeatDeltasWithin4Px: screenshots.every((item) => item.facilityAgents.filter((agent) => agent.destination === "pantry").every((agent) => agent.seatDeltaPx?.distance <= 4)),
  pantryOcclusionStartsBelowSeatCushion: screenshots.every((item) => item.facilityAgents.filter((agent) => agent.destination === "pantry").every((agent) => agent.occlusionBbox.y >= agent.screenSeatCushion.y + 4)),
  restroomFacingIsFrontCamera: screenshots.every((item) => item.facilityAgents.filter((agent) => agent.destination === "restroom").every((agent) => agent.facingLabel === "frontCamera")),
  restroomSeatDeltasWithin4Px: screenshots.every((item) => item.facilityAgents.filter((agent) => agent.destination === "restroom").every((agent) => agent.seatDeltaPx?.distance <= 4)),
  restroomOcclusionStartsBelowSeatCushion: screenshots.every((item) => item.facilityAgents.filter((agent) => agent.destination === "restroom").every((agent) => agent.occlusionBbox.y >= agent.screenSeatCushion.y + 24)),
  maxPantrySeatDeltaPx: Math.max(...screenshots.flatMap((item) => item.facilityAgents.filter((agent) => agent.destination === "pantry").map((agent) => agent.seatDeltaPx?.distance ?? Number.POSITIVE_INFINITY))),
  minPantryOcclusionClearancePx: Math.min(...screenshots.flatMap((item) => item.facilityAgents.filter((agent) => agent.destination === "pantry").map((agent) => agent.occlusionBbox.y - agent.screenSeatCushion.y))),
  restroomSeatDeltaPx: Math.max(...screenshots.flatMap((item) => item.facilityAgents.filter((agent) => agent.destination === "restroom").map((agent) => agent.seatDeltaPx?.distance ?? Number.POSITIVE_INFINITY))),
  restroomOcclusionClearancePx: Math.min(...screenshots.flatMap((item) => item.facilityAgents.filter((agent) => agent.destination === "restroom").map((agent) => agent.occlusionBbox.y - agent.screenSeatCushion.y))),
  maxRestroomSeatDeltaPx: Math.max(...screenshots.flatMap((item) => item.facilityAgents.filter((agent) => agent.destination === "restroom").map((agent) => agent.seatDeltaPx?.distance ?? Number.POSITIVE_INFINITY))),
  minRestroomOcclusionClearancePx: Math.min(...screenshots.flatMap((item) => item.facilityAgents.filter((agent) => agent.destination === "restroom").map((agent) => agent.occlusionBbox.y - agent.screenSeatCushion.y))),
  facilityAgentCounts: Object.fromEntries(screenshots.map((item) => [item.label, item.facilityAgents.length])),
  agentOnlyAssetCount: agentOnlyAssets.assets.length,
  allAgentOnlyAssetsRgba: agentOnlyAssets.assets.every((asset) => asset.colorTypeName === "RGBA"),
  allAgentOnlyAssetsHaveAlphaBbox: agentOnlyAssets.assets.every((asset) => Boolean(asset.alphaBbox)),
  allAgentOnlyAssetsHaveAnchors: agentOnlyAssets.assets.every((asset) => asset.hipAnchors?.length === 8),
  allAgentOnlyAssetsMarkedAgentOnly: agentOnlyAssets.assets.every((asset) => asset.agentOnly === true && asset.includesSeatOrFurniture === false),
  pantryUsesOriginalCounterFridgeLayer: screenshots.every((item) =>
    Boolean(item.facilitySource.pantryCounterFridge && item.facilityScreen.pantryCounterFridge)
  ),
  pantryCountertopWidthAtLeastTwoWorkstationDesktops: screenshots.every((item) =>
    item.facilitySource.pantryCountertopSurface.width >= item.facilitySource.workstationDesktopSurface.width * 2
  ),
  pantryCountertopDepthMatchesWorkstationDesktop: screenshots.every((item) =>
    Math.abs(item.facilitySource.pantryCountertopSurface.depth - item.facilitySource.workstationDesktopSurface.depth) <= 0.01
  ),
  pantryCountertopMeasuredInsideOriginalCounterFridgeLayer: screenshots.every((item) =>
    item.facilitySource.pantryCountertopSurface.width <= item.facilitySource.pantryCounterFridge.width
  ),
  restroomSourceMatchesApprovedBPosition: screenshots.every((item) =>
    item.facilitySource.restroom.x === 55 &&
      item.facilitySource.restroom.y === 820 &&
      item.facilitySource.restroom.width === 132
  ),
  restroomPrivacyUsesRestoredScaledRect: screenshots.every((item) =>
    item.facilitySource.restroomPrivacy.x === -25 &&
      item.facilitySource.restroomPrivacy.y === 716 &&
      item.facilitySource.restroomPrivacy.width === 300
  ),
  restroomPrivacyWiderThanToiletLayer: screenshots.every((item) =>
    item.facilitySource.restroomPrivacy.width > item.facilitySource.restroom.width
  ),
  restroomScreenDoesNotOverlapPantryTableChairs: screenshots.every((item) =>
    !rectsOverlap(item.facilityScreen.restroom, item.facilityScreen.pantryTableChairs)
  ),
  restroomPrivacyAlphaInsideCanvas: screenshots.every((item) => {
    const bbox = projectPrivacyAlphaBbox(item.facilitySource.restroomPrivacy);
    return bbox.x >= 0 && bbox.y >= 0 && bbox.x + bbox.width <= 1536 && bbox.y + bbox.height <= 1024;
  }),
  restroomPrivacyAlphaTouchesPantryEdgeAfterScaleUp: screenshots.every((item) =>
    rectsOverlap(projectPrivacyAlphaBbox(item.facilitySource.restroomPrivacy), pantryTableSourceBbox(item.facilitySource.pantryTableChairs))
  ),
  restroomPantryTableHorizontalGapAtLeast20SourcePx: screenshots.every((item) =>
    horizontalGap(item.facilitySource.restroom, item.facilitySource.pantryTableChairs) >= 20
  ),
  pantryTopSourceY: screenshots[0].facilitySource.pantry.y
};

const failedChecks = Object.entries(checks)
  .filter(([, value]) => typeof value === "boolean" && !value)
  .map(([key]) => key);
if (failedChecks.length > 0) {
  throw new Error(`Facility browser QA failed: ${failedChecks.join(", ")}`);
}

writeFileSync(summaryPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  url,
  checks,
  screenshots,
  agentOnlyAssets: agentOnlyAssets.assets
}, null, 2));

console.log(JSON.stringify({
  summaryPath,
  checks,
  agents1080p: screenshots[0].facilityAgents.map((agent) => ({
    agentId: agent.agentId,
    seatId: agent.seatId,
    facingLabel: agent.facingLabel,
    actionKey: agent.actionKey,
    holdDurationMs: agent.holdDurationMs,
    seatDeltaPx: agent.seatDeltaPx,
    fallback: agent.fallback
  }))
}, null, 2));

async function captureViewport(viewport) {
  const port = 32000 + Math.floor(Math.random() * 10000);
  const profile = `${tmpdir()}/codex-animation-chrome-facility-qa-${viewport.label}-${Date.now()}`;
  removePathWithRetries(profile);
  const chrome = spawn(chromePath, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    `--window-size=${viewport.width},${viewport.height}`,
    "about:blank"
  ], { stdio: "ignore" });

  try {
    const targets = await waitForJson(`http://127.0.0.1:${port}/json/list`);
    const page = targets.find((target) => target.type === "page") ?? targets[0];
    const cdp = await createCdp(page.webSocketDebuggerUrl);
    try {
      await cdp.send("Page.enable");
      await cdp.send("Runtime.enable");
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 1,
        mobile: false
      });
      await cdp.send("Page.navigate", { url });
      const metrics = await waitForFacilityMetrics(cdp, viewport.label);
      writeFileSync(viewport.out, await captureCanvasScreenshot(cdp));
      return { viewport, metrics };
    } finally {
      cdp.close();
    }
  } finally {
    await terminateProcess(chrome);
    await removePathBestEffort(profile);
  }
}

async function waitForFacilityMetrics(cdp, label) {
  let metrics;
  const started = Date.now();
  while (Date.now() - started < 30000) {
    const result = await cdp.send("Runtime.evaluate", {
      expression: `(() => {
        const metrics = window.__codexAnimationLayoutDebug || null;
        const agents = metrics?.agents || [];
        return {
          ready: agents.length === 3 && agents.every(agent =>
            agent.seatId &&
            agent.actionKey &&
            agent.occlusionBbox &&
            agent.seatDeltaPx &&
            agent.fallback === false
          ),
          metrics
        };
      })()`,
      returnByValue: true
    });
    metrics = result.result?.value?.metrics ?? metrics;
    if (result.result?.value?.ready) {
      return metrics;
    }
    await sleep(250);
  }
  throw new Error(`Facility metrics not ready for ${label}: ${JSON.stringify(metrics?.agents ?? [])}`);
}

async function waitForJson(url, timeoutMs = 10000) {
  const started = Date.now();
  let lastError;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return await response.json();
      }
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(100);
  }
  throw lastError ?? new Error(`Timed out waiting for ${url}`);
}

function createCdp(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener("message", async (event) => {
    const text = typeof event.data === "string" ? event.data : Buffer.from(await event.data.arrayBuffer()).toString("utf8");
    const msg = JSON.parse(text);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    }
  });
  return new Promise((resolve, reject) => {
    ws.addEventListener("open", () => resolve({
      send(method, params = {}) {
        const id = nextId++;
        ws.send(JSON.stringify({ id, method, params }));
        return withTimeout(new Promise((res, rej) => pending.set(id, { resolve: res, reject: rej })), method, 45000);
      },
      close() {
        ws.close();
      }
    }));
    ws.addEventListener("error", () => reject(new Error(`WebSocket failed: ${wsUrl}`)));
  });
}

function withTimeout(promise, label, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_resolve, reject) => {
      setTimeout(() => reject(new Error(`Timed out waiting for CDP method: ${label}`)), timeoutMs);
    })
  ]);
}

function pngInfo(path) {
  const bytes = readFileSync(path);
  return {
    path,
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    bitDepth: bytes[24],
    colorType: bytes[25],
    colorTypeName: bytes[25] === 6 ? "RGBA" : bytes[25] === 2 ? "RGB" : `type-${bytes[25]}`,
    sha256: createHash("sha256").update(bytes).digest("hex")
  };
}

async function terminateProcess(processRef) {
  if (processRef.exitCode !== null || processRef.signalCode !== null) {
    return;
  }
  if (process.platform === "win32" && processRef.pid) {
    spawnSync("taskkill", ["/PID", String(processRef.pid), "/T", "/F"], { stdio: "ignore" });
    await sleep(500);
    return;
  }

  const exited = new Promise((resolve) => processRef.once("exit", resolve));
  processRef.kill("SIGTERM");
  await Promise.race([exited, sleep(2000)]);

  if (processRef.exitCode === null && processRef.signalCode === null) {
    processRef.kill("SIGKILL");
    await Promise.race([exited, sleep(1000)]);
  }
}

function removePathWithRetries(path) {
  rmSync(path, {
    recursive: true,
    force: true,
    maxRetries: 8,
    retryDelay: 250
  });
}

async function removePathBestEffort(path) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      removePathWithRetries(path);
      return;
    } catch (error) {
      if (!isRetryableRemoveError(error) || attempt === 11) {
        console.warn(`Warning: could not remove temporary Chrome profile ${path}: ${error.message}`);
        return;
      }
      await sleep(250);
    }
  }
}

function isRetryableRemoveError(error) {
  return ["EPERM", "EBUSY", "ENOTEMPTY"].includes(error?.code);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
