import { seedCatalystCompileStates, seedCatalysts } from "@/lib/domain/seed-data";
import type {
  Catalyst,
  CatalystCompileState,
  CatalystDraft,
  CatalystReviewStatus,
} from "@/lib/domain/types";
import {
  deleteRecordsByIds,
  getPersistedRecord,
  getPersistenceMode,
  listPersistedRecords,
  upsertCatalystCompileStateRecord,
  upsertCatalystRecord,
} from "@/lib/persistence/database";

const catalystsStore: Catalyst[] = structuredClone(seedCatalysts);
const catalystCompileStateStore = new Map(
  structuredClone(seedCatalystCompileStates).map((state) => [state.projectId, state] as const),
);

function catalystId(projectId: string, stableKey: string): string {
  return `catalyst-${projectId}-${stableKey}`;
}

export interface CatalystsRepository {
  listByProjectId(projectId: string): Promise<Catalyst[]>;
  syncProjectCatalysts(
    projectId: string,
    drafts: CatalystDraft[],
    summary: string,
  ): Promise<Catalyst[]>;
  getCompileState(projectId: string): Promise<CatalystCompileState>;
  updateReviewStatus(
    catalystId: string,
    reviewStatus: CatalystReviewStatus,
    reviewNote?: string | null,
    reviewedBy?: string | null,
  ): Promise<Catalyst | null>;
}

class InMemoryCatalystsRepository implements CatalystsRepository {
  async listByProjectId(projectId: string): Promise<Catalyst[]> {
    return structuredClone(
      catalystsStore
        .filter((candidate) => candidate.projectId === projectId)
        .sort((left, right) => {
          const timeframeCompare = (left.expectedTimeframe ?? "9999-12-31").localeCompare(
            right.expectedTimeframe ?? "9999-12-31",
          );
          return timeframeCompare || right.updatedAt.localeCompare(left.updatedAt);
        }),
    );
  }

  async syncProjectCatalysts(
    projectId: string,
    drafts: CatalystDraft[],
    summary: string,
  ): Promise<Catalyst[]> {
    const now = new Date().toISOString();
    const existingById = new Map(
      catalystsStore
        .filter((candidate) => candidate.projectId === projectId)
        .map((candidate) => [candidate.id, candidate] as const),
    );
    const nextCatalysts = drafts.map<Catalyst>((draft) => {
      const id = catalystId(projectId, draft.stableKey);
      const existing = existingById.get(id);

      if (existing) {
        existing.title = draft.title;
        existing.description = draft.description;
        existing.catalystType = draft.catalystType;
        existing.status = draft.status;
        existing.expectedTimeframe = draft.expectedTimeframe;
        existing.timeframePrecision = draft.timeframePrecision;
        existing.importance = draft.importance;
        existing.confidence = draft.confidence;
        existing.reviewStatus = existing.reviewStatus ?? "active";
        existing.reviewedAt = existing.reviewedAt ?? null;
        existing.reviewedBy = existing.reviewedBy ?? null;
        existing.reviewNote = existing.reviewNote ?? null;
        existing.linkedThesisId = draft.linkedThesisId ?? null;
        existing.linkedTimelineEventIds = structuredClone(draft.linkedTimelineEventIds);
        existing.linkedClaimIds = structuredClone(draft.linkedClaimIds);
        existing.linkedSourceIds = structuredClone(draft.linkedSourceIds);
        existing.linkedContradictionIds = structuredClone(draft.linkedContradictionIds);
        existing.metadata = draft.metadata ? structuredClone(draft.metadata) : {};
        existing.updatedAt = now;
        return structuredClone(existing);
      }

      const created: Catalyst = {
        id,
        projectId,
        title: draft.title,
        description: draft.description,
        catalystType: draft.catalystType,
        status: draft.status,
        expectedTimeframe: draft.expectedTimeframe,
        timeframePrecision: draft.timeframePrecision,
        importance: draft.importance,
        confidence: draft.confidence,
        reviewStatus: "active",
        reviewedAt: null,
        reviewedBy: null,
        reviewNote: null,
        linkedThesisId: draft.linkedThesisId ?? null,
        linkedTimelineEventIds: structuredClone(draft.linkedTimelineEventIds),
        linkedClaimIds: structuredClone(draft.linkedClaimIds),
        linkedSourceIds: structuredClone(draft.linkedSourceIds),
        linkedContradictionIds: structuredClone(draft.linkedContradictionIds),
        metadata: draft.metadata ? structuredClone(draft.metadata) : {},
        createdAt: now,
        updatedAt: now,
      };

      catalystsStore.push(created);
      return structuredClone(created);
    });

    const nextIds = new Set(nextCatalysts.map((candidate) => candidate.id));

    for (let index = catalystsStore.length - 1; index >= 0; index -= 1) {
      const catalyst = catalystsStore[index];
      if (catalyst.projectId === projectId && !nextIds.has(catalyst.id)) {
        catalystsStore.splice(index, 1);
      }
    }

    catalystCompileStateStore.set(projectId, {
      projectId,
      lastCompiledAt: now,
      catalystCount: nextCatalysts.length,
      summary,
    });

    return this.listByProjectId(projectId);
  }

