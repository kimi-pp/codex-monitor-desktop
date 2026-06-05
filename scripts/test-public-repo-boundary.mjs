import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const packageLock = JSON.parse(readFileSync("package-lock.json", "utf8"));
const gitignore = readFileSync(".gitignore", "utf8");
const readme = readFileSync("README.md", "utf8");
const license = readFileSync("LICENSE", "utf8");
const ci = readFileSync(".github/workflows/ci.yml", "utf8");

assert.equal(packageJson.name, "codex-monitor-desktop");
assert.equal(packageJson.license, "MIT");
assert.equal(packageJson.repository.url, "git+https://github.com/kimi-pp/codex-monitor-desktop.git");
assert.equal(packageJson.build.productName, "Codex Monitor Desktop");
assert.equal(packageJson.build.appId, "com.codex.monitor.desktop");
assert.equal(packageLock.name, "codex-monitor-desktop");
assert.equal(packageLock.packages[""].name, "codex-monitor-desktop");

for (const pattern of [
  "release/",
  "artifacts/",
  "tmp/",
  ".superpowers/",
  ".codex/",
  "agents/",
  "node_modules/",
  "dist/",
  "dist-electron/",
  ".env.*",
  "Agent.md",
  "NEXT_THREAD_HANDOFF.md",
  "docs/subagent-registry.md",
  "docs/superpowers/",
  "public/assets/generated/screen-animation-review/"
]) {
  assert.match(gitignore, new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${pattern} must be ignored`);
}

assert.match(readme, /Codex Monitor Desktop/);
assert.doesNotMatch(readme, /first version uses a mock status provider/i);
assert.match(readme, /Does not read `.codex\/auth\.json`/);
assert.match(readme, /Project selector/);
assert.match(readme, /Six runtime states/);
assert.match(readme, /Node\.js 22 or later/);
assert.match(license, /MIT License/);

for (const command of [
  "npm run test:codex-project-scope",
  "npm run test:codex-resident-agent-registry",
  "npm run test:codex-runtime-status",
  "npm run test:codex-provider-privacy",
  "npm run test:packaged-asset-paths",
  "npm run test:public-repo-boundary",
  "npm run typecheck",
  "npm run build"
]) {
  assert.match(ci, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
}
assert.match(ci, /permissions:\s*\n\s*contents:\s*read/);

assert.ok(existsSync("public/assets/generated"), "runtime generated assets must remain in public/");

const publicFiles = [
  "scripts/test-codex-resident-agent-registry.mjs",
  "README.md",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "docs/RELEASE_WORKFLOW.md"
];
for (const file of publicFiles) {
  const contents = readFileSync(file, "utf8");
  assert.doesNotMatch(contents, /D:\\codex_Animation/, `${file} must not contain local workspace paths`);
  assert.doesNotMatch(contents, /C:\\Users\\34927/, `${file} must not contain local user paths`);
}

console.log("public repository boundary tests passed");
