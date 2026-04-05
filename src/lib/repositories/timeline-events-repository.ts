import { seedTimelineCompileStates, seedTimelineEvents } from "@/lib/domain/seed-data";
import type {
  TimelineCompileState,
  TimelineEvent,
  TimelineEventDraft,
} from "@/lib/domain/types";
import {
  deleteRecordsByIds,
  getPersistedRecord,
  getPersistenceMode,
  listPersistedRecords,
  upsertTimelineCompileStateRecord,
  upsertTimelineEventRecord,
} from "@/lib/persistence/database";

const timelineEventsStore: TimelineEvent[] = structuredClone(seedTimelineEvents);
const timelineCompileStateStore = new Map(
  structuredClone(seedTimelineCompileStates).map((state) => [state.projectId, state] as const),
);

function timelineEventId(projectId: string, stableKey: string): string {
  return `timeline-${projectId}-${stableKey}`;
}

export interface TimelineEventsRepository {
  listByProjectId(projectId: string): Promise<TimelineEvent[]>;
  syncProjectEvents(
    projectId: string,
    eventDrafts: TimelineEventDraft[],
    summary: string,
  ): Promise<TimelineEvent[]>;
  getCompileState(projectId: string): Promise<TimelineCompileState>;
}

class InMemoryTimelineEventsRepository implements TimelineEventsRepository {
  async listByProjectId(projectId: string): Promise<TimelineEvent[]> {
    return structuredClone(
      timelineEventsStore
        .filter((event) => event.projectId === projectId)
        .sort(
          (left, right) =>
            left.eventDate.localeCompare(right.eventDate) ||
            left.title.localeCompare(right.title),
        ),
    );
  }

  async syncProjectEvents(
    projectId: string,
    eventDrafts: TimelineEventDraft[],
    summary: string,
  ): Promise<TimelineEvent[]> {
    const now = new Date().toISOString();
    const existingById = new Map(
      timelineEventsStore
        .filter((event) => event.projectId === projectId)
        .map((event) => [event.id, event] as const),
    );
    const nextEvents = eventDrafts.map<TimelineEvent>((draft) => {
      const id = timelineEventId(projectId, draft.stableKey);
      const existing = existingById.get(id);

      if (existing) {
        existing.title = draft.title;
        existing.description = draft.description;
        existing.eventDate = draft.eventDate;
        existing.eventDatePrecision = draft.eventDatePrecision;
        existing.eventType = draft.eventType;
        existing.confidence = draft.confidence;
        existing.sourceIds = structuredClone(draft.sourceIds);
        existing.wikiPageIds = structuredClone(draft.wikiPageIds);
        existing.claimIds = structuredClone(draft.claimIds);
        existing.provenance = draft.provenance;
        existing.metadata = draft.metadata ? structuredClone(draft.metadata) : {};
        existing.updatedAt = now;
        return structuredClone(existing);
      }

      const created: TimelineEvent = {
        id,
        projectId,
        title: draft.title,
        description: draft.description,
        eventDate: draft.eventDate,
        eventDatePrecision: draft.eventDatePrecision,
        eventType: draft.eventType,
        confidence: draft.confidence,
        sourceIds: structuredClone(draft.sourceIds),
        wikiPageIds: structuredClone(draft.wikiPageIds),
        claimIds: structuredClone(draft.claimIds),
        provenance: draft.provenance,
        metadata: draft.metadata ? structuredClone(draft.metadata) : {},
        createdAt: now,
        updatedAt: now,
      };

      timelineEventsStore.push(created);
      return structuredClone(created);
    });

    const nextEventIds = new Set(nextEvents.map((event) => event.id));

    for (let index = timelineEventsStore.length - 1; index >= 0; index -= 1) {
      const event = timelineEventsStore[index];
      if (event.projectId === projectId && !nextEventIds.has(event.id)) {
        timelineEventsStore.splice(index, 1);
      }
    }

    timelineCompileStateStore.set(projectId, {
      projectId,
      lastCompiledAt: now,
      eventCount: nextEvents.length,
      summary,
    });

    return this.listByProjectId(projectId);
  }

  async getCompileState(projectId: string): Promise<TimelineCompileState> {
    return (
      structuredClone(timelineCompileStateStore.get(projectId)) ?? {
        projectId,
        lastCompiledAt: null,
        eventCount: 0,
        summary: "Timeline has not been compiled for this project yet.",
      }
    );
  }
}

class SqliteTimelineEventsRepository implements TimelineEventsRepository {
  async listByProjectId(projectId: string): Promise<TimelineEvent[]> {
    return listPersistedRecords<TimelineEvent>(
      "timeline_events_store",
      `SELECT payload
       FROM timeline_events_store
       WHERE project_id = ?
       ORDER BY event_date ASC, updated_at DESC`,
      projectId,
    );
  }

  async syncProjectEvents(
    projectId: string,
    eventDrafts: TimelineEventDraft[],
    summary: string,
  ): Promise<TimelineEvent[]> {
    const now = new Date().toISOString();
    const existing = await this.listByProjectId(projectId);
    const existingById = new Map(existing.map((entry) => [entry.id, entry] as const));
    const nextEvents = eventDrafts.map<TimelineEvent>((draft) => {
      const id = timelineEventId(projectId, draft.stableKey);
      const previous = existingById.get(id);
      const event: TimelineEvent = {
        id,
        projectId,
        title: draft.title,
        description: draft.description,
        eventDate: draft.eventDate,
        eventDatePrecision: draft.eventDatePrecision,
        eventType: draft.eventType,
        confidence: draft.confidence,
        sourceIds: structuredClone(draft.sourceIds),
        wikiPageIds: structuredClone(draft.wikiPageIds),
        claimIds: structuredClone(draft.claimIds),
        provenance: draft.provenance,
        metadata: draft.metadata ? structuredClone(draft.metadata) : {},
        createdAt: previous?.createdAt ?? now,
        updatedAt: now,
      };

      upsertTimelineEventRecord(event);
      return event;
    });

    const nextIds = new Set(nextEvents.map((entry) => entry.id));
    deleteRecordsByIds(
      "timeline_events_store",
      existing.filter((entry) => !nextIds.has(entry.id)).map((entry) => entry.id),
    );

    upsertTimelineCompileStateRecord({
      projectId,
      lastCompiledAt: now,
      eventCount: nextEvents.length,
      summary,
    });

    return this.listByProjectId(projectId);
  }

  async getCompileState(projectId: string): Promise<TimelineCompileState> {
    return (
      getPersistedRecord<TimelineCompileState>(
        "SELECT payload FROM timeline_compile_states_store WHERE project_id = ?",
        projectId,
      ) ?? {
        projectId,
        lastCompiledAt: null,
        eventCount: 0,
        summary: "Timeline has not been compiled for this project yet.",
      }
    );
  }
}

export const timelineEventsRepository: TimelineEventsRepository =
  getPersistenceMode() === "sqlite"
    ? new SqliteTimelineEventsRepository()
    : new InMemoryTimelineEventsRepository();
