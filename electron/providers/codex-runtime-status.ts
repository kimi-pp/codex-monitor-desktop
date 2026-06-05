import fs from "node:fs";
import type { AgentStatus } from "../../src/shared/types";

export const ASSISTANT_COMPLETION_THINKING_GRACE_MS = 30_000;
export const STALE_OFFLINE_MS = 6 * 60 * 60 * 1000;
export const ROLLOUT_TAIL_BYTES = 256 * 1024;

type RuntimeRecord = {
  type?: string;
  payload?: {
    type?: string;
    name?: string;
    role?: string;
    call_id?: string;
    output?: string;
  };
};

export type RolloutRuntimeSignal = {
  itemTypes: string[];
  toolNames: string[];
  hasErrorSignal: boolean;
  latestItemType?: string;
  latestToolName?: string;
  latestRole?: string;
  openToolCallCount: number;
  openBlockingCallCount: number;
  hasBlockedSignal: boolean;
};

export type RuntimeStatusInput = {
  signal: RolloutRuntimeSignal;
  nowMs: number;
  threadUpdatedAtMs: number;
  archived?: boolean;
  title?: string | null;
  preview?: string | null;
};

export type RuntimeStatusResult = {
  status: AgentStatus;
  statusReason: string;
  statusObservedAt: string;
  statusFreshnessMs: number;
};

const signalCache = new Map<string, {
  maxBytes: number;
  mtimeMs: number;
  size: number;
  signal: RolloutRuntimeSignal;
}>();

export function inferRuntimeStatus({
  signal,
  nowMs,
  threadUpdatedAtMs,
  archived = false,
  title,
  preview
}: RuntimeStatusInput): RuntimeStatusResult {
  const statusFreshnessMs = Math.max(0, nowMs - threadUpdatedAtMs);
  const base = {
    statusObservedAt: new Date(nowMs).toISOString(),
    statusFreshnessMs
  };

  if (archived || statusFreshnessMs > STALE_OFFLINE_MS) {
    return {
      ...base,
      status: "offline",
      statusReason: archived ? "thread archived" : "stale Codex state update"
    };
  }

  if (signal.hasBlockedSignal || signal.openBlockingCallCount > 0 || hasBlockedText(title, preview)) {
    return {
      ...base,
      status: "blocked",
      statusReason: signal.openBlockingCallCount > 0
        ? "waiting for user input"
        : signal.hasBlockedSignal
          ? "turn interrupted or blocked"
          : "blocked text signal"
    };
  }

  if (signal.hasErrorSignal) {
    return {
      ...base,
      status: "error",
      statusReason: "latest tool output failed"
    };
  }

  if (signal.openToolCallCount > 0 || isToolStartType(signal.latestItemType)) {
    return {
      ...base,
      status: "working",
      statusReason: signal.latestToolName
        ? `tool call in progress: ${signal.latestToolName}`
        : "tool call in progress"
    };
  }

  if (isThinkingType(signal.latestItemType)) {
    return {
      ...base,
      status: "thinking",
      statusReason: "active reasoning stream"
    };
  }

  if (isAssistantCompletionType(signal.latestItemType)) {
    if (statusFreshnessMs <= ASSISTANT_COMPLETION_THINKING_GRACE_MS) {
      return {
        ...base,
        status: "thinking",
        statusReason: "recent assistant completion grace"
      };
    }

    return {
      ...base,
      status: "idle",
      statusReason: "waiting after task complete"
    };
  }

  return {
    ...base,
    status: "idle",
    statusReason: "no active Codex event"
  };
}

export function readRolloutRuntimeSignal(
  rolloutPath: string | null,
  maxBytes = ROLLOUT_TAIL_BYTES
): RolloutRuntimeSignal {
  if (!rolloutPath) {
    return emptyRuntimeSignal();
  }

  try {
    const stat = fs.statSync(rolloutPath);
    const cached = signalCache.get(rolloutPath);
    if (cached && cached.maxBytes === maxBytes && cached.size === stat.size && cached.mtimeMs === stat.mtimeMs) {
      return cached.signal;
    }

    const signal = readRolloutRuntimeSignalFromContent(readFileTail(rolloutPath, maxBytes));
    signalCache.set(rolloutPath, {
      maxBytes,
      mtimeMs: stat.mtimeMs,
      size: stat.size,
      signal
    });
    return signal;
  } catch {
    return emptyRuntimeSignal();
  }
}

