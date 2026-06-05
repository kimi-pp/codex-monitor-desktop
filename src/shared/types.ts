export type AgentStatus =
  | "working"
  | "idle"
  | "thinking"
  | "blocked"
  | "error"
  | "offline";

export type ScreenMode = "terminal" | "code" | "diff" | "browser" | "summary";

export type AgentActivity = {
  id: string;
  name: string;
  status: AgentStatus;
  statusReason?: string;
  statusObservedAt?: string;
  statusFreshnessMs?: number;
  taskTitle?: string;
  taskDetail?: string;
  screenMode?: ScreenMode;
  screenLines?: string[];
  progress?: number;
  lastUpdated: string;
};

export type CodexProjectScopeKind = "project" | "all-active";

export type CodexProjectScope = {
  id: string;
  kind: CodexProjectScopeKind;
  name: string;
  path?: string;
};

export type CodexProjectOption = CodexProjectScope & {
  threadCount: number;
  activeThreadCount: number;
  monitorAgentCount: number;
  lastUpdated: string;
  isDefault?: boolean;
  selectable: boolean;
  hasResidentRegistry?: boolean;
  registrySource?: string;
};

export type AgentStatusPayload = {
  agents: AgentActivity[];
  paused: boolean;
  projectScope?: CodexProjectScope;
};

export type SetMockStatusRequest = {
  agentId: string;
  status: AgentStatus;
};
