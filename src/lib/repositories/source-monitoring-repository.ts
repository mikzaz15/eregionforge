import {
  seedMonitoringAnalysisStates,
  seedSourceMonitoringRecords,
  seedStaleAlerts,
} from "@/lib/domain/seed-data";
import type {
  MonitoringAnalysisState,
  SourceMonitoringDraft,
  SourceMonitoringRecord,
  StaleAlert,
  StaleAlertDraft,
} from "@/lib/domain/types";
import {
  deleteRecordsByIds,
  getPersistedRecord,
  getPersistenceMode,
  listPersistedRecords,
  upsertMonitoringAnalysisStateRecord,
  upsertMonitoringRecord,
  upsertStaleAlertRecord,
} from "@/lib/persistence/database";

const sourceMonitoringStore: SourceMonitoringRecord[] = structuredClone(
  seedSourceMonitoringRecords,
);
const staleAlertsStore: StaleAlert[] = structuredClone(seedStaleAlerts);
const monitoringAnalysisStateStore = new Map(
  structuredClone(seedMonitoringAnalysisStates).map((state) => [state.projectId, state] as const),
);

function sourceMonitoringId(projectId: string, stableKey: string): string {
  return `source-monitor-${projectId}-${stableKey}`;
}

function staleAlertId(projectId: string, stableKey: string): string {
  return `stale-alert-${projectId}-${stableKey}`;
}

export interface SourceMonitoringRepository {
  listRecordsByProjectId(projectId: string): Promise<SourceMonitoringRecord[]>;
  listAlertsByProjectId(projectId: string): Promise<StaleAlert[]>;
  syncProjectState(input: {
    projectId: string;
    sourceMonitoringDrafts: SourceMonitoringDraft[];
    staleAlertDrafts: StaleAlertDraft[];
    summary: string;
  }): Promise<{
    records: SourceMonitoringRecord[];
    alerts: StaleAlert[];
    analysisState: MonitoringAnalysisState;
  }>;
  getAnalysisState(projectId: string): Promise<MonitoringAnalysisState>;
}

class InMemorySourceMonitoringRepository implements SourceMonitoringRepository {
  async listRecordsByProjectId(projectId: string): Promise<SourceMonitoringRecord[]> {
    return structuredClone(
      sourceMonitoringStore
        .filter((record) => record.projectId === projectId)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    );
  }

  async listAlertsByProjectId(projectId: string): Promise<StaleAlert[]> {
    return structuredClone(
      staleAlertsStore
        .filter((alert) => alert.projectId === projectId)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    );
  }

