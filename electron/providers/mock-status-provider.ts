import {
  advanceAgents,
  applyAgentStatus,
  createInitialAgents
} from "../../src/shared/mock-fixtures";
import { ALL_ACTIVE_PROJECTS_ID } from "../../src/shared/project-scope";
import type {
  AgentActivity,
  AgentStatus,
  AgentStatusPayload,
  CodexProjectOption
} from "../../src/shared/types";
import type { StatusListener, StatusProvider } from "./status-provider";

const MOCK_PROJECT_ID = "project:mock-codex-animation";

export class MockStatusProvider implements StatusProvider {
  private agents = createInitialAgents();
  private listeners = new Set<StatusListener>();
  private timer: NodeJS.Timeout | undefined;
  private tick = 0;
  private paused = false;
  private selectedProjectId = MOCK_PROJECT_ID;

  start(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      if (this.paused) {
        return;
      }

      this.tick += 1;
      this.agents = advanceAgents(this.agents, this.tick);
      this.emit();
    }, 1_400);

    this.emit();
  }

  stop(): void {
    if (!this.timer) {
      return;
    }
    clearInterval(this.timer);
    this.timer = undefined;
  }

  getSnapshot(): AgentStatusPayload {
    return {
      agents: structuredClone(this.agents),
      paused: this.paused,
      projectScope: this.getCurrentProject()
    };
  }

  subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  getProjects(): CodexProjectOption[] {
    const now = new Date().toISOString();
    return [
      {
        id: ALL_ACTIVE_PROJECTS_ID,
        kind: "all-active",
        name: "All Active Projects",
        threadCount: this.agents.length,
        activeThreadCount: this.agents.filter((agent) => agent.status !== "offline").length,
        monitorAgentCount: this.agents.length,
        lastUpdated: now,
        selectable: true
      },
      {
        id: MOCK_PROJECT_ID,
        kind: "project",
        name: "codex_Animation",
        path: "D:\\codex_Animation",
        threadCount: this.agents.length,
        activeThreadCount: this.agents.filter((agent) => agent.status !== "offline").length,
        monitorAgentCount: this.agents.length,
        lastUpdated: now,
        isDefault: true,
        selectable: true,
        hasResidentRegistry: true,
        registrySource: "D:\\codex_Animation\\AGENT.md"
      },
      {
        id: "project:mock-quant-trading",
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
        id: "project:mock-taser-codex",
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

  setProjectScope(projectId: string): AgentStatusPayload {
    const project = this.getProjects().find((item) => item.id === projectId && item.selectable);
    this.selectedProjectId = project?.id ?? MOCK_PROJECT_ID;
    this.emit();
    return this.getSnapshot();
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.emit();
  }

  isPaused(): boolean {
    return this.paused;
  }

  setAgentStatus(agentId: string, status: AgentStatus): AgentStatusPayload {
    this.agents = applyAgentStatus(this.agents, agentId, status);
    this.emit();
    return this.getSnapshot();
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private getCurrentProject() {
    const project =
      this.getProjects().find((item) => item.id === this.selectedProjectId) ??
      this.getProjects().find((item) => item.id === MOCK_PROJECT_ID);
    return project
      ? {
          id: project.id,
          kind: project.kind,
          name: project.name,
          path: project.path
        }
      : undefined;
  }
}
