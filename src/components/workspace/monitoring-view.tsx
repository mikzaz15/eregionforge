import type { ReactNode } from "react";
import Link from "next/link";
import {
  compileActiveProjectCatalystsAction,
  compileActiveProjectDossierAction,
  compileActiveProjectThesisAction,
  compileActiveProjectTimelineAction,
  runActiveProjectContradictionAnalysisAction,
  updateStaleAlertStatusAction,
} from "@/app/(workspace)/actions";
import {
  MetricCard,
  PageFrame,
  SectionCard,
  StatusPill,
  type StatusTone,
} from "@/components/workspace/primitives";
import type { MonitoringPageData } from "@/lib/services/workspace-service";

function severityTone(severity: string): StatusTone {
  if (severity === "critical" || severity === "high") {
    return "danger";
  }

  if (severity === "medium") {
    return "accent";
  }

  return "neutral";
}

function freshnessTone(status: string): StatusTone {
  if (status === "current") {
    return "success";
  }

  if (status === "new_since_compile") {
    return "danger";
  }

  if (status === "uncompiled") {
    return "accent";
  }

  return "danger";
}

function impactTone(level: string): StatusTone {
  if (level === "high") {
    return "danger";
  }

  if (level === "medium") {
    return "accent";
  }

  return "neutral";
}

function alertStatusTone(status: string): StatusTone {
  if (status === "dismissed") {
    return "neutral";
  }

  if (status === "acknowledged") {
    return "success";
  }

  return "accent";
}