  async syncProjectState(input: {
    projectId: string;
    sourceMonitoringDrafts: SourceMonitoringDraft[];
    staleAlertDrafts: StaleAlertDraft[];
    summary: string;
  }): Promise<{
    records: SourceMonitoringRecord[];
    alerts: StaleAlert[];
    analysisState: MonitoringAnalysisState;
  }> {
    const now = new Date().toISOString();

    const existingRecordsById = new Map(
      sourceMonitoringStore
        .filter((record) => record.projectId === input.projectId)
        .map((record) => [record.id, record] as const),
    );
    const nextRecords = input.sourceMonitoringDrafts.map<SourceMonitoringRecord>((draft) => {
      const id = sourceMonitoringId(input.projectId, draft.stableKey);
      const existing = existingRecordsById.get(id);

      if (existing) {
        existing.sourceId = draft.sourceId;
        existing.lastSeenAt = draft.lastSeenAt;
        existing.lastCompiledAt = draft.lastCompiledAt ?? null;
        existing.freshnessStatus = draft.freshnessStatus;
        existing.possibleImpactLevel = draft.possibleImpactLevel;
        existing.staleReason = draft.staleReason;
        existing.metadata = draft.metadata ? structuredClone(draft.metadata) : {};
        existing.updatedAt = now;
        return structuredClone(existing);
      }

      const created: SourceMonitoringRecord = {
        id,
        projectId: input.projectId,
        sourceId: draft.sourceId,
        lastSeenAt: draft.lastSeenAt,
        lastCompiledAt: draft.lastCompiledAt ?? null,
        freshnessStatus: draft.freshnessStatus,
        possibleImpactLevel: draft.possibleImpactLevel,
        staleReason: draft.staleReason,
        metadata: draft.metadata ? structuredClone(draft.metadata) : {},
        createdAt: now,
        updatedAt: now,
      };

      sourceMonitoringStore.push(created);
      return structuredClone(created);
    });

    const nextRecordIds = new Set(nextRecords.map((record) => record.id));

    for (let index = sourceMonitoringStore.length - 1; index >= 0; index -= 1) {
      const record = sourceMonitoringStore[index];
      if (record.projectId === input.projectId && !nextRecordIds.has(record.id)) {
        sourceMonitoringStore.splice(index, 1);
      }
    }

    const existingAlertsById = new Map(
      staleAlertsStore
        .filter((alert) => alert.projectId === input.projectId)
        .map((alert) => [alert.id, alert] as const),
    );
    const nextAlerts = input.staleAlertDrafts.map<StaleAlert>((draft) => {
      const id = staleAlertId(input.projectId, draft.stableKey);
      const existing = existingAlertsById.get(id);

      if (existing) {
        existing.alertType = draft.alertType;
        existing.title = draft.title;
        existing.description = draft.description;
        existing.severity = draft.severity;
        existing.relatedSourceIds = structuredClone(draft.relatedSourceIds);
        existing.relatedThesisId = draft.relatedThesisId ?? null;
        existing.relatedDossierId = draft.relatedDossierId ?? null;
        existing.relatedCatalystIds = structuredClone(draft.relatedCatalystIds);
        existing.relatedTimelineIds = structuredClone(draft.relatedTimelineIds);
        existing.metadata = draft.metadata ? structuredClone(draft.metadata) : {};
        existing.updatedAt = now;
        return structuredClone(existing);
      }

      const created: StaleAlert = {
        id,
        projectId: input.projectId,
        alertType: draft.alertType,
        title: draft.title,
        description: draft.description,
        severity: draft.severity,
        status: draft.status ?? "open",
        relatedSourceIds: structuredClone(draft.relatedSourceIds),
        relatedThesisId: draft.relatedThesisId ?? null,
        relatedDossierId: draft.relatedDossierId ?? null,
        relatedCatalystIds: structuredClone(draft.relatedCatalystIds),
        relatedTimelineIds: structuredClone(draft.relatedTimelineIds),
        metadata: draft.metadata ? structuredClone(draft.metadata) : {},
        createdAt: now,
        updatedAt: now,
      };

      staleAlertsStore.push(created);
      return structuredClone(created);
    });

    const nextAlertIds = new Set(nextAlerts.map((alert) => alert.id));

    for (let index = staleAlertsStore.length - 1; index >= 0; index -= 1) {
      const alert = staleAlertsStore[index];
      if (alert.projectId === input.projectId && !nextAlertIds.has(alert.id)) {
        staleAlertsStore.splice(index, 1);
      }
    }

    const analysisState: MonitoringAnalysisState = {
      projectId: input.projectId,
      lastEvaluatedAt: now,
      sourceRecordCount: nextRecords.length,
      alertCount: nextAlerts.length,
      summary: input.summary,
    };
    monitoringAnalysisStateStore.set(input.projectId, analysisState);

    return {
      records: structuredClone(nextRecords),
      alerts: structuredClone(nextAlerts),
      analysisState: structuredClone(analysisState),
    };
  }

  async getAnalysisState(projectId: string): Promise<MonitoringAnalysisState> {
    return (
      structuredClone(monitoringAnalysisStateStore.get(projectId)) ?? {
        projectId,
        lastEvaluatedAt: null,
        sourceRecordCount: 0,
        alertCount: 0,
        summary: "Source monitoring has not been evaluated for this project yet.",
      }
    );
  }
}

class SqliteSourceMonitoringRepository implements SourceMonitoringRepository {
  async listRecordsByProjectId(projectId: string): Promise<SourceMonitoringRecord[]> {
    return listPersistedRecords<SourceMonitoringRecord>(
      "source_monitoring_records_store",
      `SELECT payload
       FROM source_monitoring_records_store
       WHERE project_id = ?
       ORDER BY updated_at DESC`,
      projectId,
    );
  }

  async listAlertsByProjectId(projectId: string): Promise<StaleAlert[]> {
    return listPersistedRecords<StaleAlert>(
      "stale_alerts_store",
      `SELECT payload
       FROM stale_alerts_store
       WHERE project_id = ?
       ORDER BY updated_at DESC`,
      projectId,
    );
  }

