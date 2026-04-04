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

      <div className="grid gap-5 xl:grid-cols-[1.32fr_1fr]">
        <SectionCard
          eyebrow="Loaded Demo"
          title={activeSummary.project.name}
          description="This loaded project is the default end-to-end demo path. It already shows a live thesis debate, visible catalysts, contradictions, chronology, artifacts, and freshness pressure."
        >
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
            <div className="rounded-[1.6rem] border border-border bg-surface-strong/78 px-5 py-5">
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill tone={activeSummary.thesisPotentiallyStale ? "danger" : "success"}>
                  {activeSummary.thesisPotentiallyStale ? "freshness attention" : "current"}
                </StatusPill>
                <StatusPill tone={compileTone(activeSummary.latestCompileStatus)}>
                  {activeSummary.latestCompileStatus}
                </StatusPill>
                <StatusPill tone="neutral">{activeSummary.project.domain}</StatusPill>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[
                  {
                    label: "Thesis stance",
                    value: activeSummary.thesisStance ?? "Not compiled",
                  },
                  {
                    label: "Dossier",
                    value: activeSummary.dossierCompanyName ?? "Not compiled",
                  },
                  {
                    label: "Catalysts",
                    value: `${activeSummary.catalystCount} tracked`,
                  },
                  {
                    label: "Monitoring",
                    value: `${activeSummary.freshnessAlertCount} active alerts`,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-border bg-background/52 px-4 py-3"
                  >
                    <p className="mono-label text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                      {item.label}
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-foreground">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-sm leading-6 text-muted">
                {activeSummary.thesisFreshnessReason}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href={`/projects/${activeSummary.project.id}`}
                  className="action-button-primary"
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
                  Review Alerts
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
                  className="rounded-[1.35rem] border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4 transition hover:bg-background"
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
                className="rounded-[1.6rem] border border-border bg-surface-strong/78 px-5 py-5"
              >
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusPill tone={summary.project.id === activeSummary.project.id ? "accent" : "neutral"}>
                          {summary.project.id === activeSummary.project.id ? "loaded workspace" : "portfolio program"}
                        </StatusPill>
                        <StatusPill tone={compileTone(summary.latestCompileStatus)}>
                          {summary.latestCompileStatus}
                        </StatusPill>
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-lg font-semibold tracking-tight text-foreground">
                          {summary.project.name}
                        </h3>
                        <p className="max-w-2xl text-sm leading-6 text-muted">
                          {summary.project.description}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-xl border border-border bg-background/50 px-4 py-3 lg:max-w-[15rem]">
                      <p className="mono-label text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        Research domain
                      </p>
                      <p className="mt-2 text-sm font-semibold text-foreground">
                        {summary.project.domain}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-muted">
                        {summary.latestCompileSummary}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {[
                    { label: "Sources", value: String(summary.sourceCount) },
                    { label: "Wiki", value: String(summary.wikiPageCount) },
                    { label: "Artifacts", value: String(summary.artifactCount) },
                    { label: "Generated", value: String(summary.generatedPageCount) },
                    {
                      label: "Source pages",
                      value: String(summary.sourceSummaryPageCount),
                    },
                    {
                      label: "Supported",
                      value: String(summary.supportedClaimsCount),
                    },
                    {
                      label: "Unresolved",
                      value: String(summary.unresolvedClaimsCount),
                    },
                    { label: "Last compile", value: summary.latestCompileLabel },
                  ].map((metric) => (
                    <div
                      key={`${summary.project.id}-${metric.label}`}
                      className="min-w-0 rounded-xl border border-border bg-background/45 px-3 py-3"
                    >
                      <p className="mono-label text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                        {metric.label}
                      </p>
                      <p className="mt-2 break-words text-base font-semibold leading-tight text-foreground">
                        {metric.value}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm leading-6 text-muted">
                  <p>
                    Evidence-linked pages: {summary.evidenceLinkedPageCount}.
                  </p>
                  <p>
                    Open lint issues: {summary.health.totalIssues}. High or critical: {summary.health.issuesBySeverity.critical + summary.health.issuesBySeverity.high}.
                  </p>
                </div>
                <div className="mt-4 flex gap-3">
                  <Link
                    href={`/projects/${summary.project.id}`}
                    className="action-button-secondary"
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
                className="rounded-[1.5rem] border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4"
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
