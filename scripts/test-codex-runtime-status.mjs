import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  ASSISTANT_COMPLETION_THINKING_GRACE_MS,
  inferRuntimeStatus,
  readRolloutRuntimeSignal,
  readRolloutRuntimeSignalFromContent
} from "../electron/providers/codex-runtime-status.ts";

const nowMs = Date.parse("2026-06-06T10:00:00.000Z");

assert.equal(
  inferStatus([
    responseItem({ type: "function_call", name: "shell_command", call_id: "call-tool" })
  ]).status,
  "working",
  "unpaired function_call should be working"
);

assert.equal(
  inferStatus([
    responseItem({ type: "reasoning" }),
    eventMsg({ type: "token_count" })
  ]).status,
  "thinking",
  "reasoning or token stream should be thinking"
);

assert.equal(
  inferStatus(
    [responseItem({ type: "message", role: "assistant" })],
    { threadUpdatedAtMs: nowMs - ASSISTANT_COMPLETION_THINKING_GRACE_MS + 1 }
  ).status,
  "thinking",
  "recent assistant completion should stay thinking during grace window"
);

assert.equal(
  inferStatus(
    [responseItem({ type: "task_complete" })],
    { threadUpdatedAtMs: nowMs - ASSISTANT_COMPLETION_THINKING_GRACE_MS - 1 }
  ).status,
  "idle",
  "completed assistant turn should become idle after grace window"
);

assert.equal(
  inferStatus([eventMsg({ type: "turn_aborted" })]).status,
  "blocked",
  "turn_aborted should be blocked"
);

assert.equal(
  inferStatus([
    eventMsg({ type: "turn_aborted" }),
    responseItem({ type: "function_call", name: "shell_command", call_id: "call-after-abort" })
  ]).status,
  "working",
  "new tool call after turn_aborted should recover to working"
);

assert.equal(
  inferStatus([responseItem({ type: "function_call", name: "request_user_input", call_id: "call-input" })]).status,
  "blocked",
  "request_user_input should be blocked rather than working"
);

assert.equal(
  inferStatus([
    responseItem({ type: "function_call", name: "request_user_input", call_id: "call-input" }),
    responseItem({ type: "function_call_output", call_id: "call-input", output: "approved" }),
    responseItem({ type: "task_complete" })
  ]).status,
  "thinking",
  "completed request_user_input should recover during completion grace window"
);

assert.equal(
  inferStatus([
    responseItem({ type: "function_call", name: "shell_command", call_id: "call-fail" }),
    responseItem({ type: "function_call_output", call_id: "call-fail", output: "exit code: 1\nfailed" })
  ]).status,
  "error",
  "latest failed tool output should be error"
);

assert.equal(
  inferStatus([
    responseItem({ type: "function_call", name: "shell_command", call_id: "call-fail" }),
    responseItem({ type: "function_call_output", call_id: "call-fail", output: "exit code: 1\nfailed" }),
    responseItem({ type: "message", role: "assistant" })
  ]).status,
  "thinking",
  "assistant message after failed tool output should recover from error during grace window"
);

assert.equal(
  inferStatus([], { archived: true }).status,
  "offline",
  "archived thread should be offline"
);

assert.equal(
  inferStatus([], { threadUpdatedAtMs: nowMs - 6 * 60 * 60 * 1000 - 1 }).status,
  "offline",
  "stale thread should be offline"
);

assert.equal(
  inferStatus([], { preview: "Waiting on blocked approval" }).status,
  "blocked",
  "blocked preview should be blocked"
);

const tempDir = mkdtempSync(path.join(tmpdir(), "codex-runtime-status-"));
try {
  const rolloutPath = path.join(tempDir, "large-rollout.jsonl");
  const largePrefix = `${"x".repeat(2 * 1024 * 1024)}\n`;
  writeFileSync(
    rolloutPath,
    largePrefix + [
      JSON.stringify(responseItem({ type: "function_call", name: "shell_command", call_id: "call-tail" })),
      JSON.stringify(responseItem({ type: "function_call_output", call_id: "call-tail", output: "ok" })),
      JSON.stringify(responseItem({ type: "task_complete" }))
    ].join("\n"),
    "utf8"
  );
  const signal = readRolloutRuntimeSignal(rolloutPath, 64 * 1024);
  assert.equal(signal.latestItemType, "task_complete", "tail reader should parse latest event from large rollout");
  assert.equal(signal.openToolCallCount, 0);
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}

console.log("codex runtime status tests passed");

function inferStatus(records, options = {}) {
  const signal = readRolloutRuntimeSignalFromContent(records.map((record) => JSON.stringify(record)).join("\n"));
  return inferRuntimeStatus({
    signal,
    nowMs,
    threadUpdatedAtMs: options.threadUpdatedAtMs ?? nowMs,
    archived: options.archived ?? false,
    title: options.title ?? "",
    preview: options.preview ?? ""
  });
}

function responseItem(payload) {
  return {
    type: "response_item",
    payload
  };
}

function eventMsg(payload) {
  return {
    type: "event_msg",
    payload
  };
}
