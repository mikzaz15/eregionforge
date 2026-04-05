import type { ReactNode } from "react";
import Link from "next/link";
import { ConfidenceExplainer } from "@/components/workspace/confidence-explainer";
import { MarkdownDocument } from "@/components/workspace/markdown-document";
import {
  MetricCard,
  PageFrame,
  SectionCard,
  StatusPill,
  type StatusTone,
} from "@/components/workspace/primitives";
import type { ThesisSupportRecord } from "@/lib/services/thesis-service";
import type { ThesisPageData } from "@/lib/services/workspace-service";
import { parseConfidenceFactors } from "@/lib/services/confidence-model-v2";

function stanceTone(stance: string | null): StatusTone {
  if (stance === "bullish") {
    return "success";
  }

  if (stance === "bearish") {
    return "danger";
  }

  if (stance === "mixed") {
    return "accent";
  }

  return "neutral";
}

function confidenceTone(confidence: string | null): StatusTone {
  if (confidence === "high") {
    return "success";
  }

  if (confidence === "medium") {
    return "accent";
  }

  return "neutral";
}

function thesisStatusTone(status: string | null): StatusTone {
  if (status === "active") {
    return "success";
  }

  if (status === "stale") {
    return "danger";
  }

  if (status === "draft") {
    return "accent";
  }

  return "neutral";
}

function severityTone(severity: string): StatusTone {
  if (severity === "critical" || severity === "high") {
    return "danger";
  }

  if (severity === "medium") {
    return "accent";
  }

  return "neutral";
}

function revisionMaterialityTone(materiality: string | null | undefined): StatusTone {
  if (materiality === "material") {
    return "danger";
  }

  if (materiality === "meaningful") {
    return "accent";
  }

  return "neutral";
}

