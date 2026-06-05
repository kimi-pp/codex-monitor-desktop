import {
  advanceAgents,
  applyAgentStatus,
  createInitialAgents
} from "../shared/mock-fixtures";
import { ALL_ACTIVE_PROJECTS_ID } from "../shared/project-scope";
import { AGENT_STATUSES } from "../shared/status-meta";
import type {
  AgentActivity,
  AgentStatus,
  AgentStatusPayload,
  CodexProjectOption
} from "../shared/types";

const BROWSER_MOCK_PROJECT_ID = "project:browser-mock-codex-animation";

export type AgentClient = {
  getSnapshot(): Promise<AgentStatusPayload>;
  getProjects(): Promise<CodexProjectOption[]>;
  setProjectScope(projectId: string): Promise<AgentStatusPayload>;
  onAgentsUpdate(callback: (payload: AgentStatusPayload) => void): () => void;
  setPaused(paused: boolean): Promise<AgentStatusPayload>;
  setMockStatus(agentId: string, status: AgentStatus): Promise<AgentStatusPayload>;
};

export function createAgentClient(): AgentClient {
  if (window.codexMonitor) {
    return window.codexMonitor;
  }
  return new BrowserMockAgentClient();
}

class BrowserMockAgentClient implements AgentClient {
  private agents: AgentActivity[] = createInitialAgents();
  private listeners = new Set<(payload: AgentStatusPayload) => void>();
  private paused = false;
  private tick = 0;
  private selectedProjectId = BROWSER_MOCK_PROJECT_ID;

  constructor() {
    const debug = readMockDebugOptions(this.agents);
    this.agents = debug.statuses.reduce(
      (agents, item) => applyAgentStatus(agents, item.agentId, item.status),
      this.agents
    );
    this.paused = debug.paused ?? this.paused;

    window.setInterval(() => {
      if (this.paused) {
        return;
      }
      this.tick += 1;
      this.agents = advanceAgents(this.agents, this.tick);
      this.emit();
    }, 1_400);
  }

  async getSnapshot(): Promise<AgentStatusPayload> {
    return this.snapshot();
  }

  async getProjects(): Promise<CodexProjectOption[]> {
    return this.projects();
  }

  async setProjectScope(projectId: string): Promise<AgentStatusPayload> {
    const nextProject = this.projects().find((project) => project.id === projectId && project.selectable);
    this.selectedProjectId = nextProject?.id ?? BROWSER_MOCK_PROJECT_ID;
    this.emit();
    return this.snapshot();
  }

  onAgentsUpdate(callback: (payload: AgentStatusPayload) => void): () => void {
    this.listeners.add(callback);
    callback(this.snapshot());
    return () => this.listeners.delete(callback);
  }

  async setPaused(paused: boolean): Promise<AgentStatusPayload> {
    this.paused = paused;
    this.emit();
    return this.snapshot();
  }

  async setMockStatus(agentId: string, status: AgentStatus): Promise<AgentStatusPayload> {
    this.agents = applyAgentStatus(this.agents, agentId, status);
    this.emit();
    return this.snapshot();
  }

  private snapshot(): AgentStatusPayload {
    const project = this.projects().find((item) => item.id === this.selectedProjectId);
    return {
      agents: structuredClone(this.agents),
      paused: this.paused,
      projectScope: project
        ? {
            id: project.id,
            kind: project.kind,
            name: project.name,
            path: project.path
          }
        : undefined
    };
  }

  private projects(): CodexProjectOption[] {
    const now = new Date().toISOString();
    const activeThreadCount = this.agents.filter((agent) => agent.status !== "offline").length;
    return [
      {
        id: ALL_ACTIVE_PROJECTS_ID,
        kind: "all-active",
        name: "All Active Projects",
        threadCount: this.agents.length,
        activeThreadCount,
        monitorAgentCount: this.agents.length,
        lastUpdated: now,
        selectable: true
      },
      {
        id: BROWSER_MOCK_PROJECT_ID,
        kind: "project",
        name: "codex_Animation",
        path: "D:\\codex_Animation",
        threadCount: this.agents.length,
        activeThreadCount,
        monitorAgentCount: this.agents.length,
        lastUpdated: now,
        isDefault: true,
        selectable: true,
        hasResidentRegistry: true,
        registrySource: "D:\\codex_Animation\\AGENT.md"
      },
      {
        id: "project:browser-mock-quant-trading",
        kind: "project",
        name: "Quant_trading",
        path: "D:\\Quant_trading",
        threadCount: 42,
        activeThreadCount: 2,
        monitorAgentCount: 1,
        lastUpdated: now,
        selectable: true,
        hasResidentRegistry: false,
        registrySource: "D:\\Quant_trading\\docs\\superpowers\\agent-registry.md"
      },
      {
        id: "project:browser-mock-taser-codex",
        kind: "project",
        name: "TASER_CODEX",
        path: "D:\\causal_v3\\TASER_CODEX",
        threadCount: 40,
        activeThreadCount: 1,
        monitorAgentCount: 7,
        lastUpdated: now,
        selectable: true,
        hasResidentRegistry: true,
        registrySource: "D:\\causal_v3\\TASER_CODEX\\project_memory\\AGENT_REGISTRY.md"
      }
    ];
  }

  private emit(): void {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}

type MockDebugOptions = {
  paused?: boolean;
  statuses: Array<{
    agentId: string;
    status: AgentStatus;
  }>;
};

function readMockDebugOptions(agents: AgentActivity[]): MockDebugOptions {
  const params = new URLSearchParams(window.location.search);
  const statuses = [
    ...parseDebugAgents(params.get("debugAgents"), agents),
    ...parseSingleDebugAgent(params, agents)
  ];

  return {
    paused: parseDebugBoolean(params.get("debugPaused")),
    statuses
  };
}

function parseDebugAgents(value: string | null, agents: AgentActivity[]) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [agentRef, statusRef] = item.split(":").map((part) => part.trim());
      const agentId = resolveAgentId(agentRef, agents);
      const status = resolveStatus(statusRef);
      return agentId && status ? { agentId, status } : undefined;
    })
    .filter((item): item is { agentId: string; status: AgentStatus } => Boolean(item));
}

function parseSingleDebugAgent(params: URLSearchParams, agents: AgentActivity[]) {
  const agentId = resolveAgentId(params.get("debugAgent") ?? "", agents);
  const status = resolveStatus(params.get("debugStatus") ?? "");
  return agentId && status ? [{ agentId, status }] : [];
}

function resolveAgentId(value: string, agents: AgentActivity[]) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }

  return agents.find((agent) => (
    agent.id.toLowerCase() === normalized ||
    agent.name.toLowerCase() === normalized ||
    agent.id.toLowerCase().endsWith(`-${normalized}`)
  ))?.id;
}

function resolveStatus(value: string): AgentStatus | undefined {
  const normalized = value.trim().toLowerCase();
  return AGENT_STATUSES.find((status) => status === normalized);
}

function parseDebugBoolean(value: string | null) {
  if (value === null) {
    return undefined;
  }

  return ["1", "true", "yes", "paused"].includes(value.trim().toLowerCase());
}
