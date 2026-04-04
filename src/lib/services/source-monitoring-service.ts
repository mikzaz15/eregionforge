import type {
  Catalyst,
  CatalystCompileState,
  Claim,
  CompanyDossier,
  Contradiction,
  ContradictionAnalysisState,
  Source,
  SourceMonitoringDraft,
  SourceMonitoringRecord,
  StaleAlert,
  StaleAlertDraft,
  TimelineCompileState,
  TimelineEvent,
  Thesis,
  WikiPage,
  WikiPageRevision,
} from "@/lib/domain/types";
import { compileJobsRepository } from "@/lib/repositories/compile-jobs-repository";
import { claimsRepository } from "@/lib/repositories/claims-repository";
import { contradictionsRepository } from "@/lib/repositories/contradictions-repository";
import { companyDossiersRepository } from "@/lib/repositories/company-dossiers-repository";
import { catalystsRepository } from "@/lib/repositories/catalysts-repository";
import { sourcesRepository } from "@/lib/repositories/sources-repository";
import { sourceMonitoringRepository } from "@/lib/repositories/source-monitoring-repository";
import { timelineEventsRepository } from "@/lib/repositories/timeline-events-repository";
import { wikiRepository } from "@/lib/repositories/wiki-repository";
import { getProjectThesisSnapshot } from "@/lib/services/thesis-service";
import {
  detectSemanticThemes,
  formatThemeLabel,
  summarizeThemeList,
  type SemanticTheme,
} from "@/lib/services/semantic-intelligence-v1";

type PageContext = {
  page: WikiPage;
  revision: WikiPageRevision | null;
  sourceIds: string[];
};

export type SourceMonitoringRecordDetail = {
  record: SourceMonitoringRecord;
  source: Source | null;
};

export type StaleAlertReferenceRecord = {
  alert: StaleAlert;
  relatedSources: Source[];
  relatedThesis: Thesis | null;
  relatedDossier: CompanyDossier | null;
  relatedCatalysts: Catalyst[];
  relatedTimelineEvents: TimelineEvent[];
};

export type ProjectMonitoringSnapshot = {
  sourceRecords: SourceMonitoringRecordDetail[];
  alerts: StaleAlertReferenceRecord[];
  analysisState: {
    projectId: string;
    lastEvaluatedAt: string | null;
    sourceRecordCount: number;
    alertCount: number;
    summary: string;
  };
  summary: {
    activeAlerts: number;
    highSeverityAlerts: number;
    sourcesNeedingReview: number;
    highImpactSourceChanges: number;
    thesisAlerts: number;
    dossierAlerts: number;
  };
};

export type MonitoringPageData = ProjectMonitoringSnapshot & {
  metrics: Array<{ label: string; value: string; note: string }>;
};

function maxTimestamp(...values: Array<string | null | undefined>): string | null {
  const filtered = values.filter((value): value is string => Boolean(value));
  if (filtered.length === 0) {
    return null;
  }

  return filtered.sort((left, right) => right.localeCompare(left))[0] ?? null;
}

async function buildPageContexts(projectId: string): Promise<PageContext[]> {
  const pages = await wikiRepository.listPagesByProjectId(projectId);

  return Promise.all(
    pages.map(async (page) => {
      const [revision, sourceIds] = await Promise.all([
        wikiRepository.getCurrentRevision(page.id),
        wikiRepository.listSourceIdsForPage(page.id),
      ]);

      return {
        page,
        revision,
        sourceIds,
      };
    }),
  );
}

function stableKey(...parts: Array<string | null | undefined>): string {
  return parts
    .filter((part): part is string => Boolean(part))
    .map((part) => part.toLowerCase().replace(/[^a-z0-9]+/g, "-"))
    .join("-");
}

function sourceThemes(source: Source): SemanticTheme[] {
  return detectSemanticThemes(`${source.title} ${source.body ?? ""}`);
}

function formatThemeSummary(themes: SemanticTheme[]): string {
  return themes.length > 0 ? summarizeThemeList(themes) : "general research posture";
}

