import { seedCatalysts } from "@/lib/domain/seed-data";
import type {
  Catalyst,
  CatalystCompileState,
  CatalystDraft,
} from "@/lib/domain/types";

const catalystsStore: Catalyst[] = structuredClone(seedCatalysts);
const catalystCompileStateStore = new Map<string, CatalystCompileState>();

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
}

export const catalystsRepository: CatalystsRepository =
  new InMemoryCatalystsRepository();
