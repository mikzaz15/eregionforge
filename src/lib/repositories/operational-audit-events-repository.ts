import { seedOperationalAuditEvents } from "@/lib/domain/seed-data";
import type {
  OperationalAuditEvent,
  OperationalAuditEventPayload,
} from "@/lib/domain/types";
import {
  getPersistenceMode,
  listPersistedRecords,
  upsertOperationalAuditEventRecord,
} from "@/lib/persistence/database";

const operationalAuditEventsStore: OperationalAuditEvent[] = structuredClone(
  seedOperationalAuditEvents,
);

export interface OperationalAuditEventsRepository {
  listByProjectId(projectId: string): Promise<OperationalAuditEvent[]>;
  create(input: OperationalAuditEventPayload): Promise<OperationalAuditEvent>;
}

class InMemoryOperationalAuditEventsRepository
  implements OperationalAuditEventsRepository
{
  async listByProjectId(projectId: string): Promise<OperationalAuditEvent[]> {
    return structuredClone(
      operationalAuditEventsStore
        .filter((event) => event.projectId === projectId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    );
  }

  async create(input: OperationalAuditEventPayload): Promise<OperationalAuditEvent> {
    const event: OperationalAuditEvent = {
      id: crypto.randomUUID(),
      ...input,
      metadata: input.metadata ? structuredClone(input.metadata) : {},
      createdAt: new Date().toISOString(),
    };

    operationalAuditEventsStore.unshift(event);
    return structuredClone(event);
  }
}

class SqliteOperationalAuditEventsRepository
  implements OperationalAuditEventsRepository
{
  async listByProjectId(projectId: string): Promise<OperationalAuditEvent[]> {
    return listPersistedRecords<OperationalAuditEvent>(
      "operational_audit_events_store",
      `SELECT payload
       FROM operational_audit_events_store
       WHERE project_id = ?
       ORDER BY created_at DESC`,
      projectId,
    );
  }

  async create(input: OperationalAuditEventPayload): Promise<OperationalAuditEvent> {
    const event: OperationalAuditEvent = {
      id: crypto.randomUUID(),
      ...input,
      metadata: input.metadata ? structuredClone(input.metadata) : {},
      createdAt: new Date().toISOString(),
    };

    upsertOperationalAuditEventRecord(event);
    return structuredClone(event);
  }
}

export const operationalAuditEventsRepository: OperationalAuditEventsRepository =
  getPersistenceMode() === "sqlite"
    ? new SqliteOperationalAuditEventsRepository()
    : new InMemoryOperationalAuditEventsRepository();
