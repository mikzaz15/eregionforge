import Link from "next/link";
import { notFound } from "next/navigation";
import { MarkdownDocument } from "@/components/workspace/markdown-document";
import {
  PageFrame,
  SectionCard,
  StatusPill,
  type StatusTone,
} from "@/components/workspace/primitives";
import {
  getActiveProjectId,
  getWikiPageDetailData,
} from "@/lib/services/workspace-service";

function pageTone(status: string): StatusTone {
  if (status === "active") {
    return "success";
  }

  if (status === "draft") {
    return "accent";
  }

  return "neutral";
}

function claimTone(status: string): StatusTone {
  if (status === "supported") {
    return "success";
  }

  if (status === "weak-support") {
    return "accent";
  }

  if (status === "unresolved") {
    return "danger";
  }

  return "neutral";
}

export default async function WikiPageDetail({
  params,
}: Readonly<{
  params: Promise<{ pageId: string }>;
}>) {
  const { pageId } = await params;
  const projectId = await getActiveProjectId();
  const data = await getWikiPageDetailData(projectId, pageId);

  if (!data) {
    notFound();
  }

  return (
    <PageFrame
      eyebrow="Canonical Page"
      title={data.page.title}
      description={data.currentRevision?.summary ?? "No current revision summary is available for this page."}
      actions={
        <div className="flex flex-wrap gap-3">
          <Link
            href="/wiki"
            className="rounded-full border border-border bg-background/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-background"
          >
            Back To Wiki
          </Link>
          <StatusPill tone={pageTone(data.page.status)}>{data.page.status}</StatusPill>
          <StatusPill
            tone={data.page.generationMetadata?.generatedBy ? "success" : "neutral"}
          >
            {data.page.generationMetadata?.generatedBy ? "generated" : "seeded"}
          </StatusPill>
        </div>
      }
    >
      <div className="grid gap-4 xl:grid-cols-4">
        <SectionCard
          eyebrow="Page Type"
          title={data.page.pageType}
          description="Canonical type for routing, filtering, and future compile orchestration."
        >
          <p className="mono-label text-sm uppercase tracking-[0.24em] text-muted-foreground">
            {data.page.slug}
          </p>
        </SectionCard>
        <SectionCard
          eyebrow="Revisions"
          title={String(data.revisions.length)}
          description="Lightweight revision history is available below without full diffing."
        >
          <p className="text-sm leading-6 text-muted">
            Latest revision: {data.currentRevision?.createdAt
              ? new Intl.DateTimeFormat("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                }).format(new Date(data.currentRevision.createdAt))
              : "Not available"}
          </p>
        </SectionCard>
        <SectionCard
          eyebrow="Source Linkage"
          title={data.page.sourceId ? "Direct" : "Indirect"}
          description="Source-summary pages bind directly to one source; project-level pages may aggregate multiple sources."
        >
          <p className="text-sm leading-6 text-muted">
            {data.linkedSources.length} linked source record(s)
          </p>
          <p className="mt-2 text-sm leading-6 text-muted">
            {data.linkedSources.reduce((sum, source) => sum + source.fragmentCount, 0)} fragment(s) currently inform this page.
          </p>
          {data.linkedPagesFromSameSource.length > 1 ? (
            <p className="mt-2 text-sm leading-6 text-muted">
              {data.linkedPagesFromSameSource.length - 1} additional page(s) share this source linkage.
            </p>
          ) : null}
        </SectionCard>
        <SectionCard
          eyebrow="Generation"
          title={data.page.generationMetadata?.generatedBy ? "Compile generated" : "Seeded"}
          description="This indicates whether the page currently comes from the deterministic compiler or earlier seed data."
        >
          <p className="text-sm leading-6 text-muted">
            {data.page.generationMetadata?.pageRole ?? "No generation metadata attached."}
          </p>
          {data.page.generationMetadata?.fragmentCount ? (
            <p className="mt-2 text-sm leading-6 text-muted">
              Generated from {data.page.generationMetadata.fragmentCount} fragment(s).
            </p>
          ) : null}
          {data.page.generationMetadata?.claimCount ? (
            <p className="mt-2 text-sm leading-6 text-muted">
              Current trust layer contains {data.page.generationMetadata.claimCount} claim(s).
            </p>
          ) : null}
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <SectionCard
          eyebrow="Current Revision"
          title="Canonical markdown"
          description="The current page body is rendered directly from the latest wiki page revision."
        >
          {data.currentRevision ? (
            <MarkdownDocument content={data.currentRevision.markdownContent} />
          ) : (
            <p className="text-sm leading-6 text-muted">
              No current revision content is available for this page.
            </p>
          )}
        </SectionCard>

        <div className="space-y-4">
          <SectionCard
            eyebrow="Trust"
            title="Claims and evidence"
            description="This page now carries deterministic claims with fragment-level evidence links as a first-pass trust layer."
          >
            <div className="space-y-3">
              <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
                <div className="flex flex-wrap gap-4 text-sm text-muted">
                  <span>Supported: {data.supportSummary.supported}</span>
                  <span>Weak: {data.supportSummary.weakSupport}</span>
                  <span>Unresolved: {data.supportSummary.unresolved}</span>
                  <span>Evidence links: {data.supportSummary.evidenceLinks}</span>
                </div>
              </div>
              {data.claims.length > 0 ? (
                data.claims.map((entry) => (
                  <div
                    key={entry.claim.id}
                    id={`claim-${entry.claim.id}`}
                    className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill tone={claimTone(entry.claim.supportStatus)}>
                        {entry.claim.supportStatus}
                      </StatusPill>
                      <span className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                        {entry.claim.claimType}
                      </span>
                      <span className="text-xs text-muted">
                        {entry.evidenceLinks.length} evidence link(s)
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-foreground">
                      {entry.claim.text}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      Fragment refs: {entry.linkedFragments.length}. Confidence: {entry.claim.confidence ?? "not set"}.
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm leading-6 text-muted">
                  This page does not yet carry deterministic claims or evidence links.
                </p>
              )}
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="Linked Sources"
            title="Source records"
            description="These are the source records currently linked to this page."
          >
            <div className="space-y-3">
              {data.linkedSources.length > 0 ? (
                data.linkedSources.map((source) => (
                  <div
                    key={source.source.id}
                    className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4"
                  >
                    <p className="font-semibold tracking-tight text-foreground">
                      {source.source.title}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted">
                      {source.source.provenance.label}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted">
                      <span>Type: {source.source.sourceType}</span>
                      <span>Fragments: {source.fragmentCount}</span>
                      <span>Status: {source.source.status}</span>
                    </div>
                    {source.excerpt ? (
                      <p className="mt-3 text-sm leading-6 text-muted">
                        {source.excerpt}
                      </p>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-sm leading-6 text-muted">
                  This page currently has no direct source links.
                </p>
              )}
            </div>
          </SectionCard>

          <SectionCard
            eyebrow="Revision Ledger"
            title="Recent revisions"
            description="Simple revision history for review without diffing."
          >
            <div className="space-y-3">
              {data.revisions.map((revision) => (
                <div
                  key={revision.id}
                  className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold tracking-tight text-foreground">
                      {revision.changeNote ?? revision.id}
                    </p>
                    <span className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                      {revision.createdBy}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {new Intl.DateTimeFormat("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    }).format(new Date(revision.createdAt))}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {revision.summary}
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </PageFrame>
  );
}
