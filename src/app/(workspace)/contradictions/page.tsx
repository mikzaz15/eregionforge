import Link from "next/link";
import {
  runActiveProjectContradictionAnalysisAction,
  updateContradictionStatusAction,
} from "@/app/(workspace)/actions";
import {
  MetricCard,
  PageFrame,
  SectionCard,
  StatusPill,
  type StatusTone,
} from "@/components/workspace/primitives";
import {
  getActiveProjectId,
  getContradictionsPageData,
} from "@/lib/services/workspace-service";

function severityTone(severity: string): StatusTone {
  if (severity === "critical" || severity === "high") {
    return "danger";
  }

  if (severity === "medium") {
    return "accent";
  }

  return "neutral";
}

function statusTone(status: string): StatusTone {
  if (status === "resolved") {
    return "success";
  }

  if (status === "reviewed") {
    return "accent";
  }

  return "neutral";
}

function confidenceTone(confidence: string): StatusTone {
  if (confidence === "high") {
    return "success";
  }

  if (confidence === "medium") {
    return "accent";
  }

  return "neutral";
}

function formatContradictionType(value: string): string {
  return value.replaceAll("_", " ");
}

export default async function ContradictionsPage() {
  const projectId = await getActiveProjectId();
  const data = await getContradictionsPageData(projectId);

  if (!data) {
    throw new Error("Active project contradiction data is unavailable.");
  }

  return (
    <PageFrame
      eyebrow="Integrity Analysis"
      title="Contradictions"
      description={`The contradictions map makes disagreement in ${data.summary.project.name} explicit. These records are compiled from claims, source notes, canonical summaries, and timeline state with rationale and provenance attached.`}
      actions={
        <div className="flex flex-wrap gap-3">
          <form action={runActiveProjectContradictionAnalysisAction}>
            <button className="action-button-primary">
              Re-Run Analysis
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
            href="/monitoring"
            className="action-button-secondary"
          >
            Open Monitoring
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
          eyebrow="Analysis State"
          title="Current contradiction posture"
          description="The disagreement map is rerunnable. Records are heuristic, but they are intended to be operational rather than decorative."
        >
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4">
              <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                Total
              </p>
              <p className="mt-3 text-4xl font-semibold tracking-tight text-foreground">
                {data.contradictionSummary.totalContradictions}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4 text-sm leading-6 text-foreground">
              High severity: {data.contradictionSummary.highSeverityContradictions}
              <br />
              Unresolved: {data.contradictionSummary.unresolvedContradictions}
            </div>
            <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
              <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                Analysis summary
              </p>
              <p className="mt-3 text-sm leading-6 text-foreground">
                {data.analysisState.summary}
              </p>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Contradictions Map"
          title="Actionable disagreement records"
          description="Each record shows why it was flagged and which internal knowledge objects are implicated."
        >
          <div className="space-y-3">
            {data.contradictions.length > 0 ? (
              data.contradictions.map((entry) => {
                const leftLink = entry.leftClaim
                  ? {
                      href: `/wiki/${entry.leftClaim.wikiPageId}#claim-${entry.leftClaim.id}`,
                      label: "Open Left Claim",
                    }
                  : entry.relatedPages[0]
                    ? {
                        href: `/wiki/${entry.relatedPages[0].id}`,
                        label: "Open Left Page",
                      }
                    : null;
                const rightLink = entry.rightClaim
                  ? {
                      href: `/wiki/${entry.rightClaim.wikiPageId}#claim-${entry.rightClaim.id}`,
                      label: "Open Right Claim",
                    }
                  : entry.relatedPages[1]
                    ? {
                        href: `/wiki/${entry.relatedPages[1].id}`,
                        label: "Open Right Page",
                      }
                    : null;
                const sourceLink = entry.relatedSources[0]
                  ? `/sources#${entry.relatedSources[0].id}`
                  : "/sources";

                return (
                  <article
                    key={entry.contradiction.id}
                    id={entry.contradiction.id}
                    className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold tracking-tight text-foreground">
                            {entry.contradiction.title}
                          </p>
                          <StatusPill tone={severityTone(entry.contradiction.severity)}>
                            {entry.contradiction.severity}
                          </StatusPill>
                          <StatusPill tone={statusTone(entry.contradiction.status)}>
                            {entry.contradiction.status}
                          </StatusPill>
                          <StatusPill tone={confidenceTone(entry.contradiction.confidence)}>
                            {entry.contradiction.confidence}
                          </StatusPill>
                        </div>
                        <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                          {formatContradictionType(entry.contradiction.contradictionType)}
                        </p>
                      </div>
                      <div className="text-right text-sm leading-6 text-muted">
                        <p>Pages: {entry.relatedPages.length}</p>
                        <p>Sources: {entry.relatedSources.length}</p>
                        <p>Timeline: {entry.relatedTimelineEvents.length}</p>
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-foreground">
                      {entry.contradiction.description}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-muted">
                      Rationale: {entry.contradiction.rationale}
                    </p>

                    <div className="mt-4 grid gap-3 lg:grid-cols-3">
                      <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
                        <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                          Claims
                        </p>
                        <div className="mt-3 space-y-2 text-sm leading-6">
                          {entry.leftClaim ? (
                            <Link
                              href={`/wiki/${entry.leftClaim.wikiPageId}#claim-${entry.leftClaim.id}`}
                              className="block text-foreground underline-offset-4 hover:underline"
                            >
                              {entry.leftClaim.text}
                            </Link>
                          ) : (
                            <p className="text-muted">No left claim linked</p>
                          )}
                          {entry.rightClaim ? (
                            <Link
                              href={`/wiki/${entry.rightClaim.wikiPageId}#claim-${entry.rightClaim.id}`}
                              className="block text-foreground underline-offset-4 hover:underline"
                            >
                              {entry.rightClaim.text}
                            </Link>
                          ) : (
                            <p className="text-muted">No right claim linked</p>
                          )}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
                        <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                          Pages and sources
                        </p>
                        <div className="mt-3 space-y-2 text-sm leading-6">
                          {entry.relatedPages.map((page) => (
                            <Link
                              key={page.id}
                              href={`/wiki/${page.id}`}
                              className="block text-foreground underline-offset-4 hover:underline"
                            >
                              {page.title}
                            </Link>
                          ))}
                          {entry.relatedSources.map((source) => (
                            <Link
                              key={source.id}
                              href={`/sources#${source.id}`}
                              className="block text-foreground underline-offset-4 hover:underline"
                            >
                              {source.title}
                            </Link>
                          ))}
                          {entry.relatedPages.length === 0 && entry.relatedSources.length === 0 ? (
                            <p className="text-muted">No linked pages or sources</p>
                          ) : null}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
                        <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                          Timeline references
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
                            <p className="text-muted">No timeline references</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      {leftLink ? (
                        <Link
                          href={leftLink.href}
                          className="action-button-secondary action-button-compact"
                        >
                          {leftLink.label}
                        </Link>
                      ) : null}
                      {rightLink ? (
                        <Link
                          href={rightLink.href}
                          className="action-button-secondary action-button-compact"
                        >
                          {rightLink.label}
                        </Link>
                      ) : null}
                      <Link
                        href={sourceLink}
                        className="action-button-secondary action-button-compact"
                      >
                        Open Sources
                      </Link>
                      {entry.contradiction.status !== "reviewed" ? (
                        <form action={updateContradictionStatusAction}>
                          <input
                            type="hidden"
                            name="contradictionId"
                            value={entry.contradiction.id}
                          />
                          <input type="hidden" name="status" value="reviewed" />
                          <input type="hidden" name="redirectTo" value="/contradictions" />
                          <button className="action-button-secondary action-button-compact">
                            Mark Reviewed
                          </button>
                        </form>
                      ) : null}
                      {entry.contradiction.status !== "resolved" ? (
                        <form action={updateContradictionStatusAction}>
                          <input
                            type="hidden"
                            name="contradictionId"
                            value={entry.contradiction.id}
                          />
                          <input type="hidden" name="status" value="resolved" />
                          <input type="hidden" name="redirectTo" value="/contradictions" />
                          <button className="action-button-secondary action-button-compact">
                            Mark Resolved
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4 text-sm leading-6 text-muted">
                No contradiction records exist yet for this project. Run contradiction analysis to detect tension across canon, claims, sources, and timeline state.
              </div>
            )}
          </div>
        </SectionCard>
      </div>
    </PageFrame>
  );
}
