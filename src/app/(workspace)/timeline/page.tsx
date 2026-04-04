import Link from "next/link";
import {
  MetricCard,
  PageFrame,
  SectionCard,
  StatusPill,
  type StatusTone,
} from "@/components/workspace/primitives";
import { compileActiveProjectTimelineAction } from "@/app/(workspace)/actions";
import { getActiveProjectId, getTimelinePageData } from "@/lib/services/workspace-service";

function confidenceTone(confidence: string): StatusTone {
  if (confidence === "high") {
    return "success";
  }

  if (confidence === "medium") {
    return "accent";
  }

  return "neutral";
}

function eventTypeTone(eventType: string): StatusTone {
  if (eventType === "milestone" || eventType === "system") {
    return "success";
  }

  if (eventType === "planning" || eventType === "financial") {
    return "accent";
  }

  return "neutral";
}

function formatTimelineDate(date: string, precision: string): string {
  if (precision === "month") {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      year: "numeric",
    }).format(new Date(date));
  }

  if (precision === "year") {
    return date.slice(0, 4);
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

export default async function TimelinePage() {
  const projectId = await getActiveProjectId();
  const data = await getTimelinePageData(projectId);

  if (!data) {
    throw new Error("Active project timeline data is unavailable.");
  }

  return (
    <PageFrame
      eyebrow="Chronology Layer"
      title="Timeline"
      description={`The timeline compiler turns dated source, claim, and canonical page signals into a compiled chronology for ${data.summary.project.name}. This is a durable canonical view, not a search result list.`}
      actions={
        <div className="flex flex-wrap gap-3">
          <form action={compileActiveProjectTimelineAction}>
            <button className="action-button-primary">
              Rebuild Timeline
            </button>
          </form>
          <Link
            href={`/projects/${data.summary.project.id}`}
            className="action-button-secondary"
          >
            Open Command View
          </Link>
          <Link
            href="/thesis"
            className="action-button-secondary"
          >
            Open Thesis
          </Link>
          <Link
            href="/catalysts"
            className="action-button-secondary"
          >
            Open Catalysts
          </Link>
        </div>
      }
    >
      <div className="grid gap-4 xl:grid-cols-4">
        {data.metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <SectionCard
          eyebrow="Compile State"
          title="Chronology checkpoint"
          description="Timeline compilation is rerunnable. Each pass normalizes, deduplicates, and replaces the project timeline state with the current canonical chronology."
        >
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4">
              <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                Last compiled
              </p>
              <p className="mt-3 text-sm leading-6 text-foreground">
                {data.compileState.lastCompiledAt
                  ? new Intl.DateTimeFormat("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    }).format(new Date(data.compileState.lastCompiledAt))
                  : "Timeline has not been compiled yet."}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
              <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                Summary
              </p>
              <p className="mt-3 text-sm leading-6 text-foreground">
                {data.compileState.summary}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
              <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                Event count
              </p>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
                {data.compileState.eventCount}
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Canonical View"
          title="Compiled project chronology"
          description="Each event is compiled from project knowledge objects and keeps provenance visible through linked sources, wiki pages, claims, and confidence posture."
        >
          <div className="space-y-3">
            {data.events.length > 0 ? (
              data.events.map((entry) => (
                <article
                  key={entry.event.id}
                  id={entry.event.id}
                  className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4"
                >
                  <div className="grid gap-4 lg:grid-cols-[170px_minmax(0,1fr)]">
                    <div className="rounded-2xl border border-border bg-background/70 px-4 py-4">
                      <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                        Event date
                      </p>
                      <p className="mt-3 text-lg font-semibold tracking-tight text-foreground">
                        {formatTimelineDate(
                          entry.event.eventDate,
                          entry.event.eventDatePrecision,
                        )}
                      </p>
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {entry.event.eventDatePrecision.replace("_", " ")}
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold tracking-tight text-foreground">
                          {entry.event.title}
                        </h2>
                        <StatusPill tone={eventTypeTone(entry.event.eventType)}>
                          {entry.event.eventType}
                        </StatusPill>
                        <StatusPill tone={confidenceTone(entry.event.confidence)}>
                          {entry.event.confidence}
                        </StatusPill>
                      </div>
                      <p className="text-sm leading-6 text-muted">
                        {entry.event.description}
                      </p>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        Provenance {entry.event.provenance.replace(/-/g, " ")}
                      </p>
                      <div className="grid gap-3 lg:grid-cols-3">
                        <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
                          <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                            Sources
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {entry.relatedSources.length > 0 ? (
                              entry.relatedSources.map((source) => (
                                <Link
                                  key={source.id}
                                  href={`/sources#${source.id}`}
                                  className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
                                >
                                  {source.title}
                                </Link>
                              ))
                            ) : (
                              <span className="text-sm text-muted">No linked sources</span>
                            )}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
                          <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                            Wiki pages
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {entry.relatedPages.length > 0 ? (
                              entry.relatedPages.map((page) => (
                                <Link
                                  key={page.id}
                                  href={`/wiki/${page.id}`}
                                  className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
                                >
                                  {page.title}
                                </Link>
                              ))
                            ) : (
                              <span className="text-sm text-muted">No linked pages</span>
                            )}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
                          <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                            Claims
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {entry.relatedClaims.length > 0 ? (
                              entry.relatedClaims.map((claim) => (
                                <Link
                                  key={claim.id}
                                  href={`/wiki/${claim.wikiPageId}#claim-${claim.id}`}
                                  className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
                                >
                                  {claim.text}
                                </Link>
                              ))
                            ) : (
                              <span className="text-sm text-muted">No linked claims</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4 text-sm leading-6 text-muted">
                No timeline events exist yet for this project. Compile the timeline to extract and normalize chronology from sources, claims, and canonical pages.
              </div>
            )}
          </div>
        </SectionCard>
      </div>
    </PageFrame>
  );
}