function buildImpactSourceSet(input: {
  thesis: Thesis | null;
  dossier: CompanyDossier | null;
  catalysts: Catalyst[];
  pageContexts: PageContext[];
}): {
  high: Set<string>;
  medium: Set<string>;
} {
  const high = new Set<string>();
  const medium = new Set<string>();

  if (input.thesis) {
    for (const refs of Object.values(input.thesis.supportBySection) as Array<{
      sourceIds: string[];
    }>) {
      refs.sourceIds.forEach((sourceId) => high.add(sourceId));
    }
  }

  if (input.dossier) {
    for (const refs of Object.values(input.dossier.supportBySection) as Array<{
      sourceIds: string[];
    }>) {
      refs.sourceIds.forEach((sourceId) => {
        if (!high.has(sourceId)) {
          medium.add(sourceId);
        }
      });
    }
  }

  for (const catalyst of input.catalysts) {
    catalyst.linkedSourceIds.forEach((sourceId) => high.add(sourceId));
  }

  for (const context of input.pageContexts) {
    context.sourceIds.forEach((sourceId) => {
      if (!high.has(sourceId)) {
        medium.add(sourceId);
      }
    });
  }

  return { high, medium };
}

function buildSourceMonitoringDrafts(input: {
  projectId: string;
  sources: Source[];
  latestProjectCompileAt: string | null;
  highImpactSources: Set<string>;
  mediumImpactSources: Set<string>;
}): SourceMonitoringDraft[] {
  return input.sources.map((source) => {
    let freshnessStatus: SourceMonitoringRecord["freshnessStatus"];
    let staleReason: string;
    const themes = sourceThemes(source);
    const themeSummary = formatThemeSummary(themes);

    if (source.status === "failed") {
      freshnessStatus = "stale";
      staleReason = `Source processing failed, so compiled intelligence may be missing ${themeSummary} input entirely.`;
    } else if (
      source.status === "pending" ||
      source.status === "parsed" ||
      source.status === "extracted" ||
      !input.latestProjectCompileAt
    ) {
      freshnessStatus = "uncompiled";
      staleReason = `Source exists but has not yet flowed through a completed project compile. The source appears relevant to ${themeSummary}.`;
    } else if (source.updatedAt > input.latestProjectCompileAt) {
      freshnessStatus = "new_since_compile";
      staleReason = `Source was added or updated after the last completed project compile and touches ${themeSummary}.`;
    } else {
      freshnessStatus = "current";
      staleReason = "Source freshness is aligned with the latest completed project compile.";
    }

    const possibleImpactLevel =
      input.highImpactSources.has(source.id) ||
      themes.some((theme) =>
        ["pricing", "margin", "demand", "timing", "guidance", "earnings", "product", "regulatory", "customer"].includes(
          theme,
        ),
      )
      ? "high"
      : input.mediumImpactSources.has(source.id)
        ? "medium"
        : "low";

    return {
      stableKey: stableKey(source.id),
      projectId: input.projectId,
      sourceId: source.id,
      lastSeenAt: source.updatedAt,
      lastCompiledAt: input.latestProjectCompileAt,
      freshnessStatus,
      possibleImpactLevel,
      staleReason,
      metadata: {
        sourceStatus: source.status,
        semanticThemes: themes.join(", "),
      },
    };
  });
}

function filterChangedSources(
  sourceRecords: SourceMonitoringDraft[],
  threshold: string | null,
  minimumImpact: "high" | "medium" | "low" = "low",
): SourceMonitoringDraft[] {
  const rank = { high: 3, medium: 2, low: 1 };
  return sourceRecords.filter(
    (record) =>
      record.lastSeenAt > (threshold ?? "") &&
      record.freshnessStatus !== "current" &&
      rank[record.possibleImpactLevel] >= rank[minimumImpact],
  );
}

