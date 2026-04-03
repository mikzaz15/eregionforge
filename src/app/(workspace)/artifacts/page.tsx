import Link from "next/link";
import {
  MetricCard,
  PageFrame,
  SectionCard,
  StatusPill,
  type StatusTone,
} from "@/components/workspace/primitives";
import { getActiveProjectId, getArtifactsPageData } from "@/lib/services/workspace-service";

function artifactTone(status: string): StatusTone {
  if (status === "active") {
    return "success";
  }

  if (status === "draft") {
    return "accent";
  }

  return "neutral";
}

export default async function ArtifactsPage() {
  const projectId = await getActiveProjectId();
  const data = await getArtifactsPageData(projectId);

  if (!data) {
    throw new Error("Active project artifact data is unavailable.");
  }

  return (
    <PageFrame
      eyebrow="Output Layer"
      title="Artifacts"
      description={`Artifacts are reusable research outputs derived from the compiled wiki for ${data.summary.project.name}. They should compound over time instead of disappearing as one-off responses.`}
      actions={
        <Link
          href={`/projects/${data.summary.project.id}`}
          className="rounded-full border border-border bg-background/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-background"
        >
          View Project
        </Link>
      }
    >
      <div className="grid gap-4 xl:grid-cols-3">
        {data.metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

        <SectionCard
        eyebrow="Artifact Ledger"
        title="Project artifact ledger"
        description="These outputs are real artifact records tied to the active project boundary."
      >
        <div className="space-y-3">
          {data.artifacts.map((artifact) => (
            <div
              key={artifact.id}
              className="grid gap-3 rounded-2xl border border-border bg-surface-strong/75 px-4 py-4 lg:grid-cols-[minmax(0,1.25fr)_160px_160px]"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold tracking-tight text-foreground">
                    {artifact.title}
                  </h3>
                  <StatusPill tone={artifactTone(artifact.status)}>{artifact.status}</StatusPill>
                </div>
                <p className="text-sm leading-6 text-muted">{artifact.markdownContent}</p>
              </div>
              <div>
                <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  Type
                </p>
                <p className="mt-2 text-sm font-medium capitalize text-foreground">
                  {artifact.artifactType}
                </p>
              </div>
              <div>
                <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  Derived From
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {artifact.metadata.derivedFrom}
                </p>
                {artifact.metadata.originatingPrompt ? (
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Prompt: {artifact.metadata.originatingPrompt}
                  </p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </PageFrame>
  );
}
