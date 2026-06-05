import type {
  AgentActivity,
  AgentStatus,
  AgentStatusPayload,
  CodexProjectOption,
  CodexProjectScope
} from "../../src/shared/types";
import { ALL_ACTIVE_PROJECTS_ID } from "../../src/shared/project-scope";
import {
  buildCodexProjectOptions,
  normalizeWorkspacePath,
  selectThreadRowsForProject,
  type CodexThreadRow
} from "./codex-projects";
import {
  readResidentAgentRegistryForWorkspace,
  type ResidentAgentRegistry
} from "./codex-resident-agent-registry";
import {
  inferRuntimeStatus,
  readRolloutRuntimeSignal,
  type RolloutRuntimeSignal
} from "./codex-runtime-status";
import { CodexStateStore, type CodexStateSnapshot } from "./codex-state-store";
import type { StatusListener, StatusProvider } from "./status-provider";

const POLL_INTERVAL_MS = 2_000;
const TEXT_LIMIT = 120;

export type CodexReadonlyStatusProviderOptions = {
  defaultWorkspacePath?: string;
  store?: CodexStateStore;
};

export class CodexReadonlyStatusProvider implements StatusProvider {
  private readonly store: CodexStateStore;
  private readonly defaultWorkspacePath?: string;
  private listeners = new Set<StatusListener>();
  private timer: NodeJS.Timeout | undefined;
  private paused = false;
  private projects: CodexProjectOption[] = [];
  private selectedProjectId: string | undefined;
  private payload: AgentStatusPayload = {
    agents: [],
    paused: false
  };

  constructor(options: CodexReadonlyStatusProviderOptions = {}) {
    this.store = options.store ?? new CodexStateStore();
    this.defaultWorkspacePath = options.defaultWorkspacePath;
  }

  start(): void {
    if (this.timer) {
      return;
    }

    this.refresh();
    this.timer = setInterval(() => {
      if (!this.paused) {
        this.refresh();
      }
    }, POLL_INTERVAL_MS);
  }

  stop(): void {
    if (!this.timer) {
      return;
    }
    clearInterval(this.timer);
    this.timer = undefined;
  }

  getSnapshot(): AgentStatusPayload {
    return structuredClone(this.payload);
  }

  subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  getProjects(): CodexProjectOption[] {
    if (this.projects.length === 0) {
      this.refresh();
    }
    return structuredClone(this.projects);
  }

  setProjectScope(projectId: string): AgentStatusPayload {
    this.selectedProjectId = this.resolveProjectId(projectId);
    this.refresh();
    return this.getSnapshot();
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.payload = {
      ...this.payload,
      paused
    };
    this.emit();
  }

  isPaused(): boolean {
    return this.paused;
  }

  setAgentStatus(_agentId: string, _status: AgentStatus): AgentStatusPayload {
    return this.getSnapshot();
  }

  private refresh(): void {
    const snapshot = this.store.loadSnapshot();
    const nowMs = snapshot.loadedAtMs;
    const residentRegistriesByWorkspacePath = this.getResidentRegistriesByWorkspacePath(snapshot.threads);
    const residentAgentIdsByWorkspacePath = buildResidentAgentIdsByWorkspacePath(residentRegistriesByWorkspacePath);
    const residentRegistrySourceByWorkspacePath = buildResidentRegistrySourceByWorkspacePath(
      residentRegistriesByWorkspacePath
    );
    this.projects = buildCodexProjectOptions({
      threads: snapshot.threads,
      edges: snapshot.edges,
      defaultWorkspacePath: this.defaultWorkspacePath,
      residentAgentIdsByWorkspacePath,
      residentRegistrySourceByWorkspacePath,
      nowMs
    });
    this.selectedProjectId = this.resolveProjectId(this.selectedProjectId);

    const selectedRows = selectThreadRowsForProject({
      projectId: this.selectedProjectId,
      projects: this.projects,
      threads: snapshot.threads,
      edges: snapshot.edges,
      residentAgentIdsByWorkspacePath,
      nowMs
    });
    const agents = snapshot.error
      ? [createProviderErrorAgent(snapshot)]
      : selectedRows.map((thread) => createAgentFromThread(thread, nowMs));

    this.payload = {
      agents,
      paused: this.paused,
      projectScope: this.getCurrentProjectScope()
    };
    this.emit();
  }

  private resolveProjectId(projectId: string | undefined): string | undefined {
    const requestedProject = this.projects.find((project) => project.id === projectId && project.selectable);
    if (requestedProject) {
      return requestedProject.id;
    }

    return (
      this.projects.find((project) => project.kind === "project" && project.isDefault)?.id ??
      this.projects.find((project) => project.kind === "project" && project.selectable)?.id ??
      this.projects.find((project) => project.id === ALL_ACTIVE_PROJECTS_ID)?.id
    );
  }

  private getCurrentProjectScope(): CodexProjectScope | undefined {
    const project = this.projects.find((item) => item.id === this.selectedProjectId);
    return project
      ? {
          id: project.id,
          kind: project.kind,
          name: project.name,
          path: project.path
        }
      : undefined;
  }

