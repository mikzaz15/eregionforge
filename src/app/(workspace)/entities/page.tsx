import Link from "next/link";
import { compileActiveProjectEntitiesAction } from "@/app/(workspace)/actions";
import {
  MetricCard,
  PageFrame,
  SectionCard,
  StatusPill,
  type StatusTone,
} from "@/components/workspace/primitives";
import { getActiveProjectId, getEntitiesPageData } from "@/lib/services/workspace-service";

function entityTypeTone(entityType: string): StatusTone {
  if (entityType === "company" || entityType === "metric") {
    return "success";
  }

  if (entityType === "risk_theme" || entityType === "market_or_competitor") {
    return "accent";
  }

  return "neutral";
}

function confidenceTone(confidence: string): StatusTone {
  if (confidence === "high") {
    return "success";
  }

  if (confidence === "medium") {
    return "accent";
  }

  return "neutral";
}

function labelize(value: string): string {
  return value.replaceAll("_", " ");
}

function roleLabel(entryRole: string | undefined): string | null {
  if (!entryRole) {
    return null;
  }

  return entryRole.replaceAll("-", " ");
}

export default async function EntitiesPage() {
  const projectId = await getActiveProjectId();
  const data = await getEntitiesPageData(projectId);

  if (!data) {
    throw new Error("Active project entity data is unavailable.");
  }

  return (
    <PageFrame
      eyebrow="Entity Intelligence"
      title="Entities"
      description={`The entity layer compiles durable research subjects for ${data.summary.project.name} so dossier, thesis, catalysts, and contradictions can reason over company-specific structure rather than loose theme overlap alone.`}
      actions={
        <div className="flex flex-wrap gap-3">
          <form action={compileActiveProjectEntitiesAction}>
            <button className="action-button-primary">Refresh Entities</button>
          </form>
          <Link
            href={`/projects/${data.summary.project.id}`}
            className="action-button-secondary"
          >
            Open Command View
          </Link>
          <Link
            href="/dossier"
            className="action-button-secondary"
          >
            Open Dossier
          </Link>
          <Link
            href="/thesis"
            className="action-button-secondary"
          >
            Open Thesis
          </Link>
          <Link
            href="/catalysts"
            className="action-button-secondary"
          >
            Open Catalysts
          </Link>
        </div>
      }
    >
      <div className="grid gap-4 xl:grid-cols-4">
        {data.metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <SectionCard
        eyebrow="Compiled Objects"
        title="Focused research entities"
        description="This is a compact inspection view for the entity layer. It keeps provenance visible and shows where each entity now appears across the research stack."
      >
        <div className="space-y-3">
          {data.entities.map((entry) => (
            <article
              key={entry.entity.id}
              className="rounded-2xl border border-border bg-surface-strong/75 px-4 py-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold tracking-tight text-foreground">
                      {entry.entity.canonicalName}
                    </p>
                    <StatusPill tone={entityTypeTone(entry.entity.entityType)}>
                      {labelize(entry.entity.entityType)}
                    </StatusPill>
                    <StatusPill tone={confidenceTone(entry.entity.confidence)}>
                      {entry.entity.confidence}
                    </StatusPill>
                  </div>
                  {entry.entity.aliases.length > 0 ? (
                    <p className="text-sm leading-6 text-muted">
                      Aliases: {entry.entity.aliases.join(", ")}
                    </p>
                  ) : null}
                  {roleLabel(entry.entity.metadata?.role ?? entry.entity.entityType) ? (
                    <p className="text-sm leading-6 text-muted">
                      Role: {roleLabel(entry.entity.metadata?.role ?? entry.entity.entityType)}
                    </p>
                  ) : null}
                </div>
                <div className="text-right text-sm leading-6 text-muted">
                  <p>Claims: {entry.relatedClaims.length}</p>
                  <p>Sources: {entry.relatedSources.length}</p>
                  <p>Pages: {entry.relatedPages.length}</p>
                </div>
              </div>

              <p className="mt-4 text-sm leading-6 text-foreground">
                {entry.entity.description}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted">
                {entry.influenceSummary}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted">
                {entry.whereItMatters}
              </p>

              <div className="mt-4 grid gap-3 xl:grid-cols-2">
                <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
                  <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                    Supporting Objects
                  </p>
                  <div className="mt-3 space-y-2 text-sm leading-6">
                    {entry.relatedPages.map((page) => (
                      <Link
                        key={page.id}
                        href={`/wiki/${page.id}`}
                        className="block text-foreground underline-offset-4 hover:underline"
                      >
                        {page.title}
                      </Link>
                    ))}
                    {entry.relatedClaims.map((claim) => (
                      <Link
                        key={claim.id}
                        href={`/wiki/${claim.wikiPageId}#claim-${claim.id}`}
                        className="block text-foreground underline-offset-4 hover:underline"
                      >
                        {claim.text}
                      </Link>
                    ))}
                    {entry.relatedSources.map((source) => (
                      <Link
                        key={source.id}
                        href={`/sources#${source.id}`}
                        className="block text-foreground underline-offset-4 hover:underline"
                      >
                        {source.title}
                      </Link>
                    ))}
                    {entry.relatedPages.length === 0 &&
                    entry.relatedClaims.length === 0 &&
                    entry.relatedSources.length === 0 ? (
                      <p className="text-muted">No linked supporting objects are currently attached.</p>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-[rgba(255,255,255,0.42)] px-4 py-4">
                  <p className="mono-label text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                    Appearance Map
                  </p>
                  <div className="mt-3 space-y-2 text-sm leading-6 text-foreground">
                    <p>
                      Thesis:{" "}
                      {entry.appearances.thesisSections.length > 0
                        ? entry.appearances.thesisSections.join(", ")
                        : "Not directly referenced"}
                    </p>
                    <p>
                      Dossier:{" "}
                      {entry.appearances.dossierSections.length > 0
                        ? entry.appearances.dossierSections.join(", ")
                        : "Not directly referenced"}
                    </p>
                    <p>
                      Catalysts:{" "}
                      {entry.appearances.catalystLinks.length > 0
                        ? entry.appearances.catalystLinks.slice(0, 2).map((catalyst, index) => (
                            <span key={catalyst.id}>
                              {index > 0 ? " | " : null}
                              <Link
                                href={`/catalysts#${catalyst.id}`}
                                className="underline-offset-4 hover:underline"
                              >
                                {catalyst.title}
                              </Link>
                            </span>
                          ))
                        : "No linked catalyst yet"}
                    </p>
                    <p>
                      Contradictions:{" "}
                      {entry.appearances.contradictionLinks.length > 0
                        ? entry.appearances.contradictionLinks.slice(0, 2).map((contradiction, index) => (
                            <span key={contradiction.id}>
                              {index > 0 ? " | " : null}
                              <Link
                                href={`/contradictions#${contradiction.id}`}
                                className="underline-offset-4 hover:underline"
                              >
                                {contradiction.title}
                              </Link>
                            </span>
                          ))
                        : "No linked contradiction yet"}
                    </p>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>
    </PageFrame>
  );
}