function labelize(value: string | null): string {
  if (!value) {
    return "Not set";
  }

  return value.replace(/([A-Z])/g, " $1").replaceAll("-", " ");
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

function buildRevisionHref(basePath: string, revisionId: string): string {
  return `${basePath}?revisionId=${encodeURIComponent(revisionId)}`;
}

function ReferencePanel({
  support,
}: Readonly<{
  support: ThesisSupportRecord;
}>) {
  return (
    <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
      <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
        <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          Pages
        </p>
        <div className="mt-3 space-y-2 text-sm leading-6">
          {support.pages.length > 0 ? (
            support.pages.map((page) => (
              <Link
                key={page.id}
                href={`/wiki/${page.id}`}
                className="block text-foreground underline-offset-4 hover:underline"
              >
                {page.title}
              </Link>
            ))
          ) : (
            <p className="text-muted">None linked</p>
          )}
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
        <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          Entities
        </p>
        <div className="mt-3 space-y-2 text-sm leading-6">
          {support.entities.length > 0 ? (
            support.entities.map((entity) => (
              <Link
                key={entity.id}
                href={`/entities#${entity.id}`}
                className="block text-foreground underline-offset-4 hover:underline"
              >
                {entity.canonicalName}
              </Link>
            ))
          ) : (
            <p className="text-muted">None linked</p>
          )}
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
        <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          Claims
        </p>
        <div className="mt-3 space-y-2 text-sm leading-6">
          {support.claims.length > 0 ? (
            support.claims.map((claim) => (
              <Link
                key={claim.id}
                href={`/wiki/${claim.wikiPageId}#claim-${claim.id}`}
                className="block text-foreground underline-offset-4 hover:underline"
              >
                {claim.text}
              </Link>
            ))
          ) : (
            <p className="text-muted">None linked</p>
          )}
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
        <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          Catalysts
        </p>
        <div className="mt-3 space-y-2 text-sm leading-6">
          {support.catalysts.length > 0 ? (
            support.catalysts.map((catalyst) => (
              <Link
                key={catalyst.id}
                href={`/catalysts#${catalyst.id}`}
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
      <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
        <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          Sources
        </p>
        <div className="mt-3 space-y-2 text-sm leading-6">
          {support.sources.length > 0 ? (
            support.sources.map((source) => (
              <Link
                key={source.id}
                href={`/sources#${source.id}`}
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
      <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
        <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          Timeline
        </p>
        <div className="mt-3 space-y-2 text-sm leading-6">
          {support.timelineEvents.length > 0 ? (
            support.timelineEvents.map((event) => (
              <Link
                key={event.id}
                href={`/timeline#${event.id}`}
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
      <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
        <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          Contradictions
        </p>
        <div className="mt-3 space-y-2 text-sm leading-6">
          {support.contradictions.length > 0 ? (
            support.contradictions.map((contradiction) => (
              <Link
                key={contradiction.id}
                href={`/contradictions#${contradiction.id}`}
                className="block text-foreground underline-offset-4 hover:underline"
              >
                {contradiction.title}
              </Link>
            ))
          ) : (
            <p className="text-muted">None linked</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function ThesisView({
  data,
  eyebrow,
  title,
  description,
  basePath,
  catalystsPath,
  monitoringPath,
  actions,
}: Readonly<{
  data: ThesisPageData;
  eyebrow: string;
  title: string;
  description: string;
  basePath: string;
  catalystsPath: string;
  monitoringPath?: string | null;
  actions?: ReactNode;
}>) {
  const thesisDetail = data.thesis;
  const thesis = thesisDetail?.thesis ?? null;
  const currentRevision = thesisDetail?.currentRevision ?? null;
  const comparison = thesisDetail?.comparison ?? null;
  const thesisConfidenceFactors = parseConfidenceFactors(
    thesis?.metadata?.confidenceFactors,
  );
  const currentRevisionMateriality = currentRevision?.intelligence.materiality ?? "maintenance";

  return (
    <PageFrame
      eyebrow={eyebrow}
      title={title}
      description={description}
      actions={actions}
    >
      <div className="grid gap-4 xl:grid-cols-6">
        {data.metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      {thesis && thesisDetail && currentRevision ? (
        <>
          <SectionCard
            eyebrow="Overview"
            title={thesis.title}
            description="The thesis remains compiled from project canon, then preserved as a living revision history rather than overwritten in place."
          >
            <div className="flex flex-wrap gap-2">
              <StatusPill tone={thesisStatusTone(data.summary.thesisStatus)}>
                {data.summary.thesisStatus}
              </StatusPill>
              <StatusPill tone={stanceTone(thesis.overallStance)}>
                {labelize(thesis.overallStance)}
              </StatusPill>
              <StatusPill tone={confidenceTone(thesis.confidence)}>
                {thesis.confidence}
              </StatusPill>
              <StatusPill tone="neutral">Revision {thesis.revisionCount}</StatusPill>
              {thesis.ticker ? <StatusPill tone="neutral">{thesis.ticker}</StatusPill> : null}
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_320px]">
              <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4">
                <MarkdownDocument content={thesis.summary} />
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
                  <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                    Thesis posture
                  </p>
                  <p className="mt-3 text-sm leading-6 text-foreground">
                    Subject: {thesis.subjectName}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-foreground">
                    {thesis.metadata?.postureSummary ??
                      `Unresolved contradictions: ${data.summary.unresolvedContradictionCount}`}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-foreground">
                    {thesis.metadata?.majorTensionSummary ??
                      `Catalyst count: ${data.summary.thesisCatalystCount}`}
                  </p>
                  {thesis.metadata?.bestNextAction ? (
                    <p className="mt-2 text-sm leading-6 text-muted">
                      Next move: {thesis.metadata.bestNextAction}
                    </p>
                  ) : null}
                  {thesis.metadata?.operatorPostureSummary ? (
                    <p className="mt-2 text-sm leading-6 text-muted">
                      {thesis.metadata.operatorPostureSummary}
                    </p>
                  ) : null}
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Current revision change class: {currentRevisionMateriality}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Last refreshed {formatDateTime(thesisDetail.freshness.lastRefreshedAt)}
                  </p>
                </div>
                <ConfidenceExplainer
                  summary={thesis.metadata?.confidenceSummary}
                  factors={thesisConfidenceFactors}
                />
                <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                      Freshness
                    </p>
                    <StatusPill
                      tone={thesisDetail.freshness.potentiallyStale ? "danger" : "success"}
                    >
                      {thesisDetail.freshness.potentiallyStale ? "attention" : "current"}
                    </StatusPill>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-foreground">
                    {thesisDetail.freshness.reason}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Latest knowledge update {formatDateTime(thesisDetail.freshness.latestKnowledgeUpdateAt)}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Monitoring last evaluated {formatDateTime(data.summary.monitoringLastEvaluatedAt)}
                  </p>
                  {data.freshnessAlerts.length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {data.freshnessAlerts.slice(0, 2).map((entry) => (
                        <div
                          key={entry.alert.id}
                          className="rounded-2xl border border-border bg-background/65 px-4 py-4"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold tracking-tight text-foreground">
                              {entry.alert.title}
                            </p>
                            <StatusPill tone={severityTone(entry.alert.severity)}>
                              {entry.alert.severity}
                            </StatusPill>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-foreground">
                            {entry.alert.description}
                          </p>
                          {entry.alert.metadata?.driverSummary ? (
                            <p className="mt-2 text-sm leading-6 text-muted">
                              Likely drivers: {entry.alert.metadata.driverSummary}
                            </p>
                          ) : null}
                          <div className="mt-3 flex flex-wrap gap-2">
                            {monitoringPath ? (
                              <Link
                                href={monitoringPath}
                                className="action-button-secondary action-button-compact"
                              >
                                Review Alerts
                              </Link>
                            ) : null}
                            <Link
                              href={catalystsPath}
                              className="action-button-secondary action-button-compact"
                            >
                              Open Catalysts
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="mt-4">
              <ReferencePanel support={currentRevision.supportBySection.summary} />
            </div>
          </SectionCard>

          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <SectionCard
              eyebrow="Refresh Intelligence"
              title={`Revision ${currentRevision.revision.revisionNumber}`}
              description="Each thesis refresh records what changed and which newer knowledge objects likely drove the update."
            >
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4 text-sm leading-6 text-foreground">
                  {currentRevision.revision.changeSummary}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
                    <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                      Change class
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusPill tone={revisionMaterialityTone(currentRevisionMateriality)}>
                        {currentRevisionMateriality}
                      </StatusPill>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
                    <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                      Changed sections
                    </p>
                    <p className="mt-3 text-sm leading-6 text-foreground">
                      {currentRevision.intelligence.changedSections.length > 0
                        ? currentRevision.intelligence.changedSections
                            .map((section) => labelize(section))
                            .join(", ")
                        : "None"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
                    <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                      Confidence shift
                    </p>
                    <p className="mt-3 text-sm leading-6 text-foreground">
                      {currentRevision.intelligence.confidenceShift === 0
                        ? "No change"
                        : currentRevision.intelligence.confidenceShift > 0
                          ? `Up ${currentRevision.intelligence.confidenceShift}`
                          : `Down ${Math.abs(currentRevision.intelligence.confidenceShift)}`}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
                    <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                      Delta
                    </p>
                    <p className="mt-3 text-sm leading-6 text-foreground">
                      Catalysts {currentRevision.intelligence.catalystCountShift >= 0 ? "+" : ""}
                      {currentRevision.intelligence.catalystCountShift}
                      <br />
                      Contradictions {currentRevision.intelligence.contradictionCountShift >= 0 ? "+" : ""}
                      {currentRevision.intelligence.contradictionCountShift}
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
                  <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                    Likely drivers
                  </p>
                  <p className="mt-3 text-sm leading-6 text-foreground">
                    {currentRevision.intelligence.likelyDriverSummary ?? "No likely drivers isolated."}
                  </p>
                  <div className="mt-4 grid gap-3 lg:grid-cols-4">
                    <div className="space-y-2 text-sm leading-6">
                      <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                        Wiki and claims
                      </p>
                      {currentRevision.intelligence.likelyDrivers.pages.map((page) => (
                        <Link
                          key={page.id}
                          href={`/wiki/${page.id}`}
                          className="block text-foreground underline-offset-4 hover:underline"
                        >
                          {page.title}
                        </Link>
                      ))}
                      {currentRevision.intelligence.likelyDrivers.claims.map((claim) => (
                        <Link
                          key={claim.id}
                          href={`/wiki/${claim.wikiPageId}#claim-${claim.id}`}
                          className="block text-foreground underline-offset-4 hover:underline"
                        >
                          {claim.text}
                        </Link>
                      ))}
                      {currentRevision.intelligence.likelyDrivers.pages.length === 0 &&
                      currentRevision.intelligence.likelyDrivers.claims.length === 0 ? (
                        <p className="text-muted">None isolated</p>
                      ) : null}
                    </div>
                    <div className="space-y-2 text-sm leading-6">
                      <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                        Catalysts and timeline
                      </p>
                      {currentRevision.intelligence.likelyDrivers.catalysts.map((catalyst) => (
                        <Link
                          key={catalyst.id}
                          href={catalystsPath}
                          className="block text-foreground underline-offset-4 hover:underline"
                        >
                          {catalyst.title}
                        </Link>
                      ))}
                      {currentRevision.intelligence.likelyDrivers.timelineEvents.map((event) => (
                        <Link
                          key={event.id}
                          href={`/timeline#${event.id}`}
                          className="block text-foreground underline-offset-4 hover:underline"
                        >
                          {event.title}
                        </Link>
                      ))}
                      {currentRevision.intelligence.likelyDrivers.catalysts.length === 0 &&
                      currentRevision.intelligence.likelyDrivers.timelineEvents.length === 0 ? (
                        <p className="text-muted">None isolated</p>
                      ) : null}
                    </div>
                    <div className="space-y-2 text-sm leading-6">
                      <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                        Sources
                      </p>
                      {currentRevision.intelligence.likelyDrivers.sources.map((source) => (
                        <Link
                          key={source.id}
                          href={`/sources#${source.id}`}
                          className="block text-foreground underline-offset-4 hover:underline"
                        >
                          {source.title}
                        </Link>
                      ))}
                      {currentRevision.intelligence.likelyDrivers.sources.length === 0 ? (
                        <p className="text-muted">None isolated</p>
                      ) : null}
                    </div>
                    <div className="space-y-2 text-sm leading-6">
                      <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                        Contradictions and artifacts
                      </p>
                      {currentRevision.intelligence.likelyDrivers.contradictions.map(
                        (contradiction) => (
                          <Link
                            key={contradiction.id}
                            href={`/contradictions#${contradiction.id}`}
                            className="block text-foreground underline-offset-4 hover:underline"
                          >
                            {contradiction.title}
                          </Link>
                        ),
                      )}
                      {currentRevision.intelligence.likelyDrivers.artifacts.map((artifact) => (
                        <Link
                          key={artifact.id}
                          href={`/artifacts/${artifact.id}`}
                          className="block text-foreground underline-offset-4 hover:underline"
                        >
                          {artifact.title}
                        </Link>
                      ))}
                      {currentRevision.intelligence.likelyDrivers.contradictions.length === 0 &&
                      currentRevision.intelligence.likelyDrivers.artifacts.length === 0 ? (
                        <p className="text-muted">None isolated</p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Revision History"
              title="Prior thesis revisions"
              description="Revision history tracks how the thesis evolved and supports side-by-side inspection against the current view."
            >
              <div className="space-y-3">
                <Link
                  href={basePath}
                  className="action-button-secondary"
                >
                  View Current Thesis
                </Link>
                {thesisDetail.revisions.map((entry) => {
                  const isCurrent = entry.revision.id === thesis.currentRevisionId;
                  const isSelected = entry.revision.id === data.selectedRevisionId;

                  return (
                    <div
                      key={entry.revision.id}
                      className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold tracking-tight text-foreground">
                          Revision {entry.revision.revisionNumber}
                        </p>
                        <StatusPill tone={isCurrent ? "success" : "neutral"}>
                          {isCurrent ? "current" : "prior"}
                        </StatusPill>
                        {isSelected ? <StatusPill tone="accent">selected</StatusPill> : null}
                        <StatusPill tone={revisionMaterialityTone(entry.intelligence.materiality)}>
                          {entry.intelligence.materiality}
                        </StatusPill>
                        <StatusPill tone={stanceTone(entry.revision.stance)}>
                          {labelize(entry.revision.stance)}
                        </StatusPill>
                        <StatusPill tone={confidenceTone(entry.revision.confidence)}>
                          {entry.revision.confidence}
                        </StatusPill>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted">
                        {formatDateTime(entry.revision.createdAt)}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-foreground">
                        {entry.revision.changeSummary}
                      </p>
                      {!isCurrent ? (
                        <Link
                          href={buildRevisionHref(basePath, entry.revision.id)}
                          className="action-button-secondary mt-4"
                        >
                          Compare To Current
                        </Link>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          </div>

          {comparison ? (
            <SectionCard
              eyebrow="Revision Comparison"
              title={`Current Revision vs Revision ${comparison.baseRevision.revision.revisionNumber}`}
              description="Comparison highlights the sections that materially changed between the selected prior revision and the current thesis."
            >
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4 text-sm leading-6 text-foreground">
                  {comparison.changeSummary}
                </div>
                {comparison.sections.length > 0 ? (
                  comparison.sections.map((section) => (
                    <div
                      key={section.key}
                      className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold tracking-tight text-foreground">
                          {section.title}
                        </p>
                        <StatusPill tone="accent">changed</StatusPill>
                      </div>
                      <div className="mt-4 grid gap-4 xl:grid-cols-2">
                        <div className="rounded-2xl border border-border bg-background/65 px-4 py-4">
                          <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                            Previous
                          </p>
                          <div className="mt-3">
                            <MarkdownDocument content={section.previousContent} />
                          </div>
                        </div>
                        <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4">
                          <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                            Current
                          </p>
                          <div className="mt-3">
                            <MarkdownDocument content={section.currentContent} />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4 text-sm leading-6 text-muted">
                    No thesis sections changed materially between the selected prior revision and the current revision.
                  </div>
                )}
              </div>
            </SectionCard>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard
              eyebrow="Bull Case"
              title="Constructive case"
              description="These are the strongest compiled arguments currently supporting the thesis."
            >
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4">
                  <MarkdownDocument content={thesis.bullCaseMarkdown} />
                </div>
                <ReferencePanel support={currentRevision.supportBySection.bullCase} />
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Bear Case"
              title="Downside case"
              description="These are the strongest compiled arguments pushing against the thesis."
            >
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4">
                  <MarkdownDocument content={thesis.bearCaseMarkdown} />
                </div>
                <ReferencePanel support={currentRevision.supportBySection.bearCase} />
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Variant View"
              title="Alternative read"
              description="Variant view captures where contradictions, catalysts, or mixed signals could change the current stance."
            >
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4">
                  <MarkdownDocument content={thesis.variantViewMarkdown} />
                </div>
                <ReferencePanel support={currentRevision.supportBySection.variantView} />
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Risks"
              title="Key risks"
              description="Risks stay tied to explicit canon, chronology, and contradiction records."
            >
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4">
                  <MarkdownDocument content={thesis.keyRisksMarkdown} />
                </div>
                <ReferencePanel support={currentRevision.supportBySection.keyRisks} />
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Unknowns"
              title="Key unknowns"
              description="Unknowns represent unresolved research gaps rather than generic TODOs."
            >
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4">
                  <MarkdownDocument content={thesis.keyUnknownsMarkdown} />
                </div>
                <ReferencePanel support={currentRevision.supportBySection.keyUnknowns} />
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Catalysts"
              title="Catalyst summary"
              description="Catalysts are sourced from the compiled timeline and related supporting knowledge."
            >
              <div className="space-y-4">
                <Link
                  href={catalystsPath}
                  className="action-button-secondary"
                >
                  Open Catalysts
                </Link>
                <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4">
                  <MarkdownDocument content={thesis.catalystSummaryMarkdown} />
                </div>
                <ReferencePanel support={currentRevision.supportBySection.catalystSummary} />
              </div>
            </SectionCard>
          </div>
        </>
      ) : (
        <SectionCard
          eyebrow="Thesis Compile"
          title="No thesis compiled yet"
          description="Generate the first-pass thesis to turn current project knowledge into a thesis workspace."
        >
          <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4 text-sm leading-6 text-muted">
            No thesis record exists for this project yet. Use the compile action to synthesize stance, risks, unknowns, catalysts, and supporting references from the current compiled knowledge base.
          </div>
        </SectionCard>
      )}
    </PageFrame>
  );
}
