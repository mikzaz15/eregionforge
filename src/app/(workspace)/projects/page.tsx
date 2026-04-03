import Link from "next/link";
import {
  MetricCard,
  PageFrame,
  SectionCard,
  StatusPill,
  type StatusTone,
} from "@/components/workspace/primitives";
import { executionLane, getProjectsPageData } from "@/lib/services/workspace-service";

function compileTone(status: string): StatusTone {
  if (status === "completed") {
    return "success";
  }

  if (status === "running") {
    return "accent";
  }

  if (status === "failed") {
    return "danger";
  }

  return "neutral";
}

export default async function ProjectsPage() {
  const { metrics, summaries } = await getProjectsPageData();

  return (
    <PageFrame
      eyebrow="Workspace"
      title="Projects"
      description="Projects are the durable operating boundary for sources, canonical wiki pages, revisions, compile jobs, and artifacts. The portfolio now runs through project-oriented repositories instead of a single generic mock layer."
    >
      <div className="grid gap-4 xl:grid-cols-3">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <SectionCard
          eyebrow="Portfolio"
          title="Research programs"
          description="Each program has its own source base, wiki surface, artifact set, and compile state."
        >
          <div className="space-y-3">
            {summaries.map((summary) => (
              <div
                key={summary.project.id}
                className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold tracking-tight text-foreground">
                        {summary.project.name}
                      </h3>
                      <StatusPill tone={compileTone(summary.latestCompileStatus)}>
                        {summary.latestCompileStatus}
                      </StatusPill>
                    </div>
                    <p className="max-w-2xl text-sm leading-6 text-muted">
                      {summary.project.description}
                    </p>
                    <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                      {summary.project.domain}
                    </p>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-right xl:grid-cols-8">
                    <div>
                      <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                        Sources
                      </p>
                      <p className="mt-1 text-lg font-semibold">{summary.sourceCount}</p>
                    </div>
                    <div>
                      <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                        Wiki
                      </p>
                      <p className="mt-1 text-lg font-semibold">{summary.wikiPageCount}</p>
                    </div>
                    <div>
                      <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                        Artifacts
                      </p>
                      <p className="mt-1 text-lg font-semibold">{summary.artifactCount}</p>
                    </div>
                    <div>
                      <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                        Generated
                      </p>
                      <p className="mt-1 text-lg font-semibold">{summary.generatedPageCount}</p>
                    </div>
                    <div>
                      <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                        Source pages
                      </p>
                      <p className="mt-1 text-lg font-semibold">{summary.sourceSummaryPageCount}</p>
                    </div>
                    <div>
                      <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                        Supported
                      </p>
                      <p className="mt-1 text-lg font-semibold">{summary.supportedClaimsCount}</p>
                    </div>
                    <div>
                      <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                        Unresolved
                      </p>
                      <p className="mt-1 text-lg font-semibold">{summary.unresolvedClaimsCount}</p>
                    </div>
                    <div>
                      <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                        Last compile
                      </p>
                      <p className="mt-1 text-lg font-semibold">{summary.latestCompileLabel}</p>
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-6 text-muted">{summary.latestCompileSummary}</p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Evidence-linked pages: {summary.evidenceLinkedPageCount}.
                </p>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Open lint issues: {summary.health.totalIssues}. High or critical: {summary.health.issuesBySeverity.critical + summary.health.issuesBySeverity.high}.
                </p>
                <div className="mt-4 flex gap-3">
                  <Link
                    href={`/projects/${summary.project.id}`}
                    className="rounded-full border border-border px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-background"
                  >
                    Project Detail
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Recommended Order"
          title="Execution lane"
          description="The shell is in place. The next sequence keeps the wiki at the center and avoids building ingestion or ask flows before their canonical targets exist."
        >
          <ol className="space-y-3">
            {executionLane.map((item, index) => (
              <li
                key={item.title}
                className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border-strong bg-background/75 mono-label text-xs font-semibold tracking-[0.2em] text-muted">
                    {index + 1}
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold tracking-tight text-foreground">{item.title}</p>
                    <p className="text-sm leading-6 text-muted">{item.detail}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </SectionCard>
      </div>
    </PageFrame>
  );
}
