import { seedArtifacts } from "@/lib/domain/seed-data";
import type { Artifact } from "@/lib/domain/types";

export interface ArtifactsRepository {
  listByProjectId(projectId: string): Promise<Artifact[]>;
  getById(artifactId: string): Promise<Artifact | null>;
}

class InMemoryArtifactsRepository implements ArtifactsRepository {
  async listByProjectId(projectId: string): Promise<Artifact[]> {
    return structuredClone(
      seedArtifacts.filter((artifact) => artifact.projectId === projectId),
    );
  }

  async getById(artifactId: string): Promise<Artifact | null> {
    const artifact = seedArtifacts.find(
      (candidate) => candidate.id === artifactId,
    );
    return artifact ? structuredClone(artifact) : null;
  }
}

export const artifactsRepository: ArtifactsRepository =
  new InMemoryArtifactsRepository();
