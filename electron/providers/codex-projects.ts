import path from "node:path";
import type { CodexProjectOption } from "../../src/shared/types";

export const ALL_ACTIVE_PROJECTS_ID = "all-active-projects";
const ACTIVE_PROJECT_WINDOW_MS = 24 * 60 * 60 * 1000;

export type CodexThreadRow = {
  id: string;
  cwd: string | null;
  title: string | null;
  updatedAtMs: number;
  createdAtMs: number;
  archived?: boolean;
  rolloutPath: string | null;
  agentNickname?: string | null;
  agentRole?: string | null;
  preview?: string | null;
};

export type CodexSpawnEdgeRow = {
  parentThreadId: string;
  childThreadId: string;
  status: string | null;
};

export type BuildProjectOptionsInput = {
  threads: CodexThreadRow[];
  edges: CodexSpawnEdgeRow[];
  defaultWorkspacePath?: string;
  residentAgentIdsByWorkspacePath?: Map<string, Set<string>>;
  residentRegistrySourceByWorkspacePath?: Map<string, string | undefined>;
  nowMs?: number;
};

export type SelectThreadRowsInput = BuildProjectOptionsInput & {
  projectId: string | undefined;
  projects: CodexProjectOption[];
  residentAgentIdsByWorkspacePath?: Map<string, Set<string>>;
};

export function buildCodexProjectOptions({
  threads,
  edges,
  defaultWorkspacePath,
  residentAgentIdsByWorkspacePath,
  residentRegistrySourceByWorkspacePath,
  nowMs = Date.now()
}: BuildProjectOptionsInput): CodexProjectOption[] {
  const normalizedDefaultPath = normalizeWorkspacePath(defaultWorkspacePath);
  const threadsById = new Map(threads.map((thread) => [thread.id, thread]));
  const parentByChildId = buildParentByChildId(edges);
  const childrenByParentId = buildChildrenByParentId(edges);
  const projectBuckets = new Map<string, Set<string>>();

  for (const thread of threads) {
    const workspacePath = normalizeWorkspacePath(thread.cwd);
    if (!workspacePath) {
      continue;
    }

    const ids = projectBuckets.get(workspacePath) ?? new Set<string>();
    ids.add(thread.id);
    for (const childId of collectOpenDescendantIds(thread.id, childrenByParentId)) {
      if (threadsById.has(childId)) {
        ids.add(childId);
      }
    }
    projectBuckets.set(workspacePath, ids);
  }

  const projectOptions = [...projectBuckets.entries()]
    .map(([workspacePath, ids]) => {
      const projectThreads = [...ids]
        .map((id) => threadsById.get(id))
        .filter((thread): thread is CodexThreadRow => Boolean(thread));
      const lastUpdatedMs = Math.max(...projectThreads.map((thread) => thread.updatedAtMs));
      const activeThreadCount = projectThreads.filter((thread) => isRecentThread(thread, nowMs)).length;
      const residentAgentIds = getResidentAgentIds(residentAgentIdsByWorkspacePath, workspacePath);
      const monitorRows = selectMonitorRowsForWorkspace({
        workspacePath,
        threads,
        threadsById,
        parentByChildId,
        childrenByParentId,
        residentAgentIds
      });

      return {
        id: projectIdForPath(workspacePath),
        kind: "project" as const,
        name: path.win32.basename(workspacePath) || workspacePath,
        path: workspacePath,
        threadCount: projectThreads.length,
        activeThreadCount,
        monitorAgentCount: monitorRows.length,
        lastUpdated: new Date(lastUpdatedMs).toISOString(),
        isDefault: normalizedDefaultPath === workspacePath,
        selectable: projectThreads.length > 0,
        hasResidentRegistry: residentAgentIds.size > 0,
        registrySource: getResidentRegistrySource(residentRegistrySourceByWorkspacePath, workspacePath)
      };
    })
    .sort((left, right) => {
      if (left.isDefault !== right.isDefault) {
        return left.isDefault ? -1 : 1;
      }
      return Date.parse(right.lastUpdated) - Date.parse(left.lastUpdated);
    });

  const activeThreadIds = new Set(
    threads.filter((thread) => isRecentThread(thread, nowMs)).map((thread) => thread.id)
  );
  const allActiveLastUpdatedMs = Math.max(
    0,
    ...threads
      .filter((thread) => activeThreadIds.has(thread.id))
      .map((thread) => thread.updatedAtMs)
  );
  const allActiveMonitorIds = new Set<string>();
  for (const project of projectOptions) {
    if (!project.path) {
      continue;
    }
    const monitorRows = selectMonitorRowsForWorkspace({
      workspacePath: project.path,
      threads,
      threadsById,
      parentByChildId,
      childrenByParentId,
      residentAgentIds: getResidentAgentIds(residentAgentIdsByWorkspacePath, project.path)
    });
    const rootThread = monitorRows.find((thread) => !parentByChildId.has(thread.id));
    if (!rootThread || !isRecentThread(rootThread, nowMs)) {
      continue;
    }
    for (const thread of monitorRows) {
      allActiveMonitorIds.add(thread.id);
    }
  }

  return [
    {
      id: ALL_ACTIVE_PROJECTS_ID,
      kind: "all-active",
      name: "All Active Projects",
      threadCount: activeThreadIds.size,
      activeThreadCount: activeThreadIds.size,
      monitorAgentCount: allActiveMonitorIds.size,
      lastUpdated: new Date(allActiveLastUpdatedMs || nowMs).toISOString(),
      selectable: true
    },
    ...projectOptions
  ];
}

