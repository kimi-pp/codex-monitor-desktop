import { useEffect, useMemo, useState } from "react";
import { MonitorShell } from "./components/MonitorShell";
import { createAgentClient } from "./services/agent-client";
import {
  LEGACY_PROJECT_SCOPE_STORAGE_KEY,
  PROJECT_SCOPE_STORAGE_KEY
} from "./shared/project-scope";
import { AGENT_STATUSES } from "./shared/status-meta";
import type {
  AgentActivity,
  AgentStatus,
  AgentStatusPayload,
  CodexProjectOption,
  CodexProjectScope
} from "./shared/types";
import {
  LEGACY_THEME_STORAGE_KEY,
  THEME_STORAGE_KEY,
  normalizeThemePreference,
  resolveEffectiveTheme,
  type ThemePreference
} from "./ui-theme";
import { readUiVariantFromSearch, type UiVariant } from "./ui-variant";

const client = createAgentClient();

function readStoredThemePreference(): ThemePreference {
  if (typeof window === "undefined") {
    return "system";
  }

  return normalizeThemePreference(
    window.localStorage.getItem(THEME_STORAGE_KEY) ??
    window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY)
  );
}

function readStoredProjectScopeId(): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return (
    window.localStorage.getItem(PROJECT_SCOPE_STORAGE_KEY) ??
    window.localStorage.getItem(LEGACY_PROJECT_SCOPE_STORAGE_KEY) ??
    undefined
  );
}

function readSystemPrefersDark() {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function readUiVariant(): UiVariant {
  if (typeof window === "undefined") {
    return "product";
  }

  return readUiVariantFromSearch(window.location.search);
}

function writeUiVariantToUrl(variant: UiVariant) {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.set("uiVariant", variant);
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

export function App() {
  const [agents, setAgents] = useState<AgentActivity[]>([]);
  const [paused, setPaused] = useState(false);
  const [projects, setProjects] = useState<CodexProjectOption[]>([]);
  const [projectScope, setProjectScope] = useState<CodexProjectScope>();
  const [projectScopeId, setProjectScopeId] = useState<string | undefined>(readStoredProjectScopeId);
  const [selectedAgentId, setSelectedAgentId] = useState<string>();
  const [filter, setFilter] = useState<AgentStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [themePreference, setThemePreference] = useState<ThemePreference>(readStoredThemePreference);
  const [systemPrefersDark, setSystemPrefersDark] = useState(readSystemPrefersDark);
  const [uiVariant, setUiVariant] = useState<UiVariant>(readUiVariant);
  const effectiveTheme = resolveEffectiveTheme(themePreference, systemPrefersDark);

  useEffect(() => {
    let mounted = true;
    Promise.all([client.getSnapshot(), client.getProjects()]).then(async ([payload, projectOptions]) => {
      if (!mounted) {
        return;
      }
      setProjects(projectOptions);
      const restoredProjectId = resolveProjectScopeId(projectScopeId, projectOptions, payload.projectScope?.id);
      const scopedPayload =
        restoredProjectId && restoredProjectId !== payload.projectScope?.id
          ? await client.setProjectScope(restoredProjectId)
          : payload;
      if (!mounted) {
        return;
      }
      applyStatusPayload(scopedPayload);
    });

    const unsubscribe = client.onAgentsUpdate((payload) => {
      applyStatusPayload(payload);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  function applyStatusPayload(payload: AgentStatusPayload) {
    setAgents(payload.agents);
    setPaused(payload.paused);
    setProjectScope(payload.projectScope);
    setProjectScopeId(payload.projectScope?.id);
    setSelectedAgentId((current) => (
      current && payload.agents.some((agent) => agent.id === current)
        ? current
        : payload.agents[0]?.id
    ));
  }

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleThemeChange = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches);
    };

    setSystemPrefersDark(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleThemeChange);

    return () => {
      mediaQuery.removeEventListener("change", handleThemeChange);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(THEME_STORAGE_KEY, themePreference);
    window.localStorage.removeItem(LEGACY_THEME_STORAGE_KEY);
  }, [themePreference]);

  useEffect(() => {
    function handlePopState() {
      setUiVariant(readUiVariant());
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const visibleAgents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return agents.filter((agent) => {
      const matchesStatus = filter === "all" || agent.status === filter;
      const matchesQuery =
        normalizedQuery.length === 0 ||
        agent.name.toLowerCase().includes(normalizedQuery) ||
        agent.taskTitle?.toLowerCase().includes(normalizedQuery);
      return matchesStatus && matchesQuery;
    });
  }, [agents, filter, query]);

  const selectedAgent = useMemo(
    () => visibleAgents.find((agent) => agent.id === selectedAgentId) ?? visibleAgents[0],
    [selectedAgentId, visibleAgents]
  );

  const statusCounts = useMemo(() => {
    return AGENT_STATUSES.reduce<Record<AgentStatus, number>>((counts, status) => {
      counts[status] = agents.filter((agent) => agent.status === status).length;
      return counts;
    }, {} as Record<AgentStatus, number>);
  }, [agents]);

  async function togglePaused() {
    const payload = await client.setPaused(!paused);
    applyStatusPayload(payload);
  }

  async function setAgentStatus(agentId: string, status: AgentStatus) {
    const payload = await client.setMockStatus(agentId, status);
    applyStatusPayload(payload);
  }

  async function updateProjectScope(projectId: string) {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PROJECT_SCOPE_STORAGE_KEY, projectId);
      window.localStorage.removeItem(LEGACY_PROJECT_SCOPE_STORAGE_KEY);
    }
    setProjectScopeId(projectId);
    const payload = await client.setProjectScope(projectId);
    applyStatusPayload(payload);
    const nextProjects = await client.getProjects();
    setProjects(nextProjects);
  }

  function updateUiVariant(variant: UiVariant) {
    setUiVariant(variant);
    writeUiVariantToUrl(variant);
  }

  return (
    <MonitorShell
      agents={agents}
      visibleAgents={visibleAgents}
      selectedAgent={selectedAgent}
      selectedAgentId={selectedAgent?.id}
      filter={filter}
      query={query}
      paused={paused}
      projects={projects}
      projectScopeId={projectScopeId ?? projectScope?.id}
      projectScope={projectScope}
      statusCounts={statusCounts}
      themePreference={themePreference}
      effectiveTheme={effectiveTheme}
      uiVariant={uiVariant}
      onFilterChange={setFilter}
      onQueryChange={setQuery}
      onProjectScopeChange={updateProjectScope}
      onThemePreferenceChange={setThemePreference}
      onUiVariantChange={updateUiVariant}
      onSelectAgent={setSelectedAgentId}
      onTogglePaused={togglePaused}
      onSetAgentStatus={setAgentStatus}
    />
  );
}

function resolveProjectScopeId(
  requestedProjectId: string | undefined,
  projects: CodexProjectOption[],
  currentProjectId: string | undefined
) {
  if (requestedProjectId && projects.some((project) => project.id === requestedProjectId && project.selectable)) {
    return requestedProjectId;
  }

  if (currentProjectId && projects.some((project) => project.id === currentProjectId && project.selectable)) {
    return currentProjectId;
  }

  return (
    projects.find((project) => project.kind === "project" && project.isDefault)?.id ??
    projects.find((project) => project.selectable)?.id
  );
}
