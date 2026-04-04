import { seedContradictions } from "@/lib/domain/seed-data";
import type {
  Contradiction,
  ContradictionAnalysisState,
  ContradictionDraft,
  ContradictionStatus,
} from "@/lib/domain/types";

const contradictionsStore: Contradiction[] = structuredClone(seedContradictions);
const contradictionAnalysisStateStore = new Map<string, ContradictionAnalysisState>();

function contradictionId(projectId: string, stableKey: string): string {
  return `contradiction-${projectId}-${stableKey}`;
}

export interface ContradictionsRepository {
  listByProjectId(projectId: string): Promise<Contradiction[]>;
  syncProjectContradictions(
    projectId: string,
    contradictionDrafts: ContradictionDraft[],
    summary: string,
  ): Promise<Contradiction[]>;
  updateStatus(
    contradictionId: string,
    status: ContradictionStatus,
  ): Promise<Contradiction | null>;
  getAnalysisState(projectId: string): Promise<ContradictionAnalysisState>;
}

class InMemoryContradictionsRepository implements ContradictionsRepository {
  async listByProjectId(projectId: string): Promise<Contradiction[]> {
    return structuredClone(
      contradictionsStore
        .filter((contradiction) => contradiction.projectId === projectId)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    );
  }

  async syncProjectContradictions(
    projectId: string,
    contradictionDrafts: ContradictionDraft[],
    summary: string,
  ): Promise<Contradiction[]> {
    const now = new Date().toISOString();
    const existingById = new Map(
      contradictionsStore
        .filter((contradiction) => contradiction.projectId === projectId)
        .map((contradiction) => [contradiction.id, contradiction] as const),
    );
    const nextContradictions = contradictionDrafts.map<Contradiction>((draft) => {
      const id = contradictionId(projectId, draft.stableKey);
      const existing = existingById.get(id);

      if (existing) {
        existing.contradictionType = draft.contradictionType;
        existing.title = draft.title;
        existing.description = draft.description;
        existing.severity = draft.severity;
        existing.confidence = draft.confidence;
        existing.leftClaimId = draft.leftClaimId ?? null;
        existing.rightClaimId = draft.rightClaimId ?? null;
        existing.relatedPageIds = structuredClone(draft.relatedPageIds);
        existing.relatedSourceIds = structuredClone(draft.relatedSourceIds);
        existing.relatedTimelineEventIds = structuredClone(draft.relatedTimelineEventIds);
        existing.rationale = draft.rationale;
        existing.metadata = draft.metadata ? structuredClone(draft.metadata) : {};
        existing.updatedAt = now;
        return structuredClone(existing);
      }

      const created: Contradiction = {
        id,
        projectId,
        contradictionType: draft.contradictionType,
        title: draft.title,
        description: draft.description,
        severity: draft.severity,
        status: draft.status ?? "open",
        confidence: draft.confidence,
        leftClaimId: draft.leftClaimId ?? null,
        rightClaimId: draft.rightClaimId ?? null,
        relatedPageIds: structuredClone(draft.relatedPageIds),
        relatedSourceIds: structuredClone(draft.relatedSourceIds),
        relatedTimelineEventIds: structuredClone(draft.relatedTimelineEventIds),
        rationale: draft.rationale,
        metadata: draft.metadata ? structuredClone(draft.metadata) : {},
        createdAt: now,
        updatedAt: now,
      };

      contradictionsStore.push(created);
      return structuredClone(created);
    });

    const nextIds = new Set(nextContradictions.map((contradiction) => contradiction.id));

    for (let index = contradictionsStore.length - 1; index >= 0; index -= 1) {
      const contradiction = contradictionsStore[index];
      if (contradiction.projectId === projectId && !nextIds.has(contradiction.id)) {
        contradictionsStore.splice(index, 1);
      }
    }

    contradictionAnalysisStateStore.set(projectId, {
      projectId,
      lastAnalyzedAt: now,
      contradictionCount: nextContradictions.length,
      summary,
    });

    return this.listByProjectId(projectId);
  }

  async updateStatus(
    targetContradictionId: string,
    status: ContradictionStatus,
  ): Promise<Contradiction | null> {
    const contradiction = contradictionsStore.find(
      (candidate) => candidate.id === targetContradictionId,
    );

    if (!contradiction) {
      return null;
    }

    contradiction.status = status;
    contradiction.updatedAt = new Date().toISOString();

    return structuredClone(contradiction);
  }

  async getAnalysisState(projectId: string): Promise<ContradictionAnalysisState> {
    return (
      structuredClone(contradictionAnalysisStateStore.get(projectId)) ?? {
        projectId,
        lastAnalyzedAt: null,
        contradictionCount: 0,
        summary: "Contradiction analysis has not been run for this project yet.",
      }
    );
  }
}

export const contradictionsRepository: ContradictionsRepository =
  new InMemoryContradictionsRepository();
