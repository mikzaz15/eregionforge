import {
  seedEntities,
  seedEntityAnalysisStates,
} from "@/lib/domain/seed-data";
import type {
  EntityAnalysisState,
  EntityType,
  ResearchEntity,
  ResearchEntityDraft,
} from "@/lib/domain/types";
import {
  deleteRecordsByIds,
  getPersistedRecord,
  getPersistenceMode,
  listPersistedRecords,
  upsertEntityAnalysisStateRecord,
  upsertEntityRecord,
} from "@/lib/persistence/database";

const entitiesStore: ResearchEntity[] = structuredClone(seedEntities);
const entityAnalysisStatesStore: EntityAnalysisState[] = structuredClone(
  seedEntityAnalysisStates,
);

type SyncEntityResult = {
  entities: ResearchEntity[];
  analysisState: EntityAnalysisState;
};

export interface EntitiesRepository {
  listByProjectId(projectId: string): Promise<ResearchEntity[]>;
  listByType(projectId: string, entityType: EntityType): Promise<ResearchEntity[]>;
  getById(entityId: string): Promise<ResearchEntity | null>;
  getAnalysisState(projectId: string): Promise<EntityAnalysisState>;
  syncProjectEntities(
    projectId: string,
    drafts: ResearchEntityDraft[],
    summary: string,
  ): Promise<SyncEntityResult>;
}

function sortEntities(entities: ResearchEntity[]): ResearchEntity[] {
  return structuredClone(entities).sort((left, right) => {
    if (left.entityType !== right.entityType) {
      return left.entityType.localeCompare(right.entityType);
    }

    return left.canonicalName.localeCompare(right.canonicalName);
  });
}

function emptyAnalysisState(projectId: string): EntityAnalysisState {
  return {
    projectId,
    lastCompiledAt: null,
    entityCount: 0,
    summary: "Entity intelligence has not been compiled for this project yet.",
  };
}

class InMemoryEntitiesRepository implements EntitiesRepository {
  async listByProjectId(projectId: string): Promise<ResearchEntity[]> {
    return sortEntities(
      entitiesStore.filter((entity) => entity.projectId === projectId),
    );
  }

  async listByType(
    projectId: string,
    entityType: EntityType,
  ): Promise<ResearchEntity[]> {
    return sortEntities(
      entitiesStore.filter(
        (entity) => entity.projectId === projectId && entity.entityType === entityType,
      ),
    );
  }

  async getById(entityId: string): Promise<ResearchEntity | null> {
    const entity = entitiesStore.find((candidate) => candidate.id === entityId);
    return entity ? structuredClone(entity) : null;
  }

  async getAnalysisState(projectId: string): Promise<EntityAnalysisState> {
    const state = entityAnalysisStatesStore.find(
      (candidate) => candidate.projectId === projectId,
    );
    return state ? structuredClone(state) : emptyAnalysisState(projectId);
  }

  async syncProjectEntities(
    projectId: string,
    drafts: ResearchEntityDraft[],
    summary: string,
  ): Promise<SyncEntityResult> {
    for (let index = entitiesStore.length - 1; index >= 0; index -= 1) {
      if (entitiesStore[index].projectId === projectId) {
        entitiesStore.splice(index, 1);
      }
    }

    const now = new Date().toISOString();
    const entities = drafts.map((draft) => ({
      id: `entity-${draft.stableKey}`,
      projectId: draft.projectId,
      entityType: draft.entityType,
      canonicalName: draft.canonicalName,
      aliases: structuredClone(draft.aliases),
      description: draft.description,
      confidence: draft.confidence,
      relatedSourceIds: structuredClone(draft.relatedSourceIds),
      relatedClaimIds: structuredClone(draft.relatedClaimIds),
      relatedWikiPageIds: structuredClone(draft.relatedWikiPageIds),
      metadata: draft.metadata ? structuredClone(draft.metadata) : {},
      createdAt: now,
      updatedAt: now,
    }));
    entitiesStore.push(...entities);

    const analysisState: EntityAnalysisState = {
      projectId,
      lastCompiledAt: now,
      entityCount: entities.length,
      summary,
    };
    const existingStateIndex = entityAnalysisStatesStore.findIndex(
      (candidate) => candidate.projectId === projectId,
    );

    if (existingStateIndex >= 0) {
      entityAnalysisStatesStore[existingStateIndex] = analysisState;
    } else {
      entityAnalysisStatesStore.push(analysisState);
    }

    return {
      entities: sortEntities(entities),
      analysisState: structuredClone(analysisState),
    };
  }
}

class SqliteEntitiesRepository implements EntitiesRepository {
  async listByProjectId(projectId: string): Promise<ResearchEntity[]> {
    return listPersistedRecords<ResearchEntity>(
      "entities_store",
      `SELECT payload
       FROM entities_store
       WHERE project_id = ?
       ORDER BY entity_type ASC, canonical_name ASC`,
      projectId,
    );
  }

  async listByType(
    projectId: string,
    entityType: EntityType,
  ): Promise<ResearchEntity[]> {
    return listPersistedRecords<ResearchEntity>(
      "entities_store",
      `SELECT payload
       FROM entities_store
       WHERE project_id = ? AND entity_type = ?
       ORDER BY canonical_name ASC`,
      projectId,
      entityType,
    );
  }

  async getById(entityId: string): Promise<ResearchEntity | null> {
    return getPersistedRecord<ResearchEntity>(
      "SELECT payload FROM entities_store WHERE id = ?",
      entityId,
    );
  }

  async getAnalysisState(projectId: string): Promise<EntityAnalysisState> {
    return (
      getPersistedRecord<EntityAnalysisState>(
        "SELECT payload FROM entity_analysis_states_store WHERE project_id = ?",
        projectId,
      ) ?? emptyAnalysisState(projectId)
    );
  }

  async syncProjectEntities(
    projectId: string,
    drafts: ResearchEntityDraft[],
    summary: string,
  ): Promise<SyncEntityResult> {
    const existing = await this.listByProjectId(projectId);
    deleteRecordsByIds(
      "entities_store",
      existing.map((entity) => entity.id),
    );

    const now = new Date().toISOString();
    const previousById = new Map(existing.map((entity) => [entity.id, entity] as const));
    const entities = drafts.map((draft) => {
      const id = `entity-${draft.stableKey}`;
      const previous = previousById.get(id);
      const entity: ResearchEntity = {
        id,
        projectId: draft.projectId,
        entityType: draft.entityType,
        canonicalName: draft.canonicalName,
        aliases: structuredClone(draft.aliases),
        description: draft.description,
        confidence: draft.confidence,
        relatedSourceIds: structuredClone(draft.relatedSourceIds),
        relatedClaimIds: structuredClone(draft.relatedClaimIds),
        relatedWikiPageIds: structuredClone(draft.relatedWikiPageIds),
        metadata: draft.metadata ? structuredClone(draft.metadata) : {},
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
      };

      upsertEntityRecord(entity);
      return entity;
    });

    const analysisState: EntityAnalysisState = {
      projectId,
      lastCompiledAt: now,
      entityCount: entities.length,
      summary,
    };
    upsertEntityAnalysisStateRecord(analysisState);

    return {
      entities: sortEntities(entities),
      analysisState,
    };
  }
}

export const entitiesRepository: EntitiesRepository =
  getPersistenceMode() === "sqlite"
    ? new SqliteEntitiesRepository()
    : new InMemoryEntitiesRepository();
