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
import type { DossierSupportRecord } from "@/lib/services/company-dossier-service";
import type { DossierPageData } from "@/lib/services/workspace-service";

function confidenceTone(confidence: string | null): StatusTone {
  if (confidence === "high") {
    return "success";
  }

  if (confidence === "medium") {
    return "accent";
  }

  return "neutral";
}

function dossierStatusTone(status: string | null): StatusTone {
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

function formatDateTime(value: string | null): string {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function ReferencePanel({
  support,
}: Readonly<{
  support: DossierSupportRecord;
}>) {
  return (
    <div className="grid gap-3 lg:grid-cols-4">
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
          Artifacts
        </p>
        <div className="mt-3 space-y-2 text-sm leading-6">
          {support.artifacts.length > 0 ? (
            support.artifacts.map((artifact) => (
              <Link
                key={artifact.id}
                href={`/artifacts/${artifact.id}`}
                className="block text-foreground underline-offset-4 hover:underline"
              >
                {artifact.title}
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

export function DossierView({
  data,
  eyebrow,
  title,
  description,
  actions,
}: Readonly<{
  data: DossierPageData;
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}>) {
  const detail = data.dossier;
  const dossier = detail?.dossier ?? null;

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

      {dossier && detail ? (
        <>
          <SectionCard
            eyebrow="Overview"
            title={dossier.companyName}
            description="The dossier consolidates compiled business intelligence into a structured research view instead of a generic company profile."
          >
            <div className="flex flex-wrap gap-2">
              <StatusPill tone={dossierStatusTone(dossier.status)}>{dossier.status}</StatusPill>
              <StatusPill tone={confidenceTone(dossier.confidence)}>
                {dossier.confidence}
              </StatusPill>
              {dossier.ticker ? <StatusPill tone="neutral">{dossier.ticker}</StatusPill> : null}
              {dossier.sector ? <StatusPill tone="neutral">{dossier.sector}</StatusPill> : null}
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_320px]">
              <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4">
                <MarkdownDocument content={dossier.businessOverviewMarkdown} />
              </div>
              <div className="space-y-3">
                <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
                  <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                    Company posture
                  </p>
                  <p className="mt-3 text-sm leading-6 text-foreground">
                    Company: {dossier.companyName}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-foreground">
                    Geography: {dossier.geography ?? "Not set"}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-foreground">
                    Coverage: {detail.readiness.sectionCoverageLabel}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Last refreshed {formatDateTime(dossier.updatedAt)}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <ReferencePanel support={detail.supportBySection.businessOverview} />
            </div>
          </SectionCard>

          <div className="grid gap-4 xl:grid-cols-2">
            <SectionCard
              eyebrow="Products"
              title="Products and segments"
              description="This section compiles how the company is described commercially and operationally."
            >
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4">
                  <MarkdownDocument content={dossier.productsAndSegmentsMarkdown} />
                </div>
                <ReferencePanel support={detail.supportBySection.productsAndSegments} />
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Operators"
              title="Management and operators"
              description="Operating discipline, leadership, and execution signals are kept tied to explicit support."
            >
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4">
                  <MarkdownDocument content={dossier.managementAndOperatorsMarkdown} />
                </div>
                <ReferencePanel support={detail.supportBySection.managementAndOperators} />
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Market"
              title="Market and competition"
              description="Competitive position and market structure remain grounded in compiled claims, pages, sources, and artifacts."
            >
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4">
                  <MarkdownDocument content={dossier.marketAndCompetitionMarkdown} />
                </div>
                <ReferencePanel support={detail.supportBySection.marketAndCompetition} />
              </div>
            </SectionCard>

            <SectionCard
              eyebrow="Facts"
              title="Key metrics and facts"
              description="Metrics stay lightweight and research-oriented rather than turning into a live quote terminal."
            >
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4">
                  <MarkdownDocument content={dossier.keyMetricsAndFactsMarkdown} />
                </div>
                <ReferencePanel support={detail.supportBySection.keyMetricsAndFacts} />
              </div>
            </SectionCard>
          </div>

          <SectionCard
            eyebrow="Coverage"
            title="Source coverage summary"
            description="Coverage expresses how much durable supporting research currently sits behind the dossier."
          >
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4">
                <MarkdownDocument content={dossier.sourceCoverageSummaryMarkdown} />
              </div>
              <ReferencePanel support={detail.supportBySection.sourceCoverageSummary} />
            </div>
          </SectionCard>
        </>
      ) : (
        <SectionCard
          eyebrow="Dossier Compile"
          title="No dossier compiled yet"
          description="Generate the first dossier to turn current project knowledge into a structured research briefing."
        >
          <div className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4 text-sm leading-6 text-muted">
            No company dossier exists for this project yet. Use the compile action to synthesize business overview, products, operators, market context, key facts, and source coverage from the current compiled knowledge base.
          </div>
        </SectionCard>
      )}
    </PageFrame>
  );
}
