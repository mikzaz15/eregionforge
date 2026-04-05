import Link from "next/link";
import {
  MetricCard,
  PageFrame,
  SectionCard,
  StatusPill,
  type StatusTone,
} from "@/components/workspace/primitives";
import { compileActiveProjectWikiAction } from "@/app/(workspace)/actions";
import { getActiveProjectId, getWikiPageData } from "@/lib/services/workspace-service";

function pageTone(status: string): StatusTone {
  if (status === "active") {
    return "success";
  }

  if (status === "draft") {
    return "accent";
  }

  return "neutral";
}

function supportTone(label: string): StatusTone {
  if (label === "strong") {
    return "success";
  }

  if (label === "mixed") {
    return "accent";
  }

  if (label === "weak") {
    return "danger";
  }

  return "neutral";
}

export default async function WikiPage() {
  const projectId = await getActiveProjectId();
  const data = await getWikiPageData(projectId);

  if (!data) {
    throw new Error("Active project wiki data is unavailable.");
  }

  return (
    <PageFrame
      eyebrow="Canonical Layer"
      title="Wiki"
      description={`The compiled wiki is the center of EregionForge. The current workspace is rendering canonical pages for ${data.summary.project.name}.`}
      actions={
        <div className="flex flex-wrap gap-3">
          <form action={compileActiveProjectWikiAction}>
            <button className="action-button-primary">
              Compile Wiki
            </button>
          </form>
          <a
            href="#revision-feed"
            className="action-button-secondary"
          >
            Review Revisions
          </a>
          <Link
            href={`/projects/${data.summary.project.id}`}
            className="action-button-secondary"
          >
            Project Detail
          </Link>
          <Link
            href="/lint"
            className="action-button-secondary"
          >
            Open Lint
          </Link>
        </div>
      }
    >
      <div className="grid gap-4 xl:grid-cols-3">
        {data.metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <SectionCard
        eyebrow="Compile State"
        title="Current compiler checkpoint"
        description="Compile jobs are now first-class domain objects. The current wiki can be either seeded or refreshed from active project sources."
      >
        <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr_1fr_1fr]">
          <div className="rounded-[1.5rem] border border-border bg-surface-strong/75 px-4 py-4">
            <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              Compiler Note
            </p>
            <p className="mt-3 text-sm leading-6 text-foreground">{data.compilerNote}</p>
          </div>
          <div className="rounded-[1.5rem] border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
            <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              Latest Summary
            </p>
            <p className="mt-3 text-sm leading-6 text-foreground">
              {data.latestCompile?.summary ?? "No compile has been executed in this workspace session yet."}
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
            <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              Last Completed
            </p>
            <p className="mt-3 text-sm leading-6 text-foreground">
              {data.latestCompileAtLabel}
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
            <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              Sources In Canon
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
              {data.compiledSourceCount}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted">
              Sources currently informing the active canonical wiki set.
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
            <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              Affected Pages
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
              {data.latestCompile?.affectedPageIds.length ?? 0}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted">
              Pages refreshed by the most recent compile pass.
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
            <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              Parsed Fragments
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
              {data.latestCompile?.metadata.fragmentCount ?? "0"}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted">
              Explicit source units available to the current compiler pass.
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
            <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              Claims
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
              {data.latestCompile?.metadata.claimCount ?? "0"}
            </p>
            <p className="mt-2 text-sm leading-6 text-muted">
              Deterministic claims emitted in the latest compile pass.
            </p>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <SectionCard
          eyebrow="Compiled Structure"
          title="Canonical page index"
          description={`These page records are now coming from the wiki repository for ${data.summary.project.name}, including generated source-summary pages and project-level canon.`}
        >
          <div className="space-y-3">
            {data.pages.map((entry) => (
              <Link
                key={entry.page.id}
                href={`/wiki/${entry.page.id}`}
                className="grid gap-3 rounded-2xl border border-border bg-surface-strong/75 px-4 py-4 transition hover:border-border-strong hover:bg-background/80 lg:grid-cols-[minmax(0,1.25fr)_120px_120px_120px_120px_120px_140px]"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold tracking-tight text-foreground">
                      {entry.page.title}
                    </h3>
                    <StatusPill tone={pageTone(entry.page.status)}>
                      {entry.page.status}
                    </StatusPill>
                    <StatusPill tone={entry.isGenerated ? "success" : "neutral"}>
                      {entry.isGenerated ? "generated" : "seeded"}
                    </StatusPill>
                    <StatusPill tone={supportTone(entry.supportDensityLabel)}>
                      {entry.supportDensityLabel} support
                    </StatusPill>
                    {entry.isStale ? (
                      <StatusPill tone="danger">stale</StatusPill>
                    ) : (
                      <StatusPill tone="success">current</StatusPill>
                    )}
                  </div>
                  <p className="text-sm leading-6 text-muted">
                    {entry.currentRevision?.summary ?? "No current revision summary is available."}
                  </p>
                  <p className="text-sm leading-6 text-muted">
                    {entry.supportPosture}
                  </p>
                  {entry.isStale ? (
                    <p className="text-sm leading-6 text-[var(--danger-ink)]">
                      {entry.staleReason}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    <span>Claims {entry.claimCount}</span>
                    <span>Supported {entry.supportedClaimCount}</span>
                    <span>Weak {entry.weakSupportClaimCount}</span>
                    <span>Unresolved {entry.unresolvedClaimCount}</span>
                    <span>Evidence {entry.evidenceLinkCount}</span>
                    <span>Sources {entry.sourceDiversityCount || entry.sourceCount}</span>
                    <span>Revisions {entry.revisionCount}</span>
                  </div>
                  {entry.changedSections.length > 0 ? (
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      Changed sections: {entry.changedSections.join(", ")}
                    </p>
                  ) : null}
                </div>
                <div>
                  <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                    Page Type
                  </p>
                  <p className="mt-2 text-sm font-medium capitalize text-foreground">
                    {entry.page.pageType}
                  </p>
                </div>
                <div>
                  <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                    Claims
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {entry.claimCount}
                  </p>
                </div>
                <div>
                  <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                    Support
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {entry.supportedClaimCount}/{entry.claimCount}
                  </p>
                </div>
                <div>
                  <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                    Linked Source
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {entry.page.sourceId ? "Yes" : "No"}
                  </p>
                </div>
                <div>
                  <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                    Freshness
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {entry.isStale ? "Needs review" : "Current"}
                  </p>
                </div>
                <div>
                  <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                    Updated
                  </p>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {entry.latestRevisionAt
                      ? new Intl.DateTimeFormat("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        }).format(new Date(entry.latestRevisionAt))
                      : "Not available"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Revision Feed"
          title="Compiler activity"
          description="Revisions and compile-job metadata now move together so the wiki can evolve from current project sources."
        >
          <div id="revision-feed" className="space-y-3">
            {data.latestCompile ? (
              <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold tracking-tight text-foreground">
                    {data.latestCompile.summary}
                  </p>
                  <span className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                    {data.latestCompile.triggeredBy}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {data.latestCompile.completedAt
                    ? `Completed ${new Intl.DateTimeFormat("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      }).format(new Date(data.latestCompile.completedAt))}.`
                    : "No completed compile timestamp yet."}
                </p>
              </div>
            ) : null}
            {data.recentRevisions.map((revision) => (
              <div
                key={revision.id}
                className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold tracking-tight text-foreground">
                    {revision.changeNote}
                  </p>
                  <span className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                    {revision.createdBy}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted">{revision.summary}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </PageFrame>
  );
}
