import type { ReactNode } from "react";
import Link from "next/link";
import { updateCatalystReviewStatusAction } from "@/app/(workspace)/actions";
import { ConfidenceExplainer } from "@/components/workspace/confidence-explainer";
import {
  MetricCard,
  PageFrame,
  SectionCard,
  StatusPill,
  type StatusTone,
} from "@/components/workspace/primitives";
import { parseConfidenceFactors } from "@/lib/services/confidence-model-v2";
import { buildFragmentSnippet } from "@/lib/services/evidence-lineage-v3";
import type { CatalystsPageData } from "@/lib/services/workspace-service";

function confidenceTone(confidence: string): StatusTone {
  if (confidence === "high") {
    return "success";
  }

  if (confidence === "medium") {
    return "accent";
  }

  return "neutral";
}

function importanceTone(importance: string): StatusTone {
  if (importance === "high") {
    return "danger";
  }

  if (importance === "medium") {
    return "accent";
  }

  return "neutral";
}

function statusTone(status: string): StatusTone {
  if (status === "resolved") {
    return "success";
  }

  if (status === "active") {
    return "accent";
  }

  if (status === "upcoming") {
    return "neutral";
  }

  if (status === "invalidated") {
    return "danger";
  }

  return "neutral";
}

function reviewStatusTone(status: string): StatusTone {
  if (status === "resolved") {
    return "success";
  }

  if (status === "invalidated") {
    return "danger";
  }

  if (status === "reviewed") {
    return "accent";
  }

  return "neutral";
}

function labelize(value: string): string {
  return value.replace(/([A-Z])/g, " $1").replaceAll("_", " ").replaceAll("-", " ");
}

