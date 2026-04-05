import Link from "next/link";
import { notFound } from "next/navigation";
import { MarkdownDocument } from "@/components/workspace/markdown-document";
import {
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
import { buildFragmentSnippet } from "@/lib/services/evidence-lineage-v3";
import {
  getActiveProjectId,
  getArtifactDetailPageData,
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

export default async function ArtifactDetailPage({
  params,
}: Readonly<{
  params: Promise<{ artifactId: string }>;
}>) {
  const { artifactId } = await params;
  const projectId = await getActiveProjectId();
  const data = await getArtifactDetailPageData(projectId, artifactId);

  if (!data) {
    notFound();
  }

  const artifact = data.artifact.artifact;

  return (
    <PageFrame
      eyebrow="Artifact"
      title={artifact.title}
      description={artifact.previewText}
      actions={
        <div className="flex flex-wrap gap-3">
          <Link
            href="/artifacts"
            className="rounded-full border border-border bg-background/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-background"
          >
            Back To Artifacts
          </Link>
          <StatusPill tone={artifactTone(artifact.status)}>{artifact.status}</StatusPill>
          <StatusPill tone={provenanceTone(artifact.provenance)}>
            {artifactProvenanceLabel(artifact.provenance)}
          </StatusPill>
        </div>
      }
    >
      <div className="grid gap-4 xl:grid-cols-4">
        <SectionCard
          eyebrow="Type"
          title={artifactTypeLabel(artifact.artifactType)}
          description="Artifact types express the durable output shape rather than a generic file category."
        >
          <p className="text-sm leading-6 text-muted">
            Created{" "}
            {new Intl.DateTimeFormat("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            }).format(new Date(artifact.createdAt))}
          </p>
        </SectionCard>
        <SectionCard
          eyebrow="Provenance"
          title={artifactProvenanceLabel(artifact.provenance)}
          description="Every artifact should explain how it entered the project memory."
        >
          <p className="text-sm leading-6 text-muted">
            {artifact.metadata.derivedFrom ?? "No derived-from label attached."}
          </p>
          {artifact.metadata.provenanceNote ? (
            <p className="mt-2 text-sm leading-6 text-muted">
              {artifact.metadata.provenanceNote}
            </p>
          ) : null}
          {artifact.metadata.lineageSummary ? (
            <p className="mt-2 text-sm leading-6 text-muted">
              {artifact.metadata.lineageSummary}
            </p>
          ) : null}
        </SectionCard>
        <SectionCard
          eyebrow="References"
          title={String(
            artifact.referencedWikiPageIds.length +
              artifact.referencedSourceIds.length +
              artifact.referencedClaimIds.length,
          )}
          description="Referenced knowledge objects keep the asset grounded in project context."
        >
          <p className="text-sm leading-6 text-muted">
            Pages {artifact.referencedWikiPageIds.length} · Claims {artifact.referencedClaimIds.length} · Sources {artifact.referencedSourceIds.length}
          </p>
          {data.artifact.evidenceHighlights.length > 0 ? (
            <p className="mt-2 text-sm leading-6 text-muted">
              Evidence fragments {data.artifact.evidenceHighlights.length}
            </p>
          ) : null}
        </SectionCard>
        <SectionCard
          eyebrow="Wiki Filing"
          title={artifact.eligibleForWikiFiling ? "Eligible" : "Not yet filed"}
          description="This is only a lightweight foundation for future filing into wiki pages or source inputs."
        >
          <form action={setArtifactWikiFilingEligibilityAction}>
            <input type="hidden" name="artifactId" value={artifact.id} />
            <input
              type="hidden"
              name="eligibleForWikiFiling"
              value={artifact.eligibleForWikiFiling ? "false" : "true"}
            />
            <input type="hidden" name="redirectTo" value={`/artifacts/${artifact.id}`} />
            <button className="rounded-full border border-border bg-background/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-background">
              {artifact.eligibleForWikiFiling
                ? "Remove Wiki Filing"
                : "Mark For Wiki Filing"}
            </button>
          </form>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.9fr]">
        <SectionCard
          eyebrow="Content"
          title="Artifact body"
          description="Artifacts remain markdown-native so they can be read, edited, and later filed back into project canon."
        >
          <MarkdownDocument content={artifact.markdownContent} />
        </SectionCard>

        <div className="space-y-4">
          {artifact.originatingPrompt ? (
            <SectionCard
              eyebrow="Originating Prompt"
              title="Ask lineage"
              description="When an artifact comes from Ask mode, the originating prompt remains attached."
            >
              <p className="text-sm leading-6 text-foreground">
                {artifact.originatingPrompt}
              </p>
              {data.artifact.askSession ? (
                <Link
                  href={`/ask?sessionId=${data.artifact.askSession.id}`}
                  className="mt-4 inline-flex rounded-full border border-border bg-background/70 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-background"
                >
                  Open Ask Session
                </Link>
              ) : null}
            </SectionCard>
          ) : null}

          <SectionCard
            eyebrow="References"
            title="Consulted objects"
            description="These references show what this asset points back to inside the project."
          >
            <div className="space-y-4">
              <div className="space-y-3">
                <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  Evidence
                </p>
                {data.artifact.evidenceHighlights.length > 0 ? (
                  data.artifact.evidenceHighlights.map((highlight) => (
                    <Link
                      key={highlight.fragment.id}
                      href={`/sources#${highlight.fragment.sourceId}`}
                      className="block rounded-2xl border border-border bg-surface-strong/75 px-4 py-4 transition hover:bg-background"
                    >
                      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {highlight.source?.title ?? "Source fragment"}
                      </p>
                      {highlight.claim ? (
                        <p className="mt-2 text-xs leading-5 text-muted">
                          Claim: {highlight.claim.text}
                        </p>
                      ) : null}
                      <p className="mt-3 text-sm leading-6 text-foreground">
                        {buildFragmentSnippet(highlight.fragment)}
                      </p>
                    </Link>
                  ))
                ) : (
                  <p className="text-sm leading-6 text-muted">No evidence fragments referenced.</p>
                )}
              </div>
              <div className="space-y-3">
                <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  Wiki Pages
                </p>
                {data.artifact.referencedPages.length > 0 ? (
                  data.artifact.referencedPages.map((page) => (
                    <Link
                      key={page.id}
                      href={`/wiki/${page.id}`}
                      className="block rounded-2xl border border-border bg-surface-strong/75 px-4 py-4 text-sm font-semibold text-foreground transition hover:bg-background"
                    >
                      {page.title}
                    </Link>
                  ))
                ) : (
                  <p className="text-sm leading-6 text-muted">No wiki pages referenced.</p>
                )}
              </div>
              <div className="space-y-3">
                <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  Claims
                </p>
                {data.artifact.referencedClaims.length > 0 ? (
                  data.artifact.referencedClaims.map((claim) => (
                    <div
                      key={claim.id}
                      className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4 text-sm leading-6 text-foreground"
                    >
                      {claim.text}
                    </div>
                  ))
                ) : (
                  <p className="text-sm leading-6 text-muted">No claims referenced.</p>
                )}
              </div>
              <div className="space-y-3">
                <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  Sources
                </p>
                {data.artifact.referencedSources.length > 0 ? (
                  data.artifact.referencedSources.map((source) => (
                    <Link
                      key={source.id}
                      href="/sources"
                      className="block rounded-2xl border border-border bg-surface-strong/75 px-4 py-4 text-sm font-semibold text-foreground transition hover:bg-background"
                    >
                      {source.title}
                    </Link>
                  ))
                ) : (
                  <p className="text-sm leading-6 text-muted">No sources referenced.</p>
                )}
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </PageFrame>
  );
}
