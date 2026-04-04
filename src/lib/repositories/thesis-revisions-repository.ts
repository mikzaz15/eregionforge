import { seedThesisRevisions } from "@/lib/domain/seed-data";
import type { ThesisRevision } from "@/lib/domain/types";
import {
  getPersistedRecord,
  getPersistenceMode,
  listPersistedRecords,
  upsertThesisRevisionRecord,
} from "@/lib/persistence/database";

const thesisRevisionsStore: ThesisRevision[] = structuredClone(seedThesisRevisions);

export interface ThesisRevisionsRepository {
  listByProjectId(projectId: string): Promise<ThesisRevision[]>;
  getById(revisionId: string): Promise<ThesisRevision | null>;
  create(input: Omit<ThesisRevision, "id" | "createdAt">): Promise<ThesisRevision>;
}

class InMemoryThesisRevisionsRepository implements ThesisRevisionsRepository {
  async listByProjectId(projectId: string): Promise<ThesisRevision[]> {
    return structuredClone(
      thesisRevisionsStore
        .filter((revision) => revision.projectId === projectId)
        .sort(
          (left, right) =>
            right.revisionNumber - left.revisionNumber ||
            right.createdAt.localeCompare(left.createdAt),
        ),
    );
  }

  async getById(revisionId: string): Promise<ThesisRevision | null> {
    const revision = thesisRevisionsStore.find((candidate) => candidate.id === revisionId);
    return revision ? structuredClone(revision) : null;
  }

  async create(
    input: Omit<ThesisRevision, "id" | "createdAt">,
  ): Promise<ThesisRevision> {
    const createdAt = new Date().toISOString();
    const revision: ThesisRevision = {
      id: `thesis-revision-${input.projectId}-${String(input.revisionNumber).padStart(3, "0")}`,
      thesisId: input.thesisId,
      projectId: input.projectId,
      revisionNumber: input.revisionNumber,
      status: input.status,
      stance: input.stance,
      confidence: input.confidence,
      summary: input.summary,
      bullCaseMarkdown: input.bullCaseMarkdown,
      bearCaseMarkdown: input.bearCaseMarkdown,
      variantViewMarkdown: input.variantViewMarkdown,
      keyRisksMarkdown: input.keyRisksMarkdown,
      keyUnknownsMarkdown: input.keyUnknownsMarkdown,
      catalystSummaryMarkdown: input.catalystSummaryMarkdown,
      changeSummary: input.changeSummary,
      supportBySection: structuredClone(input.supportBySection),
      metadata: input.metadata ? structuredClone(input.metadata) : {},
      createdAt,
    };

    thesisRevisionsStore.unshift(revision);
    return structuredClone(revision);
  }
}

class SqliteThesisRevisionsRepository implements ThesisRevisionsRepository {
  async listByProjectId(projectId: string): Promise<ThesisRevision[]> {
    return listPersistedRecords<ThesisRevision>(
      "thesis_revisions_store",
      `SELECT payload
       FROM thesis_revisions_store
       WHERE project_id = ?
       ORDER BY revision_number DESC, created_at DESC`,
      projectId,
    );
  }

  async getById(revisionId: string): Promise<ThesisRevision | null> {
    return getPersistedRecord<ThesisRevision>(
      "SELECT payload FROM thesis_revisions_store WHERE id = ?",
      revisionId,
    );
  }

  async create(
    input: Omit<ThesisRevision, "id" | "createdAt">,
  ): Promise<ThesisRevision> {
    const revision: ThesisRevision = {
      id: `thesis-revision-${input.projectId}-${String(input.revisionNumber).padStart(3, "0")}`,
      thesisId: input.thesisId,
      projectId: input.projectId,
      revisionNumber: input.revisionNumber,
      status: input.status,
      stance: input.stance,
      confidence: input.confidence,
      summary: input.summary,
      bullCaseMarkdown: input.bullCaseMarkdown,
      bearCaseMarkdown: input.bearCaseMarkdown,
      variantViewMarkdown: input.variantViewMarkdown,
      keyRisksMarkdown: input.keyRisksMarkdown,
      keyUnknownsMarkdown: input.keyUnknownsMarkdown,
      catalystSummaryMarkdown: input.catalystSummaryMarkdown,
      changeSummary: input.changeSummary,
      supportBySection: structuredClone(input.supportBySection),
      metadata: input.metadata ? structuredClone(input.metadata) : {},
      createdAt: new Date().toISOString(),
    };

    upsertThesisRevisionRecord(revision);
    return structuredClone(revision);
  }
}

export const thesisRevisionsRepository: ThesisRevisionsRepository =
  getPersistenceMode() === "sqlite"
    ? new SqliteThesisRevisionsRepository()
    : new InMemoryThesisRevisionsRepository();
