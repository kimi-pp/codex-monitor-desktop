import fs from "node:fs";
import path from "node:path";

const REGISTRY_RELATIVE_PATHS = [
  "AGENT.md",
  "AGENTS.md",
  "Agent.md",
  path.join("docs", "superpowers", "agent-registry.md"),
  path.join("project_memory", "AGENT_REGISTRY.md")
];
const HANDLE_ID_PATTERN = /Handle ID:\s*`?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})`?/gi;
const UUID_PATTERN = /`?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})`?/gi;

export type ResidentAgentRegistry = {
  ids: Set<string>;
  sourcePath?: string;
  hasRegistryFile: boolean;
  hasResidentRegistry: boolean;
};

export function readResidentAgentRegistryForWorkspace(workspacePath: string | undefined): ResidentAgentRegistry {
  const normalizedWorkspacePath = normalizeRegistryWorkspacePath(workspacePath);
  if (!normalizedWorkspacePath) {
    return emptyRegistry();
  }

  const registryPaths = REGISTRY_RELATIVE_PATHS
    .map((relativePath) => path.join(normalizedWorkspacePath, relativePath))
    .filter((candidatePath) => fs.existsSync(candidatePath));

  const ids = new Set<string>();
  let firstResidentSourcePath: string | undefined;

  for (const registryPath of registryPaths) {
    const contents = fs.readFileSync(registryPath, "utf8");
    const fileIds = new Set<string>();

    for (const match of contents.matchAll(HANDLE_ID_PATTERN)) {
      fileIds.add(match[1].toLowerCase());
    }
    for (const id of readResidentIdsFromTableRows(contents)) {
      fileIds.add(id);
    }

    if (fileIds.size > 0 && !firstResidentSourcePath) {
      firstResidentSourcePath = registryPath;
    }
    for (const id of fileIds) {
      ids.add(id);
    }
  }

  return {
    ids,
    sourcePath: firstResidentSourcePath ?? registryPaths[0],
    hasRegistryFile: registryPaths.length > 0,
    hasResidentRegistry: ids.size > 0
  };
}

export function readResidentAgentIdsForWorkspace(workspacePath: string | undefined): Set<string> {
  return readResidentAgentRegistryForWorkspace(workspacePath).ids;
}

function normalizeRegistryWorkspacePath(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  const withoutLongPathPrefix = trimmed.replace(/^\\\\\?\\/, "");
  const normalizedSlashes = withoutLongPathPrefix.replace(/\//g, "\\");
  return path.win32.normalize(normalizedSlashes).replace(/[\\]+$/, "");
}

function readResidentIdsFromTableRows(contents: string): Set<string> {
  const ids = new Set<string>();

  for (const line of contents.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine.startsWith("|") || /^\|?\s*-+\s*\|/.test(trimmedLine)) {
      continue;
    }

    const lineIds = [...trimmedLine.matchAll(UUID_PATTERN)].map((match) => match[1].toLowerCase());
    if (lineIds.length === 0 || !isResidentRegistryRow(trimmedLine)) {
      continue;
    }

    for (const id of lineIds) {
      ids.add(id);
    }
  }

  return ids;
}

function isResidentRegistryRow(row: string): boolean {
  const normalized = row.toLowerCase();
  const excludedSignals = [
    "completed",
    "closed",
    "shutdown",
    "not_found",
    "not found",
    "archived",
    "stale explorer",
    "temporary",
    "worker",
    "explorer"
  ];
  if (excludedSignals.some((signal) => normalized.includes(signal))) {
    return false;
  }

  return (
    normalized.includes("`open`") ||
    normalized.includes("| open |") ||
    normalized.includes(" runtime_confirmed") ||
    normalized.includes("runtime_confirmed_on") ||
    normalized.includes(" runtime_created") ||
    normalized.includes("runtime_created_on") ||
    normalized.includes("| active |")
  );
}

function emptyRegistry(): ResidentAgentRegistry {
  return {
    ids: new Set(),
    hasRegistryFile: false,
    hasResidentRegistry: false
  };
}
