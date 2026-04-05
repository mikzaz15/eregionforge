import Link from "next/link";
import { notFound } from "next/navigation";
import {
  compileActiveProjectTimelineAction,
  compileProjectCatalystsAction,
  compileProjectDossierAction,
  compileProjectThesisAction,
  runActiveProjectContradictionAnalysisAction,
} from "@/app/(workspace)/actions";
import {
  MetricCard,
  PageFrame,
  SectionCard,
  StatusPill,
  type StatusTone,
} from "@/components/workspace/primitives";
import { artifactTypeLabel } from "@/lib/services/artifact-service";
import { getActiveProjectId, getProjectDetailData } from "@/lib/services/workspace-service";

type RecommendedAction =
  | {
      kind: "link";
      label: string;
      detail: string;
      href: string;
      secondaryHref?: string;
      secondaryLabel?: string;
    }
  | {
      kind:
        | "refresh-thesis"
        | "refresh-dossier"
        | "refresh-catalysts"
        | "rebuild-timeline"
        | "rerun-contradictions";
      label: string;
      detail: string;
      secondaryHref?: string;
      secondaryLabel?: string;
    };

type RecentChangeRecord = {
  title: string;
  detail: string;
  timestamp: string | null;
  href: string;
};

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

function pageTone(status: string): StatusTone {
  if (status === "active") {
    return "success";
  }

  if (status === "draft") {
    return "accent";
  }

  return "neutral";
}

function artifactTone(status: string): StatusTone {
  if (status === "active") {
    return "success";
  }

  if (status === "draft") {
    return "accent";
  }

  return "neutral";
}

function severityTone(status: string): StatusTone {
  if (status === "critical" || status === "high") {
    return "danger";
  }

  if (status === "medium") {
    return "accent";
  }

  return "neutral";
}

function contradictionStatusTone(status: string): StatusTone {
  if (status === "resolved") {
    return "success";
  }

  if (status === "reviewed") {
    return "accent";
  }

  return "neutral";
}

function timelineConfidenceTone(confidence: string): StatusTone {
  if (confidence === "high") {
    return "success";
  }

  if (confidence === "medium") {
    return "accent";
  }

  return "neutral";
}

function thesisStanceTone(stance: string | null): StatusTone {
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

function formatTimelineDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(date));
}

function formatContradictionType(value: string): string {
  return value.replaceAll("_", " ");
}

function labelize(value: string | null): string {
  if (!value) {
    return "Not set";
  }

  return value.replace(/([A-Z])/g, " $1").replaceAll("-", " ");
}

