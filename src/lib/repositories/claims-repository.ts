import { seedClaims } from "@/lib/domain/seed-data";
import type { Claim, ClaimPayload } from "@/lib/domain/types";

const claimsStore: Claim[] = structuredClone(seedClaims);

export interface ClaimsRepository {
  listByProjectId(projectId: string): Promise<Claim[]>;
  listByWikiPageId(wikiPageId: string): Promise<Claim[]>;
  replaceForWikiPage(
    wikiPageId: string,
    projectId: string,
    claims: ClaimPayload[],
  ): Promise<Claim[]>;
}

class InMemoryClaimsRepository implements ClaimsRepository {
  async listByProjectId(projectId: string): Promise<Claim[]> {
    return structuredClone(
      claimsStore.filter((claim) => claim.projectId === projectId),
    );
  }

  async listByWikiPageId(wikiPageId: string): Promise<Claim[]> {
    return structuredClone(
      claimsStore.filter((claim) => claim.wikiPageId === wikiPageId),
    );
  }

  async replaceForWikiPage(
    wikiPageId: string,
    projectId: string,
    claims: ClaimPayload[],
  ): Promise<Claim[]> {
    for (let index = claimsStore.length - 1; index >= 0; index -= 1) {
      if (
        claimsStore[index].wikiPageId === wikiPageId &&
        claimsStore[index].projectId === projectId
      ) {
        claimsStore.splice(index, 1);
      }
    }

    const now = new Date().toISOString();
    const stored = claims.map((claim) => ({
      ...claim,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    }));

    claimsStore.push(...stored);

    return structuredClone(stored);
  }
}

export const claimsRepository: ClaimsRepository = new InMemoryClaimsRepository();
