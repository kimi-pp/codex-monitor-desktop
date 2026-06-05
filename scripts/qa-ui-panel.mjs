import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

const root = "D:/codex_Animation";
const chromePath = "C:/Users/34927/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe";
const artifactsDir = `${root}/artifacts`;
const baseUrl = process.env.UI_QA_BASE_URL ?? "http://127.0.0.1:5175/";
const storageKey = "codex-monitor-desktop.themePreference";

const viewports = [
  { label: "1080p", width: 1920, height: 1080 },
  { label: "2k", width: 2560, height: 1440 },
  { label: "4k", width: 3840, height: 2160 },
  { label: "1120w", width: 1120, height: 900 },
  { label: "840w", width: 840, height: 900 }
];
const themes = ["light", "dark"];
const uiVariants = ["product", "liquid"];

if (!existsSync(chromePath)) {
  throw new Error(`Chrome not found: ${chromePath}`);
}

mkdirSync(artifactsDir, { recursive: true });
const results = [];
const browserSession = await startBrowserSession();
try {
  for (const uiVariant of uiVariants) {
    for (const viewport of viewports) {
      for (const theme of themes) {
        console.error(`ui-panel QA ${uiVariant} ${theme} ${viewport.label}`);
        results.push(await captureViewportTheme(browserSession.cdp, viewport, theme, uiVariant));
      }
    }
  }
} finally {
  browserSession.close();
}

const checks = {
  allThemesApplied: results.every((item) => item.metrics.theme === item.theme && item.metrics.storedTheme === item.theme),
  allVariantsApplied: results.every((item) => item.metrics.uiVariant === item.uiVariant),
  allDarkThemesUseCodexGraphite: results.filter((item) => item.theme === "dark").every((item) =>
    item.metrics.shellBgBase === "#171717" &&
    item.metrics.shellAccent === "#10a37f" &&
    (item.metrics.shellPanel === "rgba(32, 32, 32, 0.92)" || item.metrics.shellPanel === "rgba(33, 33, 33, 0.56)")
  ),
  liquidActiveControlsUseSelectionAccent: results.filter((item) => item.uiVariant === "liquid").every((item) =>
    item.metrics.activeTopbarIndicatorColors.length > 0 &&
    item.metrics.activeTopbarIndicatorColors.every((color) => color === item.metrics.shellSelectionAccentRgb)
  ),
  liquidActiveControlsAvoidBrandAccent: results.filter((item) => item.uiVariant === "liquid").every((item) =>
    item.metrics.activeTopbarIndicatorColors.length > 0 &&
    item.metrics.activeTopbarIndicatorColors.every((color) => color !== item.metrics.shellAccentRgb)
  ),
  allHaveCanvas: results.every((item) => item.metrics.hasCanvas),
  allHaveNewLayoutRegions: results.every((item) =>
    item.metrics.hasAppFrame &&
    item.metrics.hasAgentRail &&
    item.metrics.hasStageShell &&
    item.metrics.hasInspectorDrawer &&
    item.metrics.hasVariantSwitcher
  ),
  allHaveInspectorEnrichment: results.every((item) =>
    item.metrics.hasRuntimeSnapshot &&
    item.metrics.hasActivityTrace &&
    item.metrics.activityTraceRows >= 3
  ),
  desktopInspectorLowerAreaFilled: results.filter((item) => item.viewport.width > 920).every((item) =>
    item.metrics.inspectorLowerGapPx <= 28
  ),
  allHaveStageBleedBackdrop: results.every((item) => item.metrics.stageBleedBackdropPresent),
  allHaveStageMatteExtension: results.every((item) => item.metrics.stageMatteExtensionPresent && item.metrics.stageMatteTint.length > 0),
  liquidConsoleUsesContinuousSurface: results.filter((item) => item.uiVariant === "liquid").every((item) =>
    item.metrics.shellLiquidConsoleSurface.length > 0 &&
    item.metrics.consoleGridColumnGap === "0px" &&
    item.metrics.consoleGridRowGap === "0px"
  ),
  liquidPrimaryRegionsAreNotSeparateCards: results.filter((item) => item.uiVariant === "liquid").every((item) =>
    item.metrics.primaryRegionStyles.every((style) =>
      style.backgroundColor === "rgba(0, 0, 0, 0)" &&
      style.boxShadow === "none"
    )
  ),
  liquidPrimaryRegionsKeepInternalDividers: results.filter((item) => item.uiVariant === "liquid").every((item) =>
    item.metrics.primaryRegionStyles.some((style) => style.selector === ".system-bar" && style.borderBottomColor !== "rgba(0, 0, 0, 0)") &&
    item.metrics.primaryRegionStyles.some((style) => style.selector === ".agent-rail" && style.borderRightColor !== "rgba(0, 0, 0, 0)") &&
    item.metrics.primaryRegionStyles.some((style) => style.selector === ".inspector-drawer" && style.borderLeftColor !== "rgba(0, 0, 0, 0)")
  ),
  devToolsClosedByDefault: results.every((item) => item.metrics.devToolsOpen === false && item.metrics.visibleMockButtonsDefault === 0),
  devToolsOpensWithSixControlsInDev: results.every((item) => item.metrics.afterDevToolsOpen.devToolsOpen === true && item.metrics.afterDevToolsOpen.visibleMockButtons === 6),
  commandSearchClosedByDefault: results.every((item) => item.metrics.commandSearchOpen === false),
  commandSearchFiltersToOneVisibleAgent: results.every((item) => item.metrics.afterCommandSearch.visibleRailAgents === 1),
  noHorizontalPageOverflow: results.every((item) => item.metrics.noHorizontalPageOverflow),
  noButtonTextOverflow: results.every((item) => item.metrics.buttonTextOverflow.length === 0),
  desktopRailStageDrawerDoNotOverlap: results.filter((item) => item.viewport.width > 920).every((item) =>
    item.metrics.agentRailRight <= item.metrics.stageLeft && item.metrics.stageRight <= item.metrics.drawerLeft
  ),
  desktopDrawerWidth: results.filter((item) => item.viewport.width > 1240).every((item) => item.metrics.drawerWidth >= 330),
  singleColumnAt840: results.filter((item) => item.viewport.width === 840).every((item) =>
    item.metrics.stageTop > item.metrics.agentRailTop && item.metrics.drawerTop > item.metrics.stageTop
  ),
  liquidTabForegroundContrast: results.filter((item) => item.uiVariant === "liquid").every((item) =>
    item.theme === "light"
      ? item.metrics.topbarControlMaxLuminance < 0.32
      : item.metrics.topbarControlMinLuminance > 0.42
  )
};

