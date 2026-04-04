import { seedSources } from "@/lib/domain/seed-data";
import type { Source, SourceInput, SourceStatus } from "@/lib/domain/types";
import {
  getPersistedRecord,
  getPersistenceMode,
  listPersistedRecords,
  upsertSourceRecord,
} from "@/lib/persistence/database";

const sourcesStore: Source[] = structuredClone(seedSources);

type CreateSourceRecordInput = SourceInput & {
  projectId: string;
};

export interface SourcesRepository {
  listByProjectId(projectId: string): Promise<Source[]>;
  getById(sourceId: string): Promise<Source | null>;
  create(input: CreateSourceRecordInput): Promise<Source>;
  updateStatus(sourceId: string, status: SourceStatus): Promise<Source | null>;
}

class InMemorySourcesRepository implements SourcesRepository {
  async listByProjectId(projectId: string): Promise<Source[]> {
    return structuredClone(
      sourcesStore.filter((source) => source.projectId === projectId),
    );
  }

  async getById(sourceId: string): Promise<Source | null> {
    const source = sourcesStore.find((candidate) => candidate.id === sourceId);
    return source ? structuredClone(source) : null;
  }

  async create(input: CreateSourceRecordInput): Promise<Source> {
    const now = new Date().toISOString();
    const source: Source = {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      sourceType: input.sourceType,
      title: input.title,
      body: input.body ?? null,
      url: input.url ?? null,
      filePath: input.filePath ?? null,
      status: input.status,
      provenance: {
        label:
          input.sourceType === "text"
            ? "Workspace pasted input"
            : input.sourceType === "markdown"
              ? "Workspace markdown placeholder"
              : input.sourceType === "pdf"
                ? "Workspace PDF placeholder"
                : "Workspace URL placeholder",
        kind: "workspace-ingestion",
      },
      metadata: {
        createdVia: "sources-page",
      },
      createdAt: now,
      updatedAt: now,
    };

    sourcesStore.unshift(source);
    return structuredClone(source);
  }

  async updateStatus(
    sourceId: string,
    status: SourceStatus,
  ): Promise<Source | null> {
    const source = sourcesStore.find((candidate) => candidate.id === sourceId);

    if (!source) {
      return null;
    }

    source.status = status;
    source.updatedAt = new Date().toISOString();

    return structuredClone(source);
  }
}

class SqliteSourcesRepository implements SourcesRepository {
  async listByProjectId(projectId: string): Promise<Source[]> {
    return listPersistedRecords<Source>(
      "sources_store",
      "SELECT payload FROM sources_store WHERE project_id = ? ORDER BY created_at DESC, title ASC",
      projectId,
    );
  }

  async getById(sourceId: string): Promise<Source | null> {
    return getPersistedRecord<Source>(
      "SELECT payload FROM sources_store WHERE id = ?",
      sourceId,
    );
  }

  async create(input: CreateSourceRecordInput): Promise<Source> {
    const now = new Date().toISOString();
    const source: Source = {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      sourceType: input.sourceType,
      title: input.title,
      body: input.body ?? null,
      url: input.url ?? null,
      filePath: input.filePath ?? null,
      status: input.status,
      provenance: {
        label:
          input.sourceType === "text"
            ? "Workspace pasted input"
            : input.sourceType === "markdown"
              ? "Workspace markdown placeholder"
              : input.sourceType === "pdf"
                ? "Workspace PDF placeholder"
                : "Workspace URL placeholder",
        kind: "workspace-ingestion",
      },
      metadata: {
        createdVia: "sources-page",
      },
      createdAt: now,
      updatedAt: now,
    };

    upsertSourceRecord(source);
    return structuredClone(source);
  }

  async updateStatus(sourceId: string, status: SourceStatus): Promise<Source | null> {
    const source = await this.getById(sourceId);

    if (!source) {
      return null;
    }

    source.status = status;
    source.updatedAt = new Date().toISOString();
    upsertSourceRecord(source);
    return structuredClone(source);
  }
}

export const sourcesRepository: SourcesRepository =
  getPersistenceMode() === "sqlite"
    ? new SqliteSourcesRepository()
    : new InMemorySourcesRepository();
