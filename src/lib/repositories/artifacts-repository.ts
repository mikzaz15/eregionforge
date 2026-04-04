import { seedArtifacts } from "@/lib/domain/seed-data";
import type {
  Artifact,
  ArtifactProvenance,
  ArtifactStatus,
  ArtifactType,
  StringMetadata,
} from "@/lib/domain/types";
import {
  getPersistedRecord,
  getPersistenceMode,
  listPersistedRecords,
  upsertArtifactRecord,
} from "@/lib/persistence/database";

const artifactsStore: Artifact[] = structuredClone(seedArtifacts);

type CreateArtifactInput = {
  projectId: string;
  artifactType: ArtifactType;
  title: string;
  markdownContent: string;
  previewText: string;
  provenance: ArtifactProvenance;
  originatingPrompt?: string | null;
  derivedFromAskSessionId?: string | null;
  referencedWikiPageIds?: string[];
  referencedSourceIds?: string[];
  referencedClaimIds?: string[];
  eligibleForWikiFiling?: boolean;
  status: ArtifactStatus;
  metadata: StringMetadata;
};

export interface ArtifactsRepository {
  listByProjectId(projectId: string): Promise<Artifact[]>;
  getById(artifactId: string): Promise<Artifact | null>;
  create(input: CreateArtifactInput): Promise<Artifact>;
  updateWikiFilingEligibility(
    artifactId: string,
    eligibleForWikiFiling: boolean,
  ): Promise<Artifact | null>;
}

class InMemoryArtifactsRepository implements ArtifactsRepository {
  async listByProjectId(projectId: string): Promise<Artifact[]> {
    return structuredClone(
      artifactsStore
        .filter((artifact) => artifact.projectId === projectId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    );
  }

  async getById(artifactId: string): Promise<Artifact | null> {
    const artifact = artifactsStore.find(
      (candidate) => candidate.id === artifactId,
    );
    return artifact ? structuredClone(artifact) : null;
  }

  async create(input: CreateArtifactInput): Promise<Artifact> {
    const now = new Date().toISOString();
    const artifact: Artifact = {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      artifactType: input.artifactType,
      title: input.title,
      markdownContent: input.markdownContent,
      previewText: input.previewText,
      provenance: input.provenance,
      originatingPrompt: input.originatingPrompt ?? null,
      derivedFromAskSessionId: input.derivedFromAskSessionId ?? null,
      referencedWikiPageIds: structuredClone(input.referencedWikiPageIds ?? []),
      referencedSourceIds: structuredClone(input.referencedSourceIds ?? []),
      referencedClaimIds: structuredClone(input.referencedClaimIds ?? []),
      eligibleForWikiFiling: input.eligibleForWikiFiling ?? false,
      status: input.status,
      metadata: structuredClone(input.metadata),
      createdAt: now,
      updatedAt: now,
    };

    artifactsStore.unshift(artifact);
    return structuredClone(artifact);
  }

  async updateWikiFilingEligibility(
    artifactId: string,
    eligibleForWikiFiling: boolean,
  ): Promise<Artifact | null> {
    const artifact = artifactsStore.find((candidate) => candidate.id === artifactId);

    if (!artifact) {
      return null;
    }

    artifact.eligibleForWikiFiling = eligibleForWikiFiling;
    artifact.updatedAt = new Date().toISOString();

    return structuredClone(artifact);
  }
}

class SqliteArtifactsRepository implements ArtifactsRepository {
  async listByProjectId(projectId: string): Promise<Artifact[]> {
    return listPersistedRecords<Artifact>(
      "artifacts_store",
      `SELECT payload
       FROM artifacts_store
       WHERE project_id = ?
       ORDER BY created_at DESC, updated_at DESC`,
      projectId,
    );
  }

  async getById(artifactId: string): Promise<Artifact | null> {
    return getPersistedRecord<Artifact>(
      "SELECT payload FROM artifacts_store WHERE id = ?",
      artifactId,
    );
  }

  async create(input: CreateArtifactInput): Promise<Artifact> {
    const now = new Date().toISOString();
    const artifact: Artifact = {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      artifactType: input.artifactType,
      title: input.title,
      markdownContent: input.markdownContent,
      previewText: input.previewText,
      provenance: input.provenance,
      originatingPrompt: input.originatingPrompt ?? null,
      derivedFromAskSessionId: input.derivedFromAskSessionId ?? null,
      referencedWikiPageIds: structuredClone(input.referencedWikiPageIds ?? []),
      referencedSourceIds: structuredClone(input.referencedSourceIds ?? []),
      referencedClaimIds: structuredClone(input.referencedClaimIds ?? []),
      eligibleForWikiFiling: input.eligibleForWikiFiling ?? false,
      status: input.status,
      metadata: structuredClone(input.metadata),
      createdAt: now,
      updatedAt: now,
    };

    upsertArtifactRecord(artifact);
    return structuredClone(artifact);
  }

  async updateWikiFilingEligibility(
    artifactId: string,
    eligibleForWikiFiling: boolean,
  ): Promise<Artifact | null> {
    const artifact = await this.getById(artifactId);

    if (!artifact) {
      return null;
    }

    artifact.eligibleForWikiFiling = eligibleForWikiFiling;
    artifact.updatedAt = new Date().toISOString();
    upsertArtifactRecord(artifact);

    return structuredClone(artifact);
  }
}

export const artifactsRepository: ArtifactsRepository =
  getPersistenceMode() === "sqlite"
    ? new SqliteArtifactsRepository()
    : new InMemoryArtifactsRepository();