const failedChecks = Object.entries(checks)
  .filter(([, value]) => value === false)
  .map(([key]) => key);
const summary = {
  generatedAt: new Date().toISOString(),
  url: baseUrl,
  uiVariants,
  checks,
  failedChecks,
  screenshots: results.map(({ viewport, theme, uiVariant, out, sha256, metrics }) => ({
    viewport: viewport.label,
    width: viewport.width,
    height: viewport.height,
    theme,
    uiVariant,
    path: out,
    sha256,
    dataTheme: metrics.theme,
    dataUiVariant: metrics.uiVariant,
    shellBgBase: metrics.shellBgBase,
    shellPanel: metrics.shellPanel,
    shellAccent: metrics.shellAccent,
    shellAccentRgb: metrics.shellAccentRgb,
    shellSelectionAccent: metrics.shellSelectionAccent,
    shellSelectionAccentRgb: metrics.shellSelectionAccentRgb,
    shellSelectionActiveBg: metrics.shellSelectionActiveBg,
    shellLiquidConsoleSurface: metrics.shellLiquidConsoleSurface,
    consoleGridColumnGap: metrics.consoleGridColumnGap,
    consoleGridRowGap: metrics.consoleGridRowGap,
    primaryRegionStyles: metrics.primaryRegionStyles,
    activeTopbarIndicatorColors: metrics.activeTopbarIndicatorColors,
    agentRailWidth: metrics.agentRailWidth,
    stageWidth: metrics.stageWidth,
    stageHeight: metrics.stageHeight,
    stageContainVerticalBlankPx: metrics.stageContainVerticalBlankPx,
    stageCoverVerticalBlankPx: metrics.stageCoverVerticalBlankPx,
    stageMatteExtensionPresent: metrics.stageMatteExtensionPresent,
    stageMatteTint: metrics.stageMatteTint,
    drawerWidth: metrics.drawerWidth,
    hasRuntimeSnapshot: metrics.hasRuntimeSnapshot,
    hasActivityTrace: metrics.hasActivityTrace,
    activityTraceRows: metrics.activityTraceRows,
    inspectorLowerGapPx: metrics.inspectorLowerGapPx,
    stageBleedBackdropPresent: metrics.stageBleedBackdropPresent,
    devToolsOpen: metrics.devToolsOpen,
    visibleMockButtonsDefault: metrics.visibleMockButtonsDefault,
    devToolsOpenAfterClick: metrics.afterDevToolsOpen.devToolsOpen,
    visibleMockButtonsAfterClick: metrics.afterDevToolsOpen.visibleMockButtons,
    commandSearchVisibleAfterOpen: metrics.afterCommandSearch.commandSearchOpen,
    railAgentsAfterSearch: metrics.afterCommandSearch.visibleRailAgents,
    noHorizontalPageOverflow: metrics.noHorizontalPageOverflow,
    topbarControlMinLuminance: metrics.topbarControlMinLuminance,
    topbarControlMaxLuminance: metrics.topbarControlMaxLuminance
  }))
};

