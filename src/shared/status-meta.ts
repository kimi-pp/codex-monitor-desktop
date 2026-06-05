import type { AgentStatus } from "./types";

export const AGENT_STATUSES: AgentStatus[] = [
  "working",
  "thinking",
  "blocked",
  "error",
  "idle",
  "offline"
];

export const STATUS_LABELS: Record<AgentStatus, string> = {
  working: "Working",
  thinking: "Thinking",
  blocked: "Blocked",
  error: "Error",
  idle: "Idle",
  offline: "Offline"
};

export const STATUS_COLORS: Record<AgentStatus, string> = {
  working: "#1C9A78",
  thinking: "#3B70C4",
  blocked: "#B88717",
  error: "#C94D3F",
  idle: "#68737A",
  offline: "#2A2F33"
};

export const STATUS_PIXI_COLORS: Record<AgentStatus, number> = {
  working: 0x1c9a78,
  thinking: 0x3b70c4,
  blocked: 0xb88717,
  error: 0xc94d3f,
  idle: 0x68737a,
  offline: 0x2a2f33
};
