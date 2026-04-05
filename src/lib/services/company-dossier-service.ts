import type {
  Artifact,
  Claim,
  CompanyDossier,
  DossierSectionReferences,
  DossierSectionSupportMap,
  ResearchEntity,
  RevisionConfidence,
  Source,
  Thesis,
  WikiPage,
  WikiPageRevision,
} from "@/lib/domain/types";
import { artifactsRepository } from "@/lib/repositories/artifacts-repository";
import { claimsRepository } from "@/lib/repositories/claims-repository";
import { companyDossiersRepository } from "@/lib/repositories/company-dossiers-repository";
import { contradictionsRepository } from "@/lib/repositories/contradictions-repository";
import { projectsRepository } from "@/lib/repositories/projects-repository";
import { sourcesRepository } from "@/lib/repositories/sources-repository";
import { thesesRepository } from "@/lib/repositories/theses-repository";
import { wikiRepository } from "@/lib/repositories/wiki-repository";
import { compileProjectEntities } from "@/lib/services/entity-intelligence-service";
import {
  completeOperationalJob,
  failOperationalJob,
  recordOperationalAuditEvent,
  startOperationalJob,
} from "@/lib/services/operational-history-service";
import {
  confidenceLabelFromScore,
  deriveConfidenceScore,
  safeRatio,
} from "@/lib/services/semantic-intelligence-v1";

type PageContext = {
  page: WikiPage;
  revision: WikiPageRevision | null;
  sourceIds: string[];
};

type DossierBullet = {
  text: string;
  references: DossierSectionReferences;
  score: number;
};

export type DossierSupportRecord = {
  pages: WikiPage[];
  claims: Claim[];
  sources: Source[];
  artifacts: Artifact[];
};

export type CompanyDossierDetailRecord = {
  dossier: CompanyDossier;
  supportBySection: {
    businessOverview: DossierSupportRecord;
    productsAndSegments: DossierSupportRecord;
    managementAndOperators: DossierSupportRecord;
    marketAndCompetition: DossierSupportRecord;
    keyMetricsAndFacts: DossierSupportRecord;
    sourceCoverageSummary: DossierSupportRecord;
  };
  readiness: {
    coveredSections: number;
    totalSections: number;
    sectionCoverageLabel: string;
  };
};

function emptyReferences(): DossierSectionReferences {
  return {
    wikiPageIds: [],
    claimIds: [],
    sourceIds: [],
    artifactIds: [],
  };
}

function mergeReferences(
  ...references: DossierSectionReferences[]
): DossierSectionReferences {
  return references.reduce<DossierSectionReferences>(
    (accumulator, refs) => ({
      wikiPageIds: Array.from(new Set([...accumulator.wikiPageIds, ...refs.wikiPageIds])),
      claimIds: Array.from(new Set([...accumulator.claimIds, ...refs.claimIds])),
      sourceIds: Array.from(new Set([...accumulator.sourceIds, ...refs.sourceIds])),
      artifactIds: Array.from(new Set([...accumulator.artifactIds, ...refs.artifactIds])),
    }),
    emptyReferences(),
  );
}

function confidenceRank(confidence: RevisionConfidence | null | undefined): number {
  if (confidence === "high") {
    return 3;
  }

  if (confidence === "medium") {
    return 2;
  }

  return 1;
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function previewText(value: string | null | undefined, length = 220): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return null;
  }

  return normalized.length > length
    ? `${normalized.slice(0, length).trimEnd()}...`
    : normalized;
}

function pageReferences(context: PageContext): DossierSectionReferences {
  return {
    wikiPageIds: [context.page.id],
    claimIds: [],
    sourceIds: context.sourceIds,
    artifactIds: [],
  };
}

function claimReferences(claim: Claim): DossierSectionReferences {
  return {
    wikiPageIds: [claim.wikiPageId],
    claimIds: [claim.id],
    sourceIds: claim.sourceId ? [claim.sourceId] : [],
    artifactIds: [],
  };
}