export function selectThreadRowsForProject({
  projectId,
  projects,
  threads,
  edges,
  residentAgentIdsByWorkspacePath,
  nowMs = Date.now()
}: SelectThreadRowsInput): CodexThreadRow[] {
  const threadsById = new Map(threads.map((thread) => [thread.id, thread]));
  const parentByChildId = buildParentByChildId(edges);
  const childrenByParentId = buildChildrenByParentId(edges);

  if (projectId === ALL_ACTIVE_PROJECTS_ID) {
    const selectedIds = new Set<string>();
    for (const project of projects) {
      if (project.kind !== "project" || !project.path) {
        continue;
      }
      const monitorRows = selectMonitorRowsForWorkspace({
        workspacePath: project.path,
        threads,
        threadsById,
        parentByChildId,
        childrenByParentId,
        residentAgentIds: getResidentAgentIds(residentAgentIdsByWorkspacePath, project.path)
      });
      const rootThread = monitorRows.find((thread) => !parentByChildId.has(thread.id));
      if (!rootThread || !isRecentThread(rootThread, nowMs)) {
        continue;
      }
      for (const thread of monitorRows) {
        selectedIds.add(thread.id);
      }
    }

    return [...selectedIds]
      .map((id) => threadsById.get(id))
      .filter((thread): thread is CodexThreadRow => Boolean(thread))
      .sort((left, right) => right.updatedAtMs - left.updatedAtMs);
  }

  const selectedProject =
    projects.find((project) => project.id === projectId && project.kind === "project") ??
    projects.find((project) => project.kind === "project" && project.isDefault) ??
    projects.find((project) => project.kind === "project");

  if (!selectedProject?.path) {
    return [];
  }

  const selectedPath = normalizeWorkspacePath(selectedProject.path);
  if (!selectedPath) {
    return [];
  }

  return selectMonitorRowsForWorkspace({
    workspacePath: selectedPath,
    threads,
    threadsById,
    parentByChildId,
    childrenByParentId,
    residentAgentIds: getResidentAgentIds(residentAgentIdsByWorkspacePath, selectedPath)
  });
}

export function normalizeWorkspacePath(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  const withoutLongPathPrefix = trimmed.replace(/^\\\\\?\\/, "");
  const normalizedSlashes = withoutLongPathPrefix.replace(/\//g, "\\");
  return path.win32.normalize(normalizedSlashes).replace(/[\\]+$/, "");
}

function projectIdForPath(workspacePath: string): string {
  return `project:${workspacePath.toLowerCase()}`;
}

function buildChildrenByParentId(edges: CodexSpawnEdgeRow[]) {
  const childrenByParentId = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.status?.toLowerCase() === "closed") {
      continue;
    }

    const children = childrenByParentId.get(edge.parentThreadId) ?? [];
    children.push(edge.childThreadId);
    childrenByParentId.set(edge.parentThreadId, children);
  }
  return childrenByParentId;
}

