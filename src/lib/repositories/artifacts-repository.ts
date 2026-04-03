import { seedArtifacts } from "@/lib/domain/seed-data";
import type { Artifact, ArtifactStatus, ArtifactType, StringMetadata } from "@/lib/domain/types";

const artifactsStore: Artifact[] = structuredClone(seedArtifacts);

type CreateArtifactInput = {
  projectId: string;
  artifactType: ArtifactType;
  title: string;
  markdownContent: string;
  status: ArtifactStatus;
  metadata: StringMetadata;
};

export interface ArtifactsRepository {
  listByProjectId(projectId: string): Promise<Artifact[]>;
  getById(artifactId: string): Promise<Artifact | null>;
  create(input: CreateArtifactInput): Promise<Artifact>;
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
      status: input.status,
      metadata: structuredClone(input.metadata),
      createdAt: now,
      updatedAt: now,
    };

    artifactsStore.unshift(artifact);
    return structuredClone(artifact);
  }
}

export const artifactsRepository: ArtifactsRepository =
  new InMemoryArtifactsRepository();
