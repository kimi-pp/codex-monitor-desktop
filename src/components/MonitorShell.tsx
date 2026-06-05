import { type CSSProperties, type KeyboardEvent, type RefObject, useEffect, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  ChevronDown,
  CirclePause,
  CirclePlay,
  Code2,
  Coffee,
  Command,
  FolderOpen,
  Laptop,
  Monitor,
  Moon,
  Radio,
  RefreshCw,
  Search,
  Settings2,
  Sun,
  WifiOff,
  X
} from "lucide-react";
import { OfficeScene } from "../animation/OfficeScene";
import { AGENT_STATUSES, STATUS_COLORS, STATUS_LABELS } from "../shared/status-meta";
import type {
  AgentActivity,
  AgentStatus,
  CodexProjectOption,
  CodexProjectScope
} from "../shared/types";
import type { ThemePreference } from "../ui-theme";
import type { UiVariant } from "../ui-variant";

const statusIcons: Record<AgentStatus, typeof Monitor> = {
  working: Code2,
  thinking: Bot,
  blocked: AlertTriangle,
  error: AlertTriangle,
  idle: Coffee,
  offline: WifiOff
};

const themeOptions: Array<{ value: ThemePreference; label: string; Icon: typeof Monitor }> = [
  { value: "system", label: "System", Icon: Laptop },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon }
];

const uiVariantOptions: Array<{ value: UiVariant; label: string; Icon: typeof Monitor }> = [
  { value: "product", label: "Product", Icon: Monitor },
  { value: "liquid", label: "Liquid", Icon: Activity }
];

type MonitorShellProps = {
  agents: AgentActivity[];
  visibleAgents: AgentActivity[];
  selectedAgent?: AgentActivity;
  selectedAgentId?: string;
  filter: AgentStatus | "all";
  query: string;
  paused: boolean;
  projects: CodexProjectOption[];
  projectScopeId?: string;
  projectScope?: CodexProjectScope;
  statusCounts: Record<AgentStatus, number>;
  themePreference: ThemePreference;
  effectiveTheme: "light" | "dark";
  uiVariant: UiVariant;
  onFilterChange: (filter: AgentStatus | "all") => void;
  onQueryChange: (query: string) => void;
  onProjectScopeChange: (projectId: string) => void;
  onThemePreferenceChange: (preference: ThemePreference) => void;
  onUiVariantChange: (variant: UiVariant) => void;
  onSelectAgent: (agentId: string) => void;
  onTogglePaused: () => void;
  onSetAgentStatus: (agentId: string, status: AgentStatus) => void;
};