function artifactReferences(artifact: Artifact): DossierSectionReferences {
  return {
    wikiPageIds: artifact.referencedWikiPageIds,
    claimIds: artifact.referencedClaimIds,
    sourceIds: artifact.referencedSourceIds,
    artifactIds: [artifact.id],
  };
}

function entityReferences(entity: ResearchEntity): DossierSectionReferences {
  return {
    wikiPageIds: entity.relatedWikiPageIds,
    claimIds: entity.relatedClaimIds,
    sourceIds: entity.relatedSourceIds,
    artifactIds: [],
  };
}

function chooseTopBullets(bullets: DossierBullet[], limit: number): DossierBullet[] {
  return [...bullets]
    .sort((left, right) => right.score - left.score || left.text.localeCompare(right.text))
    .slice(0, limit);
}

function renderSectionMarkdown(
  title: string,
  bullets: DossierBullet[],
  fallback: string,
): string {
  if (bullets.length === 0) {
    return `# ${title}\n\n- ${fallback}`;
  }

  return `# ${title}\n\n${bullets.map((bullet) => `- ${bullet.text}`).join("\n")}`;
}

async function buildPageContexts(projectId: string): Promise<PageContext[]> {
  const pages = await wikiRepository.listPagesByProjectId(projectId);

  return Promise.all(
    pages.map(async (page) => {
      const [revision, sourceIds] = await Promise.all([
        wikiRepository.getCurrentRevision(page.id),
        wikiRepository.listSourceIdsForPage(page.id),
      ]);

      return { page, revision, sourceIds };
    }),
  );
}

function detectCompanyName(
  projectName: string,
  sources: Source[],
  entities: ResearchEntity[],
): string {
  const entityName = entities.find((entity) => entity.entityType === "company")?.canonicalName;
  if (entityName) {
    return entityName;
  }

  const issuer = sources.find((source) => source.metadata.issuer)?.metadata.issuer;
  return issuer ?? projectName;
}

function detectTicker(sources: Source[], entities: ResearchEntity[]): string | null {
  const entityTicker = entities.find((entity) => entity.entityType === "company")?.aliases.find(
    (alias) => /^[A-Z]{1,6}$/.test(alias.toUpperCase()),
  );
  if (entityTicker) {
    return entityTicker.toUpperCase();
  }

  for (const source of sources) {
    const ticker = source.metadata.ticker ?? source.metadata.symbol ?? null;
    if (ticker) {
      return ticker.toUpperCase();
    }
  }

  return null;
}

function buildEntityBullets(
  entities: ResearchEntity[],
  entityTypes: ResearchEntity["entityType"][],
  baseScore: number,
): DossierBullet[] {
  return entities
    .filter((entity) => entityTypes.includes(entity.entityType))
    .map<DossierBullet>((entity) => ({
      text: `${entity.canonicalName}: ${entity.description}`,
      references: entityReferences(entity),
      score: baseScore + confidenceRank(entity.confidence),
    }));
}

function detectSector(
  projectDomain: string,
  sources: Source[],
  claims: Claim[],
): string | null {
  const fromSources =
    sources.find((source) => source.metadata.sector)?.metadata.sector ??
    sources.find((source) => source.metadata.theme)?.metadata.theme ??
    null;

  if (fromSources) {
    return fromSources;
  }

  const sectorClaim = claims.find((claim) =>
    normalizeText(claim.text).includes("market") ||
    normalizeText(claim.text).includes("industry") ||
    normalizeText(claim.text).includes("semiconductor"),
  );

  return sectorClaim ? previewText(sectorClaim.text, 80) : projectDomain;
}

function detectGeography(sources: Source[], claims: Claim[]): string | null {
  const fromSources =
    sources.find((source) => source.metadata.region)?.metadata.region ??
    sources.find((source) => source.metadata.geography)?.metadata.geography ??
    null;

  if (fromSources) {
    return fromSources;
  }

  const geographyClaim = claims.find((claim) =>
    /\b(north america|europe|global|asia|united states|mexico)\b/i.test(claim.text),
  );

  return geographyClaim ? previewText(geographyClaim.text, 90) : null;
}