writeFileSync(`${artifactsDir}/ui-panel-qa-summary.json`, JSON.stringify(summary, null, 2));
if (failedChecks.length > 0) {
  throw new Error(`UI panel QA failed: ${failedChecks.join(", ")}`);
}

console.log(JSON.stringify(summary, null, 2));

async function startBrowserSession() {
  const port = 36000 + Math.floor(Math.random() * 10000);
  const profile = `${tmpdir().replaceAll("\\", "/")}/codex-ui-qa-${Date.now()}`;
  rmSync(profile, { recursive: true, force: true });
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
    "--window-size=3840,2160",
    "about:blank"
  ], { stdio: "ignore" });

  const cdp = await connectCdp(await waitForWsUrl(port));
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  return {
    cdp,
    close() {
      try {
        cdp.close();
      } catch {
        // best effort cleanup
      }
      chrome.kill();
      setTimeout(() => rmSync(profile, { recursive: true, force: true }), 1000);
    }
  };
}

async function captureViewportTheme(cdp, viewport, theme, uiVariant) {
  try {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: false
    });
    const qaUrl = buildQaUrl(baseUrl, {
      uiVariant,
      uiQa: `${Date.now()}-${uiVariant}-${viewport.label}-${theme}`
    });
    await cdp.send("Page.navigate", { url: qaUrl });
    await sleep(1200);
    await cdp.send("Runtime.evaluate", {
      expression: `window.localStorage.setItem(${JSON.stringify(storageKey)}, ${JSON.stringify(theme)}); window.location.reload();`,
      returnByValue: true
    });
    await sleep(2000);
    await waitForAgents(cdp);

    const metrics = await evalValue(cdp, collectMetricsExpression());
    await evalValue(cdp, `document.querySelector(".dev-tools-anchor > .glass-tool")?.click()`);
    await sleep(250);
    const afterDevToolsOpen = await evalValue(cdp, `(() => {
      const visibleMockButtons = Array.from(document.querySelectorAll(".mock-button")).filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }).length;
      return {
        devToolsOpen: Boolean(document.querySelector(".dev-tools-popover")),
        visibleMockButtons
      };
    })()`);
    await evalValue(cdp, `document.querySelector(".search-trigger")?.click()`);
    await sleep(250);
    await evalValue(cdp, `(() => {
      const input = document.querySelector(".command-search input");
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      if (input && setter) {
        setter.call(input, "Aurora");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    })()`);
    await sleep(250);
    const afterCommandSearch = await evalValue(cdp, `(() => {
      const visibleRailAgents = Array.from(document.querySelectorAll(".rail-agent")).filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }).length;
      const commandSearchOpen = Boolean(document.querySelector(".command-search"));
      return { commandSearchOpen, visibleRailAgents };
    })()`);
    await evalValue(cdp, `document.querySelector(".command-search .glass-tool")?.click(); document.querySelector(".dev-tools-popover .glass-tool")?.click();`);
    await sleep(150);

    const screenshot = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 86, fromSurface: true });
    const bytes = Buffer.from(screenshot.data, "base64");
    const out = `${artifactsDir}/ui-panel-qa-${uiVariant}-${theme}-${viewport.label}.jpg`;
    writeFileSync(out, bytes);
    return {
      viewport,
      theme,
      uiVariant,
      out,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      metrics: { ...metrics, afterDevToolsOpen, afterCommandSearch }
    };
  } finally {
    await cdp.send("Runtime.evaluate", {
      expression: `window.localStorage.removeItem(${JSON.stringify(storageKey)});`,
      returnByValue: true
    }).catch(() => {});
  }
}

function buildQaUrl(base, params) {
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

async function waitForAgents(cdp) {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const count = await evalValue(cdp, `document.querySelectorAll(".rail-agent").length`);
    if (count > 0) {
      return;
    }
    await sleep(250);
  }
  throw new Error("Timed out waiting for agent rows");
}

