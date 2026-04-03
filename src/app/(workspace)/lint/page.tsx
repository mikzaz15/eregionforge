import Link from "next/link";
import {
  createMissingExpectedPagePlaceholderAction,
  markLintIssueResolvedAction,
  recompileProjectFromLintAction,
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
  getLintIssuesPageData,
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

  if (status === "dismissed") {
    return "neutral";
  }

  return "accent";
}

function formatIssueType(value: string): string {
  return value.replaceAll("_", " ");
}

export default async function LintPage() {
  const projectId = await getActiveProjectId();
  const data = await getLintIssuesPageData(projectId);

  if (!data) {
    throw new Error("Active project lint data is unavailable.");
  }

  return (
    <PageFrame
      eyebrow="Knowledge Integrity"
      title="Lint"
      description={`Operational trust view for ${data.summary.project.name}. These issues come from heuristic checks over compiled pages, claims, evidence posture, and expected canon structure.`}
      actions={
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/projects/${data.summary.project.id}`}
            className="rounded-full border border-border bg-background/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-background"
          >
            Project Detail
          </Link>
          <Link
            href="/wiki"
            className="rounded-full border border-border bg-background/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-background"
          >
            Open Wiki
          </Link>
        </div>
      }
    >
      <div className="grid gap-4 xl:grid-cols-5">
        <MetricCard
          label="Open Issues"
          value={String(data.health.totalIssues)}
          note="Only open issues count toward current project health."
        />
        <MetricCard
          label="Unsupported Claims"
          value={String(data.health.unsupportedClaimsCount)}
          note="Claims with unresolved or weak support now become explicit operational work."
        />
        <MetricCard
          label="Weak Pages"
          value={String(data.health.weakPagesCount)}
          note="These pages carry too much unsupported synthesis to trust casually."
        />
        <MetricCard
          label="Stale Pages"
          value={String(data.health.stalePagesCount)}
          note="Freshness is currently heuristic and includes a placeholder seeded-page check."
        />
        <MetricCard
          label="Orphan Pages"
          value={String(data.health.orphanPagesCount)}
          note="Orphans are pages that look disconnected from the rest of canon."
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <SectionCard
          eyebrow="Severity Ledger"
          title="Current issue mix"
          description="Severity is heuristic, but it is intentionally opinionated so trust debt becomes triageable."
        >
          <div className="space-y-3">
            {Object.entries(data.health.issuesBySeverity).map(([severity, count]) => (
              <div
                key={severity}
                className="flex items-center justify-between rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4"
              >
                <div>
                  <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                    {severity}
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                    {count}
                  </p>
                </div>
                <StatusPill tone={severityTone(severity)}>{severity}</StatusPill>
              </div>
            ))}
            <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4 text-sm leading-6 text-muted">
              Open: {data.openIssueCount}. Resolved in session: {data.resolvedIssueCount}.
            </div>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Issue Queue"
          title="Actionable trust gaps"
          description="This is a first-pass knowledge operations queue, not a generic validator log."
        >
          <div className="space-y-3">
            {data.issues.length > 0 ? (
              data.issues.map(({ issue, relatedPage }) => (
                <div
                  key={issue.id}
                  className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold tracking-tight text-foreground">
                          {issue.title}
                        </p>
                        <StatusPill tone={severityTone(issue.severity)}>
                          {issue.severity}
                        </StatusPill>
                        <StatusPill tone={statusTone(issue.status)}>
                          {issue.status}
                        </StatusPill>
                      </div>
                      <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                        {formatIssueType(issue.issueType)}
                      </p>
                    </div>
                    <div className="text-right text-sm leading-6 text-muted">
                      <p>Scope: {relatedPage?.title ?? "Project-wide"}</p>
                      <p>Claims: {issue.relatedClaimIds.length}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-foreground">
                    {issue.description}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-muted">
                    Suggested action: {issue.recommendedAction}
                  </p>
                  {issue.issueType === "duplicate_or_overlapping_concept" &&
                  issue.metadata?.pairedPageTitle ? (
                    <p className="mt-2 text-sm leading-6 text-muted">
                      Paired page: {issue.metadata.pairedPageTitle}
                    </p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-3">
                    {relatedPage ? (
                      <Link
                        href={`/wiki/${relatedPage.id}`}
                        className="rounded-full border border-border bg-background/70 px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-background"
                      >
                        Open Page
                      </Link>
                    ) : null}
                    {relatedPage && issue.relatedClaimIds.length > 0 ? (
                      <Link
                        href={`/wiki/${relatedPage.id}`}
                        className="rounded-full border border-border bg-background/70 px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-background"
                      >
                        Review Evidence
                      </Link>
                    ) : null}
                    {issue.status === "open" ? (
                      <form action={recompileProjectFromLintAction}>
                        <input type="hidden" name="projectId" value={data.summary.project.id} />
                        <input type="hidden" name="redirectTo" value="/lint" />
                        <button className="rounded-full border border-border bg-background/70 px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-background">
                          {relatedPage ? "Recompile Page" : "Recompile Canon"}
                        </button>
                      </form>
                    ) : null}
                    {issue.status === "open" &&
                    issue.issueType === "missing_expected_page" &&
                    issue.metadata?.missingPageType &&
                    issue.metadata?.missingSlug &&
                    issue.metadata?.missingTitle ? (
                      <form action={createMissingExpectedPagePlaceholderAction}>
                        <input type="hidden" name="projectId" value={data.summary.project.id} />
                        <input
                          type="hidden"
                          name="pageType"
                          value={issue.metadata.missingPageType}
                        />
                        <input type="hidden" name="slug" value={issue.metadata.missingSlug} />
                        <input type="hidden" name="title" value={issue.metadata.missingTitle} />
                        <input type="hidden" name="redirectTo" value="/lint" />
                        <button className="rounded-full border border-border bg-background/70 px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-background">
                          Create Placeholder
                        </button>
                      </form>
                    ) : null}
                    {issue.status === "open" ? (
                      <form action={markLintIssueResolvedAction}>
                        <input type="hidden" name="issueId" value={issue.id} />
                        <input type="hidden" name="projectId" value={data.summary.project.id} />
                        <input type="hidden" name="redirectTo" value="/lint" />
                        <button className="rounded-full border border-border bg-background/70 px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-background">
                          Mark Resolved
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4 text-sm leading-6 text-muted">
                No lint issues are currently open for this project.
              </div>
            )}
          </div>
        </SectionCard>
      </div>
    </PageFrame>
  );
}
