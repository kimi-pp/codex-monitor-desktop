import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const appSource = readFileSync("src/App.tsx", "utf8");
const sharedTypesSource = readFileSync("src/shared/types.ts", "utf8");
const monitorShellSource = readOptional("src/components/MonitorShell.tsx");
const officeRendererSource = readOptional("src/animation/office-renderer.ts");
const stylesSource = readFileSync("src/styles.css", "utf8");
const combined = `${appSource}\n${sharedTypesSource}\n${monitorShellSource}\n${officeRendererSource}\n${stylesSource}`;

for (const className of [
  "app-frame",
  "agent-rail",
  "stage-shell",
  "inspector-drawer",
  "runtime-snapshot",
  "activity-trace",
  "command-search",
  "status-counters",
  "project-switcher",
  "project-popover",
  "project-option-meta",
  "project-count-pill",
  "project-registry-pill",
  "variant-switcher",
  "dev-tools-popover"
]) {
  assert.match(combined, new RegExp(`"${className}"|\\.${className}\\b`), `missing UI contract class: ${className}`);
}

assert.match(monitorShellSource, /data-ui-variant/, "Shell must expose the active UI variant as data-ui-variant");
assert.match(combined, /product/, "Product-system UI variant must be implemented");
assert.match(combined, /liquid/, "Liquid-glass UI variant must be implemented");
assert.match(
  stylesSource,
  /\.app-shell\[data-ui-variant="liquid"\]\s+\.glass-tool[\s\S]*?border-color:\s*transparent/,
  "Liquid variant controls must be frameless by default"
);
assert.match(
  stylesSource,
  /\.app-shell\[data-ui-variant="liquid"\]\s+\.status-counters[\s\S]*?background:\s*transparent/,
  "Liquid variant status controls must not sit in a boxed segmented container"
);
assert.match(
  stylesSource,
  /\.app-shell\[data-ui-variant="liquid"\]\s+\.rail-agent\.selected::before/,
  "Liquid variant rail selection must use a light strip instead of card boxing"
);
assert.match(
  stylesSource,
  /\.app-shell\[data-ui-variant="liquid"\]\s+\.task-glass,[\s\S]*?\.progress-glass[\s\S]*?background:\s*transparent/,
  "Liquid variant drawer sections must use dividers rather than nested cards"
);
assert.match(
  stylesSource,
  /--liquid-console-surface:/,
  "Liquid variant must define one shared console surface token"
);
assert.match(
  stylesSource,
  /\.app-shell\[data-ui-variant="liquid"\]\s+\.app-frame\s*\{[^}]*background:[^}]*var\(--liquid-console-surface\)/,
  "Liquid app frame must provide the shared console surface"
);
assert.match(
  stylesSource,
  /\.app-shell\[data-ui-variant="liquid"\]\s+\.console-grid\s*\{[^}]*gap:\s*0;/,
  "Liquid console grid must remove panel gaps for a continuous surface"
);
assert.match(
  stylesSource,
  /\.app-shell\[data-ui-variant="liquid"\]\s+\.system-bar,[\s\S]*?\.inspector-drawer\s*\{[^}]*border-color:\s*transparent;[^}]*background:\s*transparent;[^}]*box-shadow:\s*none;/,
  "Liquid primary regions must be transparent outer regions instead of four bordered cards"
);
assert.match(
  stylesSource,
  /\.app-shell\[data-ui-variant="liquid"\]\s+\.system-bar\s*\{[^}]*border-bottom:\s*1px solid var\(--liquid-region-divider\);/,
  "Liquid top bar must separate with an internal divider rather than an external card border"
);
assert.match(
  stylesSource,
  /\.app-shell\[data-ui-variant="liquid"\]\s+\.agent-rail\s*\{[^}]*border-right:\s*1px solid var\(--liquid-region-divider\);/,
  "Liquid rail must use an internal divider for continuity"
);
assert.match(
  stylesSource,
  /\.app-shell\[data-ui-variant="liquid"\]\s+\.inspector-drawer\s*\{[^}]*border-left:\s*1px solid var\(--liquid-region-divider\);/,
  "Liquid drawer must use an internal divider for continuity"
);
assert.match(
  monitorShellSource,
  /function buildRuntimeSnapshot/,
  "Inspector drawer must derive runtime snapshot rows from existing AgentActivity data"
);
assert.match(
  monitorShellSource,
  /function buildActivityTrace/,
  "Inspector drawer must derive activity trace rows from existing AgentActivity data"
);
assert.match(
  stylesSource,
  /\.runtime-snapshot[\s\S]*?grid-template-columns/,
  "Runtime snapshot must use a compact grid so the lower inspector area is intentionally filled"
);
assert.match(
  stylesSource,
  /\.activity-trace[\s\S]*?grid-template-columns/,
  "Activity trace must use structured rows rather than empty lower drawer space"
);
assert.match(
  stylesSource,
  /--liquid-control-fg:/,
  "Liquid variant must define stable foreground tokens for readable toolbar controls"
);
assert.match(
  stylesSource,
  /--liquid-control-hover:/,
  "Liquid variant must use a non-white hover token for toolbar controls"
);
assert.match(
  stylesSource,
  /\.app-shell\[data-ui-variant="liquid"\]\s+\.status-counter::after,[\s\S]*?box-shadow:\s*none/,
  "Liquid tab indicators must not use cheap glow shadows"
);
assert.match(
  stylesSource,
  /--selection-accent:/,
  "UI shell must define a selection accent token independent of brand/status colors"
);
assert.match(
  stylesSource,
  /--selection-active-bg:/,
  "UI shell must define a selection active background token independent of brand/status colors"
);
assert.match(
  stylesSource,
  /\.app-shell\[data-ui-variant="liquid"\]\s+\.status-counter\.active,[\s\S]*?\.variant-option\.active\s*\{[^}]*background:\s*var\(--selection-active-bg\);/,
  "Liquid active controls must use the selection background token"
);
assert.match(
  stylesSource,
  /\.app-shell\[data-ui-variant="liquid"\]\s+\.status-counter\.active::after\s*\{[^}]*background:\s*var\(--selection-accent\);/,
  "Liquid active status indicators must use the selection accent instead of brand or per-status colors"
);
assert.doesNotMatch(
  stylesSource,
  /\.app-shell\[data-ui-variant="liquid"\]\s+\.status-counter\.active::after\s*\{[^}]*background:\s*var\(--agent-status-color\);/,
  "Liquid active status indicators must not inherit per-status colors"
);
assert.doesNotMatch(
  stylesSource,
  /\.app-shell\[data-ui-variant="liquid"\]\s+\.status-counter\.active::after\s*\{[^}]*background:\s*var\(--accent\);/,
  "Liquid active status indicators must not reuse the brand accent"
);
assert.match(
  stylesSource,
  /\.app-shell\[data-theme="dark"\]\s*\{[\s\S]*?--bg-base:\s*#171717;[\s\S]*?--panel:\s*rgba\(32,\s*32,\s*32,\s*0\.92\);[\s\S]*?--accent:\s*#10a37f;/,
  "Dark theme must use codex-dark graphite panels with Codex green as the restrained accent"
);
assert.match(
  stylesSource,
  /\.app-shell\[data-theme="dark"\]\[data-ui-variant="liquid"\]\s*\{[\s\S]*?--bg-base:\s*#171717;[\s\S]*?--panel:\s*rgba\(33,\s*33,\s*33,\s*0\.56\);[\s\S]*?--liquid-control-fg:\s*#ececf1;[\s\S]*?--accent:\s*#10a37f;/,
  "Liquid dark variant must inherit the codex-dark graphite palette instead of the old blue-green palette"
);
assert.doesNotMatch(
  stylesSource,
  /#0f1719|#1b2b2e|#64dacb|#82e7f2|rgba\(130,\s*231,\s*242|rgba\(118,\s*224,\s*238/,
  "Old teal/cyan dark-mode tokens must not remain in the shell palette"
);
assert.match(
  officeRendererSource,
  /backgroundAlpha:\s*0/,
  "Office renderer canvas must be transparent so the stage bleed can fill letterbox areas"
);
assert.match(
  officeRendererSource,
  /drawStageMatte\(backdrop,\s*width,\s*height\)/,
  "Office renderer must draw the top/bottom stage matte inside Pixi instead of relying only on CSS behind the canvas"
);
assert.match(
  officeRendererSource,
  /function drawStageMatte/,
  "Office renderer must include a Pixi stage matte implementation"
);
assert.match(
  officeRendererSource,
  /Math\.min\(width \/ OFFICE_BACKGROUND_SOURCE\.width,\s*height \/ OFFICE_BACKGROUND_SOURCE\.height\)/,
  "Office renderer background layout must use contain scaling so the full office scene remains visible"
);
assert.doesNotMatch(
  officeRendererSource,
  /Math\.max\(width \/ OFFICE_BACKGROUND_SOURCE\.width,\s*height \/ OFFICE_BACKGROUND_SOURCE\.height\)/,
  "Office renderer background layout must not crop the scene with cover scaling"
);
assert.match(
  stylesSource,
  /\.stage-shell[\s\S]*office-background-2d-v1\.png/,
  "Stage shell must provide an office-background bleed behind the Pixi canvas"
);
assert.match(
  stylesSource,
  /--stage-matte-tint:/,
  "Stage shell must define a matte tint for intentional top/bottom extension areas"
);
assert.match(
  stylesSource,
  /\.stage-shell::after[\s\S]*office-background-2d-v1\.png/,
  "Stage shell must render an intentional matte extension layer behind the full scene"
);
assert.match(monitorShellSource, /import\.meta\.env\.DEV/, "Debug tools must be guarded by import.meta.env.DEV");
assert.doesNotMatch(monitorShellSource, /className="side-panel"/, "old side-panel structure should not remain");
assert.doesNotMatch(monitorShellSource, /className="agent-list"/, "old agent-list structure should not remain");
assert.match(appSource, /MonitorShell/, "App should delegate panel rendering to MonitorShell");
assert.match(appSource, /PROJECT_SCOPE_STORAGE_KEY/, "App must persist the selected Codex project scope");
assert.match(
  monitorShellSource,
  /function ProjectSwitcher/,
  "MonitorShell must expose a project selector in the system bar"
);
assert.match(
  monitorShellSource,
  /onProjectScopeChange/,
  "Project selector must notify App when the selected project changes"
);
assert.match(
  monitorShellSource,
  /aria-label="Codex project scope"/,
  "Project selector must be accessible as a Codex project scope control"
);
assert.match(
  monitorShellSource,
  /monitorAgentCount/,
  "Project selector must expose the monitored agent count separately from historical thread count"
);
assert.match(
  monitorShellSource,
  /hasResidentRegistry/,
  "Project selector must disclose whether a project has a resident registry"
);
assert.match(
  sharedTypesSource,
  /statusReason/,
  "AgentActivity contract must include a statusReason field for runtime status explainability"
);
assert.match(
  monitorShellSource,
  /statusReason/,
  "Inspector drawer must show statusReason in runtime snapshot"
);
assert.match(
  monitorShellSource,
  /statusFreshnessMs/,
  "Inspector drawer must show status freshness in runtime snapshot"
);

console.log("ui panel contract tests passed");

function readOptional(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}