function labelize(value: string): string {
  return value.replace(/([A-Z])/g, " $1").replaceAll("_", " ").replaceAll("-", " ");
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function alertTargetPath(input: {
  alertType: string;
  thesisPath: string;
  dossierPath: string;
  catalystsPath: string;
  timelinePath: string;
  contradictionsPath: string;
}): string {
  if (input.alertType === "thesis_may_be_stale") {
    return input.thesisPath;
  }

  if (input.alertType === "dossier_may_be_stale") {
    return input.dossierPath;
  }

  if (input.alertType === "catalyst_tracker_needs_refresh") {
    return input.catalystsPath;
  }

  return input.contradictionsPath;
}

function AlertRefreshAction({
  alertType,
}: Readonly<{
  alertType: string;
}>) {
  if (alertType === "thesis_may_be_stale") {
    return (
      <form action={compileActiveProjectThesisAction}>
        <button className="action-button-secondary action-button-compact">
          Refresh Thesis
        </button>
      </form>
    );
  }

  if (alertType === "dossier_may_be_stale") {
    return (
      <form action={compileActiveProjectDossierAction}>
        <button className="action-button-secondary action-button-compact">
          Refresh Dossier
        </button>
      </form>
    );
  }

  if (alertType === "catalyst_tracker_needs_refresh") {
    return (
      <form action={compileActiveProjectCatalystsAction}>
        <button className="action-button-secondary action-button-compact">
          Refresh Catalysts
        </button>
      </form>
    );
  }

  if (alertType === "contradictions_should_rerun") {
    return (
      <form action={runActiveProjectContradictionAnalysisAction}>
        <button className="action-button-secondary action-button-compact">
          Re-run Contradictions
        </button>
      </form>
    );
  }

  return (
    <form action={compileActiveProjectTimelineAction}>
      <button className="action-button-secondary action-button-compact">
        Rebuild Timeline
      </button>
    </form>
  );
}

export function MonitoringView({
  data,
  eyebrow,
  title,
  description,
  actions,
  sourcesPath,
  thesisPath,
  dossierPath,
  catalystsPath,
  timelinePath,
  contradictionsPath,
}: Readonly<{
  data: MonitoringPageData;
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  sourcesPath: string;
  thesisPath: string;
  dossierPath: string;
  catalystsPath: string;
  timelinePath: string;
  contradictionsPath: string;
}>) {
  const activeAlerts = data.alerts.filter(
    (entry) =>
      entry.alert.metadata?.signalState !== "inactive" &&
      entry.alert.status !== "dismissed",
  );
  const historicalAlerts = data.alerts.filter(
    (entry) =>
      entry.alert.metadata?.signalState === "inactive" ||
      entry.alert.status === "dismissed",
  );

  return (
    <PageFrame
      eyebrow={eyebrow}
      title={title}
      description={description}
      actions={actions}
    >
      <div className="grid gap-4 xl:grid-cols-4">
        {data.metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <SectionCard
        eyebrow="Alert Queue"
        title="Stale intelligence alerts"
        description="Freshness alerts identify which compiled views may lag newer sources, timeline state, contradiction analysis, or catalyst updates."
      >
        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4">
            <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              Monitoring summary
            </p>
            <p className="mt-3 text-4xl font-semibold tracking-tight text-foreground">
              {data.monitoringSummary.activeAlerts}
            </p>
            <p className="mt-3 text-sm leading-6 text-muted">
              High severity: {data.monitoringSummary.highSeverityAlerts}. Acknowledged: {data.monitoringSummary.acknowledgedAlerts}. Dismissed history: {data.monitoringSummary.dismissedAlerts}.
            </p>
            <p className="mt-3 text-sm leading-6 text-muted">
              Sources needing review: {data.monitoringSummary.sourcesNeedingReview}. High-impact source changes: {data.monitoringSummary.highImpactSourceChanges}.
            </p>
            <p className="mt-3 text-sm leading-6 text-muted">
              {data.analysisState.summary}
            </p>
            <p className="mt-3 text-sm leading-6 text-muted">
              Last evaluated {formatDateTime(data.analysisState.lastEvaluatedAt)}
            </p>
          </div>
          <div className="space-y-3">
            {activeAlerts.length > 0 ? (
              activeAlerts.map((entry) => (
                <article
                  key={entry.alert.id}
                  id={entry.alert.id}
                  className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold tracking-tight text-foreground">
                      {entry.alert.title}
                    </p>
                    <StatusPill tone={severityTone(entry.alert.severity)}>
                      {entry.alert.severity}
                    </StatusPill>
                    <StatusPill tone={alertStatusTone(entry.alert.status)}>
                      {entry.alert.status}
                    </StatusPill>
                    <StatusPill tone="neutral">
                      {labelize(entry.alert.alertType)}
                    </StatusPill>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-foreground">
                    {entry.alert.description}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Suggested next action: {entry.alert.metadata?.suggestedAction ?? "Review freshness inputs"}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href={alertTargetPath({
                        alertType: entry.alert.alertType,
                        thesisPath,
                        dossierPath,
                        catalystsPath,
                        timelinePath,
                        contradictionsPath,
                      })}
                      className="action-button-secondary action-button-compact"
                    >
                      Inspect Surface
                    </Link>
                    <AlertRefreshAction alertType={entry.alert.alertType} />
                    {entry.alert.status !== "acknowledged" ? (
                      <form action={updateStaleAlertStatusAction}>
                        <input type="hidden" name="projectId" value={data.summary.project.id} />
                        <input type="hidden" name="alertId" value={entry.alert.id} />
                        <input type="hidden" name="status" value="acknowledged" />
                        <input type="hidden" name="redirectTo" value="/monitoring" />
                        <button className="action-button-secondary action-button-compact">
                          Acknowledge Alert
                        </button>
                      </form>
                    ) : null}
                    {entry.alert.status !== "dismissed" ? (
                      <form action={updateStaleAlertStatusAction}>
                        <input type="hidden" name="projectId" value={data.summary.project.id} />
                        <input type="hidden" name="alertId" value={entry.alert.id} />
                        <input type="hidden" name="status" value="dismissed" />
                        <input type="hidden" name="redirectTo" value="/monitoring" />
                        <button className="action-button-secondary action-button-compact">
                          Dismiss Alert
                        </button>
                      </form>
                    ) : null}
                    <Link
                      href={sourcesPath}
                      className="action-button-secondary action-button-compact"
                    >
                      Review Sources
                    </Link>
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-5">
                    <div className="rounded-2xl border border-border bg-background/65 px-4 py-4">
                      <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                        Sources
                      </p>
                      <div className="mt-3 space-y-2 text-sm leading-6">
                        {entry.relatedSources.length > 0 ? (
                          entry.relatedSources.map((source) => (
                            <Link
                              key={source.id}
                              href={`${sourcesPath}#${source.id}`}
                              className="block text-foreground underline-offset-4 hover:underline"
                            >
                              {source.title}
                            </Link>
                          ))
                        ) : (
                          <p className="text-muted">None linked</p>
                        )}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border bg-background/65 px-4 py-4">
                      <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                        Thesis / dossier
                      </p>
                      <div className="mt-3 space-y-2 text-sm leading-6">
                        {entry.relatedThesis ? (
                          <Link
                            href={thesisPath}
                            className="block text-foreground underline-offset-4 hover:underline"
                          >
                            {entry.relatedThesis.title}
                          </Link>
                        ) : null}
                        {entry.relatedDossier ? (
                          <Link
                            href={dossierPath}
                            className="block text-foreground underline-offset-4 hover:underline"
                          >
                            {entry.relatedDossier.companyName}
                          </Link>
                        ) : null}
                        {!entry.relatedThesis && !entry.relatedDossier ? (
                          <p className="text-muted">None linked</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border bg-background/65 px-4 py-4">
                      <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                        Catalysts
                      </p>
                      <div className="mt-3 space-y-2 text-sm leading-6">
                        {entry.relatedCatalysts.length > 0 ? (
                          entry.relatedCatalysts.map((catalyst) => (
                            <Link
                              key={catalyst.id}
                              href={`${catalystsPath}#${catalyst.id}`}
                              className="block text-foreground underline-offset-4 hover:underline"
                            >
                              {catalyst.title}
                            </Link>
                          ))
                        ) : (
                          <p className="text-muted">None linked</p>
                        )}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border bg-background/65 px-4 py-4">
                      <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                        Timeline
                      </p>
                      <div className="mt-3 space-y-2 text-sm leading-6">
                        {entry.relatedTimelineEvents.length > 0 ? (
                          entry.relatedTimelineEvents.map((event) => (
                            <Link
                              key={event.id}
                              href={`${timelinePath}#${event.id}`}
                              className="block text-foreground underline-offset-4 hover:underline"
                            >
                              {event.title}
                            </Link>
                          ))
                        ) : (
                          <p className="text-muted">None linked</p>
                        )}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border bg-background/65 px-4 py-4">
                      <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                        Suggested surface
                      </p>
                      <div className="mt-3 space-y-2 text-sm leading-6">
                        <Link
                          href={alertTargetPath({
                            alertType: entry.alert.alertType,
                            thesisPath,
                            dossierPath,
                            catalystsPath,
                            timelinePath,
                            contradictionsPath,
                          })}
                          className="block text-foreground underline-offset-4 hover:underline"
                        >
                          Open {labelize(entry.alert.alertType)}
                        </Link>
                      </div>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4 text-sm leading-6 text-muted">
                No stale alerts are active right now. Current thesis, dossier, catalysts, and contradiction analysis appear aligned with the latest compiled project state.
              </div>
            )}

            {historicalAlerts.length > 0 ? (
              <div className="rounded-2xl border border-border bg-background/55 px-4 py-4">
                <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  Review history
                </p>
                <div className="mt-3 space-y-2">
                  {historicalAlerts.map((entry) => (
                    <div
                      key={entry.alert.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-3"
                    >
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">{entry.alert.title}</p>
                        <p className="text-sm leading-6 text-muted">
                          {entry.alert.reviewedAt
                            ? `Reviewed ${formatDateTime(entry.alert.reviewedAt)}`
                            : entry.alert.metadata?.signalState === "inactive"
                              ? "No longer active in the latest monitoring run"
                              : "Historical monitoring record"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill tone={alertStatusTone(entry.alert.status)}>
                          {entry.alert.status}
                        </StatusPill>
                        <Link
                          href={alertTargetPath({
                            alertType: entry.alert.alertType,
                            thesisPath,
                            dossierPath,
                            catalystsPath,
                            timelinePath,
                            contradictionsPath,
                          })}
                          className="action-button-secondary action-button-compact"
                        >
                          Inspect Surface
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Source Freshness"
        title="Source monitoring records"
        description="Each source now carries an operational freshness status, impact level, and stale reason against the latest compiled knowledge stack."
      >
        <div className="space-y-3">
          {data.sourceRecords.map((entry) => (
            <article
              key={entry.record.id}
              className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold tracking-tight text-foreground">
                  {entry.source?.title ?? entry.record.sourceId}
                </p>
                <StatusPill tone={freshnessTone(entry.record.freshnessStatus)}>
                  {labelize(entry.record.freshnessStatus)}
                </StatusPill>
                <StatusPill tone={impactTone(entry.record.possibleImpactLevel)}>
                  {entry.record.possibleImpactLevel} impact
                </StatusPill>
              </div>
              <p className="mt-3 text-sm leading-6 text-foreground">
                {entry.record.staleReason}
              </p>
              <div className="mt-3 flex flex-wrap gap-4 text-sm leading-6 text-muted">
                <span>Last seen {formatDateTime(entry.record.lastSeenAt)}</span>
                <span>Last compiled {formatDateTime(entry.record.lastCompiledAt)}</span>
              </div>
              <div className="mt-4">
                <Link
                  href={`${sourcesPath}#${entry.record.sourceId}`}
                  className="action-button-secondary action-button-compact"
                >
                  Review Source
                </Link>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>
    </PageFrame>
  );
}
