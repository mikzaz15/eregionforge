import type { ReactNode } from "react";
import Link from "next/link";
import { MarkdownDocument } from "@/components/workspace/markdown-document";
import {
  MetricCard,
  PageFrame,
  SectionCard,
  StatusPill,
  type StatusTone,
} from "@/components/workspace/primitives";
import type {
  ThesisPageData,
} from "@/lib/services/workspace-service";
import type { ThesisSupportRecord } from "@/lib/services/thesis-service";

function stanceTone(stance: string | null): StatusTone {
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

function confidenceTone(confidence: string | null): StatusTone {
  if (confidence === "high") {
    return "success";
  }

  if (confidence === "medium") {
    return "accent";
  }

  return "neutral";
}

function thesisStatusTone(status: string | null): StatusTone {
  if (status === "active") {
    return "success";
  }

  if (status === "stale") {
    return "danger";
  }

  if (status === "draft") {
    return "accent";
  }

  return "neutral";
}

function labelize(value: string | null): string {
  if (!value) {
    return "Not set";
  }

  return value.replace(/([A-Z])/g, " $1").replaceAll("-", " ");
}

function ReferencePanel({
  support,
}: Readonly<{
  support: ThesisSupportRecord;
}>) {
  return (
    <div className="grid gap-3 lg:grid-cols-5">
      <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
        <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          Pages
        </p>
        <div className="mt-3 space-y-2 text-sm leading-6">
          {support.pages.length > 0 ? (
            support.pages.map((page) => (
              <Link
                key={page.id}
                href={`/wiki/${page.id}`}
                className="block text-foreground underline-offset-4 hover:underline"
              >
                {page.title}
              </Link>
            ))
          ) : (
            <p className="text-muted">None linked</p>
          )}
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
        <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          Claims
        </p>
        <div className="mt-3 space-y-2 text-sm leading-6">
          {support.claims.length > 0 ? (
            support.claims.map((claim) => (
              <Link
                key={claim.id}
                href={`/wiki/${claim.wikiPageId}#claim-${claim.id}`}
                className="block text-foreground underline-offset-4 hover:underline"
              >
                {claim.text}
              </Link>
            ))
          ) : (
            <p className="text-muted">None linked</p>
          )}
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
        <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          Sources
        </p>
        <div className="mt-3 space-y-2 text-sm leading-6">
          {support.sources.length > 0 ? (
            support.sources.map((source) => (
              <Link
                key={source.id}
                href={`/sources#${source.id}`}
                className="block text-foreground underline-offset-4 hover:underline"
              >
                {source.title}
              </Link>
            ))
          ) : (
            <p className="text-muted">None linked</p>
          )}
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
        <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          Timeline
        </p>
        <div className="mt-3 space-y-2 text-sm leading-6">
          {support.timelineEvents.length > 0 ? (
            support.timelineEvents.map((event) => (
              <Link
                key={event.id}
                href={`/timeline#${event.id}`}
                className="block text-foreground underline-offset-4 hover:underline"
              >
                {event.title}
              </Link>
            ))
          ) : (
            <p className="text-muted">None linked</p>
          )}
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
        <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          Contradictions
        </p>
        <div className="mt-3 space-y-2 text-sm leading-6">
          {support.contradictions.length > 0 ? (
            support.contradictions.map((contradiction) => (
              <Link
                key={contradiction.id}
                href={`/contradictions#${contradiction.id}`}
                className="block text-foreground underline-offset-4 hover:underline"
              >
                {contradiction.title}
              </Link>
            ))
          ) : (
            <p className="text-muted">None linked</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function ThesisView({
  data,
  eyebrow,
  title,
  description,
  actions,
}: Readonly<{
  data: ThesisPageData;
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}>) {
  const thesisDetail = data.thesis;
  const thesis = thesisDetail?.thesis ?? null;
  const compiledThesis =
    thesis && thesisDetail
      ? {
          thesis,
          supportBySection: thesisDetail.supportBySection,
        }
      : null;

  return (
    <PageFrame
      eyebrow={eyebrow}
      title={title}
      description={description}
      actions={actions}
    >
      <div className="grid gap-4 xl:grid-cols-4">
        {data.metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      {compiledThesis ? (
        <>
          <SectionCard
            eyebrow="Overview"
            title={compiledThesis.thesis.title}
            description="The thesis is compiled from the project knowledge base rather than maintained as a detached investment memo."
          >
            <div className="flex flex-wrap gap-2">
              <StatusPill tone={thesisStatusTone(compiledThesis.thesis.status)}>{compiledThesis.thesis.status}</StatusPill>
              <StatusPill tone={stanceTone(compiledThesis.thesis.overallStance)}>
                {labelize(compiledThesis.thesis.overallStance)}
              </StatusPill>
              <StatusPill tone={confidenceTone(compiledThesis.thesis.confidence)}>
                {compiledThesis.thesis.confidence}
              </StatusPill>
              {compiledThesis.thesis.ticker ? <StatusPill tone="neutral">{compiledThesis.thesis.ticker}</StatusPill> : null}
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_280px]">
              <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4">
                <MarkdownDocument content={compiledThesis.thesis.summary} />
              </div>
              <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
                <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  Thesis posture
                </p>
                <p className="mt-3 text-sm leading-6 text-foreground">
                  Subject: {compiledThesis.thesis.subjectName}
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground">
                  Unresolved contradictions: {data.summary.unresolvedContradictionCount}
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground">
                  Catalyst count: {data.summary.thesisCatalystCount}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Last refreshed {new Intl.DateTimeFormat("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  }).format(new Date(compiledThesis.thesis.updatedAt))}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <ReferencePanel support={compiledThesis.supportBySection.summary} />
            </div>
          </SectionCard>

          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard
              eyebrow="Bull Case"
              title="Constructive case"
              description="These are the strongest compiled arguments currently supporting the thesis."
            >
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4">
                  <MarkdownDocument content={compiledThesis.thesis.bullCaseMarkdown} />
                </div>
                <ReferencePanel support={compiledThesis.supportBySection.bullCase} />
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Bear Case"
              title="Downside case"
              description="These are the strongest compiled arguments pushing against the thesis."
            >
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4">
                  <MarkdownDocument content={compiledThesis.thesis.bearCaseMarkdown} />
                </div>
                <ReferencePanel support={compiledThesis.supportBySection.bearCase} />
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Variant View"
              title="Alternative read"
              description="Variant view captures where contradictions, catalysts, or mixed signals could change the current stance."
            >
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4">
                  <MarkdownDocument content={compiledThesis.thesis.variantViewMarkdown} />
                </div>
                <ReferencePanel support={compiledThesis.supportBySection.variantView} />
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Risks"
              title="Key risks"
              description="Risks stay tied to explicit canon, chronology, and contradiction records."
            >
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4">
                  <MarkdownDocument content={compiledThesis.thesis.keyRisksMarkdown} />
                </div>
                <ReferencePanel support={compiledThesis.supportBySection.keyRisks} />
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Unknowns"
              title="Key unknowns"
              description="Unknowns represent unresolved research gaps rather than generic TODOs."
            >
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4">
                  <MarkdownDocument content={compiledThesis.thesis.keyUnknownsMarkdown} />
                </div>
                <ReferencePanel support={compiledThesis.supportBySection.keyUnknowns} />
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Catalysts"
              title="Catalyst summary"
              description="Catalysts are sourced from the compiled timeline and related supporting knowledge."
            >
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4">
                  <MarkdownDocument content={compiledThesis.thesis.catalystSummaryMarkdown} />
                </div>
                <ReferencePanel support={compiledThesis.supportBySection.catalystSummary} />
              </div>
            </SectionCard>
          </div>
        </>
      ) : (
        <SectionCard
          eyebrow="Thesis Compile"
          title="No thesis compiled yet"
          description="Generate the first-pass thesis to turn current project knowledge into a thesis workspace."
        >
          <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4 text-sm leading-6 text-muted">
            No thesis record exists for this project yet. Use the compile action to synthesize stance, risks, unknowns, catalysts, and supporting references from the current compiled knowledge base.
          </div>
        </SectionCard>
      )}
    </PageFrame>
  );
}
