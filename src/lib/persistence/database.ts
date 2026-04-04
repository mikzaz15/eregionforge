import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import {
  activeProjectId,
  seedClaims,
  seedEvidenceLinks,
  seedArtifacts,
  seedAskSessions,
  seedMonitoringAnalysisStates,
  seedProjects,
  seedSourceFragments,
  seedSourceMonitoringRecords,
  seedSources,
  seedStaleAlerts,
  seedTheses,
  seedThesisRevisions,
  seedWikiPageRevisions,
  seedWikiPages,
  seedWikiPageSourceLinks,
} from "@/lib/domain/seed-data";
import type {
  Artifact,
  AskSession,
  MonitoringAnalysisState,
  Project,
  Source,
  SourceFragment,
  SourceMonitoringRecord,
  StaleAlert,
  Thesis,
  ThesisRevision,
} from "@/lib/domain/types";

type SqliteRow = Record<string, unknown>;

type SqliteStatement = {
  run: (...params: unknown[]) => unknown;
  get: (...params: unknown[]) => SqliteRow | undefined;
  all: (...params: unknown[]) => SqliteRow[];
};

type SqliteDatabase = {
  exec: (sql: string) => void;
  prepare: (sql: string) => SqliteStatement;
};

type SqliteModule = {
  DatabaseSync: new (path: string) => SqliteDatabase;
};

const require = createRequire(import.meta.url);

let databaseInstance: SqliteDatabase | null | undefined;
let schemaReady = false;

function resolveDatabaseSync(): SqliteModule["DatabaseSync"] | null {
  try {
    return (require("node:sqlite") as SqliteModule).DatabaseSync;
  } catch {
    return null;
  }
}

export function getPersistenceMode(): "sqlite" | "memory" {
  if (process.env.EREGIONFORGE_PERSISTENCE === "memory") {
    return "memory";
  }

  return resolveDatabaseSync() ? "sqlite" : "memory";
}

export function getPersistenceDatabasePath(): string {
  return (
    process.env.EREGIONFORGE_DB_PATH ??
    path.join(process.cwd(), "data", "eregionforge.sqlite")
  );
}

