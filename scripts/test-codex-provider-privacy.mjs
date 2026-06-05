import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { CodexReadonlyStatusProvider } = require("../dist-electron/electron/providers/codex-readonly-status-provider.js");

const nowMs = Date.parse("2026-06-06T10:00:00.000Z");

const provider = new CodexReadonlyStatusProvider({
  defaultWorkspacePath: "D:\\codex_Animation",
  store: {
    loadSnapshot() {
      return {
        threads: [
          {
            id: "thread-private-title",
            cwd: "D:\\codex_Animation",
            title: "RAW_USER_PROMPT_SECRET please do private work",
            updatedAtMs: nowMs,
            createdAtMs: nowMs - 1_000,
            archived: false,
            rolloutPath: null,
            agentNickname: "Parent",
            agentRole: null,
            preview: "RAW_PREVIEW_PROMPT_SECRET do not show"
          }
        ],
        edges: [],
        loadedAtMs: nowMs,
        sourcePath: "C:\\Users\\34927\\.codex\\state_5.sqlite"
      };
    }
  }
});

const payload = provider.getSnapshot().agents.length > 0
  ? provider.getSnapshot()
  : provider.setProjectScope("project:d:\\codex_animation");
const agent = payload.agents[0];

assert.ok(agent, "provider should return the fixture agent");
assert.doesNotMatch(agent.taskTitle ?? "", /RAW_USER_PROMPT_SECRET|RAW_PREVIEW_PROMPT_SECRET/);
assert.doesNotMatch(agent.taskDetail ?? "", /RAW_USER_PROMPT_SECRET|RAW_PREVIEW_PROMPT_SECRET/);
assert.doesNotMatch((agent.screenLines ?? []).join("\n"), /RAW_USER_PROMPT_SECRET|RAW_PREVIEW_PROMPT_SECRET/);

console.log("codex provider privacy tests passed");
