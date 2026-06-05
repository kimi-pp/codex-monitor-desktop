import type { AgentActivity, AgentStatus, ScreenMode } from "./types";

const now = () => new Date().toISOString();

const taskPool = [
  {
    title: "Patch renderer state flow",
    detail: "Tracing IPC updates into the React agent store.",
    mode: "code" as ScreenMode
  },
  {
    title: "Run integration checks",
    detail: "Watching build output and retrying failed assertions.",
    mode: "terminal" as ScreenMode
  },
  {
    title: "Inspect UI regression",
    detail: "Comparing layout snapshots across window sizes.",
    mode: "browser" as ScreenMode
  },
  {
    title: "Review pending diff",
    detail: "Scanning changed files for risky state transitions.",
    mode: "diff" as ScreenMode
  },
  {
    title: "Summarize session",
    detail: "Condensing recent tool output into next actions.",
    mode: "summary" as ScreenMode
  }
];

const linePools: Record<ScreenMode, string[]> = {
  terminal: [
    "$ npm run build",
    "vite v6 compiling renderer",
    "tsc checking shared contracts",
    "electron main emitted",
    "bundle size within budget",
    "all checks passed"
  ],
  code: [
    "const status = nextFrame(agent)",
    "if (status === 'working') {",
    "  renderScreen(lines)",
    "}",
    "dispatch({ type: 'agents:update' })",
    "return snapshot"
  ],
  diff: [
    "+ add StatusProvider boundary",
    "+ wire mock IPC channel",
    "- remove static placeholder",
    "+ animate idle posture",
    "+ update summary counters",
    "review complete"
  ],
  browser: [
    "open http://127.0.0.1:5173",
    "measure stage bounds",
    "click agent workstation",
    "assert detail panel updates",
    "capture desktop viewport",
    "visual pass complete"
  ],
  summary: [
    "Agents: 6 tracked",
    "Queue: mock telemetry stream",
    "Risk: adapter not connected",
    "Next: replace provider",
    "State: UI responsive",
    "Ready for packaging"
  ]
};

const idleLines = ["personal screen", "playlist queued", "quick game open", "ready to resume"];
const blockedLines = ["waiting on tool output", "dependency unavailable", "retry scheduled"];
const errorLines = ["process exited 1", "stack trace captured", "needs operator review"];
const offlineLines = ["agent disconnected", "last heartbeat stale", "no active session"];

export function createInitialAgents(): AgentActivity[] {
  return [
    createAgent("agent-aurora", "Aurora", "working", 0),
    createAgent("agent-binary", "Binary", "thinking", 1),
    createAgent("agent-cascade", "Cascade", "idle", 2),
    createAgent("agent-delta", "Delta", "blocked", 3),
    createAgent("agent-echo", "Echo", "working", 4),
    createAgent("agent-forge", "Forge", "offline", 0)
  ];
}

export function advanceAgents(agents: AgentActivity[], tick: number): AgentActivity[] {
  return agents.map((agent, index) => {
    if (agent.status === "offline") {
      return agent;
    }

    const shouldRotate = tick % (5 + index) === 0;
    const nextStatus = shouldRotate ? rotateStatus(agent.status, index, tick) : agent.status;
    const task = taskPool[(tick + index) % taskPool.length];
    const progress = nextStatus === "working" ? ((agent.progress ?? 0) + 9 + index) % 100 : agent.progress;

    return {
      ...agent,
      status: nextStatus,
      taskTitle: getTaskTitle(nextStatus, task.title),
      taskDetail: getTaskDetail(nextStatus, task.detail),
      screenMode: getScreenMode(nextStatus, task.mode),
      screenLines: nextScreenLines(nextStatus, task.mode, tick, index),
      progress,
      lastUpdated: now()
    };
  });
}

export function applyAgentStatus(
  agents: AgentActivity[],
  agentId: string,
  status: AgentStatus
): AgentActivity[] {
  return agents.map((agent, index) => {
    if (agent.id !== agentId) {
      return agent;
    }

    const task = taskPool[index % taskPool.length];
    return {
      ...agent,
      status,
      taskTitle: getTaskTitle(status, task.title),
      taskDetail: getTaskDetail(status, task.detail),
      screenMode: getScreenMode(status, task.mode),
      screenLines: nextScreenLines(status, task.mode, Date.now(), index),
      progress: status === "working" ? agent.progress ?? 12 : agent.progress,
      lastUpdated: now()
    };
  });
}

function createAgent(
  id: string,
  name: string,
  status: AgentStatus,
  taskIndex: number
): AgentActivity {
  const task = taskPool[taskIndex % taskPool.length];
  return {
    id,
    name,
    status,
    taskTitle: getTaskTitle(status, task.title),
    taskDetail: getTaskDetail(status, task.detail),
    screenMode: getScreenMode(status, task.mode),
    screenLines: nextScreenLines(status, task.mode, Date.now(), taskIndex),
    progress: status === "working" ? 36 + taskIndex * 8 : undefined,
    lastUpdated: now()
  };
}

function rotateStatus(status: AgentStatus, index: number, tick: number): AgentStatus {
  if (tick % 17 === 0 && index === 4) {
    return "error";
  }
  if (tick % 13 === 0 && index === 3) {
    return "blocked";
  }

  const flow: AgentStatus[] = ["working", "thinking", "idle", "working"];
  const current = flow.includes(status) ? flow.indexOf(status) : 0;
  return flow[(current + 1 + (index % 2)) % flow.length];
}

function getTaskTitle(status: AgentStatus, fallback: string): string {
  if (status === "idle") {
    return "Waiting for next assignment";
  }
  if (status === "blocked") {
    return "Blocked on external signal";
  }
  if (status === "error") {
    return "Failure needs review";
  }
  if (status === "offline") {
    return "No active Codex session";
  }
  if (status === "thinking") {
    return "Planning next action";
  }
  return fallback;
}

function getTaskDetail(status: AgentStatus, fallback: string): string {
  if (status === "idle") {
    return "Agent is relaxed but ready to resume.";
  }
  if (status === "blocked") {
    return "The current step is waiting for an unavailable dependency.";
  }
  if (status === "error") {
    return "The last simulated command failed and requires attention.";
  }
  if (status === "offline") {
    return "No heartbeat is currently available for this agent.";
  }
  return fallback;
}

function getScreenMode(status: AgentStatus, mode: ScreenMode): ScreenMode {
  if (status === "idle" || status === "offline") {
    return "summary";
  }
  if (status === "blocked" || status === "error") {
    return "terminal";
  }
  return mode;
}

function nextScreenLines(
  status: AgentStatus,
  mode: ScreenMode,
  tick: number,
  offset: number
): string[] {
  if (status === "idle") {
    return rotateLines(idleLines, tick, offset, 4);
  }
  if (status === "blocked") {
    return rotateLines(blockedLines, tick, offset, 4);
  }
  if (status === "error") {
    return rotateLines(errorLines, tick, offset, 4);
  }
  if (status === "offline") {
    return rotateLines(offlineLines, tick, offset, 4);
  }

  return rotateLines(linePools[mode], tick, offset, 5);
}

function rotateLines(lines: string[], tick: number, offset: number, count: number): string[] {
  const start = (Math.floor(tick / 2) + offset) % lines.length;
  return Array.from({ length: count }, (_, index) => lines[(start + index) % lines.length]);
}