function buildThesisAlert(input: {
  projectId: string;
  thesis: Thesis | null;
  thesisPotentiallyStale: boolean;
  sourceRecords: SourceMonitoringDraft[];
  claims: Claim[];
  timelineEvents: TimelineEvent[];
  timelineState: TimelineCompileState;
  contradictionState: ContradictionAnalysisState;
  contradictions: Contradiction[];
  catalystState: CatalystCompileState;
  catalysts: Catalyst[];
}): StaleAlertDraft | null {
  if (!input.thesis) {
    return null;
  }

  const changedSources = filterChangedSources(
    input.sourceRecords,
    input.thesis.updatedAt,
    "medium",
  );
  const changedThemes = Array.from(
    new Set(
      changedSources.flatMap((record) =>
        (record.metadata?.semanticThemes ?? "")
          .split(",")
          .map((theme) => theme.trim())
          .filter(Boolean),
      ),
    ),
  );
  const newerTimelineEvents = input.timelineEvents.filter(
    (event) => event.updatedAt > input.thesis!.updatedAt,
  );
  const contradictionCountDelta =
    input.contradictions.filter((entry) => entry.status !== "resolved").length -
    Number.parseInt(input.thesis.metadata?.contradictionCount ?? "0", 10);
  const supportedClaimDelta =
    input.claims.filter((claim) => claim.supportStatus === "supported").length -
    Number.parseInt(input.thesis.metadata?.supportedClaimCount ?? "0", 10);
  const sourceDiversityDelta =
    new Set(
      input.claims
        .map((claim) => claim.sourceId ?? null)
        .filter((value): value is string => Boolean(value)),
    ).size - Number.parseInt(input.thesis.metadata?.sourceDiversityCount ?? "0", 10);
  const preciseTimelineDelta =
    input.timelineEvents.filter((event) => event.eventDatePrecision === "exact_day").length -
    Number.parseInt(input.thesis.metadata?.preciseTimelineCount ?? "0", 10);
  const catalystCountDelta =
    input.catalysts.length -
    Number.parseInt(input.thesis.metadata?.catalystCount ?? "0", 10);
  const needsAlert =
    input.thesisPotentiallyStale ||
    changedSources.length > 0 ||
    newerTimelineEvents.length > 0 ||
    (input.contradictionState.lastAnalyzedAt ?? "") > input.thesis.updatedAt ||
    (input.catalystState.lastCompiledAt ?? "") > input.thesis.updatedAt ||
    contradictionCountDelta !== 0 ||
    catalystCountDelta !== 0 ||
    supportedClaimDelta !== 0 ||
    sourceDiversityDelta !== 0 ||
    preciseTimelineDelta !== 0;

  if (!needsAlert) {
    return null;
  }

  const severity: StaleAlert["severity"] =
    changedSources.some((record) => record.possibleImpactLevel === "high") ||
    contradictionCountDelta > 0 ||
    catalystCountDelta > 0 ||
    supportedClaimDelta > 0
      ? "high"
      : "medium";
  const driverSummary = [
    changedThemes.length > 0
      ? `theme shift: ${changedThemes
          .slice(0, 3)
          .map((theme) => formatThemeLabel(theme as SemanticTheme))
          .join(", ")}`
      : null,
    contradictionCountDelta !== 0
      ? `contradiction posture ${contradictionCountDelta > 0 ? "up" : "down"} ${Math.abs(contradictionCountDelta)}`
      : null,
    catalystCountDelta !== 0
      ? `catalyst posture ${catalystCountDelta > 0 ? "up" : "down"} ${Math.abs(catalystCountDelta)}`
      : null,
    supportedClaimDelta !== 0
      ? `supported claims ${supportedClaimDelta > 0 ? "up" : "down"} ${Math.abs(supportedClaimDelta)}`
      : null,
    sourceDiversityDelta !== 0
      ? `source diversity ${sourceDiversityDelta > 0 ? "up" : "down"} ${Math.abs(sourceDiversityDelta)}`
      : null,
    preciseTimelineDelta > 0 ? `${preciseTimelineDelta} more exact-date event(s)` : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join("; ");

  return {
    stableKey: stableKey("thesis", input.thesis.id),
    projectId: input.projectId,
    alertType: "thesis_may_be_stale",
    title: "Thesis may be stale",
    description: `The thesis predates newer project inputs. ${changedSources.length} relevant source change(s), ${newerTimelineEvents.length} newer timeline event(s), contradiction delta ${contradictionCountDelta}, catalyst delta ${catalystCountDelta}. ${driverSummary ? `Likely drivers: ${driverSummary}. ` : ""}Suggested next action: refresh the thesis after reviewing new sources and updated analysis layers.`,
    severity,
    relatedSourceIds: changedSources.map((record) => record.sourceId),
    relatedThesisId: input.thesis.id,
    relatedDossierId: null,
    relatedCatalystIds: input.catalysts
      .filter((entry) => entry.updatedAt > input.thesis!.updatedAt)
      .map((entry) => entry.id),
    relatedTimelineIds: newerTimelineEvents.map((entry) => entry.id),
    metadata: {
      suggestedAction: "Refresh thesis",
    },
  };
}

function buildDossierAlert(input: {
  projectId: string;
  dossier: CompanyDossier | null;
  sourceRecords: SourceMonitoringDraft[];
  pageContexts: PageContext[];
}): StaleAlertDraft | null {
  if (!input.dossier) {
    return null;
  }

  const dossier = input.dossier;

  const changedSourceSummaryPages = input.pageContexts.filter(
    (context) =>
      context.page.pageType === "source-summary" &&
      (maxTimestamp(context.page.updatedAt, context.revision?.createdAt) ?? "") >
        dossier.updatedAt,
  );
  const changedSources = filterChangedSources(
    input.sourceRecords,
    dossier.updatedAt,
    "medium",
  ).filter((record) =>
    Object.values(dossier.supportBySection).some((refs) =>
      refs.sourceIds.includes(record.sourceId),
    ),
  );
  const changedThemes = Array.from(
    new Set(
      changedSources.flatMap((record) =>
        (record.metadata?.semanticThemes ?? "")
          .split(",")
          .map((theme) => theme.trim())
          .filter(Boolean),
      ),
    ),
  );

  if (changedSourceSummaryPages.length === 0 && changedSources.length === 0) {
    return null;
  }

  return {
    stableKey: stableKey("dossier", dossier.id),
    projectId: input.projectId,
    alertType: "dossier_may_be_stale",
    title: "Dossier may be stale",
    description: `The dossier predates ${changedSourceSummaryPages.length} changed source-summary page(s) and ${changedSources.length} relevant source change(s). ${
      changedThemes.length > 0
        ? `Updated source themes: ${changedThemes
            .slice(0, 3)
            .map((theme) => formatThemeLabel(theme as SemanticTheme))
            .join(", ")}. `
        : ""
    }Suggested next action: refresh the dossier after reviewing updated summaries and sources.`,
    severity: changedSources.some((record) => record.possibleImpactLevel === "high")
      ? "high"
      : "medium",
    relatedSourceIds: changedSources.map((record) => record.sourceId),
    relatedThesisId: null,
    relatedDossierId: dossier.id,
    relatedCatalystIds: [],
    relatedTimelineIds: [],
    metadata: {
      suggestedAction: "Refresh dossier",
    },
  };
}

function buildCatalystAlert(input: {
  projectId: string;
  catalystState: CatalystCompileState;
  catalysts: Catalyst[];
  sourceRecords: SourceMonitoringDraft[];
  timelineState: TimelineCompileState;
  thesis: Thesis | null;
}): StaleAlertDraft | null {
  const changedSources = filterChangedSources(
    input.sourceRecords,
    input.catalystState.lastCompiledAt,
    "medium",
  );
  const needsAlert =
    (input.catalystState.lastCompiledAt === null && input.catalysts.length === 0) ||
    changedSources.length > 0 ||
    (input.timelineState.lastCompiledAt ?? "") > (input.catalystState.lastCompiledAt ?? "") ||
    (input.thesis?.updatedAt ?? "") > (input.catalystState.lastCompiledAt ?? "");

  if (!needsAlert) {
    return null;
  }

  const changedThemes = Array.from(
    new Set(
      changedSources.flatMap((record) =>
        (record.metadata?.semanticThemes ?? "")
          .split(",")
          .map((theme) => theme.trim())
          .filter(Boolean),
      ),
    ),
  );

  return {
    stableKey: stableKey("catalyst-tracker"),
    projectId: input.projectId,
    alertType: "catalyst_tracker_needs_refresh",
    title: "Catalyst tracker may need refresh",
    description: `Catalyst tracking predates newer project signals. ${changedSources.length} source change(s) arrived after the last catalyst compile. ${
      changedThemes.length > 0
        ? `New source themes: ${changedThemes
            .slice(0, 3)
            .map((theme) => formatThemeLabel(theme as SemanticTheme))
            .join(", ")}. `
        : ""
    }Suggested next action: rebuild catalysts after reviewing new sources, thesis state, and chronology.`,
    severity: changedSources.some((record) => record.possibleImpactLevel === "high")
      ? "high"
      : "medium",
    relatedSourceIds: changedSources.map((record) => record.sourceId),
    relatedThesisId: input.thesis?.id ?? null,
    relatedDossierId: null,
    relatedCatalystIds: input.catalysts.map((entry) => entry.id),
    relatedTimelineIds: [],
    metadata: {
      suggestedAction: "Refresh catalysts",
    },
  };
}

function buildContradictionsAlert(input: {
  projectId: string;
  contradictionState: ContradictionAnalysisState;
  sourceRecords: SourceMonitoringDraft[];
  pageContexts: PageContext[];
  timelineEvents: TimelineEvent[];
  contradictions: Contradiction[];
}): StaleAlertDraft | null {
  const latestPageUpdate = input.pageContexts.reduce<string | null>(
    (latest, context) =>
      maxTimestamp(latest, context.page.updatedAt, context.revision?.createdAt),
    null,
  );
  const latestTimelineUpdate = input.timelineEvents.reduce<string | null>(
    (latest, event) => maxTimestamp(latest, event.updatedAt),
    null,
  );
  const changedSources = filterChangedSources(
    input.sourceRecords,
    input.contradictionState.lastAnalyzedAt,
    "low",
  );
  const needsAlert =
    input.contradictionState.lastAnalyzedAt === null
      ? input.pageContexts.length > 0 ||
        input.timelineEvents.length > 0 ||
        changedSources.length > 0
      : (maxTimestamp(latestPageUpdate, latestTimelineUpdate) ?? "") >
          input.contradictionState.lastAnalyzedAt ||
        changedSources.length > 0;
  const changedThemes = Array.from(
    new Set(
      changedSources.flatMap((record) =>
        (record.metadata?.semanticThemes ?? "")
          .split(",")
          .map((theme) => theme.trim())
          .filter(Boolean),
      ),
    ),
  );

  if (!needsAlert) {
    return null;
  }

  return {
    stableKey: stableKey("contradictions"),
    projectId: input.projectId,
    alertType: "contradictions_should_rerun",
    title: "Contradictions analysis should be rerun",
    description: `Contradiction analysis predates newer canonical inputs. ${changedSources.length} source change(s) and updated page or timeline state may affect disagreement records. ${
      changedThemes.length > 0
        ? `Potentially affected themes: ${changedThemes
            .slice(0, 3)
            .map((theme) => formatThemeLabel(theme as SemanticTheme))
            .join(", ")}. `
        : ""
    }Suggested next action: rerun contradiction analysis.`,
    severity: input.contradictions.length > 0 || changedSources.length > 0 ? "medium" : "low",
    relatedSourceIds: changedSources.map((record) => record.sourceId),
    relatedThesisId: null,
    relatedDossierId: null,
    relatedCatalystIds: [],
    relatedTimelineIds: input.timelineEvents
      .filter((event) => event.updatedAt > (input.contradictionState.lastAnalyzedAt ?? ""))
      .map((event) => event.id),
    metadata: {
      suggestedAction: "Rerun contradictions",
    },
  };
}

export async function runProjectMonitoringAnalysis(
  projectId: string,
): Promise<ProjectMonitoringSnapshot> {
  const [
    sources,
    latestCompile,
    thesisSnapshot,
    claims,
    dossier,
    catalysts,
    catalystState,
    timelineEvents,
    timelineState,
    contradictions,
    contradictionState,
    pageContexts,
  ] = await Promise.all([
    sourcesRepository.listByProjectId(projectId),
    compileJobsRepository.getLatestByProjectId(projectId),
    getProjectThesisSnapshot(projectId),
    claimsRepository.listByProjectId(projectId),
    companyDossiersRepository.getByProjectId(projectId),
    catalystsRepository.listByProjectId(projectId),
    catalystsRepository.getCompileState(projectId),
    timelineEventsRepository.listByProjectId(projectId),
    timelineEventsRepository.getCompileState(projectId),
    contradictionsRepository.listByProjectId(projectId),
    contradictionsRepository.getAnalysisState(projectId),
    buildPageContexts(projectId),
  ]);

  const impactSets = buildImpactSourceSet({
    thesis: thesisSnapshot.thesis,
    dossier,
    catalysts,
    pageContexts,
  });
  const sourceMonitoringDrafts = buildSourceMonitoringDrafts({
    projectId,
    sources,
    latestProjectCompileAt: latestCompile?.completedAt ?? null,
    highImpactSources: impactSets.high,
    mediumImpactSources: impactSets.medium,
  });
  const staleAlertDrafts = [
    buildThesisAlert({
      projectId,
      thesis: thesisSnapshot.thesis,
      thesisPotentiallyStale: thesisSnapshot.freshness.potentiallyStale,
      sourceRecords: sourceMonitoringDrafts,
      claims,
      timelineEvents,
      timelineState,
      contradictionState,
      contradictions,
      catalystState,
      catalysts,
    }),
    buildDossierAlert({
      projectId,
      dossier,
      sourceRecords: sourceMonitoringDrafts,
      pageContexts,
    }),
    buildCatalystAlert({
      projectId,
      catalystState,
      catalysts,
      sourceRecords: sourceMonitoringDrafts,
      timelineState,
      thesis: thesisSnapshot.thesis,
    }),
    buildContradictionsAlert({
      projectId,
      contradictionState,
      sourceRecords: sourceMonitoringDrafts,
      pageContexts,
      timelineEvents,
      contradictions,
    }),
  ].filter((alert): alert is StaleAlertDraft => Boolean(alert));

  const syncResult = await sourceMonitoringRepository.syncProjectState({
    projectId,
    sourceMonitoringDrafts,
    staleAlertDrafts,
    summary: `Monitoring evaluated ${sourceMonitoringDrafts.length} source record(s) and ${staleAlertDrafts.length} stale alert(s) across thesis, dossier, catalysts, and contradiction analysis.`,
  });

  const sourcesById = new Map(sources.map((source) => [source.id, source] as const));
  const catalystsById = new Map(catalysts.map((catalyst) => [catalyst.id, catalyst] as const));
  const timelineById = new Map(timelineEvents.map((event) => [event.id, event] as const));

  const sourceRecords = syncResult.records.map((record) => ({
    record,
    source: sourcesById.get(record.sourceId) ?? null,
  }));
  const alerts = syncResult.alerts.map((alert) => ({
    alert,
    relatedSources: alert.relatedSourceIds
      .map((id) => sourcesById.get(id) ?? null)
      .filter((entry): entry is Source => Boolean(entry)),
    relatedThesis:
      alert.relatedThesisId && thesisSnapshot.thesis?.id === alert.relatedThesisId
        ? thesisSnapshot.thesis
        : null,
    relatedDossier:
      alert.relatedDossierId && dossier?.id === alert.relatedDossierId ? dossier : null,
    relatedCatalysts: alert.relatedCatalystIds
      .map((id) => catalystsById.get(id) ?? null)
      .filter((entry): entry is Catalyst => Boolean(entry)),
    relatedTimelineEvents: alert.relatedTimelineIds
      .map((id) => timelineById.get(id) ?? null)
      .filter((entry): entry is TimelineEvent => Boolean(entry)),
  }));

  return {
    sourceRecords,
    alerts,
    analysisState: syncResult.analysisState,
    summary: {
      activeAlerts: alerts.filter((entry) => entry.alert.status === "open").length,
      highSeverityAlerts: alerts.filter(
        (entry) =>
          entry.alert.status === "open" &&
          (entry.alert.severity === "high" || entry.alert.severity === "critical"),
      ).length,
      sourcesNeedingReview: sourceRecords.filter(
        (entry) => entry.record.freshnessStatus !== "current",
      ).length,
      highImpactSourceChanges: sourceRecords.filter(
        (entry) =>
          entry.record.freshnessStatus !== "current" &&
          entry.record.possibleImpactLevel === "high",
      ).length,
      thesisAlerts: alerts.filter(
        (entry) => entry.alert.alertType === "thesis_may_be_stale",
      ).length,
      dossierAlerts: alerts.filter(
        (entry) => entry.alert.alertType === "dossier_may_be_stale",
      ).length,
    },
  };
}

export async function getProjectMonitoringSnapshot(
  projectId: string,
): Promise<ProjectMonitoringSnapshot> {
  return runProjectMonitoringAnalysis(projectId);
}

export async function getProjectMonitoringPageData(
  projectId: string,
): Promise<MonitoringPageData> {
  const snapshot = await getProjectMonitoringSnapshot(projectId);

  return {
    ...snapshot,
    metrics: [
      {
        label: "Active Alerts",
        value: String(snapshot.summary.activeAlerts),
        note: "Active stale alerts identify compiled views that may no longer reflect the latest project knowledge.",
      },
      {
        label: "High Severity",
        value: String(snapshot.summary.highSeverityAlerts),
        note: "High-severity alerts typically indicate thesis or other decision-driving views may need prompt refresh.",
      },
      {
        label: "Sources Needing Review",
        value: String(snapshot.summary.sourcesNeedingReview),
        note: "These source records arrived after the latest relevant compile or remain uncompiled.",
      },
      {
        label: "Last Evaluation",
        value: snapshot.analysisState.lastEvaluatedAt
          ? new Intl.DateTimeFormat("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            }).format(new Date(snapshot.analysisState.lastEvaluatedAt))
          : "Not evaluated",
        note: snapshot.analysisState.summary,
      },
    ],
  };
}
