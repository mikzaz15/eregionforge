import { seedClaims } from "@/lib/domain/seed-data";
import type { Claim, ClaimPayload } from "@/lib/domain/types";
import {
  getPersistenceDatabase,
  getPersistenceMode,
  listPersistedRecords,
  serializeRecord,
} from "@/lib/persistence/database";

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

class SqliteClaimsRepository implements ClaimsRepository {
  async listByProjectId(projectId: string): Promise<Claim[]> {
    return listPersistedRecords<Claim>(
      "claims_store",
      `SELECT payload
       FROM claims_store
       WHERE project_id = ?
       ORDER BY created_at ASC, updated_at ASC`,
      projectId,
    );
  }

  async listByWikiPageId(wikiPageId: string): Promise<Claim[]> {
    return listPersistedRecords<Claim>(
      "claims_store",
      `SELECT payload
       FROM claims_store
       WHERE wiki_page_id = ?
       ORDER BY created_at ASC, updated_at ASC`,
      wikiPageId,
    );
  }

  async replaceForWikiPage(
    wikiPageId: string,
    projectId: string,
    claims: ClaimPayload[],
  ): Promise<Claim[]> {
    const database = getPersistenceDatabase();

    if (!database) {
      return [];
    }

    database
      .prepare(
        "DELETE FROM claims_store WHERE wiki_page_id = ? AND project_id = ?",
      )
      .run(wikiPageId, projectId);

    const now = new Date().toISOString();
    const stored = claims.map((claim) => ({
      ...claim,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    }));

    const insertStatement = database.prepare(`
      INSERT INTO claims_store (
        id, project_id, wiki_page_id, support_status, created_at, updated_at, payload
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        wiki_page_id = excluded.wiki_page_id,
        support_status = excluded.support_status,
        created_at = excluded.created_at,
        updated_at = excluded.updated_at,
        payload = excluded.payload
    `);

    for (const claim of stored) {
      insertStatement.run(
        claim.id,
        claim.projectId,
        claim.wikiPageId,
        claim.supportStatus,
        claim.createdAt,
        claim.updatedAt,
        serializeRecord(claim),
      );
    }

    return structuredClone(stored);
  }
}

export const claimsRepository: ClaimsRepository =
  getPersistenceMode() === "sqlite"
    ? new SqliteClaimsRepository()
    : new InMemoryClaimsRepository();
