import Link from "next/link";
import {
  MetricCard,
  PageFrame,
  SectionCard,
  StatusPill,
  type StatusTone,
} from "@/components/workspace/primitives";
import { setArtifactWikiFilingEligibilityAction } from "@/app/(workspace)/actions";
import {
  artifactProvenanceLabel,
  artifactTypeLabel,
} from "@/lib/services/artifact-service";
import {
  getActiveProjectId,
  getArtifactsPageData,
} from "@/lib/services/workspace-service";

function artifactTone(status: string): StatusTone {
  if (status === "active") {
    return "success";
  }

  if (status === "draft") {
    return "accent";
  }

  return "neutral";
}

function provenanceTone(provenance: string): StatusTone {
  if (provenance === "ask-mode") {
    return "accent";
  }

  if (provenance === "wiki-derived") {
    return "success";
  }

  return "neutral";
}

export default async function ArtifactsPage({
  searchParams,
}: Readonly<{
  searchParams?: Promise<{ type?: string }>;
}>) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const projectId = await getActiveProjectId();
  const data = await getArtifactsPageData(
    projectId,
    resolvedSearchParams.type as
      | "memo"
      | "briefing"
      | "comparison_report"
      | "slide_outline"
      | "saved_answer"
      | "all"
      | undefined,
  );

  if (!data) {
    throw new Error("Active project artifact data is unavailable.");
  }

  return (
    <PageFrame
      eyebrow="Output Layer"
      title="Artifacts"
      description={`Artifacts are durable project assets for ${data.summary.project.name}. They preserve usable outputs, provenance, and references instead of letting strong work disappear as one-off results.`}
      actions={
        <div className="flex flex-wrap gap-3">
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
            href="/ask"
            className="action-button-secondary"
          >
            Open Ask
          </Link>
        </div>
      }
    >
      <div className="grid gap-4 xl:grid-cols-4">
        {data.metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
        <SectionCard
          eyebrow="Filters"
          title="Artifact types"
          description="The ledger can already be filtered by durable output type without becoming a generic document manager."
        >
          <div className="space-y-3">
            <Link
              href="/artifacts"
              className={`block rounded-2xl border px-4 py-4 text-sm font-semibold transition ${
                data.activeFilter === "all"
                  ? "border-border-strong bg-background text-foreground"
                  : "border-border bg-[rgba(255,255,255,0.42)] text-foreground hover:bg-background"
              }`}
            >
              All Types
            </Link>
            {data.artifactTypes.map((type) => (
              <Link
                key={type.value}
                href={`/artifacts?type=${type.value}`}
                className={`block rounded-2xl border px-4 py-4 text-sm font-semibold transition ${
                  data.activeFilter === type.value
                    ? "border-border-strong bg-background text-foreground"
                    : "border-border bg-[rgba(255,255,255,0.42)] text-foreground hover:bg-background"
                }`}
              >
                {type.label}
              </Link>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Artifact Ledger"
          title="Project asset register"
          description="These assets are durable outputs tied to the project boundary, with provenance and references ready for future wiki filing."
        >
          <div className="space-y-3">
            {data.artifacts.length > 0 ? (
              data.artifacts.map((entry) => (
                <div
                  key={entry.artifact.id}
                  className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/artifacts/${entry.artifact.id}`}
                          className="font-semibold tracking-tight text-foreground underline-offset-4 hover:underline"
                        >
                          {entry.artifact.title}
                        </Link>
                        <StatusPill tone={artifactTone(entry.artifact.status)}>
                          {entry.artifact.status}
                        </StatusPill>
                        <StatusPill tone={provenanceTone(entry.artifact.provenance)}>
                          {artifactProvenanceLabel(entry.artifact.provenance)}
                        </StatusPill>
                        {entry.artifact.eligibleForWikiFiling ? (
                          <StatusPill tone="success">wiki filing candidate</StatusPill>
                        ) : null}
                      </div>
                      <p className="text-sm leading-6 text-muted">
                        {entry.artifact.previewText}
                      </p>
                    </div>
                    <div className="text-right text-sm leading-6 text-muted">
                      <p>{artifactTypeLabel(entry.artifact.artifactType)}</p>
                      <p>
                        {new Intl.DateTimeFormat("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        }).format(new Date(entry.artifact.createdAt))}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-4 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    <span>Pages {entry.wikiPageCount}</span>
                    <span>Claims {entry.claimCount}</span>
                    <span>Sources {entry.sourceCount}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href={`/artifacts/${entry.artifact.id}`}
                      className="action-button-secondary action-button-compact"
                    >
                      Open Detail
                    </Link>
                    <form action={setArtifactWikiFilingEligibilityAction}>
                      <input type="hidden" name="artifactId" value={entry.artifact.id} />
                      <input
                        type="hidden"
                        name="eligibleForWikiFiling"
                        value={entry.artifact.eligibleForWikiFiling ? "false" : "true"}
                      />
                      <input
                        type="hidden"
                        name="redirectTo"
                        value={
                          data.activeFilter === "all"
                            ? "/artifacts"
                            : `/artifacts?type=${data.activeFilter}`
                        }
                      />
                      <button className="action-button-secondary action-button-compact">
                        {entry.artifact.eligibleForWikiFiling
                          ? "Remove Wiki Filing"
                          : "Mark For Wiki Filing"}
                      </button>
                    </form>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4 text-sm leading-6 text-muted">
                No artifacts match the current filter.
              </div>
            )}
          </div>
        </SectionCard>
      </div>
    </PageFrame>
  );
}