function buildBusinessOverviewBullets(input: {
  pageContexts: PageContext[];
  claims: Claim[];
  thesis: Thesis | null;
  entities: ResearchEntity[];
}): DossierBullet[] {
  const pageBullets = input.pageContexts
    .filter((context) =>
      ["overview", "dossier", "investment-thesis"].includes(context.page.pageType),
    )
    .map<DossierBullet>((context) => ({
      text:
        context.revision?.summary ??
        previewText(context.revision?.markdownContent, 180) ??
        `${context.page.title} contributes core business context.`,
      references: pageReferences(context),
      score: 3 + confidenceRank(context.revision?.confidence),
    }));
  const claimBullets = input.claims
    .filter((claim) => claim.claimType === "summary")
    .map<DossierBullet>((claim) => ({
      text: claim.text,
      references: claimReferences(claim),
      score: 2 + confidenceRank(claim.confidence),
    }));
  const thesisBullets = input.thesis
    ? [
        {
          text: previewText(input.thesis.summary, 200) ?? input.thesis.summary,
          references: {
            wikiPageIds: input.thesis.supportBySection.summary.wikiPageIds,
            claimIds: input.thesis.supportBySection.summary.claimIds,
            sourceIds: input.thesis.supportBySection.summary.sourceIds,
            artifactIds: [],
          },
          score: 4 + confidenceRank(input.thesis.confidence),
        } satisfies DossierBullet,
      ]
    : [];

  const entityBullets = buildEntityBullets(input.entities, ["company"], 4);

  return chooseTopBullets(
    [...pageBullets, ...claimBullets, ...thesisBullets, ...entityBullets],
    4,
  );
}

function buildProductsBullets(input: {
  pageContexts: PageContext[];
  claims: Claim[];
  sources: Source[];
  artifacts: Artifact[];
  entities: ResearchEntity[];
}): DossierBullet[] {
  const pageBullets = input.pageContexts
    .filter((context) =>
      ["market-map", "dossier", "source-summary"].includes(context.page.pageType) ||
      /product|segment|module|platform|offering/i.test(context.page.title),
    )
    .map<DossierBullet>((context) => ({
      text:
        context.revision?.summary ??
        `${context.page.title} captures product or segment context.`,
      references: pageReferences(context),
      score: 2 + confidenceRank(context.revision?.confidence),
    }));
  const claimBullets = input.claims
    .filter((claim) => /product|segment|module|design win|offering|mix/i.test(claim.text))
    .map<DossierBullet>((claim) => ({
      text: claim.text,
      references: claimReferences(claim),
      score: 3 + confidenceRank(claim.confidence),
    }));
  const sourceBullets = input.sources
    .filter((source) => /product|pricing|competitor|investor day/i.test(source.title))
    .map<DossierBullet>((source) => ({
      text: previewText(source.body, 160) ?? `${source.title} contributes product coverage.`,
      references: {
        wikiPageIds: [],
        claimIds: [],
        sourceIds: [source.id],
        artifactIds: [],
      },
      score: 1,
    }));
  const artifactBullets = input.artifacts
    .filter((artifact) => /comparison|briefing|memo/i.test(artifact.title))
    .map<DossierBullet>((artifact) => ({
      text: `${artifact.title}: ${artifact.previewText}`,
      references: artifactReferences(artifact),
      score: 1,
    }));

  const entityBullets = buildEntityBullets(input.entities, ["product_or_segment"], 4);

  return chooseTopBullets(
    [...pageBullets, ...claimBullets, ...sourceBullets, ...artifactBullets, ...entityBullets],
    4,
  );
}