export function MonitorShell({
  agents,
  visibleAgents,
  selectedAgent,
  selectedAgentId,
  filter,
  query,
  paused,
  projects,
  projectScopeId,
  projectScope,
  statusCounts,
  themePreference,
  effectiveTheme,
  uiVariant,
  onFilterChange,
  onQueryChange,
  onProjectScopeChange,
  onThemePreferenceChange,
  onUiVariantChange,
  onSelectAgent,
  onTogglePaused,
  onSetAgentStatus
}: MonitorShellProps) {
  const [isCommandSearchOpen, setIsCommandSearchOpen] = useState(false);
  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);
  const commandInputRef = useRef<HTMLInputElement>(null);
  const isDevBuild = import.meta.env.DEV;

  useEffect(() => {
    if (isCommandSearchOpen) {
      commandInputRef.current?.focus();
    }
  }, [isCommandSearchOpen]);

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsCommandSearchOpen(true);
      }
      if (event.key === "Escape") {
        setIsCommandSearchOpen(false);
        setIsDevToolsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <main className="app-shell" data-theme={effectiveTheme} data-ui-variant={uiVariant}>
      <div className="app-frame">
        <header className="system-bar">
          <div className="brand-mark">
            <img src="./app-icon.svg" alt="" className="app-icon" />
            <div>
              <h1>Codex Monitor Desktop</h1>
              <span>{agents.length} agents observed</span>
            </div>
          </div>

          <StatusCounters
            agentsTotal={agents.length}
            filter={filter}
            statusCounts={statusCounts}
            onFilterChange={onFilterChange}
          />

          <div className="system-actions">
            <ProjectSwitcher
              projects={projects}
              projectScopeId={projectScopeId}
              projectScope={projectScope}
              onProjectScopeChange={onProjectScopeChange}
            />

            <button
              className="glass-tool search-trigger"
              type="button"
              title="Open command search"
              aria-label="Open command search"
              onClick={() => setIsCommandSearchOpen(true)}
            >
              <Search size={17} />
              <span>Ctrl K</span>
            </button>

            <VariantSwitcher uiVariant={uiVariant} onUiVariantChange={onUiVariantChange} />

            <ThemeSwitcher
              themePreference={themePreference}
              onThemePreferenceChange={onThemePreferenceChange}
            />

            <div className={paused ? "live-chip paused" : "live-chip"}>
              <Radio size={15} />
              <span>{paused ? "Paused" : "Live"}</span>
            </div>

            <button
              className="glass-tool"
              type="button"
              onClick={onTogglePaused}
              title={paused ? "Resume stream" : "Pause stream"}
              aria-label={paused ? "Resume stream" : "Pause stream"}
            >
              {paused ? <CirclePlay size={18} /> : <CirclePause size={18} />}
            </button>

            {isDevBuild && selectedAgent && (
              <div className="dev-tools-anchor">
                <button
                  className={isDevToolsOpen ? "glass-tool active" : "glass-tool"}
                  type="button"
                  aria-label="Open developer tools"
                  title="Developer tools"
                  onClick={() => setIsDevToolsOpen((open) => !open)}
                >
                  <Settings2 size={18} />
                </button>
                {isDevToolsOpen && (
                  <DevToolsPopover
                    selectedAgent={selectedAgent}
                    onSetAgentStatus={onSetAgentStatus}
                    onClose={() => setIsDevToolsOpen(false)}
                  />
                )}
              </div>
            )}
          </div>
        </header>

        <section className="console-grid">
          <AgentRail
            agents={visibleAgents}
            selectedAgentId={selectedAgent?.id}
            onSelectAgent={onSelectAgent}
          />

          <section className="stage-shell" aria-label="Office animation stage">
            <div className="stage-glow" />
            <OfficeScene
              agents={visibleAgents}
              selectedAgentId={selectedAgent?.id}
              onSelectAgent={onSelectAgent}
            />
          </section>

          <InspectorDrawer selectedAgent={selectedAgent} />
        </section>
      </div>

      {isCommandSearchOpen && (
        <CommandSearch
          query={query}
          visibleAgents={visibleAgents}
          onQueryChange={onQueryChange}
          onSelectAgent={(agentId) => {
            onSelectAgent(agentId);
            setIsCommandSearchOpen(false);
          }}
          onClose={() => setIsCommandSearchOpen(false)}
          inputRef={commandInputRef}
        />
      )}
    </main>
  );
}

