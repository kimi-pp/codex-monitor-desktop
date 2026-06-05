import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { CodexSpawnEdgeRow, CodexThreadRow } from "./codex-projects";

type DatabaseLike = {
  prepare(sql: string): {
    all(): unknown[];
  };
  close(): void;
};

type NodeSqliteModule = {
  DatabaseSync: new (filename: string, options?: { readOnly?: boolean }) => DatabaseLike;
};

type ThreadDbRow = {
  id: string;
  cwd: string | null;
  title: string | null;
  updated_at: number | null;
  created_at: number | null;
  archived: number | boolean | null;
  rollout_path: string | null;
  agent_nickname: string | null;
  agent_role: string | null;
  preview: string | null;
};

type EdgeDbRow = {
  parent_thread_id: string;
  child_thread_id: string;
  status: string | null;
};

type RawCodexStateRows = {
  threads: ThreadDbRow[];
  edges: EdgeDbRow[];
};

const EXTERNAL_NODE_SQLITE_READER = `
const { DatabaseSync } = require("node:sqlite");
const dbPath = process.argv[1];
const limit = Math.max(1, Number(process.argv[2] || 500));
let db;
try {
  db = new DatabaseSync(dbPath, { readOnly: true });
  const threads = db.prepare(\`
    select
      id,
      cwd,
      title,
      updated_at,
      created_at,
      archived,
      rollout_path,
      agent_nickname,
      agent_role,
      preview
    from threads
    order by updated_at desc
    limit \${limit}
  \`).all();
  const edges = db.prepare(\`
    select parent_thread_id, child_thread_id, status
    from thread_spawn_edges
  \`).all();
  process.stdout.write(JSON.stringify({ threads, edges }));
} finally {
  if (db) db.close();
}
`;

export type CodexStateSnapshot = {
  threads: CodexThreadRow[];
  edges: CodexSpawnEdgeRow[];
  loadedAtMs: number;
  sourcePath?: string;
  error?: string;
};

export type CodexStateStoreOptions = {
  codexHomePath?: string;
  threadLimit?: number;
};

export class CodexStateStore {
  private readonly codexHomePath: string;
  private readonly threadLimit: number;

  constructor(options: CodexStateStoreOptions = {}) {
    this.codexHomePath = options.codexHomePath ?? process.env.CODEX_HOME ?? path.join(os.homedir(), ".codex");
    this.threadLimit = options.threadLimit ?? 500;
  }

  loadSnapshot(): CodexStateSnapshot {
    const dbPath = path.join(this.codexHomePath, "state_5.sqlite");
    const loadedAtMs = Date.now();

    if (!fs.existsSync(dbPath)) {
      return {
        threads: [],
        edges: [],
        loadedAtMs,
        sourcePath: dbPath,
        error: "Codex local state database was not found"
      };
    }

    const sqlite = loadNodeSqlite();
    if (!sqlite) {
      return this.loadSnapshotWithExternalNode(dbPath, loadedAtMs);
    }

    let db: DatabaseLike | undefined;
    try {
      db = new sqlite.DatabaseSync(dbPath, { readOnly: true });
      const threads = db.prepare(`
        select
          id,
          cwd,
          title,
          updated_at,
          created_at,
          archived,
          rollout_path,
          agent_nickname,
          agent_role,
          preview
        from threads
        order by updated_at desc
        limit ${Math.max(1, this.threadLimit)}
      `).all() as ThreadDbRow[];
      const edges = db.prepare(`
        select parent_thread_id, child_thread_id, status
        from thread_spawn_edges
      `).all() as EdgeDbRow[];

      return {
        threads: threads.map(mapThreadRow),
        edges: edges.map(mapEdgeRow),
        loadedAtMs,
        sourcePath: dbPath
      };
    } catch (error) {
      return {
        threads: [],
        edges: [],
        loadedAtMs,
        sourcePath: dbPath,
        error: error instanceof Error ? error.message : "Failed to read Codex local state"
      };
    } finally {
      db?.close();
    }
  }

  private loadSnapshotWithExternalNode(dbPath: string, loadedAtMs: number): CodexStateSnapshot {
    try {
      const result = spawnSync("node", ["-e", EXTERNAL_NODE_SQLITE_READER, dbPath, String(this.threadLimit)], {
        encoding: "utf8",
        timeout: 5_000,
        windowsHide: true,
        maxBuffer: 8 * 1024 * 1024
      });

      if (result.error) {
        throw result.error;
      }
      if (result.status !== 0) {
        throw new Error(result.stderr.trim() || "external node sqlite reader failed");
      }

      const rows = JSON.parse(result.stdout) as RawCodexStateRows;
      return {
        threads: rows.threads.map(mapThreadRow),
        edges: rows.edges.map(mapEdgeRow),
        loadedAtMs,
        sourcePath: dbPath
      };
    } catch (error) {
      return {
        threads: [],
        edges: [],
        loadedAtMs,
        sourcePath: dbPath,
        error: error instanceof Error ? error.message : "node:sqlite is unavailable in this runtime"
      };
    }
  }
}

function loadNodeSqlite(): NodeSqliteModule | undefined {
  try {
    return require("node:sqlite") as NodeSqliteModule;
  } catch {
    return undefined;
  }
}

function mapThreadRow(row: ThreadDbRow): CodexThreadRow {
  return {
    id: String(row.id),
    cwd: row.cwd,
    title: row.title,
    updatedAtMs: normalizeEpochMs(row.updated_at),
    createdAtMs: normalizeEpochMs(row.created_at),
    archived: Boolean(row.archived),
    rolloutPath: row.rollout_path,
    agentNickname: row.agent_nickname,
    agentRole: row.agent_role,
    preview: row.preview
  };
}

function mapEdgeRow(row: EdgeDbRow): CodexSpawnEdgeRow {
  return {
    parentThreadId: String(row.parent_thread_id),
    childThreadId: String(row.child_thread_id),
    status: row.status
  };
}

function normalizeEpochMs(value: number | null): number {
  if (!value) {
    return 0;
  }
  return value < 10_000_000_000 ? value * 1000 : value;
}
