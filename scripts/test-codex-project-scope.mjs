import assert from "node:assert/strict";

import {
  ALL_ACTIVE_PROJECTS_ID,
  buildCodexProjectOptions,
  selectThreadRowsForProject
} from "../electron/providers/codex-projects.ts";

const now = Date.parse("2026-06-05T12:00:00.000Z");
const currentCwd = "D:\\codex_Animation";
const otherCwd = "D:\\Quant_trading";
const registrySource = "D:\\codex_Animation\\AGENT.md";

const threads = [
  {
    id: "thread-current-parent",
    cwd: "\\\\?\\D:\\codex_Animation",
    title: "Current project parent",
    updatedAtMs: now - 2_000,
    createdAtMs: now - 20_000,
    rolloutPath: "C:\\Users\\34927\\.codex\\sessions\\current.jsonl",
    agentNickname: "Parent"
  },
  {
    id: "thread-current-child",
    cwd: null,
    title: "Current project child",
    updatedAtMs: now - 3_000,
    createdAtMs: now - 19_000,
    rolloutPath: "C:\\Users\\34927\\.codex\\sessions\\child.jsonl",
    agentNickname: "Hubble"
  },
  {
    id: "thread-current-cicero",
    cwd: "\\\\?\\D:\\codex_Animation",
    title: "Current project asset specialist",
    updatedAtMs: now - 4_000,
    createdAtMs: now - 18_000,
    rolloutPath: "C:\\Users\\34927\\.codex\\sessions\\cicero.jsonl",
    agentNickname: "Cicero"
  },
  {
    id: "thread-current-temp-worker",
    cwd: "\\\\?\\D:\\codex_Animation",
    title: "Generate temporary candidates",
    updatedAtMs: now - 5_000,
    createdAtMs: now - 17_000,
    rolloutPath: "C:\\Users\\34927\\.codex\\sessions\\temp-worker.jsonl",
    agentNickname: "Temp Worker",
    agentRole: "worker"
  },
  {
    id: "thread-other-parent",
    cwd: "\\\\?\\D:\\Quant_trading",
    title: "Other project parent",
    updatedAtMs: now - 8_000,
    createdAtMs: now - 25_000,
    rolloutPath: "C:\\Users\\34927\\.codex\\sessions\\other.jsonl",
    agentNickname: "Quant"
  },
  {
    id: "thread-other-child",
    cwd: null,
    title: "Other project historical subagent",
    updatedAtMs: now - 9_000,
    createdAtMs: now - 24_000,
    rolloutPath: "C:\\Users\\34927\\.codex\\sessions\\other-child.jsonl",
    agentNickname: "Quant Helper"
  },
  {
    id: "thread-other-temp-worker",
    cwd: null,
    title: "Other project temporary worker",
    updatedAtMs: now - 10_000,
    createdAtMs: now - 23_000,
    rolloutPath: "C:\\Users\\34927\\.codex\\sessions\\other-temp.jsonl",
    agentNickname: "Quant Worker",
    agentRole: "worker"
  },
  {
    id: "thread-old-parent",
    cwd: "\\\\?\\D:\\old_project",
    title: "Old project parent",
    updatedAtMs: now - 4 * 24 * 60 * 60 * 1000,
    createdAtMs: now - 5 * 24 * 60 * 60 * 1000,
    rolloutPath: "C:\\Users\\34927\\.codex\\sessions\\old.jsonl"
  }
];

const edges = [
  {
    parentThreadId: "thread-current-parent",
    childThreadId: "thread-current-child",
    status: "open"
  },
  {
    parentThreadId: "thread-current-parent",
    childThreadId: "thread-current-cicero",
    status: "open"
  },
  {
    parentThreadId: "thread-current-parent",
    childThreadId: "thread-current-temp-worker",
    status: "closed"
  },
  {
    parentThreadId: "thread-other-parent",
    childThreadId: "thread-other-child",
    status: "open"
  },
  {
    parentThreadId: "thread-other-parent",
    childThreadId: "thread-other-temp-worker",
    status: "open"
  }
];

const residentAgentIdsByWorkspacePath = new Map([
  [currentCwd, new Set(["thread-current-child", "thread-current-cicero"])]
]);

const projects = buildCodexProjectOptions({
  threads,
  edges,
  defaultWorkspacePath: currentCwd,
  residentAgentIdsByWorkspacePath,
  residentRegistrySourceByWorkspacePath: new Map([[currentCwd, registrySource]]),
  nowMs: now
});

assert.equal(projects[0].id, ALL_ACTIVE_PROJECTS_ID, "All Active pseudo project should be first");
assert.equal(projects[0].kind, "all-active");
assert.equal(projects[0].activeThreadCount, 7, "All Active project discovery should count recent historical state rows");
assert.equal(projects[0].monitorAgentCount, 4, "All Active monitor count should use each project's scoped residents");

const currentProject = projects.find((project) => project.path === currentCwd);
assert.ok(currentProject, "current workspace project should be discovered");
assert.equal(currentProject.isDefault, true, "current workspace should be marked default");
assert.equal(currentProject.threadCount, 4, "project discovery should still count workspace state rows");
assert.equal(currentProject.activeThreadCount, 4);
assert.equal(currentProject.monitorAgentCount, 3, "project monitor count should be parent plus resident subagents");
assert.equal(currentProject.hasResidentRegistry, true);
assert.equal(currentProject.registrySource, registrySource);
assert.equal(currentProject.name, "codex_Animation");

const otherProject = projects.find((project) => project.path === otherCwd);
assert.ok(otherProject, "other workspace project should be selectable");
assert.equal(otherProject.threadCount, 3, "project discovery should still surface historical project rows");
assert.equal(otherProject.isDefault, false);
assert.equal(otherProject.monitorAgentCount, 1, "project without resident registry should monitor only latest parent");
assert.equal(otherProject.hasResidentRegistry, false);

const currentRows = selectThreadRowsForProject({
  projectId: currentProject.id,
  projects,
  threads,
  edges,
  residentAgentIdsByWorkspacePath,
  nowMs: now
});
assert.deepEqual(
  currentRows.map((row) => row.id).sort(),
  ["thread-current-child", "thread-current-cicero", "thread-current-parent"],
  "monitor scope should return latest workspace parent plus registered resident agents only"
);

const otherRows = selectThreadRowsForProject({
  projectId: otherProject.id,
  projects,
  threads,
  edges,
  residentAgentIdsByWorkspacePath,
  nowMs: now
});
assert.deepEqual(
  otherRows.map((row) => row.id),
  ["thread-other-parent"],
  "project without resident registry should fall back to latest main session only"
);

const allActiveRows = selectThreadRowsForProject({
  projectId: ALL_ACTIVE_PROJECTS_ID,
  projects,
  threads,
  edges,
  residentAgentIdsByWorkspacePath,
  nowMs: now
});
assert.deepEqual(
  allActiveRows.map((row) => row.id).sort(),
  ["thread-current-child", "thread-current-cicero", "thread-current-parent", "thread-other-parent"],
  "All Active should exclude stale projects and temporary workers"
);

console.log("codex project scope tests passed");
