import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { captureCanvasScreenshot } from "./lib/canvas-screenshot.mjs";

const root = "D:/codex_Animation";
const chromePath = "C:/Users/34927/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe";
const artifactsDir = `${root}/artifacts`;
const summaryPath = `${artifactsDir}/treadmill-qa-summary.json`;
const baseUrl = process.env.FACILITY_QA_BASE_URL ?? "http://127.0.0.1:5175/";
const query = "debugPaused=1&debugFlatAnchors=1&debugLayoutMetrics=1&debugAgents=Aurora:idle,Binary:idle,Cascade:working,Delta:working,Echo:thinking,Forge:offline&debugIdleBehaviors=Aurora:treadmill,Binary:treadmill";
const url = `${baseUrl}?${query}`;
const viewports = [
  { label: "1080p", width: 1920, height: 1080, out: `${artifactsDir}/treadmill-qa-1080p.png` },
  { label: "2k", width: 2560, height: 1440, out: `${artifactsDir}/treadmill-qa-2k.png` },
  { label: "4k", width: 3840, height: 2160, out: `${artifactsDir}/treadmill-qa-4k.png` }
];

if (!existsSync(chromePath)) {
  throw new Error(`Chrome not found: ${chromePath}`);
}

mkdirSync(artifactsDir, { recursive: true });
const captures = [];
for (const viewport of viewports) {
  captures.push(await captureViewport(viewport));
}

const screenshots = captures.map(({ viewport, metrics }) => ({
  label: viewport.label,
  ...pngInfo(viewport.out),
  treadmillAgents: metrics.agents.filter((agent) => agent.destination === "treadmill"),
  allAgents: metrics.agents,
  facilityScreen: metrics.screen,
  facilitySource: metrics.source
}));

const checks = {
  screenshots: screenshots.map((item) => ({
    label: item.label,
    path: item.path,
    width: item.width,
    height: item.height,
    sha256: item.sha256
  })),
  treadmillCapacityOne: screenshots.every((item) => item.treadmillAgents.length === 1),
  treadmillUsesRunSheet: screenshots.every((item) => item.treadmillAgents.every((agent) => agent.actionKey === "flatAgentTreadmillHorizontalRunSheet")),
  treadmillFacingHorizontalFront: screenshots.every((item) => item.treadmillAgents.every((agent) => agent.facingLabel === "horizontalFront")),
  treadmillUsesFootContactAnchor: screenshots.every((item) => item.treadmillAgents.every((agent) => agent.anchorKind === "footContact")),
  treadmillFallbackFalse: screenshots.every((item) => item.treadmillAgents.every((agent) => agent.fallback === false)),
  treadmillSeatDeltaWithin4Px: screenshots.every((item) => item.treadmillAgents.every((agent) => agent.seatDeltaPx?.distance <= 4)),
  treadmillHasNoBeltFrame: screenshots.every((item) => item.treadmillAgents.every((agent) => agent.beltFrame == null)),
  treadmillOcclusionBboxPresent: screenshots.every((item) => item.treadmillAgents.every((agent) => Boolean(agent.occlusionBbox))),
  maxTreadmillSeatDeltaPx: Math.max(...screenshots.flatMap((item) => item.treadmillAgents.map((agent) => agent.seatDeltaPx?.distance ?? Number.POSITIVE_INFINITY))),
  treadmillAgentCounts: Object.fromEntries(screenshots.map((item) => [item.label, item.treadmillAgents.length]))
};

const failedChecks = Object.entries(checks)
  .filter(([, value]) => typeof value === "boolean" && !value)
  .map(([key]) => key);
if (failedChecks.length > 0) {
  throw new Error(`Treadmill browser QA failed: ${failedChecks.join(", ")}`);
}

writeFileSync(summaryPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  url,
  checks,
  screenshots
}, null, 2));

console.log(JSON.stringify({
  summaryPath,
  checks,
  agents1080p: screenshots[0].treadmillAgents.map((agent) => ({
    agentId: agent.agentId,
    seatId: agent.seatId,
    actionKey: agent.actionKey,
    currentFrame: agent.currentFrame,
    beltFrame: agent.beltFrame,
    seatDeltaPx: agent.seatDeltaPx,
    fallback: agent.fallback
  }))
}, null, 2));

async function captureViewport(viewport) {
  const port = 32000 + Math.floor(Math.random() * 10000);
  const profile = `${tmpdir()}/codex-animation-chrome-treadmill-qa-${viewport.label}-${Date.now()}`;
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
      const metrics = await waitForTreadmillMetrics(cdp, viewport.label);
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

async function waitForTreadmillMetrics(cdp, label) {
  let metrics;
  const started = Date.now();
  while (Date.now() - started < 30000) {
    const result = await cdp.send("Runtime.evaluate", {
      expression: `(() => {
        const metrics = window.__codexAnimationLayoutDebug || null;
        const treadmillAgents = (metrics?.agents || []).filter(agent => agent.destination === "treadmill");
        return {
          ready: treadmillAgents.length === 1 &&
            treadmillAgents.every(agent =>
              agent.seatId === "treadmillBelt" &&
              agent.actionKey === "flatAgentTreadmillHorizontalRunSheet" &&
              agent.facingLabel === "horizontalFront" &&
              agent.anchorKind === "footContact" &&
              agent.beltFrame == null &&
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
  throw new Error(`Treadmill metrics not ready for ${label}: ${JSON.stringify(metrics?.agents ?? [])}`);
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
  rmSync(path, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
}

async function removePathBestEffort(path) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      removePathWithRetries(path);
      return;
    } catch (error) {
      if (!["EPERM", "EBUSY", "ENOTEMPTY"].includes(error?.code) || attempt === 11) {
        console.warn(`Warning: could not remove temporary Chrome profile ${path}: ${error.message}`);
        return;
      }
      await sleep(250);
    }
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