export function serializeRecord(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function deserializeRecord<T>(row: SqliteRow | undefined | null): T | null {
  if (!row || typeof row.payload !== "string") {
    return null;
  }

  try {
    return structuredClone(JSON.parse(row.payload) as T);
  } catch {
    return null;
  }
}

function deserializeRows<T>(rows: SqliteRow[]): T[] {
  return rows
    .map((row) => deserializeRecord<T>(row))
    .filter((value): value is T => Boolean(value));
}

function ensureSchema(database: SqliteDatabase) {
  if (schemaReady) {
    return;
  }

  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects_store (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_projects_store_slug ON projects_store(slug);

    CREATE TABLE IF NOT EXISTS sources_store (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      status TEXT NOT NULL,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sources_store_project ON sources_store(project_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS source_fragments_store (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      source_id TEXT NOT NULL,
      fragment_index INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_source_fragments_source ON source_fragments_store(source_id, fragment_index ASC);
    CREATE INDEX IF NOT EXISTS idx_source_fragments_project ON source_fragments_store(project_id, source_id ASC);

    CREATE TABLE IF NOT EXISTS wiki_pages_store (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      slug TEXT NOT NULL,
      page_type TEXT NOT NULL,
      source_id TEXT,
      current_revision_id TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_wiki_pages_store_project ON wiki_pages_store(project_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_wiki_pages_store_project_slug ON wiki_pages_store(project_id, slug);
    CREATE INDEX IF NOT EXISTS idx_wiki_pages_store_project_type ON wiki_pages_store(project_id, page_type);
    CREATE INDEX IF NOT EXISTS idx_wiki_pages_store_project_source ON wiki_pages_store(project_id, source_id);

    CREATE TABLE IF NOT EXISTS wiki_page_revisions_store (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_wiki_page_revisions_store_page ON wiki_page_revisions_store(page_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS wiki_page_source_links_store (
      page_id TEXT NOT NULL,
      source_id TEXT NOT NULL,
      PRIMARY KEY (page_id, source_id)
    );
    CREATE INDEX IF NOT EXISTS idx_wiki_page_source_links_store_page ON wiki_page_source_links_store(page_id);
    CREATE INDEX IF NOT EXISTS idx_wiki_page_source_links_store_source ON wiki_page_source_links_store(source_id);

    CREATE TABLE IF NOT EXISTS claims_store (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      wiki_page_id TEXT NOT NULL,
      support_status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_claims_store_project ON claims_store(project_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_claims_store_wiki_page ON claims_store(wiki_page_id, created_at ASC);

    CREATE TABLE IF NOT EXISTS evidence_links_store (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      claim_id TEXT NOT NULL,
      source_id TEXT NOT NULL,
      source_fragment_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_evidence_links_store_project ON evidence_links_store(project_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_evidence_links_store_claim ON evidence_links_store(claim_id, created_at ASC);

    CREATE TABLE IF NOT EXISTS artifacts_store (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      artifact_type TEXT NOT NULL,
      status TEXT NOT NULL,
      provenance TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_artifacts_store_project ON artifacts_store(project_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS ask_sessions_store (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      answer_mode TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_ask_sessions_store_project ON ask_sessions_store(project_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS theses_store (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      current_revision_id TEXT,
      updated_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS thesis_revisions_store (
      id TEXT PRIMARY KEY,
      thesis_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      revision_number INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_thesis_revisions_store_project ON thesis_revisions_store(project_id, revision_number DESC, created_at DESC);

    CREATE TABLE IF NOT EXISTS source_monitoring_records_store (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      source_id TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_source_monitoring_records_store_project ON source_monitoring_records_store(project_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS stale_alerts_store (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_stale_alerts_store_project ON stale_alerts_store(project_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS monitoring_analysis_states_store (
      project_id TEXT PRIMARY KEY,
      last_evaluated_at TEXT,
      payload TEXT NOT NULL
    );
  `);

  const insertSetting = database.prepare(`
    INSERT OR IGNORE INTO app_settings (key, value)
    VALUES (?, ?)
  `);
  insertSetting.run("active_project_id", activeProjectId);

  const insertProject = database.prepare(`
    INSERT OR IGNORE INTO projects_store (
      id, slug, name, status, created_at, updated_at, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const project of seedProjects) {
    insertProject.run(
      project.id,
      project.slug,
      project.name,
      project.status,
      project.createdAt,
      project.updatedAt,
      serializeRecord(project),
    );
  }

  const insertSource = database.prepare(`
    INSERT OR IGNORE INTO sources_store (
      id, project_id, source_type, status, title, created_at, updated_at, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const source of seedSources) {
    insertSource.run(
      source.id,
      source.projectId,
      source.sourceType,
      source.status,
      source.title,
      source.createdAt,
      source.updatedAt,
      serializeRecord(source),
    );
  }

  const insertSourceFragment = database.prepare(`
    INSERT OR IGNORE INTO source_fragments_store (
      id, project_id, source_id, fragment_index, updated_at, payload
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const fragment of seedSourceFragments) {
    insertSourceFragment.run(
      fragment.id,
      fragment.projectId,
      fragment.sourceId,
      fragment.index,
      fragment.updatedAt,
      serializeRecord(fragment),
    );
  }

  const insertWikiPage = database.prepare(`
    INSERT OR IGNORE INTO wiki_pages_store (
      id, project_id, slug, page_type, source_id, current_revision_id, status, created_at, updated_at, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const page of seedWikiPages) {
    insertWikiPage.run(
      page.id,
      page.projectId,
      page.slug,
      page.pageType,
      page.sourceId ?? null,
      page.currentRevisionId,
      page.status,
      page.createdAt,
      page.updatedAt,
      serializeRecord(page),
    );
  }

  const insertWikiPageRevision = database.prepare(`
    INSERT OR IGNORE INTO wiki_page_revisions_store (
      id, page_id, created_at, payload
    ) VALUES (?, ?, ?, ?)
  `);
  for (const revision of seedWikiPageRevisions) {
    insertWikiPageRevision.run(
      revision.id,
      revision.pageId,
      revision.createdAt,
      serializeRecord(revision),
    );
  }

  const insertWikiPageSourceLink = database.prepare(`
    INSERT OR IGNORE INTO wiki_page_source_links_store (
      page_id, source_id
    ) VALUES (?, ?)
  `);
  for (const link of seedWikiPageSourceLinks) {
    insertWikiPageSourceLink.run(link.pageId, link.sourceId);
  }

  const insertClaim = database.prepare(`
    INSERT OR IGNORE INTO claims_store (
      id, project_id, wiki_page_id, support_status, created_at, updated_at, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const claim of seedClaims) {
    insertClaim.run(
      claim.id,
      claim.projectId,
      claim.wikiPageId,
      claim.supportStatus,
      claim.createdAt,
      claim.updatedAt,
      serializeRecord(claim),
    );
  }

  const insertEvidenceLink = database.prepare(`
    INSERT OR IGNORE INTO evidence_links_store (
      id, project_id, claim_id, source_id, source_fragment_id, created_at, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const evidenceLink of seedEvidenceLinks) {
    insertEvidenceLink.run(
      evidenceLink.id,
      evidenceLink.projectId,
      evidenceLink.claimId,
      evidenceLink.sourceId,
      evidenceLink.sourceFragmentId,
      evidenceLink.createdAt,
      serializeRecord(evidenceLink),
    );
  }

  const insertArtifact = database.prepare(`
    INSERT OR IGNORE INTO artifacts_store (
      id, project_id, artifact_type, status, provenance, created_at, updated_at, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const artifact of seedArtifacts) {
    insertArtifact.run(
      artifact.id,
      artifact.projectId,
      artifact.artifactType,
      artifact.status,
      artifact.provenance,
      artifact.createdAt,
      artifact.updatedAt,
      serializeRecord(artifact),
    );
  }

  const insertAskSession = database.prepare(`
    INSERT OR IGNORE INTO ask_sessions_store (
      id, project_id, answer_mode, created_at, updated_at, payload
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const session of seedAskSessions) {
    insertAskSession.run(
      session.id,
      session.projectId,
      session.answerMode,
      session.createdAt,
      session.updatedAt,
      serializeRecord(session),
    );
  }

  const insertThesis = database.prepare(`
    INSERT OR IGNORE INTO theses_store (
      id, project_id, status, current_revision_id, updated_at, payload
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const thesis of seedTheses) {
    insertThesis.run(
      thesis.id,
      thesis.projectId,
      thesis.status,
      thesis.currentRevisionId,
      thesis.updatedAt,
      serializeRecord(thesis),
    );
  }

  const insertThesisRevision = database.prepare(`
    INSERT OR IGNORE INTO thesis_revisions_store (
      id, thesis_id, project_id, revision_number, created_at, payload
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const revision of seedThesisRevisions) {
    insertThesisRevision.run(
      revision.id,
      revision.thesisId,
      revision.projectId,
      revision.revisionNumber,
      revision.createdAt,
      serializeRecord(revision),
    );
  }

  const insertMonitoringRecord = database.prepare(`
    INSERT OR IGNORE INTO source_monitoring_records_store (
      id, project_id, source_id, updated_at, payload
    ) VALUES (?, ?, ?, ?, ?)
  `);
  for (const record of seedSourceMonitoringRecords) {
    insertMonitoringRecord.run(
      record.id,
      record.projectId,
      record.sourceId,
      record.updatedAt,
      serializeRecord(record),
    );
  }

  const insertStaleAlert = database.prepare(`
    INSERT OR IGNORE INTO stale_alerts_store (
      id, project_id, severity, status, updated_at, payload
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const alert of seedStaleAlerts) {
    insertStaleAlert.run(
      alert.id,
      alert.projectId,
      alert.severity,
      alert.status,
      alert.updatedAt,
      serializeRecord(alert),
    );
  }

  const insertAnalysisState = database.prepare(`
    INSERT OR IGNORE INTO monitoring_analysis_states_store (
      project_id, last_evaluated_at, payload
    ) VALUES (?, ?, ?)
  `);
  for (const state of seedMonitoringAnalysisStates) {
    insertAnalysisState.run(
      state.projectId,
      state.lastEvaluatedAt,
      serializeRecord(state),
    );
  }

  schemaReady = true;
}

export function getPersistenceDatabase(): SqliteDatabase | null {
  if (databaseInstance !== undefined) {
    return databaseInstance;
  }

  if (getPersistenceMode() === "memory") {
    databaseInstance = null;
    return databaseInstance;
  }

  const DatabaseSync = resolveDatabaseSync();

  if (!DatabaseSync) {
    databaseInstance = null;
    return databaseInstance;
  }

  const databasePath = getPersistenceDatabasePath();
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });

  const database = new DatabaseSync(databasePath);
  ensureSchema(database);
  databaseInstance = database;

  return databaseInstance;
}

export function listPersistedRecords<T>(table: string, sql: string, ...params: unknown[]): T[] {
  void table;
  const database = getPersistenceDatabase();

  if (!database) {
    return [];
  }

  const rows = database.prepare(sql).all(...params);
  return deserializeRows<T>(rows);
}

export function getPersistedRecord<T>(sql: string, ...params: unknown[]): T | null {
  const database = getPersistenceDatabase();

  if (!database) {
    return null;
  }

  const row = database.prepare(sql).get(...params);
  return deserializeRecord<T>(row ?? null);
}

export function getPersistedSetting(key: string): string | null {
  const database = getPersistenceDatabase();

  if (!database) {
    return null;
  }

  const row = database
    .prepare("SELECT value FROM app_settings WHERE key = ?")
    .get(key);

  return row && typeof row.value === "string" ? row.value : null;
}

export function upsertProjectRecord(project: Project): void {
  const database = getPersistenceDatabase();

  if (!database) {
    return;
  }

  database
    .prepare(`
      INSERT INTO projects_store (
        id, slug, name, status, created_at, updated_at, payload
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        slug = excluded.slug,
        name = excluded.name,
        status = excluded.status,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        payload = excluded.payload
    `)
    .run(
      project.id,
      project.slug,
      project.name,
      project.status,
      project.createdAt,
      project.updatedAt,
      serializeRecord(project),
    );
}

export function upsertSourceRecord(source: Source): void {
  const database = getPersistenceDatabase();

  if (!database) {
    return;
  }

  database
    .prepare(`
      INSERT INTO sources_store (
        id, project_id, source_type, status, title, created_at, updated_at, payload
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        source_type = excluded.source_type,
        status = excluded.status,
        title = excluded.title,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        payload = excluded.payload
    `)
    .run(
      source.id,
      source.projectId,
      source.sourceType,
      source.status,
      source.title,
      source.createdAt,
      source.updatedAt,
      serializeRecord(source),
    );
}

export function replaceSourceFragmentRecords(
  sourceId: string,
  projectId: string,
  fragments: SourceFragment[],
): void {
  const database = getPersistenceDatabase();

  if (!database) {
    return;
  }

  const deleteStatement = database.prepare(
    "DELETE FROM source_fragments_store WHERE source_id = ?",
  );
  const insertStatement = database.prepare(`
    INSERT INTO source_fragments_store (
      id, project_id, source_id, fragment_index, updated_at, payload
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      project_id = excluded.project_id,
      source_id = excluded.source_id,
      fragment_index = excluded.fragment_index,
      updated_at = excluded.updated_at,
      payload = excluded.payload
  `);

  deleteStatement.run(sourceId);

  for (const fragment of fragments) {
    insertStatement.run(
      fragment.id,
      projectId,
      sourceId,
      fragment.index,
      fragment.updatedAt,
      serializeRecord(fragment),
    );
  }
}

export function upsertArtifactRecord(artifact: Artifact): void {
  const database = getPersistenceDatabase();

  if (!database) {
    return;
  }

  database
    .prepare(`
      INSERT INTO artifacts_store (
        id, project_id, artifact_type, status, provenance, created_at, updated_at, payload
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        artifact_type = excluded.artifact_type,
        status = excluded.status,
        provenance = excluded.provenance,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        payload = excluded.payload
    `)
    .run(
      artifact.id,
      artifact.projectId,
      artifact.artifactType,
      artifact.status,
      artifact.provenance,
      artifact.createdAt,
      artifact.updatedAt,
      serializeRecord(artifact),
    );
}

export function upsertAskSessionRecord(session: AskSession): void {
  const database = getPersistenceDatabase();

  if (!database) {
    return;
  }

  database
    .prepare(`
      INSERT INTO ask_sessions_store (
        id, project_id, answer_mode, created_at, updated_at, payload
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        answer_mode = excluded.answer_mode,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        payload = excluded.payload
    `)
    .run(
      session.id,
      session.projectId,
      session.answerMode,
      session.createdAt,
      session.updatedAt,
      serializeRecord(session),
    );
}

export function upsertThesisRecord(thesis: Thesis): void {
  const database = getPersistenceDatabase();

  if (!database) {
    return;
  }

  database
    .prepare(`
      INSERT INTO theses_store (
        id, project_id, status, current_revision_id, updated_at, payload
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        status = excluded.status,
        current_revision_id = excluded.current_revision_id,
        updated_at = excluded.updated_at,
        payload = excluded.payload
    `)
    .run(
      thesis.id,
      thesis.projectId,
      thesis.status,
      thesis.currentRevisionId,
      thesis.updatedAt,
      serializeRecord(thesis),
    );
}

export function upsertThesisRevisionRecord(revision: ThesisRevision): void {
  const database = getPersistenceDatabase();

  if (!database) {
    return;
  }

  database
    .prepare(`
      INSERT INTO thesis_revisions_store (
        id, thesis_id, project_id, revision_number, created_at, payload
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        thesis_id = excluded.thesis_id,
        project_id = excluded.project_id,
        revision_number = excluded.revision_number,
        created_at = excluded.created_at,
        payload = excluded.payload
    `)
    .run(
      revision.id,
      revision.thesisId,
      revision.projectId,
      revision.revisionNumber,
      revision.createdAt,
      serializeRecord(revision),
    );
}

export function upsertMonitoringRecord(record: SourceMonitoringRecord): void {
  const database = getPersistenceDatabase();

  if (!database) {
    return;
  }

  database
    .prepare(`
      INSERT INTO source_monitoring_records_store (
        id, project_id, source_id, updated_at, payload
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        source_id = excluded.source_id,
        updated_at = excluded.updated_at,
        payload = excluded.payload
    `)
    .run(
      record.id,
      record.projectId,
      record.sourceId,
      record.updatedAt,
      serializeRecord(record),
    );
}

export function upsertStaleAlertRecord(alert: StaleAlert): void {
  const database = getPersistenceDatabase();

  if (!database) {
    return;
  }

  database
    .prepare(`
      INSERT INTO stale_alerts_store (
        id, project_id, severity, status, updated_at, payload
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        severity = excluded.severity,
        status = excluded.status,
        updated_at = excluded.updated_at,
        payload = excluded.payload
    `)
    .run(
      alert.id,
      alert.projectId,
      alert.severity,
      alert.status,
      alert.updatedAt,
      serializeRecord(alert),
    );
}

export function upsertMonitoringAnalysisStateRecord(
  state: MonitoringAnalysisState,
): void {
  const database = getPersistenceDatabase();

  if (!database) {
    return;
  }

  database
    .prepare(`
      INSERT INTO monitoring_analysis_states_store (
        project_id, last_evaluated_at, payload
      ) VALUES (?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET
        last_evaluated_at = excluded.last_evaluated_at,
        payload = excluded.payload
    `)
    .run(
      state.projectId,
      state.lastEvaluatedAt,
      serializeRecord(state),
    );
}

export function deleteRecordsByIds(table: string, ids: string[]): void {
  const database = getPersistenceDatabase();

  if (!database || ids.length === 0) {
    return;
  }

  const placeholders = ids.map(() => "?").join(", ");
  database.prepare(`DELETE FROM ${table} WHERE id IN (${placeholders})`).run(...ids);
}
