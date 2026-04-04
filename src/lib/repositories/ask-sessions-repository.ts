import { seedAskSessions } from "@/lib/domain/seed-data";
import type { AskSession, AskSessionPayload } from "@/lib/domain/types";
import {
  getPersistedRecord,
  getPersistenceMode,
  listPersistedRecords,
  upsertAskSessionRecord,
} from "@/lib/persistence/database";

const askSessionsStore: AskSession[] = structuredClone(seedAskSessions);

export interface AskSessionsRepository {
  listByProjectId(projectId: string): Promise<AskSession[]>;
  getById(sessionId: string): Promise<AskSession | null>;
  create(input: AskSessionPayload): Promise<AskSession>;
}

class InMemoryAskSessionsRepository implements AskSessionsRepository {
  async listByProjectId(projectId: string): Promise<AskSession[]> {
    return structuredClone(
      askSessionsStore
        .filter((session) => session.projectId === projectId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    );
  }

  async getById(sessionId: string): Promise<AskSession | null> {
    const session = askSessionsStore.find((candidate) => candidate.id === sessionId);
    return session ? structuredClone(session) : null;
  }

  async create(input: AskSessionPayload): Promise<AskSession> {
    const now = new Date().toISOString();
    const session: AskSession = {
      ...input,
      id: crypto.randomUUID(),
      consultedWikiPageIds: structuredClone(input.consultedWikiPageIds),
      consultedClaimIds: structuredClone(input.consultedClaimIds),
      consultedSourceIds: structuredClone(input.consultedSourceIds),
      metadata: input.metadata ? structuredClone(input.metadata) : {},
      createdAt: now,
      updatedAt: now,
    };

    askSessionsStore.unshift(session);
    return structuredClone(session);
  }
}

class SqliteAskSessionsRepository implements AskSessionsRepository {
  async listByProjectId(projectId: string): Promise<AskSession[]> {
    return listPersistedRecords<AskSession>(
      "ask_sessions_store",
      `SELECT payload
       FROM ask_sessions_store
       WHERE project_id = ?
       ORDER BY created_at DESC, updated_at DESC`,
      projectId,
    );
  }

  async getById(sessionId: string): Promise<AskSession | null> {
    return getPersistedRecord<AskSession>(
      "SELECT payload FROM ask_sessions_store WHERE id = ?",
      sessionId,
    );
  }

  async create(input: AskSessionPayload): Promise<AskSession> {
    const now = new Date().toISOString();
    const session: AskSession = {
      ...input,
      id: crypto.randomUUID(),
      consultedWikiPageIds: structuredClone(input.consultedWikiPageIds),
      consultedClaimIds: structuredClone(input.consultedClaimIds),
      consultedSourceIds: structuredClone(input.consultedSourceIds),
      metadata: input.metadata ? structuredClone(input.metadata) : {},
      createdAt: now,
      updatedAt: now,
    };

    upsertAskSessionRecord(session);
    return structuredClone(session);
  }
}

export const askSessionsRepository: AskSessionsRepository =
  getPersistenceMode() === "sqlite"
    ? new SqliteAskSessionsRepository()
    : new InMemoryAskSessionsRepository();
