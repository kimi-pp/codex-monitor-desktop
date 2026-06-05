import { contextBridge, ipcRenderer } from "electron";
import type {
  AgentStatus,
  AgentStatusPayload,
  CodexProjectOption,
  SetMockStatusRequest
} from "../src/shared/types";

contextBridge.exposeInMainWorld("codexMonitor", {
  getSnapshot: (): Promise<AgentStatusPayload> => ipcRenderer.invoke("agents:snapshot"),
  getProjects: (): Promise<CodexProjectOption[]> => ipcRenderer.invoke("projects:list"),
  setProjectScope: (projectId: string): Promise<AgentStatusPayload> =>
    ipcRenderer.invoke("projects:setScope", projectId),
  onAgentsUpdate: (callback: (payload: AgentStatusPayload) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: AgentStatusPayload) => {
      callback(payload);
    };
    ipcRenderer.on("agents:update", handler);
    return () => ipcRenderer.removeListener("agents:update", handler);
  },
  setPaused: (paused: boolean): Promise<AgentStatusPayload> =>
    ipcRenderer.invoke("mock:setPaused", paused),
  setMockStatus: (
    agentId: string,
    status: AgentStatus
  ): Promise<AgentStatusPayload> => {
    const request: SetMockStatusRequest = { agentId, status };
    return ipcRenderer.invoke("mock:setAgentStatus", request);
  }
});
