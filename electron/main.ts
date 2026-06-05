import { app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { CodexReadonlyStatusProvider } from "./providers/codex-readonly-status-provider";
import { MockStatusProvider } from "./providers/mock-status-provider";
import type { StatusProvider } from "./providers/status-provider";
import type { AgentStatus, SetMockStatusRequest } from "../src/shared/types";

const statusProvider = createStatusProvider();
let mainWindow: BrowserWindow | undefined;

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: "#f2f4ef",
    title: "Codex Monitor Desktop",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
  } else {
    void mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = undefined;
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();
  statusProvider.start();
  statusProvider.subscribe((payload) => {
    mainWindow?.webContents.send("agents:update", payload);
  });
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  statusProvider.stop();
});

function registerIpcHandlers(): void {
  ipcMain.handle("agents:snapshot", () => statusProvider.getSnapshot());

  ipcMain.handle("projects:list", () => statusProvider.getProjects());

  ipcMain.handle("projects:setScope", (_event, projectId: string) =>
    statusProvider.setProjectScope(projectId)
  );

  ipcMain.handle("mock:setPaused", (_event, paused: boolean) => {
    statusProvider.setPaused(paused);
    return statusProvider.getSnapshot();
  });

  ipcMain.handle("mock:setAgentStatus", (_event, request: SetMockStatusRequest) => {
    statusProvider.setAgentStatus(request.agentId, request.status as AgentStatus);
    return statusProvider.getSnapshot();
  });
}

function createStatusProvider(): StatusProvider {
  if (process.env.CODEX_MONITOR_PROVIDER === "mock") {
    return new MockStatusProvider();
  }

  return new CodexReadonlyStatusProvider({
    defaultWorkspacePath: process.cwd()
  });
}
