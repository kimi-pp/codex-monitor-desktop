import type {
  AgentStatus,
  AgentStatusPayload,
  CodexProjectOption
} from "../../src/shared/types";

export type StatusListener = (payload: AgentStatusPayload) => void;

export interface StatusProvider {
  start(): void;
  stop(): void;
  getSnapshot(): AgentStatusPayload;
  subscribe(listener: StatusListener): () => void;
  getProjects(): CodexProjectOption[];
  setProjectScope(projectId: string): AgentStatusPayload;
  setPaused(paused: boolean): void;
  isPaused(): boolean;
  setAgentStatus(agentId: string, status: AgentStatus): AgentStatusPayload;
}