function buildManagementBullets(input: {
  pageContexts: PageContext[];
  claims: Claim[];
  sources: Source[];
  entities: ResearchEntity[];
}): DossierBullet[] {
  const pageBullets = input.pageContexts
    .filter((context) => /management|operator|team|leadership/i.test(context.page.title))
    .map<DossierBullet>((context) => ({
      text:
        context.revision?.summary ??
        `${context.page.title} contains leadership or operator context.`,
      references: pageReferences(context),
      score: 2 + confidenceRank(context.revision?.confidence),
    }));
  const claimBullets = input.claims
    .filter((claim) => /management|operator|leadership|discipline|execution/i.test(claim.text))
    .map<DossierBullet>((claim) => ({
      text: claim.text,
      references: claimReferences(claim),
      score: 3 + confidenceRank(claim.confidence),
    }));
  const sourceBullets = input.sources
    .filter((source) => /transcript|investor day|management/i.test(source.title))
    .map<DossierBullet>((source) => ({
      text: previewText(source.body, 160) ?? `${source.title} contributes management commentary.`,
      references: {
        wikiPageIds: [],
        claimIds: [],
        sourceIds: [source.id],
        artifactIds: [],
      },
      score: 1,
    }));

  const entityBullets = buildEntityBullets(input.entities, ["operator"], 4);

  return chooseTopBullets(
    [...pageBullets, ...claimBullets, ...sourceBullets, ...entityBullets],
    4,
  );
}

function buildMarketBullets(input: {
  pageContexts: PageContext[];
  claims: Claim[];
  sources: Source[];
  artifacts: Artifact[];
  entities: ResearchEntity[];
}): DossierBullet[] {
  const pageBullets = input.pageContexts
    .filter((context) =>
      ["market-map", "risk-register", "dossier"].includes(context.page.pageType) ||
      /market|competition|pricing|risk/i.test(context.page.title),
    )
    .map<DossierBullet>((context) => ({
      text:
        context.revision?.summary ??
        `${context.page.title} contributes market or competitive context.`,
      references: pageReferences(context),
      score: 3 + confidenceRank(context.revision?.confidence),
    }));
  const claimBullets = input.claims
    .filter((claim) => /market|competition|competitor|pricing|asp|capacity/i.test(claim.text))
    .map<DossierBullet>((claim) => ({
      text: claim.text,
      references: claimReferences(claim),
      score: 2 + confidenceRank(claim.confidence),
    }));
  const sourceBullets = input.sources
    .filter((source) => /pricing|industry|competitor|channel/i.test(source.title))
    .map<DossierBullet>((source) => ({
      text: previewText(source.body, 160) ?? `${source.title} contributes market coverage.`,
      references: {
        wikiPageIds: [],
        claimIds: [],
        sourceIds: [source.id],
        artifactIds: [],
      },
      score: 1,
    }));
  const artifactBullets = input.artifacts
    .filter((artifact) => /comparison|market|briefing/i.test(artifact.title))
    .map<DossierBullet>((artifact) => ({
      text: `${artifact.title}: ${artifact.previewText}`,
      references: artifactReferences(artifact),
      score: 1,
    }));

  const entityBullets = buildEntityBullets(
    input.entities,
    ["market_or_competitor", "risk_theme"],
    4,
  );

  return chooseTopBullets(
    [...pageBullets, ...claimBullets, ...sourceBullets, ...artifactBullets, ...entityBullets],
    4,
  );
}

function buildMetricsBullets(input: {
  claims: Claim[];
  sources: Source[];
  thesis: Thesis | null;
  entities: ResearchEntity[];
}): DossierBullet[] {
  const claimBullets = input.claims
    .filter((claim) => /\d|margin|backlog|pricing|count|confidence|risk/i.test(claim.text))
    .map<DossierBullet>((claim) => ({
      text: claim.text,
      references: claimReferences(claim),
      score: 3 + confidenceRank(claim.confidence),
    }));
  const sourceBullets = input.sources.map<DossierBullet>((source) => ({
    text: `${source.title}: status ${source.status}${source.metadata.period ? `, period ${source.metadata.period}` : ""}.`,
    references: {
      wikiPageIds: [],
      claimIds: [],
      sourceIds: [source.id],
      artifactIds: [],
    },
    score: 1,
  }));
  const thesisBullets = input.thesis
    ? [
        {
          text: `Current thesis stance is ${input.thesis.overallStance} with ${input.thesis.confidence} confidence.`,
          references: {
            wikiPageIds: input.thesis.supportBySection.summary.wikiPageIds,
            claimIds: input.thesis.supportBySection.summary.claimIds,
            sourceIds: input.thesis.supportBySection.summary.sourceIds,
            artifactIds: [],
          },
          score: 2,
        } satisfies DossierBullet,
      ]
    : [];

  const entityBullets = buildEntityBullets(input.entities, ["metric"], 4);

  return chooseTopBullets(
    [...claimBullets, ...sourceBullets, ...thesisBullets, ...entityBullets],
    5,
  );
}

