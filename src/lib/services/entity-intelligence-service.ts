import type {
  Claim,
  CompanyDossier,
  DossierSectionReferences,
  EntityAnalysisState,
  EntityType,
  ResearchEntity,
  ResearchEntityDraft,
  RevisionConfidence,
  Source,
  Thesis,
  ThesisSectionReferences,
  WikiPage,
  WikiPageRevision,
} from "@/lib/domain/types";
import { catalystsRepository } from "@/lib/repositories/catalysts-repository";
import { claimsRepository } from "@/lib/repositories/claims-repository";
import { companyDossiersRepository } from "@/lib/repositories/company-dossiers-repository";
import { contradictionsRepository } from "@/lib/repositories/contradictions-repository";
import { entitiesRepository } from "@/lib/repositories/entities-repository";
import { projectsRepository } from "@/lib/repositories/projects-repository";
import { sourcesRepository } from "@/lib/repositories/sources-repository";
import { thesesRepository } from "@/lib/repositories/theses-repository";
import { wikiRepository } from "@/lib/repositories/wiki-repository";
import {
  confidenceLabelFromScore,
  deriveConfidenceScore,
  detectSemanticThemes,
  formatThemeLabel,
  normalizeSemanticText,
  safeRatio,
} from "@/lib/services/semantic-intelligence-v1";

type PageContext = {
  page: WikiPage;
  revision: WikiPageRevision | null;
};

type EntityAccumulator = {
  stableKey: string;
  projectId: string;
  entityType: EntityType;
  canonicalName: string;
  aliases: Set<string>;
  descriptions: string[];
  relatedSourceIds: Set<string>;
  relatedClaimIds: Set<string>;
  relatedWikiPageIds: Set<string>;
  supportWeight: number;
  sourceEvidenceWeight: number;
};

type EntityPageAppearance = {
  thesisSections: string[];
  dossierSections: string[];
  catalystTitles: string[];
  contradictionTitles: string[];
};

export type EntityReferenceRecord = {
  entity: ResearchEntity;
  relatedClaims: Claim[];
  relatedSources: Source[];
  relatedPages: WikiPage[];
  appearances: EntityPageAppearance;
};

export type EntitiesPageData = {
  entities: EntityReferenceRecord[];
  analysisState: EntityAnalysisState;
  summary: {
    totalEntities: number;
    companyCount: number;
    productCount: number;
    operatorCount: number;
    marketCount: number;
    metricCount: number;
    riskThemeCount: number;
  };
  metrics: Array<{ label: string; value: string; note: string }>;
};

type EntityMatch = {
  entity: ResearchEntity;
  score: number;
};

const sectionLabelMap = {
  summary: "Summary",
  bullCase: "Bull Case",
  bearCase: "Bear Case",
  variantView: "Variant View",
  keyRisks: "Key Risks",
  keyUnknowns: "Key Unknowns",
  catalystSummary: "Catalysts",
} as const;

function stableKey(...parts: Array<string | null | undefined>): string {
  return parts
    .filter((part): part is string => Boolean(part))
    .map((part) => part.toLowerCase().replace(/[^a-z0-9]+/g, "-"))
    .join("-");
}

