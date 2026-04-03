import Link from "next/link";
import { notFound } from "next/navigation";
import {
  MetricCard,
  PageFrame,
  SectionCard,
  StatusPill,
  type StatusTone,
} from "@/components/workspace/primitives";
import { artifactTypeLabel } from "@/lib/services/artifact-service";
import { getActiveProjectId, getProjectDetailData } from "@/lib/services/workspace-service";

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

  return (
    <PageFrame
      eyebrow="Project Detail"
      title={projectData.summary.project.name}
      description={projectData.summary.project.description}
      actions={
        <div className="flex flex-wrap gap-3">
          <Link
            href="/projects"
            className="rounded-full border border-border bg-background/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-background"
          >
            Back To Projects
          </Link>
          <Link
            href="/lint"
            className="rounded-full border border-border bg-background/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-background"
          >
            Open Lint
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
      </div>

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

        <SectionCard
          eyebrow="Quick Links"
          title="Related workspace surfaces"
          description="These top-level screens are already structured around project-owned data."
        >
          <div className="space-y-3">
            {["/sources", "/wiki", "/artifacts", "/ask"].map((href) => (
              <Link
                key={href}
                href={href}
                className="block rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4 text-sm font-semibold text-foreground transition hover:bg-background"
              >
                {href.replace("/", "").replace("-", " ")}
              </Link>
            ))}
            <Link
              href="/lint"
              className="block rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4 text-sm font-semibold text-foreground transition hover:bg-background"
            >
              lint
            </Link>
          </div>
        </SectionCard>
      </div>

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