function buildCoverageBullets(input: {
  pageContexts: PageContext[];
  claims: Claim[];
  sources: Source[];
  artifacts: Artifact[];
}): DossierBullet[] {
  const sourceStatusSummary = Object.entries(
    input.sources.reduce<Record<string, number>>((accumulator, source) => {
      accumulator[source.status] = (accumulator[source.status] ?? 0) + 1;
      return accumulator;
    }, {}),
  )
    .map(([status, count]) => `${status} ${count}`)
    .join(", ");

  return [
    {
      text: `Canonical coverage currently spans ${input.pageContexts.length} wiki page(s), ${input.claims.length} compiled claim(s), ${input.sources.length} source record(s), and ${input.artifacts.length} durable artifact(s).`,
      references: mergeReferences(
        ...input.pageContexts.slice(0, 3).map(pageReferences),
        ...input.claims.slice(0, 3).map(claimReferences),
        ...input.artifacts.slice(0, 2).map(artifactReferences),
      ),
      score: 5,
    },
    {
      text: `Compiled source statuses: ${sourceStatusSummary}.`,
      references: {
        wikiPageIds: [],
        claimIds: [],
        sourceIds: input.sources.map((source) => source.id),
        artifactIds: [],
      },
      score: 4,
    },
  ];
}

function supportRecordFromRefs(
  refs: DossierSectionReferences,
  lookup: {
    pagesById: Map<string, WikiPage>;
    claimsById: Map<string, Claim>;
    sourcesById: Map<string, Source>;
    artifactsById: Map<string, Artifact>;
  },
): DossierSupportRecord {
  return {
    pages: refs.wikiPageIds
      .map((id) => lookup.pagesById.get(id) ?? null)
      .filter((value): value is WikiPage => Boolean(value)),
    claims: refs.claimIds
      .map((id) => lookup.claimsById.get(id) ?? null)
      .filter((value): value is Claim => Boolean(value)),
    sources: refs.sourceIds
      .map((id) => lookup.sourcesById.get(id) ?? null)
      .filter((value): value is Source => Boolean(value)),
    artifacts: refs.artifactIds
      .map((id) => lookup.artifactsById.get(id) ?? null)
      .filter((value): value is Artifact => Boolean(value)),
  };
}