  private getResidentRegistriesByWorkspacePath(threads: CodexThreadRow[]): Map<string, ResidentAgentRegistry> {
    const registriesByWorkspacePath = new Map<string, ResidentAgentRegistry>();

    for (const thread of threads) {
      const workspacePath = normalizeWorkspacePath(thread.cwd);
      if (!workspacePath || registriesByWorkspacePath.has(workspacePath)) {
        continue;
      }

      registriesByWorkspacePath.set(workspacePath, readResidentAgentRegistryForWorkspace(workspacePath));
    }

    return registriesByWorkspacePath;
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}

function buildResidentAgentIdsByWorkspacePath(
  registriesByWorkspacePath: Map<string, ResidentAgentRegistry>
): Map<string, Set<string>> {
  const residentAgentIdsByWorkspacePath = new Map<string, Set<string>>();

  for (const [workspacePath, registry] of registriesByWorkspacePath.entries()) {
    if (registry.ids.size > 0) {
      residentAgentIdsByWorkspacePath.set(workspacePath, registry.ids);
    }
  }

  return residentAgentIdsByWorkspacePath;
}

function buildResidentRegistrySourceByWorkspacePath(
  registriesByWorkspacePath: Map<string, ResidentAgentRegistry>
): Map<string, string | undefined> {
  const residentRegistrySourceByWorkspacePath = new Map<string, string | undefined>();

  for (const [workspacePath, registry] of registriesByWorkspacePath.entries()) {
    if (registry.hasRegistryFile) {
      residentRegistrySourceByWorkspacePath.set(workspacePath, registry.sourcePath);
    }
  }

  return residentRegistrySourceByWorkspacePath;
}

function createAgentFromThread(thread: CodexThreadRow, nowMs: number): AgentActivity {
  const signal = readRolloutRuntimeSignal(thread.rolloutPath);
  const ageMs = Math.max(0, nowMs - thread.updatedAtMs);
  const runtimeStatus = inferRuntimeStatus({
    signal,
    nowMs,
    threadUpdatedAtMs: thread.updatedAtMs,
    archived: thread.archived,
    title: thread.title,
    preview: thread.preview
  });
  const toolSummary = signal.toolNames.length > 0
    ? `Recent tools: ${signal.toolNames.slice(0, 3).join(", ")}`
    : "Recent tools: none recorded";

  return {
    id: thread.id,
    name: sanitizeShortText(thread.agentNickname ?? thread.agentRole ?? `Agent ${thread.id.slice(0, 8)}`, 24),
    status: runtimeStatus.status,
    statusReason: runtimeStatus.statusReason,
    statusObservedAt: runtimeStatus.statusObservedAt,
    statusFreshnessMs: runtimeStatus.statusFreshnessMs,
    taskTitle: buildSafeTaskTitle(thread),
    taskDetail: `${formatAge(ageMs)} since last Codex state update.`,
    screenMode: screenModeForSignal(signal),
    screenLines: [
      toolSummary,
      `Signal: ${signal.latestItemType ?? "thread state"}`,
      `Thread: ${thread.id.slice(0, 8)}`
    ].map((line) => sanitizeShortText(line, TEXT_LIMIT)),
    progress: progressForStatus(runtimeStatus.status),
    lastUpdated: new Date(thread.updatedAtMs || nowMs).toISOString()
  };
}

function createProviderErrorAgent(snapshot: CodexStateSnapshot): AgentActivity {
  const now = new Date(snapshot.loadedAtMs).toISOString();
  return {
    id: "codex-provider",
    name: "Codex Provider",
    status: "error",
    statusReason: "provider state read failed",
    statusObservedAt: now,
    statusFreshnessMs: 0,
    taskTitle: "Local Codex state unavailable",
    taskDetail: sanitizeShortText(snapshot.error ?? "Unable to read local Codex state", TEXT_LIMIT),
    screenMode: "summary",
    screenLines: [
      "Read-only provider could not load state_5.sqlite.",
      "No auth or secret files were read.",
      snapshot.sourcePath ? `State file: ${sanitizePath(snapshot.sourcePath)}` : "State file: unavailable"
    ],
    progress: 0,
    lastUpdated: now
  };
}

function buildSafeTaskTitle(thread: CodexThreadRow): string {
  const label = thread.agentNickname ?? thread.agentRole;
  return label ? `${sanitizeShortText(label, 32)} Codex session` : `Codex session ${thread.id.slice(0, 8)}`;
}

function screenModeForSignal(signal: RolloutRuntimeSignal): AgentActivity["screenMode"] {
  if (signal.toolNames.some((toolName) => /browser|chrome|playwright|js/.test(toolName))) {
    return "browser";
  }
  if (signal.toolNames.some((toolName) => /apply_patch|codegraph/.test(toolName))) {
    return "code";
  }
  if (signal.toolNames.length > 0) {
    return "terminal";
  }
  return "summary";
}

function progressForStatus(status: AgentStatus): number {
  switch (status) {
    case "working":
      return 64;
    case "thinking":
      return 38;
    case "blocked":
      return 18;
    case "error":
      return 0;
    case "offline":
      return 0;
    case "idle":
      return 12;
  }
}

function sanitizeShortText(value: string, limit: number): string {
  const redacted = value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/(api[_-]?key|token|cookie|secret|password)\s*[:=]\s*\S+/gi, "$1=[redacted]")
    .replace(/[A-Za-z0-9+/]{80,}={0,2}/g, "[redacted-blob]")
    .replace(/\s+/g, " ")
    .trim();
  return redacted.length > limit ? `${redacted.slice(0, limit - 1)}...` : redacted;
}

function sanitizePath(value: string): string {
  return value.replace(/^\\\\\?\\/, "");
}

function formatAge(ageMs: number): string {
  const seconds = Math.floor(ageMs / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}