function preview(value: string | null | undefined, length = 180): string {
  if (!value) {
    return "No supporting description is currently available.";
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > length
    ? `${normalized.slice(0, length).trimEnd()}...`
    : normalized;
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function normalizeAlias(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function sanitizeMetricName(value: string): string {
  return value
    .replace(/\babove\b.*$/i, "")
    .replace(/\bthrough\b.*$/i, "")
    .replace(/\bto\b.*$/i, "")
    .trim();
}

function buildPageContexts(projectId: string): Promise<PageContext[]> {
  return wikiRepository.listPagesByProjectId(projectId).then((pages) =>
    Promise.all(
      pages.map(async (page) => ({
        page,
        revision: await wikiRepository.getCurrentRevision(page.id),
      })),
    ),
  );
}

function extractBulletLines(markdown: string | null | undefined): string[] {
  if (!markdown) {
    return [];
  }

  return markdown
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.replace(/^-+\s*/, "").trim())
    .filter(Boolean);
}

function createAccumulator(input: {
  projectId: string;
  entityType: EntityType;
  canonicalName: string;
}): EntityAccumulator {
  return {
    stableKey: stableKey(input.projectId, input.entityType, input.canonicalName),
    projectId: input.projectId,
    entityType: input.entityType,
    canonicalName: input.canonicalName,
    aliases: new Set<string>(),
    descriptions: [],
    relatedSourceIds: new Set<string>(),
    relatedClaimIds: new Set<string>(),
    relatedWikiPageIds: new Set<string>(),
    supportWeight: 0,
    sourceEvidenceWeight: 0,
  };
}

function addEntitySupport(
  entities: Map<string, EntityAccumulator>,
  input: {
    projectId: string;
    entityType: EntityType;
    canonicalName: string;
    alias?: string | null;
    description?: string | null;
    sourceId?: string | null;
    claimId?: string | null;
    wikiPageId?: string | null;
    supportWeight?: number;
  },
) {
  const canonicalName = normalizeAlias(input.canonicalName);

  if (!canonicalName) {
    return;
  }

  const key = stableKey(input.projectId, input.entityType, canonicalName);
  const record = entities.get(key) ?? createAccumulator({
    projectId: input.projectId,
    entityType: input.entityType,
    canonicalName,
  });

  if (input.alias) {
    record.aliases.add(normalizeAlias(input.alias));
  }

  if (input.description) {
    record.descriptions.push(preview(input.description, 220));
  }

  if (input.sourceId) {
    record.relatedSourceIds.add(input.sourceId);
    record.sourceEvidenceWeight += 1;
  }

  if (input.claimId) {
    record.relatedClaimIds.add(input.claimId);
  }

  if (input.wikiPageId) {
    record.relatedWikiPageIds.add(input.wikiPageId);
  }

  record.supportWeight += input.supportWeight ?? 1;
  entities.set(key, record);
}

function registerCompanyEntity(
  entities: Map<string, EntityAccumulator>,
  projectId: string,
  name: string,
  alias: string | null,
  description: string | null,
  links: {
    sourceId?: string | null;
    claimId?: string | null;
    wikiPageId?: string | null;
  },
) {
  addEntitySupport(entities, {
    projectId,
    entityType: "company",
    canonicalName: name,
    alias,
    description,
    sourceId: links.sourceId,
    claimId: links.claimId,
    wikiPageId: links.wikiPageId,
    supportWeight: 3,
  });
}

function scanProductsAndSegments(
  entities: Map<string, EntityAccumulator>,
  input: {
    projectId: string;
    text: string;
    sourceId?: string | null;
    claimId?: string | null;
    wikiPageId?: string | null;
  },
) {
  const patterns = [
    /\bautomotive power modules?\b/gi,
    /\bev power modules?\b/gi,
    /\bindustrial sockets?\b/gi,
    /\bgen[- ]?\d+\s+platform\b/gi,
    /\bpower modules?\b/gi,
  ];

  for (const pattern of patterns) {
    for (const match of input.text.matchAll(pattern)) {
      const raw = normalizeAlias(match[0]);
      const canonicalName =
        raw.toLowerCase() === "ev power modules"
          ? "Automotive power modules"
          : titleCase(raw);

      addEntitySupport(entities, {
        projectId: input.projectId,
        entityType: "product_or_segment",
        canonicalName,
        alias: raw,
        description: input.text,
        sourceId: input.sourceId,
        claimId: input.claimId,
        wikiPageId: input.wikiPageId,
        supportWeight: /gen[- ]?\d+/i.test(raw) ? 3 : 2,
      });
    }
  }
}

function scanOperators(
  entities: Map<string, EntityAccumulator>,
  input: {
    projectId: string;
    text: string;
    sourceId?: string | null;
    claimId?: string | null;
    wikiPageId?: string | null;
  },
) {
  const patterns: Array<[RegExp, string]> = [
    [/\bmanagement team\b/gi, "Management team"],
    [/\bmanagement\b/gi, "Management team"],
    [/\bleadership\b/gi, "Leadership team"],
    [/\boperating discipline\b/gi, "Operating discipline"],
  ];

  for (const [pattern, canonicalName] of patterns) {
    if (pattern.test(input.text)) {
      addEntitySupport(entities, {
        projectId: input.projectId,
        entityType: "operator",
        canonicalName,
        description: input.text,
        sourceId: input.sourceId,
        claimId: input.claimId,
        wikiPageId: input.wikiPageId,
        supportWeight: 2,
      });
    }
  }
}

function scanMarketsAndCompetitors(
  entities: Map<string, EntityAccumulator>,
  input: {
    projectId: string;
    text: string;
    sourceId?: string | null;
    claimId?: string | null;
    wikiPageId?: string | null;
  },
) {
  const patterns: Array<[RegExp, string]> = [
    [/\bpower module vendors\b/gi, "Power module vendors"],
    [/\bcompetitor(?: set|s)?\b/gi, "Competitor set"],
    [/\bwide[- ]bandgap adoption\b/gi, "Wide-bandgap adoption"],
    [/\bautomotive market\b/gi, "Automotive market"],
    [/\bindustrial market\b/gi, "Industrial market"],
  ];

  for (const [pattern, canonicalName] of patterns) {
    if (pattern.test(input.text)) {
      addEntitySupport(entities, {
        projectId: input.projectId,
        entityType: "market_or_competitor",
        canonicalName,
        description: input.text,
        sourceId: input.sourceId,
        claimId: input.claimId,
        wikiPageId: input.wikiPageId,
        supportWeight: 2,
      });
    }
  }
}

function scanMetrics(
  entities: Map<string, EntityAccumulator>,
  input: {
    projectId: string;
    text: string;
    sourceId?: string | null;
    claimId?: string | null;
    wikiPageId?: string | null;
  },
) {
  const patterns: Array<[RegExp, string]> = [
    [/\bgross margin(?:\s+above\s+\d+(?:\.\d+)?%?)?/gi, "Gross margin"],
    [/\basp\b|\baverage selling price\b/gi, "ASP"],
    [/\bbacklog\b/gi, "Backlog"],
    [/\butilization\b/gi, "Utilization"],
    [/\bpricing discipline\b/gi, "Pricing discipline"],
  ];

  for (const [pattern, fallbackName] of patterns) {
    for (const match of input.text.matchAll(pattern)) {
      const raw = normalizeAlias(match[0]);
      const canonicalName =
        fallbackName === "Gross margin" ? sanitizeMetricName(raw) || "Gross margin" : fallbackName;

      addEntitySupport(entities, {
        projectId: input.projectId,
        entityType: "metric",
        canonicalName: titleCase(canonicalName),
        alias: raw,
        description: input.text,
        sourceId: input.sourceId,
        claimId: input.claimId,
        wikiPageId: input.wikiPageId,
        supportWeight: /\d/.test(raw) ? 3 : 2,
      });
    }
  }
}

function scanRiskThemes(
  entities: Map<string, EntityAccumulator>,
  input: {
    projectId: string;
    text: string;
    sourceId?: string | null;
    claimId?: string | null;
    wikiPageId?: string | null;
  },
) {
  const patterns: Array<[RegExp, string]> = [
    [/\bpricing pressure\b|\bpricing durability\b/gi, "Pricing pressure"],
    [/\basp compression\b/gi, "ASP compression"],
    [/\bbacklog normalization\b/gi, "Backlog normalization"],
    [/\bexecution risk\b/gi, "Execution risk"],
    [/\bmargin delay\b|\bslower margin bridge\b/gi, "Margin timing risk"],
    [/\bregulatory delay\b/gi, "Regulatory delay"],
  ];

  for (const [pattern, canonicalName] of patterns) {
    if (pattern.test(input.text)) {
      addEntitySupport(entities, {
        projectId: input.projectId,
        entityType: "risk_theme",
        canonicalName,
        description: input.text,
        sourceId: input.sourceId,
        claimId: input.claimId,
        wikiPageId: input.wikiPageId,
        supportWeight: 2,
      });
    }
  }

  for (const theme of detectSemanticThemes(input.text)) {
    if (["pricing", "margin", "timing", "guidance", "customer", "regulatory"].includes(theme)) {
      addEntitySupport(entities, {
        projectId: input.projectId,
        entityType: "risk_theme",
        canonicalName: `${titleCase(formatThemeLabel(theme))} risk`,
        description: input.text,
        sourceId: input.sourceId,
        claimId: input.claimId,
        wikiPageId: input.wikiPageId,
        supportWeight: 1,
      });
    }
  }
}

function buildConfidence(input: EntityAccumulator): RevisionConfidence {
  return confidenceLabelFromScore(
    deriveConfidenceScore({
      supportDensity: Math.min(input.supportWeight / 5, 1),
      sourceDiversityCount: input.relatedSourceIds.size,
      contradictionBurden: 0,
      freshnessBurden: 0,
      precisionSupport: safeRatio(
        input.relatedClaimIds.size + input.relatedWikiPageIds.size,
        Math.max(input.relatedSourceIds.size + input.relatedClaimIds.size + input.relatedWikiPageIds.size, 1),
      ),
    }),
  );
}

function descriptionForEntity(record: EntityAccumulator): string {
  return (
    record.descriptions
      .sort((left, right) => right.length - left.length)[0] ??
    `${record.canonicalName} is currently tracked as a ${record.entityType.replaceAll("_", " ")} in the compiled research graph.`
  );
}

function finalizeEntities(
  projectId: string,
  entities: Map<string, EntityAccumulator>,
): ResearchEntityDraft[] {
  return Array.from(entities.values())
    .filter((record) => {
      if (record.entityType === "company") {
        return true;
      }

      return (
        record.relatedClaimIds.size +
          record.relatedSourceIds.size +
          record.relatedWikiPageIds.size >=
        2
      );
    })
    .map((record) => ({
      stableKey: record.stableKey,
      projectId,
      entityType: record.entityType,
      canonicalName: record.canonicalName,
      aliases: Array.from(record.aliases).filter(
        (alias) => normalizeAlias(alias).toLowerCase() !== record.canonicalName.toLowerCase(),
      ),
      description: descriptionForEntity(record),
      confidence: buildConfidence(record),
      relatedSourceIds: Array.from(record.relatedSourceIds),
      relatedClaimIds: Array.from(record.relatedClaimIds),
      relatedWikiPageIds: Array.from(record.relatedWikiPageIds),
      metadata: {
        supportWeight: String(record.supportWeight),
        sourceEvidenceWeight: String(record.sourceEvidenceWeight),
      },
    }))
    .sort(
      (left, right) =>
        left.entityType.localeCompare(right.entityType) ||
        left.canonicalName.localeCompare(right.canonicalName),
    );
}

function buildEntitySummary(entities: ResearchEntityDraft[]): string {
  const counts = {
    company: entities.filter((entity) => entity.entityType === "company").length,
    product: entities.filter((entity) => entity.entityType === "product_or_segment").length,
    operator: entities.filter((entity) => entity.entityType === "operator").length,
    market: entities.filter((entity) => entity.entityType === "market_or_competitor").length,
    metric: entities.filter((entity) => entity.entityType === "metric").length,
    risk: entities.filter((entity) => entity.entityType === "risk_theme").length,
  };

  return `Compiled ${entities.length} entity record(s): ${counts.company} company, ${counts.product} product or segment, ${counts.operator} operator, ${counts.market} market or competitor, ${counts.metric} metric, and ${counts.risk} risk-theme entity(ies).`;
}

export async function compileProjectEntities(projectId: string) {
  const project = await projectsRepository.getById(projectId);

  if (!project) {
    throw new Error("Project is required to compile entities.");
  }

  const [sources, claims, pageContexts, thesis, dossier] = await Promise.all([
    sourcesRepository.listByProjectId(projectId),
    claimsRepository.listByProjectId(projectId),
    buildPageContexts(projectId),
    thesesRepository.getByProjectId(projectId),
    companyDossiersRepository.getByProjectId(projectId),
  ]);
  const entities = new Map<string, EntityAccumulator>();

  for (const source of sources) {
    if (source.metadata.issuer) {
      registerCompanyEntity(
        entities,
        projectId,
        source.metadata.issuer === "Northstar Semi"
          ? "Northstar Semiconductor"
          : source.metadata.issuer,
        source.metadata.issuer,
        source.body,
        { sourceId: source.id },
      );
    }

    const text = `${source.title} ${source.body ?? ""}`;
    scanProductsAndSegments(entities, { projectId, text, sourceId: source.id });
    scanOperators(entities, { projectId, text, sourceId: source.id });
    scanMarketsAndCompetitors(entities, { projectId, text, sourceId: source.id });
    scanMetrics(entities, { projectId, text, sourceId: source.id });
    scanRiskThemes(entities, { projectId, text, sourceId: source.id });
  }

  for (const claim of claims) {
    scanProductsAndSegments(entities, {
      projectId,
      text: claim.text,
      sourceId: claim.sourceId,
      claimId: claim.id,
      wikiPageId: claim.wikiPageId,
    });
    scanOperators(entities, {
      projectId,
      text: claim.text,
      sourceId: claim.sourceId,
      claimId: claim.id,
      wikiPageId: claim.wikiPageId,
    });
    scanMarketsAndCompetitors(entities, {
      projectId,
      text: claim.text,
      sourceId: claim.sourceId,
      claimId: claim.id,
      wikiPageId: claim.wikiPageId,
    });
    scanMetrics(entities, {
      projectId,
      text: claim.text,
      sourceId: claim.sourceId,
      claimId: claim.id,
      wikiPageId: claim.wikiPageId,
    });
    scanRiskThemes(entities, {
      projectId,
      text: claim.text,
      sourceId: claim.sourceId,
      claimId: claim.id,
      wikiPageId: claim.wikiPageId,
    });
  }

  for (const context of pageContexts) {
    const text = `${context.page.title} ${context.revision?.summary ?? ""} ${context.revision?.markdownContent ?? ""}`;
    scanProductsAndSegments(entities, {
      projectId,
      text,
      wikiPageId: context.page.id,
      sourceId: context.page.sourceId,
    });
    scanOperators(entities, {
      projectId,
      text,
      wikiPageId: context.page.id,
      sourceId: context.page.sourceId,
    });
    scanMarketsAndCompetitors(entities, {
      projectId,
      text,
      wikiPageId: context.page.id,
      sourceId: context.page.sourceId,
    });
    scanMetrics(entities, {
      projectId,
      text,
      wikiPageId: context.page.id,
      sourceId: context.page.sourceId,
    });
    scanRiskThemes(entities, {
      projectId,
      text,
      wikiPageId: context.page.id,
      sourceId: context.page.sourceId,
    });
  }

  if (thesis) {
    registerCompanyEntity(
      entities,
      projectId,
      thesis.subjectName,
      thesis.ticker,
      thesis.summary,
      {
        sourceId: thesis.supportBySection.summary.sourceIds[0] ?? null,
        claimId: thesis.supportBySection.summary.claimIds[0] ?? null,
        wikiPageId: thesis.supportBySection.summary.wikiPageIds[0] ?? null,
      },
    );
    for (const line of [
      ...extractBulletLines(thesis.bullCaseMarkdown),
      ...extractBulletLines(thesis.bearCaseMarkdown),
      ...extractBulletLines(thesis.variantViewMarkdown),
      ...extractBulletLines(thesis.keyRisksMarkdown),
      ...extractBulletLines(thesis.catalystSummaryMarkdown),
    ]) {
      scanProductsAndSegments(entities, { projectId, text: line });
      scanOperators(entities, { projectId, text: line });
      scanMarketsAndCompetitors(entities, { projectId, text: line });
      scanMetrics(entities, { projectId, text: line });
      scanRiskThemes(entities, { projectId, text: line });
    }
  }

  if (dossier) {
    registerCompanyEntity(
      entities,
      projectId,
      dossier.companyName,
      dossier.ticker,
      dossier.businessOverviewMarkdown,
      {
        sourceId: dossier.supportBySection.businessOverview.sourceIds[0] ?? null,
        claimId: dossier.supportBySection.businessOverview.claimIds[0] ?? null,
        wikiPageId: dossier.supportBySection.businessOverview.wikiPageIds[0] ?? null,
      },
    );
    for (const line of [
      ...extractBulletLines(dossier.businessOverviewMarkdown),
      ...extractBulletLines(dossier.productsAndSegmentsMarkdown),
      ...extractBulletLines(dossier.managementAndOperatorsMarkdown),
      ...extractBulletLines(dossier.marketAndCompetitionMarkdown),
      ...extractBulletLines(dossier.keyMetricsAndFactsMarkdown),
    ]) {
      scanProductsAndSegments(entities, { projectId, text: line });
      scanOperators(entities, { projectId, text: line });
      scanMarketsAndCompetitors(entities, { projectId, text: line });
      scanMetrics(entities, { projectId, text: line });
      scanRiskThemes(entities, { projectId, text: line });
    }
  }

  const drafts = finalizeEntities(projectId, entities);
  return entitiesRepository.syncProjectEntities(projectId, drafts, buildEntitySummary(drafts));
}

export async function listProjectEntities(projectId: string): Promise<ResearchEntity[]> {
  return entitiesRepository.listByProjectId(projectId);
}

export async function getProjectEntitySnapshot(projectId: string): Promise<{
  entities: ResearchEntity[];
  analysisState: EntityAnalysisState;
}> {
  const [entities, analysisState] = await Promise.all([
    entitiesRepository.listByProjectId(projectId),
    entitiesRepository.getAnalysisState(projectId),
  ]);

  return { entities, analysisState };
}

export function matchEntitiesToText(
  entities: ResearchEntity[],
  text: string,
  entityTypes?: EntityType[],
): ResearchEntity[] {
  const normalizedText = normalizeSemanticText(text);

  const matches = entities
    .filter((entity) => !entityTypes || entityTypes.includes(entity.entityType))
    .map<EntityMatch | null>((entity) => {
      const needles = [entity.canonicalName, ...entity.aliases]
        .map((value) => normalizeSemanticText(value))
        .filter(Boolean);
      const hits = needles.filter((needle) => normalizedText.includes(needle)).length;

      if (hits === 0) {
        return null;
      }

      return {
        entity,
        score: hits + entity.aliases.length * 0.1,
      };
    })
    .filter((match): match is EntityMatch => Boolean(match))
    .sort((left, right) => right.score - left.score || left.entity.canonicalName.localeCompare(right.entity.canonicalName));

  return matches.map((match) => match.entity);
}

function sectionAppearancesFromEntity(
  entity: ResearchEntity,
  thesis: Thesis | null,
  dossier: CompanyDossier | null,
): { thesisSections: string[]; dossierSections: string[] } {
  const thesisSections = thesis
    ? Object.entries(thesis.supportBySection)
        .filter(([, refs]) => {
          const typedRefs = refs as ThesisSectionReferences;

          return (
            typedRefs.claimIds.some((id: string) => entity.relatedClaimIds.includes(id)) ||
            typedRefs.sourceIds.some((id: string) => entity.relatedSourceIds.includes(id)) ||
            typedRefs.wikiPageIds.some((id: string) => entity.relatedWikiPageIds.includes(id))
          );
        })
        .map(([key]) => sectionLabelMap[key as keyof typeof sectionLabelMap])
    : [];
  const dossierSections = dossier
    ? Object.entries(dossier.supportBySection)
        .filter(([, refs]) => {
          const typedRefs = refs as DossierSectionReferences;

          return (
            typedRefs.claimIds.some((id: string) => entity.relatedClaimIds.includes(id)) ||
            typedRefs.sourceIds.some((id: string) => entity.relatedSourceIds.includes(id)) ||
            typedRefs.wikiPageIds.some((id: string) => entity.relatedWikiPageIds.includes(id))
          );
        })
        .map(([key]) => titleCase(key.replace(/([A-Z])/g, " $1")))
    : [];

  return { thesisSections, dossierSections };
}

export async function getProjectEntitiesPageData(
  projectId: string,
): Promise<EntitiesPageData> {
  const [snapshot, claims, sources, pages, thesis, dossier, catalysts, contradictions] =
    await Promise.all([
      getProjectEntitySnapshot(projectId),
      claimsRepository.listByProjectId(projectId),
      sourcesRepository.listByProjectId(projectId),
      wikiRepository.listPagesByProjectId(projectId),
      thesesRepository.getByProjectId(projectId),
      companyDossiersRepository.getByProjectId(projectId),
      catalystsRepository.listByProjectId(projectId),
      contradictionsRepository.listByProjectId(projectId),
    ]);
  const claimsById = new Map(claims.map((claim) => [claim.id, claim] as const));
  const sourcesById = new Map(sources.map((source) => [source.id, source] as const));
  const pagesById = new Map(pages.map((page) => [page.id, page] as const));
  const entities = snapshot.entities.map((entity) => {
    const relatedClaims = entity.relatedClaimIds
      .map((id) => claimsById.get(id) ?? null)
      .filter((value): value is Claim => Boolean(value));
    const relatedSources = entity.relatedSourceIds
      .map((id) => sourcesById.get(id) ?? null)
      .filter((value): value is Source => Boolean(value));
    const relatedPages = entity.relatedWikiPageIds
      .map((id) => pagesById.get(id) ?? null)
      .filter((value): value is WikiPage => Boolean(value));
    const appearances = sectionAppearancesFromEntity(entity, thesis, dossier);

    return {
      entity,
      relatedClaims,
      relatedSources,
      relatedPages,
      appearances: {
        ...appearances,
        catalystTitles: catalysts
          .filter(
            (catalyst) =>
              catalyst.linkedClaimIds.some((id) => entity.relatedClaimIds.includes(id)) ||
              catalyst.linkedSourceIds.some((id) => entity.relatedSourceIds.includes(id)),
          )
          .map((catalyst) => catalyst.title),
        contradictionTitles: contradictions
          .filter(
            (contradiction) =>
              contradiction.relatedSourceIds.some((id) => entity.relatedSourceIds.includes(id)) ||
              contradiction.relatedPageIds.some((id) => entity.relatedWikiPageIds.includes(id)) ||
              [contradiction.leftClaimId ?? null, contradiction.rightClaimId ?? null].some(
                (id) => id && entity.relatedClaimIds.includes(id),
              ),
          )
          .map((contradiction) => contradiction.title),
      },
    };
  });

  return {
    entities,
    analysisState: snapshot.analysisState,
    summary: {
      totalEntities: entities.length,
      companyCount: entities.filter((entry) => entry.entity.entityType === "company").length,
      productCount: entities.filter((entry) => entry.entity.entityType === "product_or_segment").length,
      operatorCount: entities.filter((entry) => entry.entity.entityType === "operator").length,
      marketCount: entities.filter((entry) => entry.entity.entityType === "market_or_competitor").length,
      metricCount: entities.filter((entry) => entry.entity.entityType === "metric").length,
      riskThemeCount: entities.filter((entry) => entry.entity.entityType === "risk_theme").length,
    },
    metrics: [
      {
        label: "Entities",
        value: String(entities.length),
        note: "Entities turn repeated research subjects into durable intelligence objects rather than loose text fragments.",
      },
      {
        label: "Products",
        value: String(entities.filter((entry) => entry.entity.entityType === "product_or_segment").length),
        note: "Product and segment entities help make thesis, dossier, and catalyst outputs more specific.",
      },
      {
        label: "Risk Themes",
        value: String(entities.filter((entry) => entry.entity.entityType === "risk_theme").length),
        note: "Risk-theme entities connect contradiction posture, stale alerts, and underwriting downside more explicitly.",
      },
      {
        label: "Last Compile",
        value: snapshot.analysisState.lastCompiledAt
          ? new Intl.DateTimeFormat("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            }).format(new Date(snapshot.analysisState.lastCompiledAt))
          : "Not compiled",
        note: snapshot.analysisState.summary,
      },
    ],
  };
}
