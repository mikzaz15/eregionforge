import Link from "next/link";
import {
  MetricCard,
  PageFrame,
  SectionCard,
  StatusPill,
  type StatusTone,
} from "@/components/workspace/primitives";
import {
  getActiveProjectSummary,
  getProjectsPageData,
} from "@/lib/services/workspace-service";

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
  const [{ metrics, summaries }, activeSummary] = await Promise.all([
    getProjectsPageData(),
    getActiveProjectSummary(),
  ]);

  return (
    <PageFrame
      eyebrow="Research OS"
      title="Research Command"
      description="EregionForge compiles sources into a canonical research stack. The loaded project below is the fastest way to demonstrate thesis, dossier, catalysts, timeline, contradictions, monitoring, ask, and artifacts as one connected system."
    >
      <div className="grid gap-4 xl:grid-cols-3">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <SectionCard
          eyebrow="Loaded Demo"
          title={activeSummary.project.name}
          description="This loaded project is the default end-to-end demo path. It already shows a live thesis debate, visible catalysts, contradictions, chronology, artifacts, and freshness pressure."
        >
          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone={activeSummary.thesisPotentiallyStale ? "danger" : "success"}>
                  {activeSummary.thesisPotentiallyStale ? "freshness attention" : "current"}
                </StatusPill>
                <StatusPill tone={compileTone(activeSummary.latestCompileStatus)}>
                  {activeSummary.latestCompileStatus}
                </StatusPill>
                <StatusPill tone="neutral">{activeSummary.project.domain}</StatusPill>
              </div>
              <p className="mt-4 text-sm leading-6 text-foreground">
                Thesis stance: {activeSummary.thesisStance ?? "Not compiled"}. Dossier: {activeSummary.dossierCompanyName ?? "Not compiled"}. Catalysts: {activeSummary.catalystCount}. Contradictions: {activeSummary.contradictionCount}. Monitoring alerts: {activeSummary.freshnessAlertCount}.
              </p>
              <p className="mt-3 text-sm leading-6 text-muted">
                {activeSummary.thesisFreshnessReason}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href={`/projects/${activeSummary.project.id}`}
                  className="rounded-full border border-border-strong bg-foreground px-4 py-2 text-sm font-semibold text-background transition hover:bg-[#2b3135]"
                >
                  Open Command View
                </Link>
                <Link
                  href="/thesis"
                  className="rounded-full border border-border bg-background/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-background"
                >
                  Open Thesis
                </Link>
                <Link
                  href="/monitoring"
                  className="rounded-full border border-border bg-background/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-background"
                >
                  Open Monitoring
                </Link>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { href: "/dossier", title: "Dossier", detail: activeSummary.dossierSectionCoverageLabel },
                { href: "/catalysts", title: "Catalysts", detail: `${activeSummary.upcomingCatalystCount} upcoming / ${activeSummary.highImportanceCatalystCount} high importance` },
                { href: "/timeline", title: "Timeline", detail: `${activeSummary.timelineEventCount} chronology events` },
                { href: "/contradictions", title: "Contradictions", detail: `${activeSummary.unresolvedContradictionCount} unresolved tensions` },
                { href: "/ask", title: "Ask", detail: "Resolve questions against compiled canon first" },
                { href: "/artifacts", title: "Artifacts", detail: `${activeSummary.artifactCount} durable research outputs` },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4 transition hover:bg-background"
                >
                  <p className="font-semibold tracking-tight text-foreground">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted">{item.detail}</p>
                </Link>
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Portfolio"
          title="Research programs"
          description="Each program keeps its own canonical stack. One can be loaded as the active workspace while the rest remain available as adjacent research programs."
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
          eyebrow="Demo Flow"
          title="Narrative path"
          description="This is the cleanest route order for showing the product as a serious investment-research intelligence system instead of a loose set of pages."
        >
          <ol className="space-y-3">
            {[
              {
                title: "Start on the command view",
                detail:
                  "Anchor the demo in one project and show thesis status, dossier readiness, catalysts, contradictions, timeline posture, monitoring alerts, and recent artifacts in one place.",
              },
              {
                title: "Open the thesis, then follow tension outward",
                detail:
                  "Use the thesis as the underwriting surface, then jump directly into catalysts, contradictions, and monitoring to show why the thesis is a living object.",
              },
              {
                title: "Close with Ask and artifacts",
                detail:
                  "Ask mode proves canon-first retrieval, and the artifact ledger proves that useful answers become durable project assets.",
              },
            ].map((item, index) => (
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