function buildParentByChildId(edges: CodexSpawnEdgeRow[]) {
  const parentByChildId = new Map<string, string>();
  for (const edge of edges) {
    if (edge.status?.toLowerCase() === "closed") {
      continue;
    }
    parentByChildId.set(edge.childThreadId, edge.parentThreadId);
  }
  return parentByChildId;
}

function selectMonitorRowsForWorkspace({
  workspacePath,
  threads,
  threadsById,
  parentByChildId,
  childrenByParentId,
  residentAgentIds
}: {
  workspacePath: string;
  threads: CodexThreadRow[];
  threadsById: Map<string, CodexThreadRow>;
  parentByChildId: Map<string, string>;
  childrenByParentId: Map<string, string[]>;
  residentAgentIds: Set<string>;
}): CodexThreadRow[] {
  const normalizedPath = normalizeWorkspacePath(workspacePath);
  if (!normalizedPath) {
    return [];
  }

  const workspaceThreads = threads.filter((thread) => normalizeWorkspacePath(thread.cwd) === normalizedPath);
  const latestRootThread = workspaceThreads
    .filter((thread) => !parentByChildId.has(thread.id))
    .sort((left, right) => right.updatedAtMs - left.updatedAtMs)[0];

  if (!latestRootThread) {
    return [];
  }

  const selectedIds = new Set<string>([latestRootThread.id]);
  const descendantIds = new Set(collectOpenDescendantIds(latestRootThread.id, childrenByParentId));

  if (residentAgentIds.size > 0) {
    for (const residentId of residentAgentIds) {
      const thread = threadsById.get(residentId);
      if (!thread) {
        continue;
      }
      if (normalizeWorkspacePath(thread.cwd) === normalizedPath || descendantIds.has(thread.id)) {
        selectedIds.add(thread.id);
      }
    }
  }

  return [...selectedIds]
    .map((id) => threadsById.get(id))
    .filter((thread): thread is CodexThreadRow => Boolean(thread))
    .sort((left, right) => right.updatedAtMs - left.updatedAtMs);
}

function getResidentAgentIds(
  residentAgentIdsByWorkspacePath: Map<string, Set<string>> | undefined,
  workspacePath: string
): Set<string> {
  if (!residentAgentIdsByWorkspacePath) {
    return new Set();
  }

  const normalizedPath = normalizeWorkspacePath(workspacePath);
  const entry = [...residentAgentIdsByWorkspacePath.entries()].find(
    ([path]) => normalizeWorkspacePath(path) === normalizedPath
  );
  return entry?.[1] ?? new Set();
}

function getResidentRegistrySource(
  residentRegistrySourceByWorkspacePath: Map<string, string | undefined> | undefined,
  workspacePath: string
): string | undefined {
  if (!residentRegistrySourceByWorkspacePath) {
    return undefined;
  }

  const normalizedPath = normalizeWorkspacePath(workspacePath);
  const entry = [...residentRegistrySourceByWorkspacePath.entries()].find(
    ([path]) => normalizeWorkspacePath(path) === normalizedPath
  );
  return entry?.[1];
}

function isTemporarySubagentThread(thread: CodexThreadRow): boolean {
  const role = thread.agentRole?.toLowerCase();
  if (role === "worker" || role === "explorer") {
    return true;
  }

  const text = `${thread.title ?? ""}\n${thread.preview ?? ""}`.toLowerCase();
  return (
    text.includes("temporary") ||
    text.includes("临时") ||
    text.includes("candidate worker") ||
    text.includes("asset worker") ||
    text.includes("do not mark pass")
  );
}

function collectOpenDescendantIds(parentId: string, childrenByParentId: Map<string, string[]>): string[] {
  const descendants: string[] = [];
  const queue = [...(childrenByParentId.get(parentId) ?? [])];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const childId = queue.shift();
    if (!childId || seen.has(childId)) {
      continue;
    }
    seen.add(childId);
    descendants.push(childId);
    queue.push(...(childrenByParentId.get(childId) ?? []));
  }

  return descendants;
}

function isRecentThread(thread: CodexThreadRow, nowMs: number): boolean {
  return nowMs - thread.updatedAtMs <= ACTIVE_PROJECT_WINDOW_MS;
}