export async function compileProjectCompanyDossier(
  projectId: string,
): Promise<CompanyDossier> {
  const project = await projectsRepository.getById(projectId);

  if (!project) {
    throw new Error("Project is required to compile a company dossier.");
  }

  const job = await startOperationalJob({
    projectId,
    jobType: "refresh_dossier",
    targetObjectType: "dossier",
    targetObjectId: `dossier-${projectId}`,
    triggeredBy: "workspace-user",
    summary: "Dossier refresh started.",
  });

  try {
    const [pageContexts, claims, sources, artifacts, thesis, contradictions, entityCompileResult] =
      await Promise.all([
        buildPageContexts(projectId),
        claimsRepository.listByProjectId(projectId),
        sourcesRepository.listByProjectId(projectId),
        artifactsRepository.listByProjectId(projectId),
        thesesRepository.getByProjectId(projectId),
        contradictionsRepository.listByProjectId(projectId),
        compileProjectEntities(projectId),
      ]);
    const entities = entityCompileResult.entities;

    const companyName = detectCompanyName(project.name, sources, entities);
    const ticker = detectTicker(sources, entities);
    const sector = detectSector(project.domain, sources, claims);
    const geography = detectGeography(sources, claims);
    const businessOverviewBullets = buildBusinessOverviewBullets({
      pageContexts,
      claims,
      thesis,
      entities,
    });
    const productsBullets = buildProductsBullets({
      pageContexts,
      claims,
      sources,
      artifacts,
      entities,
    });
    const managementBullets = buildManagementBullets({
      pageContexts,
      claims,
      sources,
      entities,
    });
    const marketBullets = buildMarketBullets({
      pageContexts,
      claims,
      sources,
      artifacts,
      entities,
    });
    const metricsBullets = buildMetricsBullets({
      claims,
      sources,
      thesis,
      entities,
    });
    const coverageBullets = buildCoverageBullets({
      pageContexts,
      claims,
      sources,
      artifacts,
    });
    const supportBySection: DossierSectionSupportMap = {
      businessOverview: mergeReferences(
        ...businessOverviewBullets.map((bullet) => bullet.references),
      ),
      productsAndSegments: mergeReferences(
        ...productsBullets.map((bullet) => bullet.references),
      ),
      managementAndOperators: mergeReferences(
        ...managementBullets.map((bullet) => bullet.references),
      ),
      marketAndCompetition: mergeReferences(
        ...marketBullets.map((bullet) => bullet.references),
      ),
      keyMetricsAndFacts: mergeReferences(
        ...metricsBullets.map((bullet) => bullet.references),
      ),
      sourceCoverageSummary: mergeReferences(
        ...coverageBullets.map((bullet) => bullet.references),
      ),
    };
    const coveredSections = Object.values(supportBySection).filter(
      (refs) =>
        refs.wikiPageIds.length > 0 ||
        refs.claimIds.length > 0 ||
        refs.sourceIds.length > 0 ||
        refs.artifactIds.length > 0,
    ).length;
    const supportedClaimsCount = claims.filter(
      (claim) => claim.supportStatus === "supported",
    ).length;
    const sourceDiversityCount = new Set(
      Object.values(supportBySection).flatMap((refs) => refs.sourceIds),
    ).size;
    const openContradictions = contradictions.filter(
      (entry) => entry.status !== "resolved",
    ).length;
    const freshnessBurden = safeRatio(
      sources.filter((source) => source.status === "failed" || source.status === "pending")
        .length,
      sources.length,
    );
    const confidence: RevisionConfidence = confidenceLabelFromScore(
      deriveConfidenceScore({
        supportDensity: safeRatio(supportedClaimsCount, Math.max(claims.length, 1)),
        sourceDiversityCount,
        contradictionBurden: safeRatio(openContradictions, 4),
        freshnessBurden,
        precisionSupport: safeRatio(coveredSections, 6),
      }),
    );

    const dossier = await companyDossiersRepository.upsertForProject({
      projectId,
      companyName,
      ticker,
      sector,
      geography,
      status: pageContexts.length > 0 || claims.length > 0 ? "active" : "draft",
      businessOverviewMarkdown: renderSectionMarkdown(
        "Business Overview",
        businessOverviewBullets,
        "Core business description has not been strongly compiled yet.",
      ),
      productsAndSegmentsMarkdown: renderSectionMarkdown(
        "Products And Segments",
        productsBullets,
        "Products, segments, and commercial mix are still thinly covered.",
      ),
      managementAndOperatorsMarkdown: renderSectionMarkdown(
        "Management And Operators",
        managementBullets,
        "Leadership and operating posture remain lightly documented.",
      ),
      marketAndCompetitionMarkdown: renderSectionMarkdown(
        "Market And Competition",
        marketBullets,
        "Market structure and competition still need broader compiled coverage.",
      ),
      keyMetricsAndFactsMarkdown: renderSectionMarkdown(
        "Key Metrics And Facts",
        metricsBullets,
        "Key metrics and operating facts have not yet been densely compiled.",
      ),
      sourceCoverageSummaryMarkdown: renderSectionMarkdown(
        "Source Coverage Summary",
        coverageBullets,
        "Source coverage is still sparse and should be expanded before heavier diligence.",
      ),
      confidence,
      supportBySection,
      metadata: {
        coveredSections: String(coveredSections),
        totalSections: "6",
        sectionCoverageLabel: `${coveredSections}/6 sections supported`,
        supportedClaimCount: String(supportedClaimsCount),
        sourceDiversityCount: String(sourceDiversityCount),
        openContradictionCount: String(openContradictions),
        freshnessBurden: freshnessBurden.toFixed(2),
      },
    });

    const summary = `Dossier refresh compiled ${coveredSections}/6 supported section(s) for ${companyName} with ${confidence} confidence.`;
    await completeOperationalJob({
      jobId: job.id,
      summary,
      targetObjectId: dossier.id,
      metadata: {
        coveredSections: String(coveredSections),
        confidence,
        companyName,
      },
    });
    await recordOperationalAuditEvent({
      projectId,
      eventType: "dossier_refreshed",
      title: "Dossier refreshed",
      description: summary,
      relatedObjectType: "dossier",
      relatedObjectId: dossier.id,
      relatedJobId: job.id,
      metadata: {
        coveredSections: String(coveredSections),
        confidence,
      },
    });

    return dossier;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown dossier refresh failure.";
    await failOperationalJob(job.id, `Dossier refresh failed: ${message}`);
    await recordOperationalAuditEvent({
      projectId,
      eventType: "job_failed",
      title: "Dossier refresh failed",
      description: `Dossier refresh failed for ${project.name}: ${message}`,
      relatedObjectType: "dossier",
      relatedObjectId: `dossier-${projectId}`,
      relatedJobId: job.id,
      metadata: { jobType: "refresh_dossier" },
    });
    throw error;
  }
}