function collectMetricsExpression() {
  return `(() => {
    const rectOf = (selector) => {
      const rect = document.querySelector(selector)?.getBoundingClientRect();
      return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height, top: rect.top } : null;
    };
    const parseRgb = (value) => {
      const match = value.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
      return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : [0, 0, 0];
    };
    const luminance = (value) => {
      const [r, g, b] = parseRgb(value).map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.03928
          ? normalized / 12.92
          : Math.pow((normalized + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const normalizeColor = (value) => {
      const trimmed = value.trim();
      const hex = trimmed.match(/^#([\\da-f]{6})$/i);
      if (hex) {
        const numeric = Number.parseInt(hex[1], 16);
        return \`rgb(\${(numeric >> 16) & 255}, \${(numeric >> 8) & 255}, \${numeric & 255})\`;
      }
      const rgb = trimmed.match(/^rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)/);
      return rgb ? \`rgb(\${Number(rgb[1])}, \${Number(rgb[2])}, \${Number(rgb[3])})\` : trimmed;
    };
    const buttonTextOverflow = Array.from(document.querySelectorAll("button")).filter((el) => {
      const style = getComputedStyle(el);
      return style.display !== "none" && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
    }).map((el) => ({
      text: el.textContent?.trim().slice(0, 60),
      className: String(el.className),
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth
    }));
    const agentRail = rectOf(".agent-rail");
    const stage = rectOf(".stage-shell");
    const drawer = rectOf(".inspector-drawer");
    const activityTrace = rectOf(".activity-trace");
    const topbarControlLuminance = Array.from(document.querySelectorAll(".system-bar .status-counter, .system-bar .theme-option, .system-bar .variant-option, .system-bar .glass-tool"))
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .map((el) => luminance(getComputedStyle(el).color));
    const activeTopbarIndicatorColors = Array.from(document.querySelectorAll(".system-bar .status-counter.active, .system-bar .theme-option.active, .system-bar .variant-option.active"))
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      })
      .map((el) => getComputedStyle(el, "::after").backgroundColor);
    const visibleMockButtonsDefault = Array.from(document.querySelectorAll(".mock-button")).filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }).length;
    const officeSource = { width: 1536, height: 1024 };
    const stageContainScale = stage
      ? Math.min(stage.width / officeSource.width, stage.height / officeSource.height)
      : 0;
    const stageCoverScale = stage
      ? Math.max(stage.width / officeSource.width, stage.height / officeSource.height)
      : 0;
    const stageContainVerticalBlankPx = stage
      ? Math.max(0, stage.height - officeSource.height * stageContainScale)
      : 0;
    const stageCoverVerticalBlankPx = stage
      ? Math.max(0, stage.height - officeSource.height * stageCoverScale)
      : 0;
    const shell = document.querySelector(".app-shell");
    const shellStyle = shell ? getComputedStyle(shell) : undefined;
    const consoleGridStyle = getComputedStyle(document.querySelector(".console-grid"));
    const primaryRegionStyles = [".system-bar", ".agent-rail", ".stage-shell", ".inspector-drawer"].map((selector) => {
      const style = getComputedStyle(document.querySelector(selector));
      return {
        selector,
        backgroundColor: style.backgroundColor,
        boxShadow: style.boxShadow,
        borderTopColor: style.borderTopColor,
        borderRightColor: style.borderRightColor,
        borderBottomColor: style.borderBottomColor,
        borderLeftColor: style.borderLeftColor
      };
    });
    const shellAccent = shellStyle?.getPropertyValue("--accent").trim() ?? "";
    const shellSelectionAccent = shellStyle?.getPropertyValue("--selection-accent").trim() ?? "";
    return {
      theme: shell?.getAttribute("data-theme"),
      uiVariant: shell?.getAttribute("data-ui-variant"),
      shellBgBase: shellStyle?.getPropertyValue("--bg-base").trim() ?? "",
      shellPanel: shellStyle?.getPropertyValue("--panel").trim() ?? "",
      shellAccent,
      shellAccentRgb: normalizeColor(shellAccent),
      shellSelectionAccent,
      shellSelectionAccentRgb: normalizeColor(shellSelectionAccent),
      shellSelectionActiveBg: shellStyle?.getPropertyValue("--selection-active-bg").trim() ?? "",
      shellLiquidConsoleSurface: shellStyle?.getPropertyValue("--liquid-console-surface").trim() ?? "",
      consoleGridColumnGap: consoleGridStyle.columnGap,
      consoleGridRowGap: consoleGridStyle.rowGap,
      primaryRegionStyles,
      storedTheme: window.localStorage.getItem(${JSON.stringify(storageKey)}),
      hasAppFrame: Boolean(document.querySelector(".app-frame")),
      hasAgentRail: Boolean(document.querySelector(".agent-rail")),
      hasStageShell: Boolean(document.querySelector(".stage-shell")),
      hasInspectorDrawer: Boolean(document.querySelector(".inspector-drawer")),
      hasVariantSwitcher: Boolean(document.querySelector(".variant-switcher")),
      hasRuntimeSnapshot: Boolean(document.querySelector(".runtime-snapshot")),
      hasActivityTrace: Boolean(document.querySelector(".activity-trace")),
      activityTraceRows: document.querySelectorAll(".activity-trace .trace-row").length,
      inspectorLowerGapPx: drawer && activityTrace ? Math.max(0, drawer.y + drawer.height - (activityTrace.y + activityTrace.height)) : 9999,
      stageBleedBackdropPresent: getComputedStyle(document.querySelector(".stage-shell")).backgroundImage.includes("office-background-2d-v1"),
      stageMatteExtensionPresent: getComputedStyle(document.querySelector(".stage-shell"), "::after").backgroundImage.includes("office-background-2d-v1"),
      stageMatteTint: getComputedStyle(document.querySelector(".stage-shell")).getPropertyValue("--stage-matte-tint").trim(),
      devToolsOpen: Boolean(document.querySelector(".dev-tools-popover")),
      commandSearchOpen: Boolean(document.querySelector(".command-search")),
      hasCanvas: Boolean(document.querySelector("canvas")),
      agentRailWidth: agentRail?.width ?? 0,
      agentRailTop: agentRail?.top ?? 0,
      agentRailRight: agentRail ? agentRail.x + agentRail.width : 0,
      stageWidth: stage?.width ?? 0,
      stageHeight: stage?.height ?? 0,
      stageContainVerticalBlankPx,
      stageCoverVerticalBlankPx,
      stageTop: stage?.top ?? 0,
      stageLeft: stage?.x ?? 0,
      stageRight: stage ? stage.x + stage.width : 0,
      drawerWidth: drawer?.width ?? 0,
      drawerTop: drawer?.top ?? 0,
      drawerLeft: drawer?.x ?? 0,
      visibleMockButtonsDefault,
      noHorizontalPageOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
      topbarControlMinLuminance: topbarControlLuminance.length ? Math.min(...topbarControlLuminance) : 0,
      topbarControlMaxLuminance: topbarControlLuminance.length ? Math.max(...topbarControlLuminance) : 0,
      activeTopbarIndicatorColors,
      buttonTextOverflow
    };
  })()`;
}

