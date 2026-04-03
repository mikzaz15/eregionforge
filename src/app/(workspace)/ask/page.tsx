import Link from "next/link";
import {
  MetricCard,
  PageFrame,
  SectionCard,
  StatusPill,
  type StatusTone,
} from "@/components/workspace/primitives";
import { getActiveProjectId, getAskPageData, retrievalPolicy } from "@/lib/services/workspace-service";

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

export default async function AskPage() {
  const projectId = await getActiveProjectId();
  const data = await getAskPageData(projectId);

  if (!data) {
    throw new Error("Active project ask data is unavailable.");
  }

  return (
    <PageFrame
      eyebrow="Question Layer"
      title="Ask"
      description={`Ask mode is a disciplined query surface over compiled knowledge for ${data.summary.project.name}. It should feel like research operations, not an unbounded chat transcript.`}
      actions={
        <Link
          href={`/projects/${data.summary.project.id}`}
          className="rounded-full border border-border bg-background/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-background"
        >
          Project Detail
        </Link>
      }
    >
      <div className="grid gap-4 xl:grid-cols-3">
        {data.metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
        <SectionCard
          eyebrow="Query Design"
          title="Compiled-knowledge prompt"
          description="This shell now sits on top of explicit project, wiki, and artifact boundaries and leaves room for structured citations in later sprints."
        >
          <div className="rounded-[1.75rem] border border-border bg-background/70 p-4">
            <label
              htmlFor="ask-input"
              className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground"
            >
              Research question
            </label>
            <textarea
              id="ask-input"
              className="mt-3 min-h-40 w-full resize-none rounded-[1.35rem] border border-border bg-surface px-4 py-4 text-sm leading-7 text-foreground outline-none transition focus:border-border-strong"
              defaultValue="Which sprint order best supports a wiki-centered MVP, and what should be built immediately after the shell?"
            />
            <div className="mt-4 flex flex-wrap gap-3">
              <button className="rounded-full border border-border-strong bg-foreground px-4 py-2 text-sm font-semibold text-background transition hover:bg-[#2b3135]">
                Run Against Wiki
              </button>
              <button className="rounded-full border border-border bg-background/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-background">
                Save As Artifact
              </button>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          eyebrow="Retrieval Rules"
          title="Resolution order"
          description="The ask flow should respect the durable knowledge hierarchy."
        >
          <div className="space-y-3">
            {retrievalPolicy.map((item, index) => (
              <div
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
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        eyebrow="Project Context"
        title="Available canon and outputs"
        description="Ask mode should make the project context explicit before query execution starts."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-3">
            {data.wikiPages.map((entry) => (
              <div
                key={entry.page.id}
                className="grid gap-3 rounded-2xl border border-border bg-surface-strong/75 px-4 py-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold tracking-tight text-foreground">
                      {entry.page.title}
                    </h3>
                    <StatusPill tone={pageTone(entry.page.status)}>
                      {entry.page.status}
                    </StatusPill>
                  </div>
                  <p className="text-sm leading-6 text-muted">
                    {entry.currentRevision?.summary}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {data.artifacts.map((artifact) => (
            <div
              key={artifact.id}
              className="grid gap-3 rounded-2xl border border-border bg-surface-strong/75 px-4 py-4"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold tracking-tight text-foreground">
                    {artifact.title}
                  </h3>
                  <StatusPill tone={artifactTone(artifact.status)}>
                    {artifact.status}
                  </StatusPill>
                </div>
                <p className="text-sm leading-6 text-muted">{artifact.markdownContent}</p>
              </div>
              <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                {artifact.metadata.derivedFrom}
              </p>
            </div>
            ))}
          </div>
        </div>
      </SectionCard>
    </PageFrame>
  );
}
