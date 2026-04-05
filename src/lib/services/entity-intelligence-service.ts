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
  completeOperationalJob,
  failOperationalJob,
  recordOperationalAuditEvent,
  startOperationalJob,
} from "@/lib/services/operational-history-service";
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
  roleHints: Set<string>;
  relationHints: Set<string>;
};

type EntityPageAppearance = {
  thesisSections: string[];
  dossierSections: string[];
  catalystLinks: Array<{ id: string; title: string }>;
  contradictionLinks: Array<{ id: string; title: string }>;
};

export type EntityReferenceRecord = {
  entity: ResearchEntity;
  relatedClaims: Claim[];
  relatedSources: Source[];
  relatedPages: WikiPage[];
  appearances: EntityPageAppearance;
  whereItMatters: string;
  influenceSummary: string;
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

function preferredRole(entityType: EntityType, canonicalName: string): string {
  const normalized = canonicalName.toLowerCase();

  if (entityType === "company") {
    return "subject-company";
  }

  if (entityType === "operator") {
    return "management";
  }

  if (entityType === "product_or_segment") {
    if (/gen[- ]?4/.test(normalized)) {
      return "platform";
    }

    if (/automotive/.test(normalized)) {
      return "core-segment";
    }

    if (/industrial/.test(normalized)) {
      return "secondary-segment";
    }

    return "segment";
  }

  if (entityType === "market_or_competitor") {
    if (/peer group/.test(normalized)) {
      return "peer-group";
    }

    if (/capacity cycle/.test(normalized)) {
      return "market-cycle";
    }

    return "market-context";
  }

  if (entityType === "metric") {
    if (/gross margin/.test(normalized)) {
      return "core-metric";
    }

    if (/selling price|pricing discipline/.test(normalized)) {
      return "pricing-metric";
    }

    return "metric";
  }

  return "risk-anchor";
}

function preferredRelation(entityType: EntityType): string {
  if (entityType === "company") {
    return "primary_subject";
  }

  if (entityType === "market_or_competitor") {
    return "peer_or_market";
  }

  if (entityType === "operator") {
    return "internal_operator";
  }

  if (entityType === "risk_theme") {
    return "risk_driver";
  }

  return "subject_support";
}

function normalizeEntityName(entityType: EntityType, value: string): string {
  const normalized = normalizeAlias(value);
  const lower = normalized.toLowerCase();

  if (!normalized) {
    return "";
  }

  if (entityType === "company" && /\bnorthstar\b/.test(lower)) {
    return "Northstar Semiconductor";
  }

  if (entityType === "product_or_segment") {
    if (
      /\b(ev power modules?|ev module programs?|automotive modules?|automotive power modules?)\b/.test(
        lower,
      )
    ) {
      return "Automotive power modules";
    }

    if (/\bindustrial (sockets|programs?)\b/.test(lower)) {
      return "Industrial sockets";
    }

    if (/\bgen[- ]?4(?: automotive module)? (platform|ramp)\b|\bgen[- ]?4 platform\b/.test(lower)) {
      return "Gen-4 automotive platform";
    }

    if (lower === "power modules" || lower === "power module") {
      return "Power modules";
    }
  }

  if (entityType === "operator") {
    if (
      /\b(management|management team|leadership|leadership team|executive team|company management)\b/.test(
        lower,
      )
    ) {
      return "Management team";
    }
  }

  if (entityType === "market_or_competitor") {
    if (
      /\b(power module vendors|peer vendors|competitor set|peer group|peer pricing set|four power module vendors)\b/.test(
        lower,
      )
    ) {
      return "Power module peer group";
    }

    if (
      /\b(wide[- ]bandgap adoption|silicon carbide adoption|sic adoption|capacity additions?|wide[- ]bandgap capacity)\b/.test(
        lower,
      )
    ) {
      return "Wide-bandgap capacity cycle";
    }

    if (/\bautomotive market\b/.test(lower)) {
      return "Automotive market";
    }

    if (/\bindustrial market\b/.test(lower)) {
      return "Industrial market";
    }
  }

  if (entityType === "metric") {
    if (/\bgross margin\b/.test(lower)) {
      return "Gross margin";
    }

    if (/\basp\b|\baverage selling price\b/.test(lower)) {
      return "Average selling price";
    }

    if (/\bpricing discipline\b/.test(lower)) {
      return "Pricing discipline";
    }
  }

  if (entityType === "risk_theme") {
    if (
      /\b(pricing pressure|pricing durability|asp compression|discounting)\b/.test(lower)
    ) {
      return "Pricing pressure";
    }

    if (/\b(margin delay|slower margin bridge|timing window)\b/.test(lower)) {
      return "Margin timing risk";
    }
  }

  return titleCase(normalized);
}

function roleFromEntity(entity: ResearchEntity): string {
  return entity.metadata?.role ?? preferredRole(entity.entityType, entity.canonicalName);
}

function relationFromEntity(entity: ResearchEntity): string {
  return (
    entity.metadata?.subjectRelation ?? preferredRelation(entity.entityType)
  );
}

export function entityPriority(entity: ResearchEntity): number {
  const relation = relationFromEntity(entity);
  const role = roleFromEntity(entity);

  return (
    (relation === "primary_subject" ? 10 : relation === "subject_support" ? 7 : relation === "internal_operator" ? 6 : relation === "peer_or_market" ? 5 : 4) +
    (role === "core-segment" || role === "core-metric" ? 3 : role === "platform" || role === "peer-group" ? 2 : 0)
  );
}

export function entityInfluenceSummary(entity: ResearchEntity): string {
  if (entity.metadata?.influenceSummary) {
    return entity.metadata.influenceSummary;
  }

  const relation = relationFromEntity(entity);
  const role = roleFromEntity(entity);

  if (relation === "primary_subject") {
    return "Primary subject company used across thesis, dossier, and Ask grounding.";
  }

  if (role === "core-segment") {
    return "Core segment influencing upside, pricing durability, and catalyst posture.";
  }

  if (role === "platform") {
    return "Platform entity anchoring timing-sensitive catalyst and thesis updates.";
  }

  if (role === "peer-group") {
    return "Peer set used to ground competition, pricing pressure, and contradiction analysis.";
  }

  if (relation === "internal_operator") {
    return "Operator context shaping management credibility and execution posture.";
  }

  if (relation === "risk_driver") {
    return "Risk entity influencing stale pressure, contradictions, and downside framing.";
  }

  return "Tracked entity contributing reusable structure across the research stack.";
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
  const normalizedName = normalizeEntityName(input.entityType, input.canonicalName);

  return {
    stableKey: stableKey(input.projectId, input.entityType, normalizedName),
    projectId: input.projectId,
    entityType: input.entityType,
    canonicalName: normalizedName,
    aliases: new Set<string>(),
    descriptions: [],
    relatedSourceIds: new Set<string>(),
    relatedClaimIds: new Set<string>(),
    relatedWikiPageIds: new Set<string>(),
    supportWeight: 0,
    sourceEvidenceWeight: 0,
    roleHints: new Set<string>([preferredRole(input.entityType, normalizedName)]),
    relationHints: new Set<string>([preferredRelation(input.entityType)]),
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
    roleHint?: string | null;
    relationHint?: string | null;
  },
) {
  const canonicalName = normalizeEntityName(
    input.entityType,
    normalizeAlias(input.canonicalName),
  );

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
    const alias = normalizeAlias(input.alias);

    if (alias && alias.toLowerCase() !== canonicalName.toLowerCase()) {
      record.aliases.add(alias);
    }
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

  if (input.roleHint) {
    record.roleHints.add(input.roleHint);
  }

  if (input.relationHint) {
    record.relationHints.add(input.relationHint);
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
    roleHint: "subject-company",
    relationHint: "primary_subject",
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
  const patterns: Array<{ pattern: RegExp; canonicalName?: string; roleHint?: string }> = [
    {
      pattern:
        /\b(?:automotive power modules?|ev power modules?|ev module programs?|automotive modules?)\b/gi,
      canonicalName: "Automotive power modules",
      roleHint: "core-segment",
    },
    {
      pattern: /\bindustrial (?:sockets|programs?)\b/gi,
      canonicalName: "Industrial sockets",
      roleHint: "secondary-segment",
    },
    {
      pattern:
        /\bgen[- ]?\d+(?: automotive module)? (?:platform|ramp)\b|\bgen[- ]?\d+ platform\b/gi,
      canonicalName: "Gen-4 automotive platform",
      roleHint: "platform",
    },
  ];

  const hasSpecificSegment =
    /automotive power modules?|ev power modules?|industrial sockets?|gen[- ]?\d+/i.test(
      input.text,
    );

  for (const { pattern, canonicalName, roleHint } of patterns) {
    for (const match of input.text.matchAll(pattern)) {
      const raw = normalizeAlias(match[0]);

      addEntitySupport(entities, {
        projectId: input.projectId,
        entityType: "product_or_segment",
        canonicalName: canonicalName ?? raw,
        alias: raw,
        description: input.text,
        sourceId: input.sourceId,
        claimId: input.claimId,
        wikiPageId: input.wikiPageId,
        supportWeight: /gen[- ]?\d+/i.test(raw) ? 3 : 2,
        roleHint,
        relationHint: "subject_support",
      });
    }
  }

  if (!hasSpecificSegment) {
    for (const match of input.text.matchAll(/\bpower modules?\b/gi)) {
      const raw = normalizeAlias(match[0]);

      addEntitySupport(entities, {
        projectId: input.projectId,
        entityType: "product_or_segment",
        canonicalName: "Power modules",
        alias: raw,
        description: input.text,
        sourceId: input.sourceId,
        claimId: input.claimId,
        wikiPageId: input.wikiPageId,
        supportWeight: 1,
        roleHint: "segment",
        relationHint: "subject_support",
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
    [/\bleadership(?: team)?\b/gi, "Management team"],
    [/\bexecutive team\b/gi, "Management team"],
    [/\bcompany management\b/gi, "Management team"],
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
        roleHint: "management",
        relationHint: "internal_operator",
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
  const patterns: Array<[RegExp, string, string]> = [
    [
      /\b(power module vendors|peer vendors|competitor(?: set|s)?|peer group|peer pricing set|four power module vendors)\b/gi,
      "Power module peer group",
      "peer-group",
    ],
    [
      /\b(wide[- ]bandgap adoption|silicon carbide adoption|sic adoption|capacity additions?|wide[- ]bandgap capacity)\b/gi,
      "Wide-bandgap capacity cycle",
      "market-cycle",
    ],
    [/\bautomotive market\b/gi, "Automotive market", "market-context"],
    [/\bindustrial market\b/gi, "Industrial market", "market-context"],
  ];

  for (const [pattern, canonicalName, roleHint] of patterns) {
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
        roleHint,
        relationHint: "peer_or_market",
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
        roleHint:
          fallbackName === "Gross margin"
            ? "core-metric"
            : fallbackName === "ASP" || fallbackName === "Pricing discipline"
              ? "pricing-metric"
              : "metric",
        relationHint: "subject_support",
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
        roleHint: "risk-anchor",
        relationHint: "risk_driver",
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
        roleHint: "risk-anchor",
        relationHint: "risk_driver",
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

function pickPrimaryRole(record: EntityAccumulator): string {
  return Array.from(record.roleHints).sort((left, right) => {
    const rank = (value: string) => {
      if (value === "subject-company") return 6;
      if (value === "core-segment" || value === "core-metric") return 5;
      if (value === "platform" || value === "peer-group") return 4;
      if (value === "management" || value === "secondary-segment") return 3;
      if (value === "market-cycle" || value === "risk-anchor") return 2;
      return 1;
    };

    return rank(right) - rank(left) || left.localeCompare(right);
  })[0] ?? preferredRole(record.entityType, record.canonicalName);
}

function pickPrimaryRelation(record: EntityAccumulator): string {
  return Array.from(record.relationHints).sort((left, right) => {
    const rank = (value: string) => {
      if (value === "primary_subject") return 5;
      if (value === "subject_support") return 4;
      if (value === "internal_operator") return 3;
      if (value === "peer_or_market") return 2;
      return 1;
    };

    return rank(right) - rank(left) || left.localeCompare(right);
  })[0] ?? preferredRelation(record.entityType);
}

function descriptionForEntity(record: EntityAccumulator): string {
  return (
    record.descriptions
      .sort((left, right) => right.length - left.length)[0] ??
    `${record.canonicalName} is currently tracked as a ${record.entityType.replaceAll("_", " ")} in the compiled research graph.`
  );
}

function influenceSummaryForRecord(record: EntityAccumulator): string {
  const role = pickPrimaryRole(record);
  const relation = pickPrimaryRelation(record);

  if (relation === "primary_subject") {
    return "Primary subject company grounding thesis posture, dossier framing, and Ask synthesis.";
  }

  if (role === "core-segment") {
    return "Core segment shaping upside, pricing durability, and catalyst timing.";
  }

  if (role === "secondary-segment") {
    return "Secondary segment used to frame downside and mix-quality tension.";
  }

  if (role === "platform") {
    return "Platform entity influencing timeline significance and thesis catalysts.";
  }

  if (role === "peer-group") {
    return "Peer group grounding competition, pricing comparison, and contradiction analysis.";
  }

  if (role === "management") {
    return "Operator entity used to assess management credibility and execution posture.";
  }

  if (role === "core-metric" || role === "pricing-metric") {
    return "Metric entity influencing confidence, thesis posture, and risk framing.";
  }

  if (relation === "risk_driver") {
    return "Risk entity informing contradictions, freshness pressure, and downside posture.";
  }

  return "Reusable structured entity contributing to current research synthesis.";
}

function shouldRetainEntity(
  record: EntityAccumulator,
  allRecords: EntityAccumulator[],
): boolean {
  if (
    record.entityType === "product_or_segment" &&
    record.canonicalName === "Power modules" &&
    allRecords.some(
      (candidate) =>
        candidate.entityType === "product_or_segment" &&
        candidate.canonicalName !== "Power modules" &&
        /(Automotive power modules|Industrial sockets|Gen-4 automotive platform)/.test(
          candidate.canonicalName,
        ),
    )
  ) {
    return false;
  }

  return true;
}

function finalizeEntities(
  projectId: string,
  entities: Map<string, EntityAccumulator>,
): ResearchEntityDraft[] {
  const records = Array.from(entities.values()).filter((record) =>
    shouldRetainEntity(record, Array.from(entities.values())),
  );

  return records
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
        role: pickPrimaryRole(record),
        subjectRelation: pickPrimaryRelation(record),
        influenceSummary: influenceSummaryForRecord(record),
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

export async function compileProjectEntities(
  projectId: string,
  options?: { recordOperation?: boolean; triggeredBy?: string },
) {
  const project = await projectsRepository.getById(projectId);

  if (!project) {
    throw new Error("Project is required to compile entities.");
  }

  const job = options?.recordOperation
    ? await startOperationalJob({
        projectId,
        jobType: "extract_entities",
        targetObjectType: "entity_layer",
        targetObjectId: projectId,
        triggeredBy: options.triggeredBy ?? "workspace-user",
        summary: "Entity extraction started.",
      })
    : null;

  try {
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

    const metadataText = [
      source.metadata.comparatorSet,
      source.metadata.theme,
      source.metadata.coverage,
      source.metadata.sourceClass,
      source.metadata.region,
    ]
      .filter(Boolean)
      .join(" ");
    const text = `${source.title} ${source.body ?? ""} ${metadataText}`;
    scanProductsAndSegments(entities, { projectId, text, sourceId: source.id });
    scanOperators(entities, { projectId, text, sourceId: source.id });
    scanMarketsAndCompetitors(entities, { projectId, text, sourceId: source.id });
    scanMetrics(entities, { projectId, text, sourceId: source.id });
    scanRiskThemes(entities, { projectId, text, sourceId: source.id });
  }

  for (const claim of claims) {
    const text = `${claim.text} ${claim.metadata?.subject ?? ""} ${claim.metadata?.direction ?? ""}`;
    scanProductsAndSegments(entities, {
      projectId,
      text,
      sourceId: claim.sourceId,
      claimId: claim.id,
      wikiPageId: claim.wikiPageId,
    });
    scanOperators(entities, {
      projectId,
      text,
      sourceId: claim.sourceId,
      claimId: claim.id,
      wikiPageId: claim.wikiPageId,
    });
    scanMarketsAndCompetitors(entities, {
      projectId,
      text,
      sourceId: claim.sourceId,
      claimId: claim.id,
      wikiPageId: claim.wikiPageId,
    });
    scanMetrics(entities, {
      projectId,
      text,
      sourceId: claim.sourceId,
      claimId: claim.id,
      wikiPageId: claim.wikiPageId,
    });
    scanRiskThemes(entities, {
      projectId,
      text,
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
    const result = await entitiesRepository.syncProjectEntities(
      projectId,
      drafts,
      buildEntitySummary(drafts),
    );

    if (job) {
      const summary = `Entity extraction compiled ${result.entities.length} entity record(s) for ${project.name}.`;
      await completeOperationalJob({
        jobId: job.id,
        summary,
        targetObjectId: projectId,
        metadata: {
          entityCount: String(result.entities.length),
        },
      });
      await recordOperationalAuditEvent({
        projectId,
        eventType: "entities_extracted",
        title: "Entities extracted",
        description: summary,
        relatedObjectType: "entity_layer",
        relatedObjectId: projectId,
        relatedJobId: job.id,
        metadata: {
          entityCount: String(result.entities.length),
        },
      });
    }

    return result;
  } catch (error) {
    if (job) {
      const message = error instanceof Error ? error.message : "Unknown entity extraction failure.";
      await failOperationalJob(job.id, `Entity extraction failed: ${message}`);
      await recordOperationalAuditEvent({
        projectId,
        eventType: "job_failed",
        title: "Entity extraction failed",
        description: `Entity extraction failed for ${project.name}: ${message}`,
        relatedObjectType: "entity_layer",
        relatedObjectId: projectId,
        relatedJobId: job.id,
        metadata: { jobType: "extract_entities" },
      });
    }
    throw error;
  }
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
        score:
          hits * 2 +
          entityPriority(entity) +
          (needles.some((needle) => needle === normalizedText) ? 2 : 0) +
          Math.min(entity.aliases.length * 0.05, 0.25),
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
            (typedRefs.entityIds ?? []).includes(entity.id) ||
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
            (typedRefs.entityIds ?? []).includes(entity.id) ||
            typedRefs.claimIds.some((id: string) => entity.relatedClaimIds.includes(id)) ||
            typedRefs.sourceIds.some((id: string) => entity.relatedSourceIds.includes(id)) ||
            typedRefs.wikiPageIds.some((id: string) => entity.relatedWikiPageIds.includes(id))
          );
        })
        .map(([key]) => titleCase(key.replace(/([A-Z])/g, " $1")))
    : [];

  return { thesisSections, dossierSections };
}

function whereEntityMattersMost(input: {
  entity: ResearchEntity;
  thesisSections: string[];
  dossierSections: string[];
  catalystCount: number;
  contradictionCount: number;
}): string {
  const sections = [
    input.thesisSections[0] ? `thesis ${input.thesisSections[0]}` : null,
    input.dossierSections[0] ? `dossier ${input.dossierSections[0]}` : null,
    input.catalystCount > 0 ? `${input.catalystCount} catalyst link${input.catalystCount === 1 ? "" : "s"}` : null,
    input.contradictionCount > 0
      ? `${input.contradictionCount} contradiction anchor${input.contradictionCount === 1 ? "" : "s"}`
      : null,
  ].filter((value): value is string => Boolean(value));

  return sections.length > 0
    ? `Matters most in ${sections.slice(0, 3).join(", ")}.`
    : "Not yet strongly attached to a downstream surface.";
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
    const relatedCatalysts = catalysts
      .filter(
        (catalyst) =>
          catalyst.linkedClaimIds.some((id) => entity.relatedClaimIds.includes(id)) ||
          catalyst.linkedSourceIds.some((id) => entity.relatedSourceIds.includes(id)),
      )
      .map((catalyst) => ({ id: catalyst.id, title: catalyst.title }));
    const relatedContradictions = contradictions
      .filter(
        (contradiction) =>
          contradiction.relatedSourceIds.some((id) => entity.relatedSourceIds.includes(id)) ||
          contradiction.relatedPageIds.some((id) => entity.relatedWikiPageIds.includes(id)) ||
          [contradiction.leftClaimId ?? null, contradiction.rightClaimId ?? null].some(
            (id) => id && entity.relatedClaimIds.includes(id),
          ),
      )
      .map((contradiction) => ({ id: contradiction.id, title: contradiction.title }));

    return {
      entity,
      relatedClaims,
      relatedSources,
      relatedPages,
      appearances: {
        ...appearances,
        catalystLinks: relatedCatalysts,
        contradictionLinks: relatedContradictions,
      },
      whereItMatters: whereEntityMattersMost({
        entity,
        thesisSections: appearances.thesisSections,
        dossierSections: appearances.dossierSections,
        catalystCount: relatedCatalysts.length,
        contradictionCount: relatedContradictions.length,
      }),
      influenceSummary: entityInfluenceSummary(entity),
    };
  }).sort(
    (left, right) =>
      entityPriority(right.entity) - entityPriority(left.entity) ||
      left.entity.entityType.localeCompare(right.entity.entityType) ||
      left.entity.canonicalName.localeCompare(right.entity.canonicalName),
  );

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
        label: "Peers",
        value: String(entities.filter((entry) => entry.entity.entityType === "market_or_competitor").length),
        note: "Peer and market entities make competition, pricing pressure, and contradiction scope less generic.",
      },
      {
        label: "Operators",
        value: String(entities.filter((entry) => entry.entity.entityType === "operator").length),
        note: "Operator entities keep management and execution references cleaner across thesis and dossier surfaces.",
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
