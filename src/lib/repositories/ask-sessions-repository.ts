import { seedAskSessions } from "@/lib/domain/seed-data";
import type { AskSession, AskSessionPayload } from "@/lib/domain/types";

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

export const askSessionsRepository: AskSessionsRepository =
  new InMemoryAskSessionsRepository();
