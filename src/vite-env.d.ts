/// <reference types="vite/client" />

import type { AgentStatus, AgentStatusPayload, CodexProjectOption } from "./shared/types";

declare global {
  interface Window {
    codexMonitor?: {
      getSnapshot: () => Promise<AgentStatusPayload>;
      getProjects: () => Promise<CodexProjectOption[]>;
      setProjectScope: (projectId: string) => Promise<AgentStatusPayload>;
      onAgentsUpdate: (callback: (payload: AgentStatusPayload) => void) => () => void;
      setPaused: (paused: boolean) => Promise<AgentStatusPayload>;
      setMockStatus: (agentId: string, status: AgentStatus) => Promise<AgentStatusPayload>;
    };
  }
}

export {};
