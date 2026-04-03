import { seedEvidenceLinks } from "@/lib/domain/seed-data";
import type { EvidenceLink, EvidenceLinkPayload } from "@/lib/domain/types";

const evidenceLinksStore: EvidenceLink[] = structuredClone(seedEvidenceLinks);

export interface EvidenceLinksRepository {
  listByProjectId(projectId: string): Promise<EvidenceLink[]>;
  listByClaimId(claimId: string): Promise<EvidenceLink[]>;
  replaceForClaim(
    claimId: string,
    projectId: string,
    evidenceLinks: EvidenceLinkPayload[],
  ): Promise<EvidenceLink[]>;
  deleteByClaimIds(claimIds: string[]): Promise<void>;
}

class InMemoryEvidenceLinksRepository implements EvidenceLinksRepository {
  async listByProjectId(projectId: string): Promise<EvidenceLink[]> {
    return structuredClone(
      evidenceLinksStore.filter((link) => link.projectId === projectId),
    );
  }

  async listByClaimId(claimId: string): Promise<EvidenceLink[]> {
    return structuredClone(
      evidenceLinksStore.filter((link) => link.claimId === claimId),
    );
  }

  async replaceForClaim(
    claimId: string,
    projectId: string,
    evidenceLinks: EvidenceLinkPayload[],
  ): Promise<EvidenceLink[]> {
    for (let index = evidenceLinksStore.length - 1; index >= 0; index -= 1) {
      if (
        evidenceLinksStore[index].claimId === claimId &&
        evidenceLinksStore[index].projectId === projectId
      ) {
        evidenceLinksStore.splice(index, 1);
      }
    }

    const now = new Date().toISOString();
    const stored = evidenceLinks.map((link) => ({
      ...link,
      id: crypto.randomUUID(),
      createdAt: now,
    }));

    evidenceLinksStore.push(...stored);

    return structuredClone(stored);
  }

  async deleteByClaimIds(claimIds: string[]): Promise<void> {
    const claimIdSet = new Set(claimIds);

    for (let index = evidenceLinksStore.length - 1; index >= 0; index -= 1) {
      if (claimIdSet.has(evidenceLinksStore[index].claimId)) {
        evidenceLinksStore.splice(index, 1);
      }
    }
  }
}

export const evidenceLinksRepository: EvidenceLinksRepository =
  new InMemoryEvidenceLinksRepository();
