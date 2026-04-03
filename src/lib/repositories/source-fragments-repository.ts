import { seedSourceFragments } from "@/lib/domain/seed-data";
import type {
  SourceFragment,
  SourceFragmentPayload,
} from "@/lib/domain/types";

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

export const sourceFragmentsRepository: SourceFragmentsRepository =
  new InMemorySourceFragmentsRepository();
