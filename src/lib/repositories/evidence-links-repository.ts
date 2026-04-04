import { seedEvidenceLinks } from "@/lib/domain/seed-data";
import type { EvidenceLink, EvidenceLinkPayload } from "@/lib/domain/types";
import {
  deleteRecordsByIds,
  getPersistenceDatabase,
  getPersistenceMode,
  listPersistedRecords,
  serializeRecord,
} from "@/lib/persistence/database";

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

class SqliteEvidenceLinksRepository implements EvidenceLinksRepository {
  async listByProjectId(projectId: string): Promise<EvidenceLink[]> {
    return listPersistedRecords<EvidenceLink>(
      "evidence_links_store",
      `SELECT payload
       FROM evidence_links_store
       WHERE project_id = ?
       ORDER BY created_at ASC`,
      projectId,
    );
  }

  async listByClaimId(claimId: string): Promise<EvidenceLink[]> {
    return listPersistedRecords<EvidenceLink>(
      "evidence_links_store",
      `SELECT payload
       FROM evidence_links_store
       WHERE claim_id = ?
       ORDER BY created_at ASC`,
      claimId,
    );
  }

  async replaceForClaim(
    claimId: string,
    projectId: string,
    evidenceLinks: EvidenceLinkPayload[],
  ): Promise<EvidenceLink[]> {
    const database = getPersistenceDatabase();

    if (!database) {
      return [];
    }

    database
      .prepare(
        "DELETE FROM evidence_links_store WHERE claim_id = ? AND project_id = ?",
      )
      .run(claimId, projectId);

    const now = new Date().toISOString();
    const stored = evidenceLinks.map((link) => ({
      ...link,
      id: crypto.randomUUID(),
      createdAt: now,
    }));

    const insertStatement = database.prepare(`
      INSERT INTO evidence_links_store (
        id, project_id, claim_id, source_id, source_fragment_id, created_at, payload
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        claim_id = excluded.claim_id,
        source_id = excluded.source_id,
        source_fragment_id = excluded.source_fragment_id,
        created_at = excluded.created_at,
        payload = excluded.payload
    `);

    for (const link of stored) {
      insertStatement.run(
        link.id,
        link.projectId,
        link.claimId,
        link.sourceId,
        link.sourceFragmentId,
        link.createdAt,
        serializeRecord(link),
      );
    }

    return structuredClone(stored);
  }

  async deleteByClaimIds(claimIds: string[]): Promise<void> {
    const database = getPersistenceDatabase();

    if (!database || claimIds.length === 0) {
      return;
    }

    const rows = database
      .prepare(
        `SELECT id
         FROM evidence_links_store
         WHERE claim_id IN (${claimIds.map(() => "?").join(", ")})`,
      )
      .all(...claimIds);
    const evidenceLinkIds = rows
      .map((row) => (typeof row.id === "string" ? row.id : null))
      .filter((value): value is string => Boolean(value));

    deleteRecordsByIds("evidence_links_store", evidenceLinkIds);
  }
}

export const evidenceLinksRepository: EvidenceLinksRepository =
  getPersistenceMode() === "sqlite"
    ? new SqliteEvidenceLinksRepository()
    : new InMemoryEvidenceLinksRepository();
