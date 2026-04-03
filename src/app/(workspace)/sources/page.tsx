import Link from "next/link";
import {
  MetricCard,
  PageFrame,
  SectionCard,
  StatusPill,
  type StatusTone,
} from "@/components/workspace/primitives";
import { createActiveProjectSourceAction } from "@/app/(workspace)/actions";
import { getActiveProjectId, getSourcesPageData } from "@/lib/services/workspace-service";

function statusTone(status: string): StatusTone {
  if (status === "compiled") {
    return "success";
  }

  if (status === "extracted" || status === "parsed") {
    return "accent";
  }

  if (status === "failed") {
    return "danger";
  }

  return "neutral";
}

export default async function SourcesPage() {
  const projectId = await getActiveProjectId();
  const data = await getSourcesPageData(projectId);

  if (!data) {
    throw new Error("Active project source data is unavailable.");
  }

  return (
    <PageFrame
      eyebrow="Raw Layer"
      title="Sources"
      description={`Sources are first-class research inputs with provenance, status, and future fragment-level evidence mapping. The current workspace is scoped to ${data.summary.project.name}.`}
      actions={
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/projects/${data.summary.project.id}`}
            className="rounded-full border border-border bg-background/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-background"
          >
            View Project
          </Link>
          <a
            href="#add-source"
            className="rounded-full border border-border-strong bg-foreground px-4 py-2 text-sm font-semibold text-background transition hover:bg-[#2b3135]"
          >
            Add Source
          </a>
        </div>
      }
    >
      <div className="grid gap-4 xl:grid-cols-3">
        {data.metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_1fr]">
        <SectionCard
          eyebrow="Ingestion"
          title="Add source"
          description="This first-pass flow creates real source records for the active project. Pasted text works end-to-end in memory; URL, markdown, and PDF entries can be recorded as placeholders for later parsing."
        >
          <form id="add-source" action={createActiveProjectSourceAction} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  Title
                </span>
                <input
                  name="title"
                  placeholder="Market Interview Transcript"
                  className="mt-2 w-full rounded-[1.15rem] border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition focus:border-border-strong"
                />
              </label>
              <label className="block">
                <span className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  Source Type
                </span>
                <select
                  name="sourceType"
                  defaultValue="text"
                  className="mt-2 w-full rounded-[1.15rem] border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition focus:border-border-strong"
                >
                  <option value="text">Pasted text</option>
                  <option value="url">URL placeholder</option>
                  <option value="markdown">Markdown placeholder</option>
                  <option value="pdf">PDF placeholder</option>
                </select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  URL
                </span>
                <input
                  name="url"
                  placeholder="https://example.com/source"
                  className="mt-2 w-full rounded-[1.15rem] border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition focus:border-border-strong"
                />
              </label>
              <label className="block">
                <span className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  Status
                </span>
                <select
                  name="status"
                  defaultValue="pending"
                  className="mt-2 w-full rounded-[1.15rem] border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition focus:border-border-strong"
                >
                  <option value="pending">Pending</option>
                  <option value="parsed">Parsed</option>
                  <option value="extracted">Extracted</option>
                  <option value="compiled">Compiled</option>
                  <option value="failed">Failed</option>
                </select>
              </label>
            </div>

            <label className="block">
              <span className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                Pasted Content Or Markdown Body
              </span>
              <textarea
                name="body"
                rows={7}
                placeholder="Paste text here. For URL, markdown, and PDF placeholder records this can remain empty."
                className="mt-2 w-full resize-y rounded-[1.15rem] border border-border bg-surface px-4 py-3 text-sm leading-7 text-foreground outline-none transition focus:border-border-strong"
              />
            </label>

            <label className="block">
              <span className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                File Path Placeholder
              </span>
              <input
                name="filePath"
                placeholder="research/notes/source.md"
                className="mt-2 w-full rounded-[1.15rem] border border-border bg-surface px-4 py-3 text-sm text-foreground outline-none transition focus:border-border-strong"
              />
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                className="rounded-full border border-border-strong bg-foreground px-4 py-2 text-sm font-semibold text-background transition hover:bg-[#2b3135]"
              >
                Create Source Record
              </button>
              <p className="text-sm leading-6 text-muted">
                Pasted text sources are fully supported now. Other types create durable placeholders for later parsing work.
              </p>
            </div>
          </form>
        </SectionCard>

        <SectionCard
          eyebrow="Lifecycle"
          title="Source status model"
          description="Statuses now reflect the intended source pipeline from raw intake through canonical compilation."
        >
          <div className="grid gap-3 md:grid-cols-2">
            {data.lifecycle.map((entry) => (
              <div
                key={entry.label}
                className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4"
              >
                <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  {entry.label}
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  {entry.value}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        eyebrow="Ingestion Queue"
        title="Current source library"
        description={`These source records belong to ${data.summary.project.name} and now carry first-pass fragment structure for later claim and evidence-link generation.`}
      >
        <div className="space-y-3">
          {data.sources.map((record) => (
            <div
              key={record.source.id}
              className="grid gap-3 rounded-2xl border border-border bg-surface-strong/75 px-4 py-4 lg:grid-cols-[minmax(0,1.3fr)_110px_110px_150px_110px]"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold tracking-tight text-foreground">
                    {record.source.title}
                  </h3>
                  <StatusPill tone={statusTone(record.source.status)}>
                    {record.source.status}
                  </StatusPill>
                </div>
                <p className="text-sm leading-6 text-muted">
                  {record.excerpt ?? "No parsed excerpt is available yet."}
                </p>
                {record.previewFragments.length > 0 ? (
                  <details className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-3">
                    <summary className="cursor-pointer text-sm font-medium text-foreground">
                      Preview fragments
                    </summary>
                    <div className="mt-3 space-y-3">
                      {record.previewFragments.map((fragment) => (
                        <div key={fragment.id} className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                              {fragment.fragmentType}
                            </span>
                            <span className="text-xs text-muted">
                              #{fragment.index + 1}
                            </span>
                          </div>
                          <p className="text-sm leading-6 text-muted">
                            {fragment.title ? `${fragment.title}: ` : ""}
                            {fragment.excerpt ?? fragment.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
              <div>
                <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  Kind
                </p>
                <p className="mt-2 text-sm font-medium capitalize text-foreground">
                  {record.source.sourceType}
                </p>
              </div>
              <div>
                <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  Fragments
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {record.fragmentCount}
                </p>
              </div>
              <div>
                <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  Provenance
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {record.source.provenance.label}
                </p>
              </div>
              <div>
                <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  Created
                </p>
                <p className="mt-2 text-sm font-medium text-foreground">
                  {new Intl.DateTimeFormat("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  }).format(new Date(record.source.createdAt))}
                </p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </PageFrame>
  );
}