function ProjectSwitcher({
  projects,
  projectScopeId,
  projectScope,
  onProjectScopeChange
}: {
  projects: CodexProjectOption[];
  projectScopeId?: string;
  projectScope?: CodexProjectScope;
  onProjectScopeChange: (projectId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [projectQuery, setProjectQuery] = useState("");
  const selectedProject =
    projects.find((project) => project.id === projectScopeId) ??
    projects.find((project) => project.id === projectScope?.id);
  const label = selectedProject?.name ?? projectScope?.name ?? "Select project";
  const filteredProjects = projects.filter((project) => {
    const normalizedQuery = projectQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return true;
    }
    return (
      project.name.toLowerCase().includes(normalizedQuery) ||
      project.path?.toLowerCase().includes(normalizedQuery)
    );
  });

  return (
    <div className="project-switcher">
      <button
        className={open ? "glass-tool project-trigger active" : "glass-tool project-trigger"}
        type="button"
        aria-label="Codex project scope"
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Codex project scope"
        onClick={() => setOpen((current) => !current)}
      >
        <FolderOpen size={16} />
        <span>{label}</span>
        <ChevronDown size={14} />
      </button>

      {open && (
        <div className="project-popover" role="dialog" aria-label="Codex project scope">
          <div className="project-popover-heading">
            <span>Project scope</span>
            <small>{projects.length} available</small>
          </div>
          <input
            className="project-search"
            value={projectQuery}
            onChange={(event) => setProjectQuery(event.target.value)}
            placeholder="Search projects"
            aria-label="Search Codex projects"
          />
          <div className="project-option-list" role="listbox" aria-label="Codex projects">
            {filteredProjects.map((project) => (
              <button
                type="button"
                key={project.id}
                className={project.id === selectedProject?.id ? "project-option active" : "project-option"}
                disabled={!project.selectable}
                onClick={() => {
                  onProjectScopeChange(project.id);
                  setOpen(false);
                }}
              >
                <span>
                  <strong>{project.name}</strong>
                  <small>{project.path ?? "recent active Codex sessions"}</small>
                  <span className="project-option-meta">
                    <span className="project-count-pill">{project.monitorAgentCount} monitored</span>
                    <span className="project-count-pill muted">
                      {project.activeThreadCount}/{project.threadCount} active
                    </span>
                    {project.kind === "project" && (
                      <span
                        className={
                          project.hasResidentRegistry
                            ? "project-registry-pill resident"
                            : "project-registry-pill fallback"
                        }
                      >
                        {project.hasResidentRegistry ? "resident registry" : "main session fallback"}
                      </span>
                    )}
                  </span>
                </span>
                <em>
                  {project.monitorAgentCount}
                </em>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function VariantSwitcher({
  uiVariant,
  onUiVariantChange
}: {
  uiVariant: UiVariant;
  onUiVariantChange: (variant: UiVariant) => void;
}) {
  return (
    <div className="variant-switcher" role="group" aria-label="UI variant">
      {uiVariantOptions.map(({ value, label, Icon }) => (
        <button
          type="button"
          key={value}
          className={uiVariant === value ? "variant-option active" : "variant-option"}
          aria-pressed={uiVariant === value}
          title={`${label} UI variant`}
          onClick={() => onUiVariantChange(value)}
        >
          <Icon size={15} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

function StatusCounters({
  agentsTotal,
  filter,
  statusCounts,
  onFilterChange
}: {
  agentsTotal: number;
  filter: AgentStatus | "all";
  statusCounts: Record<AgentStatus, number>;
  onFilterChange: (filter: AgentStatus | "all") => void;
}) {
  return (
    <nav className="status-counters" aria-label="Status filters">
      <button
        type="button"
        className={filter === "all" ? "status-counter active" : "status-counter"}
        onClick={() => onFilterChange("all")}
      >
        <span className="counter-label">All</span>
        <strong>{agentsTotal}</strong>
      </button>
      {AGENT_STATUSES.map((status) => {
        const Icon = statusIcons[status];
        return (
          <button
            type="button"
            className={filter === status ? "status-counter active" : "status-counter"}
            key={status}
            style={{ "--agent-status-color": STATUS_COLORS[status] } as CSSProperties}
            onClick={() => onFilterChange(status)}
          >
            <Icon size={14} />
            <span className="counter-label">{STATUS_LABELS[status]}</span>
            <strong>{statusCounts[status] ?? 0}</strong>
          </button>
        );
      })}
    </nav>
  );
}

function ThemeSwitcher({
  themePreference,
  onThemePreferenceChange
}: {
  themePreference: ThemePreference;
  onThemePreferenceChange: (preference: ThemePreference) => void;
}) {
  return (
    <div className="theme-switcher" role="group" aria-label="Theme preference">
      {themeOptions.map(({ value, label, Icon }) => (
        <button
          type="button"
          key={value}
          className={themePreference === value ? "theme-option active" : "theme-option"}
          aria-pressed={themePreference === value}
          title={`${label} theme`}
          onClick={() => onThemePreferenceChange(value)}
        >
          <Icon size={15} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

function AgentRail({
  agents,
  selectedAgentId,
  onSelectAgent
}: {
  agents: AgentActivity[];
  selectedAgentId?: string;
  onSelectAgent: (agentId: string) => void;
}) {
  return (
    <aside className="agent-rail" aria-label="Agent rail">
      <div className="rail-orb">
        <Activity size={19} />
      </div>
      <div className="rail-agent-stack">
        {agents.map((agent) => {
          const Icon = statusIcons[agent.status];
          const selected = agent.id === selectedAgentId;
          return (
            <button
              className={selected ? "rail-agent selected" : "rail-agent"}
              type="button"
              key={agent.id}
              title={`${agent.name}: ${agent.taskTitle}`}
              aria-label={`Select ${agent.name}`}
              style={{ "--agent-status-color": STATUS_COLORS[agent.status] } as CSSProperties}
              onClick={() => onSelectAgent(agent.id)}
            >
              <span className="rail-avatar">
                <Icon size={17} />
              </span>
              {selected && <span className="rail-agent-name">{shortAgentName(agent.name)}</span>}
              <span className="rail-status-light" />
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function InspectorDrawer({ selectedAgent }: { selectedAgent?: AgentActivity }) {
  if (!selectedAgent) {
    return (
      <aside className="inspector-drawer" aria-label="Agent details">
        <div className="empty-inspector">
          <Monitor size={22} />
          <span>No agent selected</span>
        </div>
      </aside>
    );
  }

  const runtimeSnapshot = buildRuntimeSnapshot(selectedAgent);
  const activityTrace = buildActivityTrace(selectedAgent);

  return (
    <aside
      className="inspector-drawer"
      aria-label="Agent details"
      style={{ "--agent-status-color": STATUS_COLORS[selectedAgent.status] } as CSSProperties}
    >
      <div className="agent-hero">
        <div>
          <span className="eyebrow">Focused Agent</span>
          <h2>{selectedAgent.name}</h2>
        </div>
        <span className="status-badge">
          <span className="agent-status-dot" />
          {STATUS_LABELS[selectedAgent.status]}
        </span>
      </div>

      <section className="task-glass">
        <span className="eyebrow">Current Task</span>
        <h3>{selectedAgent.taskTitle}</h3>
        <p>{selectedAgent.taskDetail}</p>
      </section>

      <section className="progress-glass">
        <div className="progress-heading">
          <span className="eyebrow">Progress</span>
          <strong>{selectedAgent.progress ?? 0}%</strong>
        </div>
        <div className="progress-track">
          <div style={{ width: `${selectedAgent.progress ?? 0}%` }} />
        </div>
      </section>

      <section className="screen-preview">
        <div className="screen-title">
          <Monitor size={15} />
          <span>{selectedAgent.screenMode ?? "summary"}</span>
        </div>
        <pre>{(selectedAgent.screenLines ?? []).join("\n")}</pre>
      </section>

      <section className="runtime-snapshot" aria-label="Runtime snapshot">
        <div className="inspector-section-heading">
          <span className="eyebrow">Runtime snapshot</span>
        </div>
        <dl>
          {runtimeSnapshot.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="activity-trace" aria-label="Activity trace">
        <div className="inspector-section-heading">
          <span className="eyebrow">Activity trace</span>
        </div>
        <div className="trace-list">
          {activityTrace.map((item) => (
            <div className="trace-row" key={`${item.label}:${item.detail}`}>
              <span className="trace-pulse" />
              <div>
                <strong>{item.label}</strong>
                <span>{item.detail}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}

function buildRuntimeSnapshot(agent: AgentActivity) {
  return [
    { label: "Status", value: STATUS_LABELS[agent.status] },
    { label: "Reason", value: agent.statusReason ?? "No runtime signal" },
    { label: "Mode", value: (agent.screenMode ?? "summary").toUpperCase() },
    { label: "Updated", value: formatRelativeTime(agent.lastUpdated) },
    { label: "Freshness", value: formatDuration(agent.statusFreshnessMs) },
    { label: "Observed", value: agent.statusObservedAt ? formatRelativeTime(agent.statusObservedAt) : "now" },
    { label: "Progress", value: `${agent.progress ?? 0}%` }
  ];
}

function buildActivityTrace(agent: AgentActivity) {
  const screenLines = (agent.screenLines ?? [])
    .filter((line) => line.trim().length > 0)
    .slice(0, 3)
    .map((line, index) => ({
      label: index === 0 ? "Screen feed" : "Signal",
      detail: line
    }));

  return [
    {
      label: "Task",
      detail: agent.taskTitle ?? "No active task"
    },
    {
      label: STATUS_LABELS[agent.status],
      detail: agent.taskDetail ?? "Awaiting telemetry update"
    },
    ...screenLines
  ].slice(0, 5);
}

function formatRelativeTime(value: string) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }

  const diffMs = Math.max(0, Date.now() - timestamp);
  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  return `${diffHours}h ago`;
}

function formatDuration(value: number | undefined) {
  if (value === undefined) {
    return "unknown";
  }

  const seconds = Math.floor(Math.max(0, value) / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m`;
  }

  return `${Math.floor(minutes / 60)}h`;
}

function CommandSearch({
  query,
  visibleAgents,
  onQueryChange,
  onSelectAgent,
  onClose,
  inputRef
}: {
  query: string;
  visibleAgents: AgentActivity[];
  onQueryChange: (query: string) => void;
  onSelectAgent: (agentId: string) => void;
  onClose: () => void;
  inputRef: RefObject<HTMLInputElement>;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      onClose();
    }
  }

  return (
    <div className="command-search" role="dialog" aria-modal="true" aria-label="Command search">
      <button className="command-backdrop" type="button" aria-label="Close command search" onClick={onClose} />
      <div className="command-panel">
        <div className="command-input-row">
          <Command size={18} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search agents or tasks"
          />
          <button type="button" className="glass-tool compact" aria-label="Close search" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="command-results">
          {visibleAgents.map((agent) => {
            const Icon = statusIcons[agent.status];
            return (
              <button
                type="button"
                className="command-result"
                key={agent.id}
                style={{ "--agent-status-color": STATUS_COLORS[agent.status] } as CSSProperties}
                onClick={() => onSelectAgent(agent.id)}
              >
                <span className="command-result-icon">
                  <Icon size={16} />
                </span>
                <span>
                  <strong>{agent.name}</strong>
                  <small>{agent.taskTitle}</small>
                </span>
                <span className="command-status">{STATUS_LABELS[agent.status]}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DevToolsPopover({
  selectedAgent,
  onSetAgentStatus,
  onClose
}: {
  selectedAgent: AgentActivity;
  onSetAgentStatus: (agentId: string, status: AgentStatus) => void;
  onClose: () => void;
}) {
  return (
    <div className="dev-tools-popover" role="dialog" aria-label="Developer tools">
      <div className="popover-heading">
        <span>Mock Status</span>
        <button type="button" className="glass-tool compact" aria-label="Close developer tools" onClick={onClose}>
          <X size={15} />
        </button>
      </div>
      <div className="mock-controls" aria-label="Mock status controls">
        {AGENT_STATUSES.map((status) => (
          <button
            type="button"
            key={status}
            className={selectedAgent.status === status ? "mock-button active" : "mock-button"}
            onClick={() => onSetAgentStatus(selectedAgent.id, status)}
          >
            {STATUS_LABELS[status]}
          </button>
        ))}
      </div>
    </div>
  );
}

function shortAgentName(name: string) {
  return name.length > 8 ? name.slice(0, 7) : name;
}