export async function getStoredProjectCompanyDossier(
  projectId: string,
): Promise<CompanyDossier | null> {
  return companyDossiersRepository.getByProjectId(projectId);
}

export async function getProjectCompanyDossierDetail(
  projectId: string,
): Promise<CompanyDossierDetailRecord | null> {
  const [dossier, pages, claims, sources, artifacts] = await Promise.all([
    companyDossiersRepository.getByProjectId(projectId),
    wikiRepository.listPagesByProjectId(projectId),
    claimsRepository.listByProjectId(projectId),
    sourcesRepository.listByProjectId(projectId),
    artifactsRepository.listByProjectId(projectId),
  ]);

  if (!dossier) {
    return null;
  }

  const lookup = {
    pagesById: new Map(pages.map((page) => [page.id, page] as const)),
    claimsById: new Map(claims.map((claim) => [claim.id, claim] as const)),
    sourcesById: new Map(sources.map((source) => [source.id, source] as const)),
    artifactsById: new Map(artifacts.map((artifact) => [artifact.id, artifact] as const)),
  };

  return {
    dossier,
    supportBySection: {
      businessOverview: supportRecordFromRefs(
        dossier.supportBySection.businessOverview,
        lookup,
      ),
      productsAndSegments: supportRecordFromRefs(
        dossier.supportBySection.productsAndSegments,
        lookup,
      ),
      managementAndOperators: supportRecordFromRefs(
        dossier.supportBySection.managementAndOperators,
        lookup,
      ),
      marketAndCompetition: supportRecordFromRefs(
        dossier.supportBySection.marketAndCompetition,
        lookup,
      ),
      keyMetricsAndFacts: supportRecordFromRefs(
        dossier.supportBySection.keyMetricsAndFacts,
        lookup,
      ),
      sourceCoverageSummary: supportRecordFromRefs(
        dossier.supportBySection.sourceCoverageSummary,
        lookup,
      ),
    },
    readiness: {
      coveredSections: Number(dossier.metadata?.coveredSections ?? "0"),
      totalSections: Number(dossier.metadata?.totalSections ?? "6"),
      sectionCoverageLabel:
        dossier.metadata?.sectionCoverageLabel ?? "0/6 sections supported",
    },
  };
}