function formatTimeframe(value: string | null, precision: string): string {
  if (!value) {
    return "Unknown";
  }

  if (precision === "year") {
    return value.slice(0, 4);
  }

  if (precision === "month") {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function CatalystView({
  data,
  eyebrow,
  title,
  description,
  thesisPath,
  basePath,
  actions,
}: Readonly<{
  data: CatalystsPageData;
  eyebrow: string;
  title: string;
  description: string;
  thesisPath: string;
  basePath: string;
  actions?: ReactNode;
}>) {
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
        eyebrow="Tracker State"
        title="Compiled catalyst tracker"
        description="Catalysts are tracked as source-grounded objects that connect thesis, chronology, contradictions, and supporting claims."
      >
        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4">
            <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              Summary
            </p>
            <p className="mt-3 text-4xl font-semibold tracking-tight text-foreground">
              {data.summary.catalystCount}
            </p>
            <p className="mt-3 text-sm leading-6 text-muted">
              Upcoming: {data.summary.upcomingCatalystCount}. Resolved: {data.summary.resolvedCatalystCount}. High importance: {data.summary.highImportanceCatalystCount}.
            </p>
            <p className="mt-3 text-sm leading-6 text-muted">
              {data.compileState.summary}
            </p>
          </div>
          <div className="space-y-3">
            {data.catalysts.length > 0 ? (
              data.catalysts.map((entry) => (
                <article
                  key={entry.catalyst.id}
                  id={entry.catalyst.id}
                  className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold tracking-tight text-foreground">
                      {entry.catalyst.title}
                    </p>
                    <StatusPill tone={statusTone(entry.catalyst.status)}>
                      {entry.catalyst.status}
                    </StatusPill>
                    <StatusPill tone={reviewStatusTone(entry.catalyst.reviewStatus)}>
                      {entry.catalyst.reviewStatus}
                    </StatusPill>
                    <StatusPill tone={importanceTone(entry.catalyst.importance)}>
                      {entry.catalyst.importance}
                    </StatusPill>
                    <StatusPill tone={confidenceTone(entry.catalyst.confidence)}>
                      {entry.catalyst.confidence}
                    </StatusPill>
                  </div>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {labelize(entry.catalyst.catalystType)} · {formatTimeframe(
                      entry.catalyst.expectedTimeframe,
                      entry.catalyst.timeframePrecision,
                    )}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-foreground">
                    {entry.catalyst.description}
                  </p>
                  <div className="mt-4">
                    <ConfidenceExplainer
                      summary={entry.catalyst.metadata?.confidenceSummary}
                      factors={parseConfidenceFactors(
                        entry.catalyst.metadata?.confidenceFactors,
                      )}
                    />
                  </div>
                  {entry.catalyst.metadata?.anchorSummary ? (
                    <p className="mt-3 text-sm leading-6 text-foreground">
                      {entry.catalyst.metadata.anchorSummary}
                    </p>
                  ) : null}
                  {entry.catalyst.metadata?.lineageSummary ? (
                    <p className="mt-2 text-sm leading-6 text-muted">
                      {entry.catalyst.metadata.lineageSummary}
                    </p>
                  ) : null}
                  {entry.catalyst.metadata?.thesisSummary ? (
                    <p className="mt-2 text-sm leading-6 text-muted">
                      {entry.catalyst.metadata.thesisSummary}
                    </p>
                  ) : null}
                  {entry.noteSummary.noteCount > 0 ? (
                    <div className="mt-3 rounded-2xl border border-border bg-background/60 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Operator notes {entry.noteSummary.noteCount}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-foreground">
                        {entry.noteSummary.latestNotePreview}
                      </p>
                    </div>
                  ) : entry.catalyst.reviewNote ? (
                    <p className="mt-2 text-sm leading-6 text-muted">
                      Review note: {entry.catalyst.reviewNote}
                    </p>
                  ) : null}
                  <div className="mt-4 grid gap-3 lg:grid-cols-7">
                    <div className="rounded-2xl border border-border bg-background/65 px-4 py-4">
                      <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                        Thesis
                      </p>
                      <div className="mt-3 space-y-2 text-sm leading-6">
                        {entry.thesis ? (
                          <Link
                            href={thesisPath}
                            className="block text-foreground underline-offset-4 hover:underline"
                          >
                            {entry.thesis.title}
                          </Link>
                        ) : (
                          <p className="text-muted">None linked</p>
                        )}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border bg-background/65 px-4 py-4">
                      <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                        Canon pages
                      </p>
                      <div className="mt-3 space-y-2 text-sm leading-6">
                        {entry.relatedPages.length > 0 ? (
                          entry.relatedPages.map((page) => (
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
                    <div className="rounded-2xl border border-border bg-background/65 px-4 py-4">
                      <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                        Timeline
                      </p>
                      <div className="mt-3 space-y-2 text-sm leading-6">
                        {entry.relatedTimelineEvents.length > 0 ? (
                          entry.relatedTimelineEvents.map((event) => (
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
                    <div className="rounded-2xl border border-border bg-background/65 px-4 py-4">
                      <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                        Claims
                      </p>
                      <div className="mt-3 space-y-2 text-sm leading-6">
                        {entry.relatedClaims.length > 0 ? (
                          entry.relatedClaims.map((claim) => (
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
                    <div className="rounded-2xl border border-border bg-background/65 px-4 py-4">
                      <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                        Sources
                      </p>
                      <div className="mt-3 space-y-2 text-sm leading-6">
                        {entry.relatedSources.length > 0 ? (
                          entry.relatedSources.map((source) => (
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
                    <div className="rounded-2xl border border-border bg-background/65 px-4 py-4">
                      <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                        Contradictions
                      </p>
                      <div className="mt-3 space-y-2 text-sm leading-6">
                        {entry.relatedContradictions.length > 0 ? (
                          entry.relatedContradictions.map((contradiction) => (
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
                    <div className="rounded-2xl border border-border bg-background/65 px-4 py-4">
                      <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                        Evidence
                      </p>
                      <div className="mt-3 space-y-3 text-sm leading-6">
                        {entry.evidenceHighlights.length > 0 ? (
                          entry.evidenceHighlights.map((highlight) => (
                            <Link
                              key={highlight.fragment.id}
                              href={`/sources#${highlight.fragment.sourceId}`}
                              className="block rounded-2xl border border-border bg-background/60 px-3 py-3 transition hover:bg-background"
                            >
                              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                                {highlight.source?.title ?? "Source fragment"}
                              </p>
                              {highlight.claim ? (
                                <p className="mt-2 text-xs leading-5 text-muted">
                                  Claim: {highlight.claim.text}
                                </p>
                              ) : null}
                              <p className="mt-2 text-sm leading-6 text-foreground">
                                {buildFragmentSnippet(highlight.fragment)}
                              </p>
                            </Link>
                          ))
                        ) : (
                          <p className="text-muted">No fragment-level support linked</p>
                        )}
                      </div>
                    </div>
                  </div>
                  <form action={updateCatalystReviewStatusAction} className="mt-4 space-y-3">
                    <input type="hidden" name="projectId" value={data.summary.project.id} />
                    <input type="hidden" name="catalystId" value={entry.catalyst.id} />
                    <input type="hidden" name="redirectTo" value={basePath} />
                    <label className="block">
                      <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Operator note
                      </span>
                      <textarea
                        name="reviewNote"
                        rows={2}
                        placeholder="Optional rationale for review, resolution, or invalidation"
                        className="mt-2 w-full rounded-2xl border border-border bg-background/70 px-3 py-2 text-sm leading-6 text-foreground outline-none transition focus:border-foreground/30"
                        defaultValue=""
                      />
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {entry.catalyst.reviewStatus !== "reviewed" ? (
                        <button
                          name="reviewStatus"
                          value="reviewed"
                          className="action-button-secondary action-button-compact"
                        >
                          Mark Reviewed
                        </button>
                      ) : null}
                      {entry.catalyst.reviewStatus !== "resolved" ? (
                        <button
                          name="reviewStatus"
                          value="resolved"
                          className="action-button-secondary action-button-compact"
                        >
                          Mark Resolved
                        </button>
                      ) : null}
                      {entry.catalyst.reviewStatus !== "invalidated" ? (
                        <button
                          name="reviewStatus"
                          value="invalidated"
                          className="action-button-secondary action-button-compact"
                        >
                          Invalidate Catalyst
                        </button>
                      ) : null}
                    </div>
                  </form>
                </article>
              ))
            ) : (
              <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4 text-sm leading-6 text-muted">
                No catalysts exist yet for this project. Compile catalysts to extract source-grounded catalyst objects from the current thesis, timeline, claims, contradictions, and source summaries.
              </div>
            )}
          </div>
        </div>
      </SectionCard>
    </PageFrame>
  );
}