export function readRolloutRuntimeSignalFromContent(content: string): RolloutRuntimeSignal {
  const itemTypes: string[] = [];
  const toolNames: string[] = [];
  const openToolCallIds = new Set<string>();
  const openBlockingCallIds = new Set<string>();
  let noIdToolDepth = 0;
  let hasErrorSignal = false;
  let hasBlockedSignal = false;
  let latestItemType: string | undefined;
  let latestToolName: string | undefined;
  let latestRole: string | undefined;

  for (const line of content.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine.startsWith("{")) {
      continue;
    }

    let record: RuntimeRecord;
    try {
      record = JSON.parse(trimmedLine) as RuntimeRecord;
    } catch {
      continue;
    }

    const payload = record.payload;
    if (!payload?.type) {
      continue;
    }

    const payloadType = payload.type;
    itemTypes.push(payloadType);
    latestItemType = payloadType;
    latestRole = payload.role;

    if (payload.name) {
      latestToolName = payload.name;
    }
    if (isToolStartType(payloadType) && payload.name) {
      toolNames.push(payload.name);
    }

    if (isBlockingTool(payload)) {
      if (payload.call_id) {
        openBlockingCallIds.add(payload.call_id);
      } else {
        hasBlockedSignal = true;
      }
    } else if (payloadType === "turn_aborted") {
      hasBlockedSignal = true;
    } else if (isProgressAfterBlockedType(payloadType)) {
      hasBlockedSignal = false;
    }

    if (isToolStartType(payloadType)) {
      if (payload.call_id) {
        openToolCallIds.add(payload.call_id);
      } else {
        noIdToolDepth += 1;
      }
    }

    if (isToolEndType(payloadType)) {
      if (payload.call_id) {
        openToolCallIds.delete(payload.call_id);
        openBlockingCallIds.delete(payload.call_id);
      } else {
        noIdToolDepth = Math.max(0, noIdToolDepth - 1);
      }
      hasErrorSignal = isFailedToolOutput(payload.output);
    } else if (isAssistantCompletionPayload(payload)) {
      hasErrorSignal = false;
    }
  }

  return {
    itemTypes: itemTypes.slice(-12),
    toolNames: unique(toolNames).slice(-8),
    hasErrorSignal,
    latestItemType,
    latestToolName,
    latestRole,
    openToolCallCount: openToolCallIds.size + noIdToolDepth,
    openBlockingCallCount: openBlockingCallIds.size,
    hasBlockedSignal
  };
}

function readFileTail(filePath: string, maxBytes: number): string {
  const stat = fs.statSync(filePath);
  const start = Math.max(0, stat.size - maxBytes);
  const length = stat.size - start;
  const buffer = Buffer.alloc(length);
  const fd = fs.openSync(filePath, "r");
  try {
    fs.readSync(fd, buffer, 0, length, start);
  } finally {
    fs.closeSync(fd);
  }
  return buffer.toString("utf8");
}

function emptyRuntimeSignal(): RolloutRuntimeSignal {
  return {
    itemTypes: [],
    toolNames: [],
    hasErrorSignal: false,
    openToolCallCount: 0,
    openBlockingCallCount: 0,
    hasBlockedSignal: false
  };
}

function isToolStartType(value: string | undefined): boolean {
  return value === "function_call" ||
    value === "custom_tool_call" ||
    value === "web_search_call" ||
    value === "mcp_tool_call" ||
    value === "tool_search_call";
}

function isToolEndType(value: string | undefined): boolean {
  return value === "function_call_output" ||
    value === "custom_tool_call_output" ||
    value === "web_search_end" ||
    value === "mcp_tool_call_end" ||
    value === "tool_search_output" ||
    value === "patch_apply_end";
}

function isThinkingType(value: string | undefined): boolean {
  return value === "reasoning" ||
    value === "token_count" ||
    value === "agent_message" ||
    value === "task_started" ||
    value === "thread_goal_updated";
}

function isAssistantCompletionType(value: string | undefined): boolean {
  return value === "task_complete" || value === "message";
}

function isProgressAfterBlockedType(value: string | undefined): boolean {
  return isToolStartType(value) ||
    isToolEndType(value) ||
    isThinkingType(value) ||
    isAssistantCompletionType(value) ||
    value === "user_message";
}

function isAssistantCompletionPayload(payload: RuntimeRecord["payload"]): boolean {
  return payload?.type === "task_complete" || (payload?.type === "message" && payload.role === "assistant");
}

function isBlockingTool(payload: RuntimeRecord["payload"]): boolean {
  return payload?.type === "function_call" && /request_user_input|approval/i.test(payload.name ?? "");
}

function isFailedToolOutput(output: string | undefined): boolean {
  return /exit code:\s*[1-9]|error|failed|exception/i.test(output ?? "");
}

function hasBlockedText(title: string | null | undefined, preview: string | null | undefined): boolean {
  return /\bblocked\b|waiting for approval|waiting on approval/i.test(`${title ?? ""}\n${preview ?? ""}`);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