async function evalValue(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text ?? "Runtime.evaluate failed");
  }
  return result.result.value;
}

async function waitForWsUrl(port) {
  const deadline = Date.now() + 8000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
        if (page) {
          return page.webSocketDebuggerUrl;
        }
      }
    } catch (error) {
      lastError = error;
    }
    await sleep(150);
  }
  throw lastError ?? new Error("Chrome CDP did not start");
}

function connectCdp(wsUrl) {
  const socket = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const payload = JSON.parse(event.data);
    if (!payload.id) {
      return;
    }
    const entry = pending.get(payload.id);
    if (!entry) {
      return;
    }
    pending.delete(payload.id);
    if (payload.error) {
      entry.reject(new Error(payload.error.message));
    } else {
      entry.resolve(payload.result ?? {});
    }
  });
  return new Promise((resolve, reject) => {
    socket.addEventListener("open", () => {
      resolve({
        send(method, params = {}) {
          const id = nextId;
          nextId += 1;
          socket.send(JSON.stringify({ id, method, params }));
          return new Promise((resolveSend, rejectSend) => {
            const commandTimeoutMs = method === "Page.captureScreenshot" ? 90000 : 15000;
            const timeout = setTimeout(() => {
              pending.delete(id);
              rejectSend(new Error(`CDP command timed out: ${method}`));
            }, commandTimeoutMs);
            pending.set(id, {
              resolve(value) {
                clearTimeout(timeout);
                resolveSend(value);
              },
              reject(error) {
                clearTimeout(timeout);
                rejectSend(error);
              }
            });
          });
        },
        close() {
          socket.close();
        }
      });
    }, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