  async getCompileState(projectId: string): Promise<CatalystCompileState> {
    return (
      structuredClone(catalystCompileStateStore.get(projectId)) ?? {
        projectId,
        lastCompiledAt: null,
        catalystCount: 0,
        summary: "Catalysts have not been compiled for this project yet.",
      }
    );
  }

  async updateReviewStatus(
    targetCatalystId: string,
    reviewStatus: CatalystReviewStatus,
    reviewNote?: string | null,
    reviewedBy = "workspace-operator",
  ): Promise<Catalyst | null> {
    const catalyst = catalystsStore.find((candidate) => candidate.id === targetCatalystId);

    if (!catalyst) {
      return null;
    }

    catalyst.reviewStatus = reviewStatus;
    catalyst.reviewedAt = new Date().toISOString();
    catalyst.reviewedBy = reviewedBy;
    catalyst.reviewNote = reviewNote ?? catalyst.reviewNote ?? null;
    catalyst.updatedAt = new Date().toISOString();

    return structuredClone(catalyst);
  }
}

class SqliteCatalystsRepository implements CatalystsRepository {
  async listByProjectId(projectId: string): Promise<Catalyst[]> {
    return listPersistedRecords<Catalyst>(
      "catalysts_store",
      `SELECT payload
       FROM catalysts_store
       WHERE project_id = ?
       ORDER BY updated_at DESC`,
      projectId,
    );
  }

  async syncProjectCatalysts(
    projectId: string,
    drafts: CatalystDraft[],
    summary: string,
  ): Promise<Catalyst[]> {
    const now = new Date().toISOString();
    const existing = await this.listByProjectId(projectId);
    const existingById = new Map(existing.map((entry) => [entry.id, entry] as const));
    const nextCatalysts = drafts.map<Catalyst>((draft) => {
      const id = catalystId(projectId, draft.stableKey);
      const previous = existingById.get(id);
      const catalyst: Catalyst = {
        id,
        projectId,
        title: draft.title,
        description: draft.description,
        catalystType: draft.catalystType,
        status: draft.status,
        expectedTimeframe: draft.expectedTimeframe,
        timeframePrecision: draft.timeframePrecision,
        importance: draft.importance,
        confidence: draft.confidence,
        reviewStatus: previous?.reviewStatus ?? "active",
        reviewedAt: previous?.reviewedAt ?? null,
        reviewedBy: previous?.reviewedBy ?? null,
        reviewNote: previous?.reviewNote ?? null,
        linkedThesisId: draft.linkedThesisId ?? null,
        linkedTimelineEventIds: structuredClone(draft.linkedTimelineEventIds),
        linkedClaimIds: structuredClone(draft.linkedClaimIds),
        linkedSourceIds: structuredClone(draft.linkedSourceIds),
        linkedContradictionIds: structuredClone(draft.linkedContradictionIds),
        metadata: draft.metadata ? structuredClone(draft.metadata) : {},
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
      };

      upsertCatalystRecord(catalyst);
      return catalyst;
    });

    const nextIds = new Set(nextCatalysts.map((entry) => entry.id));
    deleteRecordsByIds(
      "catalysts_store",
      existing.filter((entry) => !nextIds.has(entry.id)).map((entry) => entry.id),
    );

    upsertCatalystCompileStateRecord({
      projectId,
      lastCompiledAt: now,
      catalystCount: nextCatalysts.length,
      summary,
    });

    return this.listByProjectId(projectId);
  }

  async getCompileState(projectId: string): Promise<CatalystCompileState> {
    return (
      getPersistedRecord<CatalystCompileState>(
        "SELECT payload FROM catalyst_compile_states_store WHERE project_id = ?",
        projectId,
      ) ?? {
        projectId,
        lastCompiledAt: null,
        catalystCount: 0,
        summary: "Catalysts have not been compiled for this project yet.",
      }
    );
  }

  async updateReviewStatus(
    targetCatalystId: string,
    reviewStatus: CatalystReviewStatus,
    reviewNote?: string | null,
    reviewedBy = "workspace-operator",
  ): Promise<Catalyst | null> {
    const catalyst = await getPersistedRecord<Catalyst>(
      "SELECT payload FROM catalysts_store WHERE id = ?",
      targetCatalystId,
    );

    if (!catalyst) {
      return null;
    }

    const updated: Catalyst = {
      ...catalyst,
      reviewStatus,
      reviewedAt: new Date().toISOString(),
      reviewedBy,
      reviewNote: reviewNote ?? catalyst.reviewNote ?? null,
      updatedAt: new Date().toISOString(),
    };

    upsertCatalystRecord(updated);
    return structuredClone(updated);
  }
}

export const catalystsRepository: CatalystsRepository =
  getPersistenceMode() === "sqlite"
    ? new SqliteCatalystsRepository()
    : new InMemoryCatalystsRepository();
