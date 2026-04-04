import { seedSourceFragments } from "@/lib/domain/seed-data";
import type {
  SourceFragment,
  SourceFragmentPayload,
} from "@/lib/domain/types";
import {
  getPersistenceDatabase,
  getPersistenceMode,
  listPersistedRecords,
  replaceSourceFragmentRecords,
} from "@/lib/persistence/database";

const sourceFragmentsStore: SourceFragment[] = structuredClone(seedSourceFragments);

export interface SourceFragmentsRepository {
  listBySourceId(sourceId: string): Promise<SourceFragment[]>;
  listByProjectId(projectId: string): Promise<SourceFragment[]>;
  replaceForSource(
    sourceId: string,
    fragments: SourceFragmentPayload[],
  ): Promise<SourceFragment[]>;
  countBySourceId(sourceId: string): Promise<number>;
}

class InMemorySourceFragmentsRepository implements SourceFragmentsRepository {
  async listBySourceId(sourceId: string): Promise<SourceFragment[]> {
    return structuredClone(
      sourceFragmentsStore
        .filter((fragment) => fragment.sourceId === sourceId)
        .sort((left, right) => left.index - right.index),
    );
  }

  async listByProjectId(projectId: string): Promise<SourceFragment[]> {
    return structuredClone(
      sourceFragmentsStore
        .filter((fragment) => fragment.projectId === projectId)
        .sort((left, right) =>
          left.sourceId.localeCompare(right.sourceId) || left.index - right.index,
        ),
    );
  }

  async replaceForSource(
    sourceId: string,
    fragments: SourceFragmentPayload[],
  ): Promise<SourceFragment[]> {
    for (let index = sourceFragmentsStore.length - 1; index >= 0; index -= 1) {
      if (sourceFragmentsStore[index].sourceId === sourceId) {
        sourceFragmentsStore.splice(index, 1);
      }
    }

    const now = new Date().toISOString();
    const stored = fragments
      .sort((left, right) => left.index - right.index)
      .map((fragment) => ({
        ...fragment,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
      }));

    sourceFragmentsStore.push(...stored);

    return structuredClone(stored);
  }

  async countBySourceId(sourceId: string): Promise<number> {
    return sourceFragmentsStore.filter((fragment) => fragment.sourceId === sourceId)
      .length;
  }
}

class SqliteSourceFragmentsRepository implements SourceFragmentsRepository {
  async listBySourceId(sourceId: string): Promise<SourceFragment[]> {
    return listPersistedRecords<SourceFragment>(
      "source_fragments_store",
      "SELECT payload FROM source_fragments_store WHERE source_id = ? ORDER BY fragment_index ASC",
      sourceId,
    );
  }

  async listByProjectId(projectId: string): Promise<SourceFragment[]> {
    return listPersistedRecords<SourceFragment>(
      "source_fragments_store",
      "SELECT payload FROM source_fragments_store WHERE project_id = ? ORDER BY source_id ASC, fragment_index ASC",
      projectId,
    );
  }

  async replaceForSource(
    sourceId: string,
    fragments: SourceFragmentPayload[],
  ): Promise<SourceFragment[]> {
    const now = new Date().toISOString();
    const stored = fragments
      .sort((left, right) => left.index - right.index)
      .map((fragment) => ({
        ...fragment,
        id: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
      }));

    const projectId = stored[0]?.projectId ?? fragments[0]?.projectId ?? null;

    if (projectId) {
      replaceSourceFragmentRecords(sourceId, projectId, stored);
    }

    return structuredClone(stored);
  }

  async countBySourceId(sourceId: string): Promise<number> {
    const database = getPersistenceDatabase();

    if (!database) {
      return 0;
    }

    const row = database
      .prepare(
        "SELECT COUNT(*) AS fragmentCount FROM source_fragments_store WHERE source_id = ?",
      )
      .get(sourceId);

    return typeof row?.fragmentCount === "number" ? row.fragmentCount : 0;
  }
}

export const sourceFragmentsRepository: SourceFragmentsRepository =
  getPersistenceMode() === "sqlite"
    ? new SqliteSourceFragmentsRepository()
    : new InMemorySourceFragmentsRepository();
