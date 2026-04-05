import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import {
  activeProjectId,
  seedEntities,
  seedEntityAnalysisStates,
  seedCatalysts,
  seedCatalystCompileStates,
  seedClaims,
  seedCompanyDossiers,
  seedContradictions,
  seedContradictionAnalysisStates,
  seedEvidenceLinks,
  seedArtifacts,
  seedAskSessions,
  seedTimelineEvents,
  seedTimelineCompileStates,
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
  Catalyst,
  CatalystCompileState,
  CompanyDossier,
  Contradiction,
  ContradictionAnalysisState,
  EntityAnalysisState,
  LintIssue,
  MonitoringAnalysisState,
  Project,
  ResearchEntity,
  Source,
  SourceFragment,
  SourceMonitoringRecord,
  StaleAlert,
  Thesis,
  ThesisRevision,
  TimelineCompileState,
  TimelineEvent,
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

    CREATE TABLE IF NOT EXISTS entities_store (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      canonical_name TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_entities_store_project ON entities_store(project_id, entity_type, canonical_name);

    CREATE TABLE IF NOT EXISTS entity_analysis_states_store (
      project_id TEXT PRIMARY KEY,
      last_compiled_at TEXT,
      payload TEXT NOT NULL
    );

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

    CREATE TABLE IF NOT EXISTS catalysts_store (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      catalyst_type TEXT NOT NULL,
      status TEXT NOT NULL,
      importance TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_catalysts_store_project ON catalysts_store(project_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS catalyst_compile_states_store (
      project_id TEXT PRIMARY KEY,
      last_compiled_at TEXT,
      payload TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contradictions_store (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      contradiction_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_contradictions_store_project ON contradictions_store(project_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS contradiction_analysis_states_store (
      project_id TEXT PRIMARY KEY,
      last_analyzed_at TEXT,
      payload TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS timeline_events_store (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      event_date TEXT NOT NULL,
      event_type TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_timeline_events_store_project ON timeline_events_store(project_id, event_date ASC, updated_at DESC);

    CREATE TABLE IF NOT EXISTS timeline_compile_states_store (
      project_id TEXT PRIMARY KEY,
      last_compiled_at TEXT,
      payload TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS company_dossiers_store (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_company_dossiers_store_project ON company_dossiers_store(project_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS lint_issues_store (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      issue_type TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_lint_issues_store_project ON lint_issues_store(project_id, updated_at DESC);
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

  const insertEntity = database.prepare(`
    INSERT OR IGNORE INTO entities_store (
      id, project_id, entity_type, canonical_name, updated_at, payload
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const entity of seedEntities) {
    insertEntity.run(
      entity.id,
      entity.projectId,
      entity.entityType,
      entity.canonicalName,
      entity.updatedAt,
      serializeRecord(entity),
    );
  }

  const insertEntityAnalysisState = database.prepare(`
    INSERT OR IGNORE INTO entity_analysis_states_store (
      project_id, last_compiled_at, payload
    ) VALUES (?, ?, ?)
  `);
  for (const state of seedEntityAnalysisStates) {
    insertEntityAnalysisState.run(
      state.projectId,
      state.lastCompiledAt,
      serializeRecord(state),
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

  const insertCatalyst = database.prepare(`
    INSERT OR IGNORE INTO catalysts_store (
      id, project_id, catalyst_type, status, importance, updated_at, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const catalyst of seedCatalysts) {
    insertCatalyst.run(
      catalyst.id,
      catalyst.projectId,
      catalyst.catalystType,
      catalyst.status,
      catalyst.importance,
      catalyst.updatedAt,
      serializeRecord(catalyst),
    );
  }

  const insertCatalystCompileState = database.prepare(`
    INSERT OR IGNORE INTO catalyst_compile_states_store (
      project_id, last_compiled_at, payload
    ) VALUES (?, ?, ?)
  `);
  for (const state of seedCatalystCompileStates) {
    insertCatalystCompileState.run(
      state.projectId,
      state.lastCompiledAt,
      serializeRecord(state),
    );
  }

  const insertContradiction = database.prepare(`
    INSERT OR IGNORE INTO contradictions_store (
      id, project_id, contradiction_type, severity, status, updated_at, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const contradiction of seedContradictions) {
    insertContradiction.run(
      contradiction.id,
      contradiction.projectId,
      contradiction.contradictionType,
      contradiction.severity,
      contradiction.status,
      contradiction.updatedAt,
      serializeRecord(contradiction),
    );
  }

  const insertContradictionAnalysisState = database.prepare(`
    INSERT OR IGNORE INTO contradiction_analysis_states_store (
      project_id, last_analyzed_at, payload
    ) VALUES (?, ?, ?)
  `);
  for (const state of seedContradictionAnalysisStates) {
    insertContradictionAnalysisState.run(
      state.projectId,
      state.lastAnalyzedAt,
      serializeRecord(state),
    );
  }

  const insertTimelineEvent = database.prepare(`
    INSERT OR IGNORE INTO timeline_events_store (
      id, project_id, event_date, event_type, updated_at, payload
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const event of seedTimelineEvents) {
    insertTimelineEvent.run(
      event.id,
      event.projectId,
      event.eventDate,
      event.eventType,
      event.updatedAt,
      serializeRecord(event),
    );
  }

  const insertTimelineCompileState = database.prepare(`
    INSERT OR IGNORE INTO timeline_compile_states_store (
      project_id, last_compiled_at, payload
    ) VALUES (?, ?, ?)
  `);
  for (const state of seedTimelineCompileStates) {
    insertTimelineCompileState.run(
      state.projectId,
      state.lastCompiledAt,
      serializeRecord(state),
    );
  }

  const insertCompanyDossier = database.prepare(`
    INSERT OR IGNORE INTO company_dossiers_store (
      id, project_id, status, updated_at, payload
    ) VALUES (?, ?, ?, ?, ?)
  `);
  for (const dossier of seedCompanyDossiers) {
    insertCompanyDossier.run(
      dossier.id,
      dossier.projectId,
      dossier.status,
      dossier.updatedAt,
      serializeRecord(dossier),
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

export function upsertEntityRecord(entity: ResearchEntity): void {
  const database = getPersistenceDatabase();

  if (!database) {
    return;
  }

  database
    .prepare(`
      INSERT INTO entities_store (
        id, project_id, entity_type, canonical_name, updated_at, payload
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        entity_type = excluded.entity_type,
        canonical_name = excluded.canonical_name,
        updated_at = excluded.updated_at,
        payload = excluded.payload
    `)
    .run(
      entity.id,
      entity.projectId,
      entity.entityType,
      entity.canonicalName,
      entity.updatedAt,
      serializeRecord(entity),
    );
}

export function upsertEntityAnalysisStateRecord(state: EntityAnalysisState): void {
  const database = getPersistenceDatabase();

  if (!database) {
    return;
  }

  database
    .prepare(`
      INSERT INTO entity_analysis_states_store (
        project_id, last_compiled_at, payload
      ) VALUES (?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET
        last_compiled_at = excluded.last_compiled_at,
        payload = excluded.payload
    `)
    .run(
      state.projectId,
      state.lastCompiledAt,
      serializeRecord(state),
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

export function upsertCatalystRecord(catalyst: Catalyst): void {
  const database = getPersistenceDatabase();

  if (!database) {
    return;
  }

  database
    .prepare(`
      INSERT INTO catalysts_store (
        id, project_id, catalyst_type, status, importance, updated_at, payload
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        catalyst_type = excluded.catalyst_type,
        status = excluded.status,
        importance = excluded.importance,
        updated_at = excluded.updated_at,
        payload = excluded.payload
    `)
    .run(
      catalyst.id,
      catalyst.projectId,
      catalyst.catalystType,
      catalyst.status,
      catalyst.importance,
      catalyst.updatedAt,
      serializeRecord(catalyst),
    );
}

export function upsertCatalystCompileStateRecord(state: CatalystCompileState): void {
  const database = getPersistenceDatabase();

  if (!database) {
    return;
  }

  database
    .prepare(`
      INSERT INTO catalyst_compile_states_store (
        project_id, last_compiled_at, payload
      ) VALUES (?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET
        last_compiled_at = excluded.last_compiled_at,
        payload = excluded.payload
    `)
    .run(state.projectId, state.lastCompiledAt, serializeRecord(state));
}

export function upsertContradictionRecord(contradiction: Contradiction): void {
  const database = getPersistenceDatabase();

  if (!database) {
    return;
  }

  database
    .prepare(`
      INSERT INTO contradictions_store (
        id, project_id, contradiction_type, severity, status, updated_at, payload
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        contradiction_type = excluded.contradiction_type,
        severity = excluded.severity,
        status = excluded.status,
        updated_at = excluded.updated_at,
        payload = excluded.payload
    `)
    .run(
      contradiction.id,
      contradiction.projectId,
      contradiction.contradictionType,
      contradiction.severity,
      contradiction.status,
      contradiction.updatedAt,
      serializeRecord(contradiction),
    );
}

export function upsertContradictionAnalysisStateRecord(
  state: ContradictionAnalysisState,
): void {
  const database = getPersistenceDatabase();

  if (!database) {
    return;
  }

  database
    .prepare(`
      INSERT INTO contradiction_analysis_states_store (
        project_id, last_analyzed_at, payload
      ) VALUES (?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET
        last_analyzed_at = excluded.last_analyzed_at,
        payload = excluded.payload
    `)
    .run(state.projectId, state.lastAnalyzedAt, serializeRecord(state));
}

export function upsertTimelineEventRecord(event: TimelineEvent): void {
  const database = getPersistenceDatabase();

  if (!database) {
    return;
  }

  database
    .prepare(`
      INSERT INTO timeline_events_store (
        id, project_id, event_date, event_type, updated_at, payload
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        event_date = excluded.event_date,
        event_type = excluded.event_type,
        updated_at = excluded.updated_at,
        payload = excluded.payload
    `)
    .run(
      event.id,
      event.projectId,
      event.eventDate,
      event.eventType,
      event.updatedAt,
      serializeRecord(event),
    );
}

export function upsertTimelineCompileStateRecord(state: TimelineCompileState): void {
  const database = getPersistenceDatabase();

  if (!database) {
    return;
  }

  database
    .prepare(`
      INSERT INTO timeline_compile_states_store (
        project_id, last_compiled_at, payload
      ) VALUES (?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET
        last_compiled_at = excluded.last_compiled_at,
        payload = excluded.payload
    `)
    .run(state.projectId, state.lastCompiledAt, serializeRecord(state));
}

export function upsertCompanyDossierRecord(dossier: CompanyDossier): void {
  const database = getPersistenceDatabase();

  if (!database) {
    return;
  }

  database
    .prepare(`
      INSERT INTO company_dossiers_store (
        id, project_id, status, updated_at, payload
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        status = excluded.status,
        updated_at = excluded.updated_at,
        payload = excluded.payload
    `)
    .run(
      dossier.id,
      dossier.projectId,
      dossier.status,
      dossier.updatedAt,
      serializeRecord(dossier),
    );
}

export function upsertLintIssueRecord(issue: LintIssue): void {
  const database = getPersistenceDatabase();

  if (!database) {
    return;
  }

  database
    .prepare(`
      INSERT INTO lint_issues_store (
        id, project_id, issue_type, severity, status, updated_at, payload
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        issue_type = excluded.issue_type,
        severity = excluded.severity,
        status = excluded.status,
        updated_at = excluded.updated_at,
        payload = excluded.payload
    `)
    .run(
      issue.id,
      issue.projectId,
      issue.issueType,
      issue.severity,
      issue.status,
      issue.updatedAt,
      serializeRecord(issue),
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