function formatDateTime(date: string | null): string {
  if (!date) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

function previewMarkdown(value: string, length = 220): string {
  const normalized = value
    .replace(/^#.*$/gm, "")
    .replace(/^- /gm, "")
    .replace(/\s+/g, " ")
    .trim();

  return normalized.length > length
    ? `${normalized.slice(0, length).trimEnd()}...`
    : normalized;
}

function isBefore(left: string | null, right: string | null): boolean {
  if (!left || !right) {
    return false;
  }

  return left < right;
}

function buildRecommendedAction(input: {
  projectId: string;
  isActiveWorkspace: boolean;
  projectData: NonNullable<Awaited<ReturnType<typeof getProjectDetailData>>>;
}): RecommendedAction {
  const openAlerts = input.projectData.monitoring.alerts.filter(
    (entry) => entry.alert.status === "open",
  );
  const firstAlert = openAlerts[0] ?? null;

  if (input.isActiveWorkspace && openAlerts.length > 0) {
    return {
      kind: "link",
      label: "Review Alerts",
      detail: firstAlert
        ? `${firstAlert.alert.title}. ${firstAlert.alert.metadata?.suggestedAction ?? "Inspect the affected surface and refresh it from there."}`
        : "Freshness alerts are open. Review the stale-to-refresh queue before refreshing downstream views.",
      href: "/monitoring",
      secondaryHref: "/sources",
      secondaryLabel: "Review Sources",
    };
  }

  if (input.projectData.summary.thesisPotentiallyStale) {
    return {
      kind: "refresh-thesis",
      label: "Refresh Thesis",
      detail: input.projectData.summary.thesisFreshnessReason,
      secondaryHref: `/projects/${input.projectId}/thesis`,
      secondaryLabel: "Open Thesis",
    };
  }

  if (!input.projectData.summary.dossierReady) {
    return {
      kind: "refresh-dossier",
      label: "Refresh Dossier",
      detail: `Dossier coverage is ${input.projectData.summary.dossierSectionCoverageLabel}. Refresh the dossier to bring the structured company view back in line with current canon and thesis posture.`,
      secondaryHref: `/projects/${input.projectId}/dossier`,
      secondaryLabel: "Open Dossier",
    };
  }

  if (
    input.projectData.summary.catalystCount === 0 ||
    isBefore(
      input.projectData.summary.catalystsLastCompiledAt,
      input.projectData.summary.thesisLastRefreshedAt,
    )
  ) {
    return {
      kind: "refresh-catalysts",
      label: "Refresh Catalysts",
      detail:
        "Catalyst tracking should be refreshed so newer thesis, timeline, and contradiction state is reflected in the tracked catalyst set.",
      secondaryHref: `/projects/${input.projectId}/catalysts`,
      secondaryLabel: "Open Catalysts",
    };
  }

  if (input.isActiveWorkspace && input.projectData.summary.timelineEventCount === 0) {
    return {
      kind: "rebuild-timeline",
      label: "Rebuild Timeline",
      detail:
        "Chronology coverage is still thin. Rebuild the timeline so catalyst timing and contradiction posture have a stronger dated backbone.",
      secondaryHref: "/timeline",
      secondaryLabel: "Open Timeline",
    };
  }

  if (input.isActiveWorkspace && input.projectData.summary.contradictionCount === 0) {
    return {
      kind: "rerun-contradictions",
      label: "Re-run Contradictions",
      detail:
        "The disagreement map is sparse. Re-run contradiction analysis to check for newer claim, source, and timing tension.",
      secondaryHref: "/contradictions",
      secondaryLabel: "Open Contradictions",
    };
  }

  return {
    kind: "link",
    label: "Open Thesis",
    detail:
      "The current stack looks coherent enough to continue from the thesis, then walk into catalysts, contradictions, and the dossier.",
    href: `/projects/${input.projectId}/thesis`,
    secondaryHref: `/projects/${input.projectId}/dossier`,
    secondaryLabel: "Open Dossier",
  };
}

function buildRecentChanges(input: {
  projectId: string;
  isActiveWorkspace: boolean;
  projectData: NonNullable<Awaited<ReturnType<typeof getProjectDetailData>>>;
}): RecentChangeRecord[] {
  return input.projectData.operationalEvents
    .map((event) => {
      let href = `/projects/${input.projectId}`;

      if (event.relatedObjectType === "thesis") {
        href = `/projects/${input.projectId}/thesis`;
      } else if (event.relatedObjectType === "dossier") {
        href = `/projects/${input.projectId}/dossier`;
      } else if (event.relatedObjectType === "catalyst_tracker") {
        href = `/projects/${input.projectId}/catalysts`;
      } else if (event.relatedObjectType === "timeline") {
        href = input.isActiveWorkspace ? "/timeline" : `/projects/${input.projectId}`;
      } else if (event.relatedObjectType === "contradictions") {
        href = input.isActiveWorkspace ? "/contradictions" : `/projects/${input.projectId}`;
      } else if (event.relatedObjectType === "monitoring") {
        href = input.isActiveWorkspace ? "/monitoring" : `/projects/${input.projectId}`;
      } else if (event.relatedObjectType === "entity_layer") {
        href = input.isActiveWorkspace ? "/entities" : `/projects/${input.projectId}`;
      } else if (event.relatedObjectType === "wiki") {
        href = input.isActiveWorkspace ? "/wiki" : `/projects/${input.projectId}`;
      }

      return {
        title: event.title,
        detail: event.description,
        timestamp: event.createdAt,
        href,
      };
    })
    .slice(0, 5);
}

export default async function ProjectDetailPage({
  params,
}: Readonly<{
  params: Promise<{ projectId: string }>;
}>) {
  const { projectId } = await params;
  const [projectData, currentActiveProjectId] = await Promise.all([
    getProjectDetailData(projectId),
    getActiveProjectId(),
  ]);

  if (!projectData) {
    notFound();
  }

  const isActiveWorkspace = projectData.summary.project.id === currentActiveProjectId;
  const recommendedAction = buildRecommendedAction({
    projectId,
    isActiveWorkspace,
    projectData,
  });
  const recentChanges = buildRecentChanges({
    projectId,
    isActiveWorkspace,
    projectData,
  });

  return (
    <PageFrame
      eyebrow="Project Detail"
      title={projectData.summary.project.name}
      description={projectData.summary.project.description}
      actions={
        <div className="flex flex-wrap gap-3">
          <Link
            href="/projects"
            className="action-button-secondary"
          >
            Back To Projects
          </Link>
          <Link
            href="/lint"
            className="action-button-secondary"
          >
            Open Lint
          </Link>
          <Link
            href="/contradictions"
            className="action-button-secondary"
          >
            Open Contradictions
          </Link>
          {isActiveWorkspace ? (
            <Link
              href="/monitoring"
              className="action-button-secondary"
            >
              Review Alerts
            </Link>
          ) : null}
          <Link
            href={`/projects/${projectId}/thesis`}
            className="action-button-secondary"
          >
            Open Thesis
          </Link>
          <Link
            href={`/projects/${projectId}/dossier`}
            className="action-button-secondary"
          >
            Open Dossier
          </Link>
          {isActiveWorkspace ? (
            <Link
              href="/entities"
              className="action-button-secondary"
            >
              Open Entities
            </Link>
          ) : null}
          <Link
            href={`/projects/${projectId}/catalysts`}
            className="action-button-secondary"
          >
            Open Catalysts
          </Link>
          <StatusPill tone={compileTone(projectData.summary.latestCompileStatus)}>
            {projectData.summary.latestCompileStatus}
          </StatusPill>
        </div>
      }
    >
      <div className="grid gap-4 xl:grid-cols-6">
        <MetricCard
          label="Domain"
          value={projectData.summary.project.domain}
          note="This domain defines the project boundary for sources, wiki pages, and artifacts."
        />
        <MetricCard
          label="Sources"
          value={String(projectData.summary.sourceCount)}
          note="Raw records are already partitioned under this project."
        />
        <MetricCard
          label="Wiki Pages"
          value={String(projectData.summary.wikiPageCount)}
          note="Canonical pages and revisions belong to this project boundary."
        />
        <MetricCard
          label="Generated"
          value={String(projectData.summary.generatedPageCount)}
          note="Generated pages now come from the compiler rather than seeded placeholders."
        />
        <MetricCard
          label="Supported Claims"
          value={String(projectData.summary.supportedClaimsCount)}
          note="First-pass trust now appears as deterministic claims backed by source fragments."
        />
        <MetricCard
          label="Artifacts"
          value={String(projectData.summary.artifactCount)}
          note="Durable outputs remain attached to the same project workspace."
        />
        <MetricCard
          label="Entities"
          value={String(projectData.summary.entityCount)}
          note="Entity intelligence turns core research subjects into durable structured objects that sharpen downstream analysis."
        />
        <MetricCard
          label="Timeline"
          value={String(projectData.summary.timelineEventCount)}
          note="Compiled chronology records turn dated source and canon signals into a durable project timeline."
        />
        <MetricCard
          label="Contradictions"
          value={String(projectData.summary.contradictionCount)}
          note="Contradiction analysis makes disagreement and tension reviewable instead of implicit."
        />
        <MetricCard
          label="Thesis"
          value={projectData.summary.thesisStance ?? "Not compiled"}
          note="The thesis tracker compiles stance, risk, unknowns, and catalysts from current project knowledge."
        />
        <MetricCard
          label="Dossier"
          value={projectData.summary.dossierCompanyName ?? "Not compiled"}
          note="The dossier compiles a structured company research view from the same canonical project knowledge stack."
        />
        <MetricCard
          label="Catalysts"
          value={String(projectData.summary.catalystCount)}
          note="Catalysts are now first-class research objects rather than only a thesis subsection."
        />
        <MetricCard
          label="Freshness Alerts"
          value={String(projectData.summary.freshnessAlertCount)}
          note="Freshness monitoring flags when thesis or adjacent compiled views may lag newer knowledge inputs."
        />
      </div>

      <SectionCard
        eyebrow="Central Command"
        title="Compiled research stack"
        description="This page is the command surface for the project. It shows the current underwriting posture, where the thesis may be stale, and which compiled views should be opened next."
      >
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill tone={projectData.summary.thesisPotentiallyStale ? "danger" : "success"}>
                {projectData.summary.thesisPotentiallyStale ? "thesis needs review" : "thesis current"}
              </StatusPill>
              <StatusPill tone={projectData.summary.dossierReady ? "success" : "accent"}>
                {projectData.summary.dossierReady ? "dossier ready" : "dossier in progress"}
              </StatusPill>
              <StatusPill tone={projectData.summary.freshnessAlertCount > 0 ? "danger" : "neutral"}>
                {projectData.summary.freshnessAlertCount} monitoring alerts
              </StatusPill>
            </div>
            <p className="mt-4 text-sm leading-6 text-foreground">
              Stance: {labelize(projectData.summary.thesisStance)}. Confidence: {projectData.summary.thesisConfidence ?? "Not set"}. Catalysts: {projectData.summary.catalystCount} total, {projectData.summary.reviewedCatalystCount} reviewed. Contradictions: {projectData.summary.unresolvedContradictionCount} unresolved, {projectData.summary.reviewedContradictionCount} reviewed. Timeline: {projectData.summary.timelineEventCount} events.
            </p>
            <p className="mt-3 text-sm leading-6 text-muted">
              {projectData.summary.thesisFreshnessReason}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={`/projects/${projectId}/thesis`}
                className="action-button-primary"
              >
                Open Thesis
              </Link>
              <Link
                href={`/projects/${projectId}/dossier`}
                className="action-button-secondary"
              >
                Open Dossier
              </Link>
              <Link
                href={`/projects/${projectId}/catalysts`}
                className="action-button-secondary"
              >
                Open Catalysts
              </Link>
              {isActiveWorkspace ? (
                <Link
                  href="/entities"
                  className="action-button-secondary"
                >
                  Open Entities
                </Link>
              ) : null}
              {isActiveWorkspace ? (
                <Link
                  href="/monitoring"
                  className="action-button-secondary"
                >
                  Review Alerts
                </Link>
              ) : null}
            </div>
          </div>
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
              <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                Next best action
              </p>
              <p className="mt-3 text-lg font-semibold tracking-tight text-foreground">
                {recommendedAction.label}
              </p>
              <p className="mt-3 text-sm leading-6 text-muted">
                {recommendedAction.detail}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {recommendedAction.kind === "link" ? (
                  <Link href={recommendedAction.href} className="action-button-primary">
                    {recommendedAction.label}
                  </Link>
                ) : null}
                {recommendedAction.kind === "refresh-thesis" ? (
                  <form action={compileProjectThesisAction}>
                    <input type="hidden" name="projectId" value={projectId} />
                    <input type="hidden" name="redirectTo" value={`/projects/${projectId}`} />
                    <button className="action-button-primary">Refresh Thesis</button>
                  </form>
                ) : null}
                {recommendedAction.kind === "refresh-dossier" ? (
                  <form action={compileProjectDossierAction}>
                    <input type="hidden" name="projectId" value={projectId} />
                    <input type="hidden" name="redirectTo" value={`/projects/${projectId}`} />
                    <button className="action-button-primary">Refresh Dossier</button>
                  </form>
                ) : null}
                {recommendedAction.kind === "refresh-catalysts" ? (
                  <form action={compileProjectCatalystsAction}>
                    <input type="hidden" name="projectId" value={projectId} />
                    <input type="hidden" name="redirectTo" value={`/projects/${projectId}`} />
                    <button className="action-button-primary">Refresh Catalysts</button>
                  </form>
                ) : null}
                {recommendedAction.kind === "rebuild-timeline" ? (
                  <form action={compileActiveProjectTimelineAction}>
                    <button className="action-button-primary">Rebuild Timeline</button>
                  </form>
                ) : null}
                {recommendedAction.kind === "rerun-contradictions" ? (
                  <form action={runActiveProjectContradictionAnalysisAction}>
                    <button className="action-button-primary">Re-run Contradictions</button>
                  </form>
                ) : null}
                {recommendedAction.secondaryHref ? (
                  <Link
                    href={recommendedAction.secondaryHref}
                    className="action-button-secondary"
                  >
                    {recommendedAction.secondaryLabel}
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
              <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                Recent changes
              </p>
              <div className="mt-3 space-y-3">
                {recentChanges.map((entry) => (
                  <Link
                    key={`${entry.title}-${entry.timestamp ?? "none"}`}
                    href={entry.href}
                    className="block rounded-2xl border border-border bg-background/65 px-4 py-4 transition hover:bg-background"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <p className="font-semibold tracking-tight text-foreground">
                        {entry.title}
                      </p>
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {formatDateTime(entry.timestamp)}
                      </p>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      {entry.detail}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { href: `/projects/${projectId}/thesis`, title: "Thesis", detail: `Revision ${projectData.summary.thesisRevisionNumber || 0} · ${labelize(projectData.summary.thesisStance)}` },
            { href: `/projects/${projectId}/dossier`, title: "Dossier", detail: projectData.summary.dossierSectionCoverageLabel },
            { href: `/projects/${projectId}/catalysts`, title: "Catalysts", detail: `${projectData.summary.upcomingCatalystCount} upcoming / ${projectData.summary.reviewedCatalystCount} reviewed` },
            { href: "/timeline", title: "Timeline", detail: `${projectData.summary.timelineEventCount} chronology events` },
            { href: "/contradictions", title: "Contradictions", detail: `${projectData.summary.unresolvedContradictionCount} unresolved / ${projectData.summary.reviewedContradictionCount} reviewed` },
            { href: isActiveWorkspace ? "/monitoring" : `/projects/${projectId}`, title: "Alerts", detail: `${projectData.summary.freshnessAlertCount} open / ${projectData.summary.acknowledgedFreshnessAlertCount} acknowledged` },
            { href: "/artifacts", title: "Artifacts", detail: `${projectData.summary.artifactCount} durable outputs` },
            { href: "/ask", title: "Ask", detail: "Canon-first research query flow" },
          ].map((item) => (
            <Link
              key={`${item.title}-${item.href}`}
              href={item.href}
              className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4 transition hover:bg-background"
            >
              <p className="font-semibold tracking-tight text-foreground">{item.title}</p>
              <p className="mt-2 text-sm leading-6 text-muted">{item.detail}</p>
            </Link>
          ))}
        </div>
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <SectionCard
          eyebrow="Knowledge Health"
          title="Trust operations summary"
          description="Linting turns compiled trust posture into an operational queue instead of leaving weak canon implicit."
        >
          <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
            <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4">
              <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                Open issues
              </p>
              <p className="mt-3 text-4xl font-semibold tracking-tight text-foreground">
                {projectData.summary.health.totalIssues}
              </p>
              <p className="mt-3 text-sm leading-6 text-muted">
                Unsupported claims: {projectData.summary.health.unsupportedClaimsCount}. Weak pages: {projectData.summary.health.weakPagesCount}. Stale pages: {projectData.summary.health.stalePagesCount}. Orphan pages: {projectData.summary.health.orphanPagesCount}.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(projectData.summary.health.issuesBySeverity).map(
                ([severity, count]) => (
                  <div
                    key={severity}
                    className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                        {severity}
                      </p>
                      <StatusPill tone={severityTone(severity)}>{severity}</StatusPill>
                    </div>
                    <p className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                      {count}
                    </p>
                  </div>
                ),
              )}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Freshness Intelligence"
          title="Monitoring and stale alerts"
          description="Freshness monitoring turns newer sources and analysis deltas into an explicit queue for keeping the investment view current."
        >
          <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
            <div className="space-y-3">
              <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4">
                <div className="flex flex-wrap gap-2">
                  <StatusPill tone={projectData.summary.freshnessAlertCount > 0 ? "danger" : "success"}>
                    {projectData.summary.freshnessAlertCount > 0 ? "attention" : "current"}
                  </StatusPill>
                  <StatusPill tone={projectData.summary.highSeverityFreshnessAlertCount > 0 ? "danger" : "neutral"}>
                    High {projectData.summary.highSeverityFreshnessAlertCount}
                  </StatusPill>
                  <StatusPill tone={projectData.summary.acknowledgedFreshnessAlertCount > 0 ? "accent" : "neutral"}>
                    Acknowledged {projectData.summary.acknowledgedFreshnessAlertCount}
                  </StatusPill>
                  <StatusPill tone={projectData.summary.sourcesNeedingReviewCount > 0 ? "accent" : "neutral"}>
                    Review {projectData.summary.sourcesNeedingReviewCount}
                  </StatusPill>
                </div>
                <p className="mt-4 text-sm leading-6 text-foreground">
                  Last evaluated {formatDateTime(projectData.summary.monitoringLastEvaluatedAt)}
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground">
                  Thesis freshness: {projectData.summary.thesisPotentiallyStale ? "attention required" : "current"}.
                </p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {projectData.summary.thesisFreshnessReason}
                </p>
                {isActiveWorkspace ? (
                  <Link
                    href="/monitoring"
                    className="action-button-secondary mt-4"
                  >
                    Review Alerts
                  </Link>
                ) : null}
              </div>
              <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
                <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  Last intelligence refresh
                </p>
                <p className="mt-3 text-sm leading-6 text-foreground">
                  Thesis: {formatDateTime(projectData.summary.thesisLastRefreshedAt)}
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground">
                  Dossier: {formatDateTime(projectData.summary.dossierLastRefreshedAt)}
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground">
                  Timeline: {formatDateTime(projectData.summary.timelineLastCompiledAt)}
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground">
                  Contradictions: {formatDateTime(projectData.summary.contradictionsLastAnalyzedAt)}
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground">
                  Catalysts: {formatDateTime(projectData.summary.catalystsLastCompiledAt)}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {projectData.monitoring.alerts.length > 0 ? (
                projectData.monitoring.alerts
                  .filter(
                    (entry) =>
                      entry.alert.metadata?.signalState !== "inactive" &&
                      entry.alert.status !== "dismissed",
                  )
                  .slice(0, 3)
                  .map((entry) => (
                  <div
                    key={entry.alert.id}
                    className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4"
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
                    <p className="mt-2 text-sm leading-6 text-muted">
                      Suggested action: {entry.alert.metadata?.suggestedAction ?? "Review updated knowledge inputs"}.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      {isActiveWorkspace ? (
                        <Link
                          href="/monitoring"
                          className="action-button-secondary action-button-compact"
                        >
                          Review Alerts
                        </Link>
                      ) : null}
                      {entry.alert.alertType === "thesis_may_be_stale" ? (
                        <form action={compileProjectThesisAction}>
                          <input type="hidden" name="projectId" value={projectId} />
                          <input type="hidden" name="redirectTo" value={`/projects/${projectId}`} />
                          <button className="action-button-secondary action-button-compact">
                            Refresh Thesis
                          </button>
                        </form>
                      ) : null}
                      {entry.alert.alertType === "dossier_may_be_stale" ? (
                        <form action={compileProjectDossierAction}>
                          <input type="hidden" name="projectId" value={projectId} />
                          <input type="hidden" name="redirectTo" value={`/projects/${projectId}`} />
                          <button className="action-button-secondary action-button-compact">
                            Refresh Dossier
                          </button>
                        </form>
                      ) : null}
                      {entry.alert.alertType === "catalyst_tracker_needs_refresh" ? (
                        <form action={compileProjectCatalystsAction}>
                          <input type="hidden" name="projectId" value={projectId} />
                          <input type="hidden" name="redirectTo" value={`/projects/${projectId}`} />
                          <button className="action-button-secondary action-button-compact">
                            Refresh Catalysts
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4 text-sm leading-6 text-muted">
                  No active stale alerts are open for this project right now.
                </div>
              )}
            </div>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Workspace Scope"
          title="Project posture"
          description="This detail route makes the project boundary explicit before deeper project-scoped routing lands."
        >
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4">
              <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                Workspace state
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                {isActiveWorkspace
                  ? "This is the active workspace project. The top-level Sources, Wiki, Artifacts, Ask, and Settings routes currently resolve against it."
                  : "This is a portfolio project. Its sources, wiki pages, and artifacts are already modeled separately, even though the top-level workspace is still pinned to the active project for now."}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
              <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                Asset mix
              </p>
              {projectData.artifactTypeMix.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {projectData.artifactTypeMix.map((entry) => (
                    <StatusPill key={entry.artifactType} tone="neutral">
                      {artifactTypeLabel(entry.artifactType)} {entry.count}
                    </StatusPill>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm leading-6 text-muted">
                  No artifacts have been created for this project yet.
                </p>
              )}
              <p className="mt-3 text-sm leading-6 text-muted">
                Recent artifacts: {projectData.artifacts.slice(0, 3).map((entry) => entry.artifact.title).join(", ") || "none yet"}.
              </p>
            </div>
          </div>
        </SectionCard>

      </div>

      <SectionCard
        eyebrow="Dossier"
        title="Compiled company view"
        description="The company dossier consolidates the main operating, product, market, and coverage context into a durable research briefing."
      >
        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4">
              <div className="flex flex-wrap gap-2">
                <StatusPill tone={projectData.dossier ? "success" : "neutral"}>
                  {projectData.dossier ? "compiled" : "not compiled"}
                </StatusPill>
                <StatusPill tone={timelineConfidenceTone(projectData.summary.dossierConfidence ?? "low")}>
                  {projectData.summary.dossierConfidence ?? "not set"}
                </StatusPill>
                <StatusPill tone={projectData.summary.dossierReady ? "success" : "accent"}>
                  {projectData.summary.dossierReady ? "research-ready" : "in progress"}
                </StatusPill>
              </div>
              <p className="mt-4 text-sm leading-6 text-foreground">
                Company: {projectData.summary.dossierCompanyName ?? "Not compiled"}
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                Coverage: {projectData.summary.dossierSectionCoverageLabel}
              </p>
              {projectData.summary.dossierConfidenceSummary ? (
                <p className="mt-2 text-sm leading-6 text-muted">
                  {projectData.summary.dossierConfidenceSummary}
                </p>
              ) : null}
              <Link
                href={`/projects/${projectId}/dossier`}
                className="action-button-secondary mt-4"
              >
                Open Dossier
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
            {projectData.dossier ? (
              <div className="space-y-4">
                <p className="font-semibold tracking-tight text-foreground">
                  {projectData.dossier.dossier.companyName}
                </p>
                <p className="text-sm leading-6 text-foreground">
                  Sector: {projectData.dossier.dossier.sector ?? "Not set"}.
                  {" "}Geography: {projectData.dossier.dossier.geography ?? "Not set"}.
                  {" "}Coverage: {projectData.dossier.readiness.sectionCoverageLabel}.
                </p>
                {projectData.dossier.dossier.metadata?.confidenceSummary ? (
                  <p className="text-sm leading-6 text-muted">
                    {projectData.dossier.dossier.metadata.confidenceSummary}
                  </p>
                ) : null}
                <p className="text-sm leading-6 text-foreground">
                  {previewMarkdown(projectData.dossier.dossier.businessOverviewMarkdown)}
                </p>
              </div>
            ) : (
              <p className="text-sm leading-6 text-muted">
                No dossier has been compiled for this project yet. Use the dossier view to generate a structured company briefing from current pages, claims, sources, artifacts, and thesis context.
              </p>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Catalysts"
        title="First-class catalyst tracker"
        description="Catalysts compile into durable research objects connected to thesis, chronology, contradictions, and source support."
      >
        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4">
              <div className="flex flex-wrap gap-2">
                <StatusPill tone={projectData.summary.catalystCount > 0 ? "success" : "neutral"}>
                  {projectData.summary.catalystCount > 0 ? "compiled" : "not compiled"}
                </StatusPill>
                <StatusPill tone="neutral">
                  Upcoming {projectData.summary.upcomingCatalystCount}
                </StatusPill>
                <StatusPill tone="accent">
                  Reviewed {projectData.summary.reviewedCatalystCount}
                </StatusPill>
                <StatusPill tone="success">
                  Resolved {projectData.summary.resolvedCatalystCount}
                </StatusPill>
                <StatusPill tone={projectData.summary.invalidatedCatalystCount > 0 ? "danger" : "neutral"}>
                  Invalidated {projectData.summary.invalidatedCatalystCount}
                </StatusPill>
                <StatusPill tone={projectData.summary.highImportanceCatalystCount > 0 ? "danger" : "neutral"}>
                  High {projectData.summary.highImportanceCatalystCount}
                </StatusPill>
              </div>
              <p className="mt-4 text-sm leading-6 text-foreground">
                Total catalysts: {projectData.summary.catalystCount}
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                Thesis-linked view with timeframe, confidence, and contradiction linkage.
              </p>
              <Link
                href={`/projects/${projectId}/catalysts`}
                className="action-button-secondary mt-4"
              >
                Open Catalysts
              </Link>
            </div>
          </div>
          <div className="space-y-3">
            {projectData.catalysts.length > 0 ? (
              projectData.catalysts.slice(0, 3).map((entry) => (
                <div
                  key={entry.catalyst.id}
                  className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold tracking-tight text-foreground">
                      {entry.catalyst.title}
                    </p>
                    <StatusPill tone={entry.catalyst.importance === "high" ? "danger" : entry.catalyst.importance === "medium" ? "accent" : "neutral"}>
                      {entry.catalyst.importance}
                    </StatusPill>
                    <StatusPill tone={entry.catalyst.status === "resolved" ? "success" : entry.catalyst.status === "active" ? "accent" : "neutral"}>
                      {entry.catalyst.status}
                    </StatusPill>
                    <StatusPill tone={entry.catalyst.reviewStatus === "resolved" ? "success" : entry.catalyst.reviewStatus === "invalidated" ? "danger" : entry.catalyst.reviewStatus === "reviewed" ? "accent" : "neutral"}>
                      {entry.catalyst.reviewStatus}
                    </StatusPill>
                  </div>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {entry.catalyst.catalystType.replaceAll("_", " ")}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-foreground">
                    {entry.catalyst.description}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4 text-sm leading-6 text-muted">
                No catalysts have been compiled for this project yet. Use the catalyst tracker to promote catalyst candidates into a durable research layer.
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Thesis"
        title="Compiled investment view"
        description="The thesis tracker turns current project knowledge into a stance, risk, variant, and catalyst view backed by canon."
      >
        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4">
              <div className="flex flex-wrap gap-2">
                <StatusPill tone={projectData.summary.thesisStatus === "active" ? "success" : projectData.summary.thesisStatus === "draft" ? "accent" : projectData.summary.thesisStatus === "stale" ? "danger" : "neutral"}>
                  {projectData.summary.thesisStatus ?? "not compiled"}
                </StatusPill>
                <StatusPill tone={thesisStanceTone(projectData.summary.thesisStance)}>
                  {labelize(projectData.summary.thesisStance)}
                </StatusPill>
                <StatusPill tone={timelineConfidenceTone(projectData.summary.thesisConfidence ?? "low")}>
                  {projectData.summary.thesisConfidence ?? "not set"}
                </StatusPill>
                {projectData.summary.thesisRevisionNumber > 0 ? (
                  <StatusPill tone="neutral">
                    Revision {projectData.summary.thesisRevisionNumber}
                  </StatusPill>
                ) : null}
              </div>
              <p className="mt-4 text-sm leading-6 text-foreground">
                Catalysts: {projectData.summary.thesisCatalystCount}
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                Unresolved contradictions: {projectData.summary.unresolvedContradictionCount}
              </p>
              <p className="mt-2 text-sm leading-6 text-foreground">
                Last refreshed: {formatDateTime(projectData.summary.thesisLastRefreshedAt)}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted">
                {projectData.summary.thesisFreshnessReason}
              </p>
              {projectData.summary.thesisConfidenceSummary ? (
                <p className="mt-2 text-sm leading-6 text-muted">
                  {projectData.summary.thesisConfidenceSummary}
                </p>
              ) : null}
              <Link
                href={`/projects/${projectId}/thesis`}
                className="action-button-secondary mt-4"
              >
                Open Thesis
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
            {projectData.thesis ? (
              <div className="space-y-4">
                <p className="font-semibold tracking-tight text-foreground">
                  {projectData.thesis.thesis.title}
                </p>
                {projectData.thesis.thesis.metadata?.confidenceSummary ? (
                  <p className="text-sm leading-6 text-muted">
                    {projectData.thesis.thesis.metadata.confidenceSummary}
                  </p>
                ) : null}
                <p className="text-sm leading-6 text-foreground">
                  {projectData.thesis.thesis.summary}
                </p>
              </div>
            ) : (
              <p className="text-sm leading-6 text-muted">
                No thesis has been compiled for this project yet. Use the thesis view to generate the first pass from current pages, claims, timeline events, contradictions, and artifacts.
              </p>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Contradictions"
        title="Disagreement map"
        description="Contradictions compile conflicting or materially inconsistent knowledge into an operator-facing integrity surface."
      >
        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <div className="space-y-3">
            <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4">
              <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                Contradictions
              </p>
              <p className="mt-3 text-4xl font-semibold tracking-tight text-foreground">
                {projectData.summary.contradictionCount}
              </p>
              <p className="mt-3 text-sm leading-6 text-muted">
                High severity: {projectData.summary.highSeverityContradictionCount}. Unresolved: {projectData.summary.unresolvedContradictionCount}. Reviewed: {projectData.summary.reviewedContradictionCount}.
              </p>
              <Link
                href="/contradictions"
                className="action-button-secondary mt-4"
              >
                Open Contradictions
              </Link>
            </div>
          </div>
          <div className="space-y-3">
            {projectData.contradictions.length > 0 ? (
              projectData.contradictions.slice(0, 3).map((entry) => (
                <div
                  key={entry.contradiction.id}
                  className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold tracking-tight text-foreground">
                      {entry.contradiction.title}
                    </p>
                    <StatusPill tone={severityTone(entry.contradiction.severity)}>
                      {entry.contradiction.severity}
                    </StatusPill>
                    <StatusPill tone={contradictionStatusTone(entry.contradiction.status)}>
                      {entry.contradiction.status}
                    </StatusPill>
                  </div>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {formatContradictionType(entry.contradiction.contradictionType)}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-foreground">
                    {entry.contradiction.rationale}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4 text-sm leading-6 text-muted">
                No contradiction records exist yet for this project. Run contradiction analysis to establish the disagreement map.
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Timeline"
        title="Compiled chronology"
        description="Timeline events turn dated source, claim, and canonical page signals into a project-level chronology with visible provenance."
      >
        <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
          <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4">
            <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              Event count
            </p>
            <p className="mt-3 text-4xl font-semibold tracking-tight text-foreground">
              {projectData.summary.timelineEventCount}
            </p>
            <p className="mt-3 text-sm leading-6 text-muted">
              The full timeline remains a compiled view, not a raw list of dates pulled from project documents.
            </p>
            <Link
              href="/timeline"
              className="action-button-secondary mt-4"
            >
              Open Timeline
            </Link>
          </div>
          <div className="space-y-3">
            {projectData.timelineEvents.length > 0 ? (
              projectData.timelineEvents
                .slice(-3)
                .reverse()
                .map((entry) => (
                  <div
                    key={entry.event.id}
                    className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold tracking-tight text-foreground">
                            {entry.event.title}
                          </p>
                          <StatusPill tone={timelineConfidenceTone(entry.event.confidence)}>
                            {entry.event.confidence}
                          </StatusPill>
                        </div>
                        <p className="text-sm leading-6 text-muted">
                          {entry.event.description}
                        </p>
                      </div>
                      <div className="text-right text-sm leading-6 text-muted">
                        <p>{formatTimelineDate(entry.event.eventDate)}</p>
                        <p className="capitalize">{entry.event.eventType}</p>
                      </div>
                    </div>
                  </div>
                ))
            ) : (
              <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4 text-sm leading-6 text-muted">
                No compiled timeline events exist yet for this project. Run the timeline compiler to establish chronology.
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard
          eyebrow="Sources"
          title="Project source library"
          description="Sources remain the raw layer feeding canonical page compilation."
        >
          <div className="space-y-3">
            {projectData.sources.slice(0, 4).map((source) => (
              <div
                key={source.id}
                className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4"
              >
                <p className="font-semibold tracking-tight text-foreground">{source.title}</p>
                <p className="mt-2 text-sm leading-6 text-muted">{source.body}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Wiki"
          title="Canonical pages"
          description="Compiled knowledge objects stay central to the workspace."
        >
          <div className="space-y-3">
            {projectData.wikiPages.slice(0, 4).map((entry) => (
              <Link
                key={entry.page.id}
                href={`/wiki/${entry.page.id}`}
                className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4"
              >
                <div className="flex items-center gap-2">
                  <p className="font-semibold tracking-tight text-foreground">
                    {entry.page.title}
                  </p>
                  <StatusPill tone={pageTone(entry.page.status)}>{entry.page.status}</StatusPill>
                  <StatusPill tone={entry.isGenerated ? "success" : "neutral"}>
                    {entry.isGenerated ? "generated" : "seeded"}
                  </StatusPill>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {entry.currentRevision?.summary}
                </p>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Claims {entry.claimCount} · Supported {entry.supportedClaimCount} · Unresolved {entry.unresolvedClaimCount}
                </p>
              </Link>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Artifacts"
          title="Durable outputs"
          description="Artifacts stay attached to the same project instead of becoming disposable text."
        >
          <div className="space-y-3">
            {projectData.artifacts.slice(0, 4).map((entry) => (
              <Link
                key={entry.artifact.id}
                href={`/artifacts/${entry.artifact.id}`}
                className="block rounded-2xl border border-border bg-surface-strong/75 px-4 py-4"
              >
                <div className="flex items-center gap-2">
                  <p className="font-semibold tracking-tight text-foreground">
                    {entry.artifact.title}
                  </p>
                  <StatusPill tone={artifactTone(entry.artifact.status)}>
                    {entry.artifact.status}
                  </StatusPill>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {entry.artifact.previewText}
                </p>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {artifactTypeLabel(entry.artifact.artifactType)} · Pages {entry.wikiPageCount} · Claims {entry.claimCount} · Sources {entry.sourceCount}
                </p>
              </Link>
            ))}
          </div>
        </SectionCard>
      </div>
    </PageFrame>
  );
}