  async syncProjectState(input: {
    projectId: string;
    sourceMonitoringDrafts: SourceMonitoringDraft[];
    staleAlertDrafts: StaleAlertDraft[];
    summary: string;
  }): Promise<{
    records: SourceMonitoringRecord[];
    alerts: StaleAlert[];
    analysisState: MonitoringAnalysisState;
  }> {
    const now = new Date().toISOString();
    const existingRecords = await this.listRecordsByProjectId(input.projectId);
    const existingRecordsById = new Map(
      existingRecords.map((record) => [record.id, record] as const),
    );
    const nextRecords = input.sourceMonitoringDrafts.map<SourceMonitoringRecord>((draft) => {
      const id = sourceMonitoringId(input.projectId, draft.stableKey);
      const existing = existingRecordsById.get(id);
      const record: SourceMonitoringRecord = {
        id,
        projectId: input.projectId,
        sourceId: draft.sourceId,
        lastSeenAt: draft.lastSeenAt,
        lastCompiledAt: draft.lastCompiledAt ?? null,
        freshnessStatus: draft.freshnessStatus,
        possibleImpactLevel: draft.possibleImpactLevel,
        staleReason: draft.staleReason,
        metadata: draft.metadata ? structuredClone(draft.metadata) : {},
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      upsertMonitoringRecord(record);
      return structuredClone(record);
    });

    const nextRecordIds = new Set(nextRecords.map((record) => record.id));
    deleteRecordsByIds(
      "source_monitoring_records_store",
      existingRecords
        .filter((record) => !nextRecordIds.has(record.id))
        .map((record) => record.id),
    );

    const existingAlerts = await this.listAlertsByProjectId(input.projectId);
    const existingAlertsById = new Map(
      existingAlerts.map((alert) => [alert.id, alert] as const),
    );
    const nextAlerts = input.staleAlertDrafts.map<StaleAlert>((draft) => {
      const id = staleAlertId(input.projectId, draft.stableKey);
      const existing = existingAlertsById.get(id);
      const alert: StaleAlert = {
        id,
        projectId: input.projectId,
        alertType: draft.alertType,
        title: draft.title,
        description: draft.description,
        severity: draft.severity,
        status: existing?.status ?? draft.status ?? "open",
        relatedSourceIds: structuredClone(draft.relatedSourceIds),
        relatedThesisId: draft.relatedThesisId ?? null,
        relatedDossierId: draft.relatedDossierId ?? null,
        relatedCatalystIds: structuredClone(draft.relatedCatalystIds),
        relatedTimelineIds: structuredClone(draft.relatedTimelineIds),
        metadata: draft.metadata ? structuredClone(draft.metadata) : {},
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      upsertStaleAlertRecord(alert);
      return structuredClone(alert);
    });

    const nextAlertIds = new Set(nextAlerts.map((alert) => alert.id));
    deleteRecordsByIds(
      "stale_alerts_store",
      existingAlerts
        .filter((alert) => !nextAlertIds.has(alert.id))
        .map((alert) => alert.id),
    );

    const analysisState: MonitoringAnalysisState = {
      projectId: input.projectId,
      lastEvaluatedAt: now,
      sourceRecordCount: nextRecords.length,
      alertCount: nextAlerts.length,
      summary: input.summary,
    };

    upsertMonitoringAnalysisStateRecord(analysisState);

    return {
      records: structuredClone(nextRecords),
      alerts: structuredClone(nextAlerts),
      analysisState: structuredClone(analysisState),
    };
  }

  async getAnalysisState(projectId: string): Promise<MonitoringAnalysisState> {
    return (
      getPersistedRecord<MonitoringAnalysisState>(
        "SELECT payload FROM monitoring_analysis_states_store WHERE project_id = ?",
        projectId,
      ) ?? {
        projectId,
        lastEvaluatedAt: null,
        sourceRecordCount: 0,
        alertCount: 0,
        summary: "Source monitoring has not been evaluated for this project yet.",
      }
    );
  }
}

export const sourceMonitoringRepository: SourceMonitoringRepository =
  getPersistenceMode() === "sqlite"
    ? new SqliteSourceMonitoringRepository()
    : new InMemorySourceMonitoringRepository();
