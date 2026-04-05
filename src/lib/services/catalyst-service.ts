import type {
  Catalyst,
  CatalystCompileState,
  CatalystDraft,
  CatalystImportance,
  CatalystReviewStatus,
  CatalystStatus,
  CatalystType,
  Claim,
  Contradiction,
  ResearchEntity,
  RevisionConfidence,
  Source,
  Thesis,
  TimelineEvent,
  TimelineEventDatePrecision,
  WikiPage,
} from "@/lib/domain/types";
import { claimsRepository } from "@/lib/repositories/claims-repository";
import { contradictionsRepository } from "@/lib/repositories/contradictions-repository";
import { catalystsRepository } from "@/lib/repositories/catalysts-repository";
import { evidenceLinksRepository } from "@/lib/repositories/evidence-links-repository";
import { sourceFragmentsRepository } from "@/lib/repositories/source-fragments-repository";
import { sourcesRepository } from "@/lib/repositories/sources-repository";
import { thesesRepository } from "@/lib/repositories/theses-repository";
import { timelineEventsRepository } from "@/lib/repositories/timeline-events-repository";
import { wikiRepository } from "@/lib/repositories/wiki-repository";
import {
  compileProjectEntities,
  entityInfluenceSummary,
  entityPriority,
  matchEntitiesToText,
} from "@/lib/services/entity-intelligence-service";
import {
  completeOperationalJob,
  failOperationalJob,
  recordOperationalAuditEvent,
  startOperationalJob,
} from "@/lib/services/operational-history-service";
import {
  buildConfidenceAssessment,
  serializeConfidenceFactors,
} from "@/lib/services/confidence-model-v2";
import {
  buildEvidenceLineageLookup,
  collectEvidenceHighlights,
  type EvidenceHighlight,
} from "@/lib/services/evidence-lineage-v3";
import {
  buildSemanticProfile,
  summarizeThemeList,
  type SemanticTheme,
} from "@/lib/services/semantic-intelligence-v1";

export type CatalystReferenceRecord = {
  catalyst: Catalyst;
  thesis: Thesis | null;
  relatedTimelineEvents: TimelineEvent[];
  relatedClaims: Claim[];
  relatedSources: Source[];
  relatedContradictions: Contradiction[];
  relatedPages: WikiPage[];
  evidenceHighlights: EvidenceHighlight[];
};

export type CatalystPageData = {
  catalysts: CatalystReferenceRecord[];
  compileState: CatalystCompileState;
  summary: {
    totalCatalysts: number;
    upcomingCatalysts: number;
    reviewedCatalysts: number;
    resolvedCatalysts: number;
    invalidatedCatalysts: number;
    highImportanceCatalysts: number;
  };
  metrics: Array<{ label: string; value: string; note: string }>;
};

type CandidateInput = {
  thesis: Thesis | null;
  timelineEvents: TimelineEvent[];
  claims: Claim[];
  contradictions: Contradiction[];
  sources: Source[];
  entities: ResearchEntity[];
};

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

function primaryEntityForText(
  text: string,
  entities: ResearchEntity[],
): ResearchEntity | null {
  const matches = matchEntitiesToText(text ? entities : [], text, [
      "company",
      "product_or_segment",
      "metric",
      "market_or_competitor",
      "risk_theme",
      "operator",
    ]);

  return (
    matches.sort(
      (left, right) =>
        entityPriority(right) - entityPriority(left) ||
        left.canonicalName.localeCompare(right.canonicalName),
    )[0] ?? null
  );
}

function catalystTitleWithEntity(
  title: string,
  entity: ResearchEntity | null,
): string {
  return entity ? `${entity.canonicalName}: ${title}` : title;
}

function confidenceRank(confidence: RevisionConfidence): number {
  return confidence === "high" ? 3 : confidence === "medium" ? 2 : 1;
}

function chooseHigherConfidence(
  left: RevisionConfidence,
  right: RevisionConfidence,
): RevisionConfidence {
  return confidenceRank(right) > confidenceRank(left) ? right : left;
}

function extractThesisCatalystLines(markdown: string | null | undefined): string[] {
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

function inferCatalystType(text: string): CatalystType {
  const profile = buildSemanticProfile(text);

  if (profile.themes.includes("earnings")) {
    return "earnings";
  }

  if (profile.themes.includes("product")) {
    return "product_launch";
  }

  if (profile.themes.includes("regulatory")) {
    return "regulatory";
  }

  if (profile.themes.includes("guidance")) {
    return "guidance_change";
  }

  if (profile.themes.includes("customer") || profile.themes.includes("demand")) {
    return "customer_or_contract";
  }

  if (/\bfinancing|capital|raise|debt|liquidity\b/.test(text.toLowerCase())) {
    return "financing";
  }

  if (
    profile.themes.includes("macro") ||
    profile.themes.includes("supply") ||
    profile.themes.includes("pricing") ||
    profile.themes.includes("margin")
  ) {
    return "macro_or_industry";
  }

  return "other";
}

function formatDateLabel(
  eventDate: string,
  precision: TimelineEventDatePrecision,
): string {
  if (precision === "year") {
    return eventDate.slice(0, 4);
  }

  if (precision === "month") {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      year: "numeric",
    }).format(new Date(eventDate));
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(eventDate));
}

function inferImportance(input: {
  catalystType: CatalystType;
  confidence: RevisionConfidence;
  contradictionCount: number;
  sourceCount: number;
  claimCount: number;
  preciseDate: boolean;
}): CatalystImportance {
  if (
    ["earnings", "guidance_change", "customer_or_contract", "product_launch", "regulatory"].includes(
      input.catalystType,
    ) &&
    (input.confidence === "high" || input.sourceCount >= 2 || input.claimCount >= 2 || input.preciseDate)
  ) {
    return "high";
  }

  if (input.contradictionCount > 0 || input.confidence === "medium" || input.sourceCount >= 2) {
    return "medium";
  }

  return "low";
}

function inferStatus(expectedTimeframe: string | null): CatalystStatus {
  if (!expectedTimeframe) {
    return "unknown";
  }

  const now = new Date();
  const target = new Date(expectedTimeframe);
  const diffMs = target.getTime() - now.getTime();
  const thirtyDays = 30 * 24 * 60 * 60 * 1000;

  if (diffMs > thirtyDays) {
    return "upcoming";
  }

  if (Math.abs(diffMs) <= thirtyDays) {
    return "active";
  }

  return "resolved";
}

function riskLinkageSentence(contradictions: Contradiction[]): string {
  const active = contradictions.filter((entry) => entry.status !== "resolved");

  if (active.length === 0) {
    return "Risk linkage: no active contradiction is currently attached.";
  }

  return `Risk linkage: ${active
    .slice(0, 2)
    .map((entry) => entry.title)
    .join("; ")}.`;
}

function buildCatalystLineageSummary(input: {
  primaryEntity: ResearchEntity | null;
  claimCount: number;
  sourceCount: number;
  timelineCount: number;
  contradictionCount: number;
  thesisLinked: boolean;
  derivedFrom: string;
}): { anchorSummary: string; thesisSummary: string; lineageSummary: string } {
  const anchorSummary = input.primaryEntity
    ? `Primary anchor: ${input.primaryEntity.canonicalName}. ${entityInfluenceSummary(input.primaryEntity)}`
    : `Primary anchor remains ${input.derivedFrom.replaceAll("_", " ")} scope rather than a stabilized entity.`;
  const thesisSummary = input.thesisLinked
    ? "This catalyst is linked back into the current thesis posture."
    : "This catalyst is not yet directly linked to a compiled thesis record.";
  const lineageSummary = `Lineage runs through ${input.claimCount} claim(s), ${input.sourceCount} source record(s), ${input.timelineCount} timeline event(s), and ${input.contradictionCount} contradiction record(s).`;

  return {
    anchorSummary,
    thesisSummary,
    lineageSummary,
  };
}

function whyItMattersSentence(
  catalystType: CatalystType,
  themes: SemanticTheme[],
): string {
  const themeSummary = summarizeThemeList(themes);

  switch (catalystType) {
    case "earnings":
      return `Why it matters: this checkpoint can validate or break the current ${themeSummary} thesis in reported results.`;
    case "product_launch":
      return `Why it matters: product timing and ramp execution can change mix, customer adoption, and forward confidence.`;
    case "regulatory":
      return `Why it matters: regulatory timing can pull forward or delay commercial access and execution assumptions.`;
    case "guidance_change":
      return `Why it matters: guidance resets forward expectations for demand, pricing, and margin durability.`;
    case "customer_or_contract":
      return `Why it matters: customer or contract signals can validate demand quality and revenue durability.`;
    case "macro_or_industry":
      return `Why it matters: macro, pricing, or supply-demand shifts can move the entire underwriting frame, not just one event.`;
    case "financing":
      return `Why it matters: financing posture can change durability, flexibility, and downside tolerance.`;
    default:
      return `Why it matters: this record touches ${themeSummary} and appears capable of changing the active thesis.`;
  }
}

function thesisRelevanceSentence(
  catalystType: CatalystType,
  contradictions: Contradiction[],
): string {
  const contradictionNote =
    contradictions.length > 0
      ? ` It also intersects ${contradictions.length} contradiction record(s).`
      : "";

  switch (catalystType) {
    case "earnings":
      return `Thesis relevance: earnings resolution is one of the fastest ways to confirm or falsify the current research view.${contradictionNote}`;
    case "product_launch":
      return `Thesis relevance: ramp timing tests whether execution and mix assumptions are realistic.${contradictionNote}`;
    case "regulatory":
      return `Thesis relevance: approvals or delays can reframe timing and risk, not just documentation.${contradictionNote}`;
    case "guidance_change":
      return `Thesis relevance: a guidance reset usually forces a stance and confidence recalibration.${contradictionNote}`;
    case "customer_or_contract":
      return `Thesis relevance: customer wins or slips change demand credibility and revenue durability.${contradictionNote}`;
    case "macro_or_industry":
      return `Thesis relevance: supply-demand and pricing shifts can re-rate the whole thesis posture.${contradictionNote}`;
    case "financing":
      return `Thesis relevance: balance-sheet flexibility can tighten or widen the viable thesis path.${contradictionNote}`;
    default:
      return `Thesis relevance: this item should be tracked as a potential thesis-moving input.${contradictionNote}`;
  }
}

function confidenceForCatalyst(input: {
  sourceCount: number;
  claimCount: number;
  contradictionCount: number;
  timeframePrecision: TimelineEventDatePrecision;
  entityClarity: number;
}): { label: RevisionConfidence; score: number; summary: string; factors: string } {
  const precisionSupport =
    input.timeframePrecision === "exact_day"
      ? 1
      : input.timeframePrecision === "month"
        ? 0.75
        : input.timeframePrecision === "year"
          ? 0.45
          : 0.25;
  const supportDensity = Math.min((input.sourceCount + input.claimCount) / 4, 1);
  const assessment = buildConfidenceAssessment({
    supportDensity,
    sourceDiversityCount: input.sourceCount,
    contradictionBurden: Math.min(input.contradictionCount / 3, 1),
    freshnessBurden: 0,
    entityClarity: input.entityClarity,
    datePrecision: precisionSupport,
    reviewPosture: 0,
  });

  return {
    label: assessment.label,
    score: assessment.score,
    summary: assessment.summary,
    factors: serializeConfidenceFactors(assessment.factors),
  };
}

function buildCatalystDescription(input: {
  baseText: string;
  catalystType: CatalystType;
  themes: SemanticTheme[];
  contradictions: Contradiction[];
  primaryEntity: ResearchEntity | null;
}): string {
  return [
    input.primaryEntity
      ? `Primary entity: ${input.primaryEntity.canonicalName}.`
      : null,
    input.baseText,
    whyItMattersSentence(input.catalystType, input.themes),
    thesisRelevanceSentence(input.catalystType, input.contradictions),
    riskLinkageSentence(input.contradictions),
  ]
    .filter((part): part is string => Boolean(part))
    .join(" ");
}

function findRelatedContradictions(
  text: string,
  contradictions: Contradiction[],
): Contradiction[] {
  const profile = buildSemanticProfile(text);

  return contradictions.filter((entry) => {
    if (entry.status === "resolved") {
      return false;
    }

    const entryProfile = buildSemanticProfile(
      `${entry.title} ${entry.description} ${entry.rationale}`,
    );
    const themes = entryProfile.themes.filter((theme) => profile.themes.includes(theme));

    return themes.length > 0;
  });
}

function buildDraftFromTimelineEvent(
  event: TimelineEvent,
  input: CandidateInput,
): CatalystDraft | null {
  const catalystType = inferCatalystType(`${event.title} ${event.description}`);

  if (catalystType === "other" && !["financial", "milestone", "system"].includes(event.eventType)) {
    return null;
  }

  const relatedContradictions = Array.from(
    new Map(
      [
        ...input.contradictions.filter((contradiction) =>
          contradiction.relatedTimelineEventIds.includes(event.id),
        ),
        ...findRelatedContradictions(`${event.title} ${event.description}`, input.contradictions),
      ].map((entry) => [entry.id, entry] as const),
    ).values(),
  );
  const themes = buildSemanticProfile(`${event.title} ${event.description}`).themes;
  const primaryEntity = primaryEntityForText(
    `${event.title} ${event.description}`,
    input.entities,
  );
  const confidenceAssessment = confidenceForCatalyst({
    sourceCount: event.sourceIds.length,
    claimCount: event.claimIds.length,
    contradictionCount: relatedContradictions.length,
    timeframePrecision: event.eventDatePrecision,
    entityClarity: primaryEntity ? 1 : themes.length > 0 ? 0.6 : 0.3,
  });
  const confidence = confidenceAssessment.label;
  const lineage = buildCatalystLineageSummary({
    primaryEntity,
    claimCount: event.claimIds.length,
    sourceCount: event.sourceIds.length,
    timelineCount: 1,
    contradictionCount: relatedContradictions.length,
    thesisLinked: Boolean(input.thesis?.id),
    derivedFrom: "timeline",
  });

  return {
    stableKey: stableKey("timeline", catalystType, event.title, event.eventDate),
    projectId: event.projectId,
    title: catalystTitleWithEntity(event.title, primaryEntity),
    description: buildCatalystDescription({
      baseText: preview(event.description),
      catalystType,
      themes,
      contradictions: relatedContradictions,
      primaryEntity,
    }),
    catalystType,
    status: inferStatus(event.eventDate),
    expectedTimeframe: event.eventDate,
    timeframePrecision: event.eventDatePrecision,
    importance: inferImportance({
      catalystType,
      confidence,
      contradictionCount: relatedContradictions.length,
      sourceCount: event.sourceIds.length,
      claimCount: event.claimIds.length,
      preciseDate: event.eventDatePrecision === "exact_day",
    }),
    confidence,
    linkedThesisId: input.thesis?.id ?? null,
    linkedTimelineEventIds: [event.id],
    linkedClaimIds: [...event.claimIds],
    linkedSourceIds: [...event.sourceIds],
    linkedContradictionIds: relatedContradictions.map((entry) => entry.id),
    metadata: {
      timeframeLabel: formatDateLabel(event.eventDate, event.eventDatePrecision),
      derivedFrom: "timeline",
      semanticThemes: themes.join(", "),
      primaryEntityName: primaryEntity?.canonicalName ?? "",
      anchorSummary: lineage.anchorSummary,
      thesisSummary: lineage.thesisSummary,
      lineageSummary: lineage.lineageSummary,
      confidenceScore: confidenceAssessment.score.toFixed(2),
      confidenceSummary: confidenceAssessment.summary,
      confidenceFactors: confidenceAssessment.factors,
    },
  };
}

function buildDraftFromClaim(
  claim: Claim,
  input: CandidateInput,
): CatalystDraft | null {
  const catalystType = inferCatalystType(claim.text);

  if (catalystType === "other") {
    return null;
  }

  const linkedTimelineEvents = input.timelineEvents.filter((event) =>
    event.claimIds.includes(claim.id),
  );
  const linkedContradictions = Array.from(
    new Map(
      [
        ...input.contradictions.filter(
          (entry) => entry.leftClaimId === claim.id || entry.rightClaimId === claim.id,
        ),
        ...findRelatedContradictions(claim.text, input.contradictions),
      ].map((entry) => [entry.id, entry] as const),
    ).values(),
  );
  const expectedTimeframe = linkedTimelineEvents[0]?.eventDate ?? null;
  const timeframePrecision =
    linkedTimelineEvents[0]?.eventDatePrecision ?? "unknown_estimated";
  const themes = buildSemanticProfile(claim.text).themes;
  const primaryEntity = primaryEntityForText(claim.text, input.entities);
  const confidenceAssessment = confidenceForCatalyst({
    sourceCount: claim.sourceId ? 1 : 0,
    claimCount: 1,
    contradictionCount: linkedContradictions.length,
    timeframePrecision,
    entityClarity: primaryEntity ? 1 : themes.length > 0 ? 0.65 : 0.3,
  });
  const confidence = confidenceAssessment.label;
  const lineage = buildCatalystLineageSummary({
    primaryEntity,
    claimCount: 1,
    sourceCount: claim.sourceId ? 1 : 0,
    timelineCount: linkedTimelineEvents.length,
    contradictionCount: linkedContradictions.length,
    thesisLinked: Boolean(input.thesis?.id),
    derivedFrom: "claim",
  });

  return {
    stableKey: stableKey(
      "claim",
      primaryEntity?.canonicalName,
      catalystType,
      claim.text.slice(0, 80),
    ),
    projectId: claim.projectId,
    title: catalystTitleWithEntity(preview(claim.text, 90), primaryEntity),
    description: buildCatalystDescription({
      baseText: claim.text,
      catalystType,
      themes,
      contradictions: linkedContradictions,
      primaryEntity,
    }),
    catalystType,
    status: inferStatus(expectedTimeframe),
    expectedTimeframe,
    timeframePrecision,
    importance: inferImportance({
      catalystType,
      confidence,
      contradictionCount: linkedContradictions.length,
      sourceCount: claim.sourceId ? 1 : 0,
      claimCount: 1,
      preciseDate: timeframePrecision === "exact_day",
    }),
    confidence,
    linkedThesisId: input.thesis?.id ?? null,
    linkedTimelineEventIds: linkedTimelineEvents.map((event) => event.id),
    linkedClaimIds: [claim.id],
    linkedSourceIds: claim.sourceId ? [claim.sourceId] : [],
    linkedContradictionIds: linkedContradictions.map((entry) => entry.id),
    metadata: {
      derivedFrom: "claim",
      semanticThemes: themes.join(", "),
      primaryEntityName: primaryEntity?.canonicalName ?? "",
      anchorSummary: lineage.anchorSummary,
      thesisSummary: lineage.thesisSummary,
      lineageSummary: lineage.lineageSummary,
      confidenceScore: confidenceAssessment.score.toFixed(2),
      confidenceSummary: confidenceAssessment.summary,
      confidenceFactors: confidenceAssessment.factors,
    },
  };
}

function buildDraftFromSource(
  source: Source,
  input: CandidateInput,
): CatalystDraft | null {
  const catalystType = inferCatalystType(`${source.title} ${source.body ?? ""}`);

  if (catalystType === "other") {
    return null;
  }

  const relatedClaims = input.claims.filter((claim) => claim.sourceId === source.id);
  const relatedTimelineEvents = input.timelineEvents.filter((event) =>
    event.sourceIds.includes(source.id),
  );
  const relatedContradictions = findRelatedContradictions(
    `${source.title} ${source.body ?? ""}`,
    input.contradictions,
  );
  const expectedTimeframe = relatedTimelineEvents[0]?.eventDate ?? null;
  const timeframePrecision =
    relatedTimelineEvents[0]?.eventDatePrecision ?? "unknown_estimated";
  const themes = buildSemanticProfile(`${source.title} ${source.body ?? ""}`).themes;
  const primaryEntity = primaryEntityForText(
    `${source.title} ${source.body ?? ""}`,
    input.entities,
  );
  const confidenceAssessment = confidenceForCatalyst({
    sourceCount: 1,
    claimCount: relatedClaims.length,
    contradictionCount: relatedContradictions.length,
    timeframePrecision,
    entityClarity: primaryEntity ? 1 : themes.length > 0 ? 0.6 : 0.3,
  });
  const confidence = confidenceAssessment.label;
  const lineage = buildCatalystLineageSummary({
    primaryEntity,
    claimCount: relatedClaims.length,
    sourceCount: 1,
    timelineCount: relatedTimelineEvents.length,
    contradictionCount: relatedContradictions.length,
    thesisLinked: Boolean(input.thesis?.id),
    derivedFrom: "source",
  });

  return {
    stableKey: stableKey("source", primaryEntity?.canonicalName, catalystType, source.title),
    projectId: source.projectId,
    title: catalystTitleWithEntity(source.title, primaryEntity),
    description: buildCatalystDescription({
      baseText: preview(source.body),
      catalystType,
      themes,
      contradictions: relatedContradictions,
      primaryEntity,
    }),
    catalystType,
    status: inferStatus(expectedTimeframe),
    expectedTimeframe,
    timeframePrecision,
    importance: inferImportance({
      catalystType,
      confidence,
      contradictionCount: relatedContradictions.length,
      sourceCount: 1,
      claimCount: relatedClaims.length,
      preciseDate: timeframePrecision === "exact_day",
    }),
    confidence,
    linkedThesisId: input.thesis?.id ?? null,
    linkedTimelineEventIds: relatedTimelineEvents.map((event) => event.id),
    linkedClaimIds: relatedClaims.map((claim) => claim.id),
    linkedSourceIds: [source.id],
    linkedContradictionIds: relatedContradictions.map((entry) => entry.id),
    metadata: {
      derivedFrom: "source",
      semanticThemes: themes.join(", "),
      primaryEntityName: primaryEntity?.canonicalName ?? "",
      anchorSummary: lineage.anchorSummary,
      thesisSummary: lineage.thesisSummary,
      lineageSummary: lineage.lineageSummary,
      confidenceScore: confidenceAssessment.score.toFixed(2),
      confidenceSummary: confidenceAssessment.summary,
      confidenceFactors: confidenceAssessment.factors,
    },
  };
}

function buildDraftFromThesis(
  thesis: Thesis,
  entities: ResearchEntity[],
): CatalystDraft[] {
  const lines = extractThesisCatalystLines(thesis.catalystSummaryMarkdown);

  const drafts = lines
    .map((line): CatalystDraft | null => {
      const catalystType = inferCatalystType(line);

      if (catalystType === "other") {
        return null;
      }

      const timeframePrecision: TimelineEventDatePrecision =
        /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(
          line,
        )
          ? "month"
          : /\b20\d{2}\b/.test(line)
            ? "year"
            : "unknown_estimated";
      const themes = buildSemanticProfile(line).themes;
      const primaryEntity = primaryEntityForText(line, entities);
      const confidenceAssessment = confidenceForCatalyst({
        sourceCount: thesis.supportBySection.catalystSummary.sourceIds.length,
        claimCount: thesis.supportBySection.catalystSummary.claimIds.length,
        contradictionCount: thesis.supportBySection.catalystSummary.contradictionIds.length,
        timeframePrecision,
        entityClarity: primaryEntity ? 1 : themes.length > 0 ? 0.55 : 0.25,
      });
      const confidence = confidenceAssessment.label;
      const lineage = buildCatalystLineageSummary({
        primaryEntity,
        claimCount: thesis.supportBySection.catalystSummary.claimIds.length,
        sourceCount: thesis.supportBySection.catalystSummary.sourceIds.length,
        timelineCount: thesis.supportBySection.catalystSummary.timelineEventIds.length,
        contradictionCount: thesis.supportBySection.catalystSummary.contradictionIds.length,
        thesisLinked: true,
        derivedFrom: "thesis",
      });

      return {
        stableKey: stableKey("thesis", catalystType, line.slice(0, 72)),
        projectId: thesis.projectId,
        title: catalystTitleWithEntity(preview(line, 88), primaryEntity),
        description: buildCatalystDescription({
          baseText: line,
          catalystType,
          themes,
          contradictions: [],
          primaryEntity,
        }),
        catalystType,
        status: "unknown",
        expectedTimeframe: null,
        timeframePrecision,
        importance: inferImportance({
          catalystType,
          confidence,
          contradictionCount: thesis.supportBySection.catalystSummary.contradictionIds.length,
          sourceCount: thesis.supportBySection.catalystSummary.sourceIds.length,
          claimCount: thesis.supportBySection.catalystSummary.claimIds.length,
          preciseDate: false,
        }),
        confidence,
        linkedThesisId: thesis.id,
        linkedTimelineEventIds: thesis.supportBySection.catalystSummary.timelineEventIds,
        linkedClaimIds: thesis.supportBySection.catalystSummary.claimIds,
        linkedSourceIds: thesis.supportBySection.catalystSummary.sourceIds,
        linkedContradictionIds: thesis.supportBySection.catalystSummary.contradictionIds,
        metadata: {
          derivedFrom: "thesis",
          semanticThemes: themes.join(", "),
          primaryEntityName: primaryEntity?.canonicalName ?? "",
          anchorSummary: lineage.anchorSummary,
          thesisSummary: lineage.thesisSummary,
          lineageSummary: lineage.lineageSummary,
          confidenceScore: confidenceAssessment.score.toFixed(2),
          confidenceSummary: confidenceAssessment.summary,
          confidenceFactors: confidenceAssessment.factors,
        },
      } satisfies CatalystDraft;
    })
    .filter((draft): draft is CatalystDraft => Boolean(draft));

  return drafts;
}

function mergeDrafts(drafts: CatalystDraft[]): CatalystDraft[] {
  const merged = new Map<string, CatalystDraft>();

  for (const draft of drafts) {
    const existing = merged.get(draft.stableKey);

    if (!existing) {
      merged.set(draft.stableKey, structuredClone(draft));
      continue;
    }

    existing.confidence = chooseHigherConfidence(existing.confidence, draft.confidence);
    existing.importance =
      existing.importance === "high" || draft.importance === "high"
        ? "high"
        : existing.importance === "medium" || draft.importance === "medium"
          ? "medium"
          : "low";
    existing.status =
      existing.status === "active" || draft.status === "active"
        ? "active"
        : existing.status === "upcoming" || draft.status === "upcoming"
          ? "upcoming"
          : existing.status === "resolved" || draft.status === "resolved"
            ? "resolved"
            : existing.status;
    existing.expectedTimeframe =
      existing.expectedTimeframe && draft.expectedTimeframe
        ? existing.expectedTimeframe.localeCompare(draft.expectedTimeframe) <= 0
          ? existing.expectedTimeframe
          : draft.expectedTimeframe
        : existing.expectedTimeframe ?? draft.expectedTimeframe;
    existing.linkedTimelineEventIds = Array.from(
      new Set([...existing.linkedTimelineEventIds, ...draft.linkedTimelineEventIds]),
    );
    existing.linkedClaimIds = Array.from(
      new Set([...existing.linkedClaimIds, ...draft.linkedClaimIds]),
    );
    existing.linkedSourceIds = Array.from(
      new Set([...existing.linkedSourceIds, ...draft.linkedSourceIds]),
    );
    existing.linkedContradictionIds = Array.from(
      new Set([...existing.linkedContradictionIds, ...draft.linkedContradictionIds]),
    );
    existing.description =
      existing.description.length >= draft.description.length
        ? existing.description
        : draft.description;
    existing.metadata = {
      ...(existing.metadata ?? {}),
      ...(draft.metadata ?? {}),
    };
  }

  return Array.from(merged.values());
}

function buildCatalystSummary(catalysts: Catalyst[]): string {
  const upcoming = catalysts.filter((catalyst) => catalyst.status === "upcoming").length;
  const active = catalysts.filter((catalyst) => catalyst.status === "active").length;
  const highImportance = catalysts.filter(
    (catalyst) => catalyst.importance === "high",
  ).length;

  return `Catalyst compilation produced ${catalysts.length} record(s): ${upcoming} upcoming, ${active} active, and ${highImportance} high-importance catalyst(s).`;
}

export async function compileProjectCatalysts(projectId: string): Promise<Catalyst[]> {
  const job = await startOperationalJob({
    projectId,
    jobType: "refresh_catalysts",
    targetObjectType: "catalyst_tracker",
    targetObjectId: projectId,
    triggeredBy: "workspace-user",
    summary: "Catalyst refresh started.",
  });

  try {
    const [thesis, timelineEvents, claims, contradictions, sources, entityCompileResult] = await Promise.all([
      thesesRepository.getByProjectId(projectId),
      timelineEventsRepository.listByProjectId(projectId),
      claimsRepository.listByProjectId(projectId),
      contradictionsRepository.listByProjectId(projectId),
      sourcesRepository.listByProjectId(projectId),
      compileProjectEntities(projectId),
    ]);

    const input: CandidateInput = {
      thesis,
      timelineEvents,
      claims,
      contradictions,
      sources,
      entities: entityCompileResult.entities,
    };
    const drafts = [
      ...(thesis ? buildDraftFromThesis(thesis, input.entities) : []),
      ...timelineEvents
        .map((event) => buildDraftFromTimelineEvent(event, input))
        .filter((draft): draft is CatalystDraft => Boolean(draft)),
      ...claims
        .map((claim) => buildDraftFromClaim(claim, input))
        .filter((draft): draft is CatalystDraft => Boolean(draft)),
      ...sources
        .map((source) => buildDraftFromSource(source, input))
        .filter((draft): draft is CatalystDraft => Boolean(draft)),
    ];
    const mergedDrafts = mergeDrafts(drafts);
    const summary = buildCatalystSummary(
      mergedDrafts.map((draft) => ({
        id: draft.stableKey,
        projectId,
        title: draft.title,
        description: draft.description,
        catalystType: draft.catalystType,
        status: draft.status,
        expectedTimeframe: draft.expectedTimeframe,
        timeframePrecision: draft.timeframePrecision,
        importance: draft.importance,
        confidence: draft.confidence,
        reviewStatus: "active",
        reviewedAt: null,
        reviewedBy: null,
        reviewNote: null,
        linkedThesisId: draft.linkedThesisId ?? null,
        linkedTimelineEventIds: draft.linkedTimelineEventIds,
        linkedClaimIds: draft.linkedClaimIds,
        linkedSourceIds: draft.linkedSourceIds,
        linkedContradictionIds: draft.linkedContradictionIds,
        createdAt: "",
        updatedAt: "",
        metadata: draft.metadata,
      })),
    );

    const catalysts = await catalystsRepository.syncProjectCatalysts(
      projectId,
      mergedDrafts,
      summary,
    );
    await completeOperationalJob({
      jobId: job.id,
      summary,
      targetObjectId: projectId,
      metadata: {
        catalystCount: String(catalysts.length),
        highImportanceCount: String(
          catalysts.filter((entry) => entry.importance === "high").length,
        ),
      },
    });
    await recordOperationalAuditEvent({
      projectId,
      eventType: "catalysts_refreshed",
      title: "Catalysts refreshed",
      description: summary,
      relatedObjectType: "catalyst_tracker",
      relatedObjectId: projectId,
      relatedJobId: job.id,
      metadata: {
        catalystCount: String(catalysts.length),
      },
    });

    return catalysts;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown catalyst refresh failure.";
    await failOperationalJob(job.id, `Catalyst refresh failed: ${message}`);
    await recordOperationalAuditEvent({
      projectId,
      eventType: "job_failed",
      title: "Catalyst refresh failed",
      description: `Catalyst refresh failed for project ${projectId}: ${message}`,
      relatedObjectType: "catalyst_tracker",
      relatedObjectId: projectId,
      relatedJobId: job.id,
      metadata: { jobType: "refresh_catalysts" },
    });
    throw error;
  }
}

export async function listProjectCatalysts(
  projectId: string,
): Promise<CatalystReferenceRecord[]> {
  const [
    catalysts,
    thesis,
    timelineEvents,
    claims,
    sources,
    contradictions,
    pages,
    evidenceLinks,
    sourceFragments,
  ] =
    await Promise.all([
      catalystsRepository.listByProjectId(projectId),
      thesesRepository.getByProjectId(projectId),
      timelineEventsRepository.listByProjectId(projectId),
      claimsRepository.listByProjectId(projectId),
      sourcesRepository.listByProjectId(projectId),
      contradictionsRepository.listByProjectId(projectId),
      wikiRepository.listPagesByProjectId(projectId),
      evidenceLinksRepository.listByProjectId(projectId),
      sourceFragmentsRepository.listByProjectId(projectId),
    ]);

  const timelineById = new Map(timelineEvents.map((event) => [event.id, event] as const));
  const claimsById = new Map(claims.map((claim) => [claim.id, claim] as const));
  const sourcesById = new Map(sources.map((source) => [source.id, source] as const));
  const contradictionsById = new Map(
    contradictions.map((entry) => [entry.id, entry] as const),
  );
  const pagesById = new Map(pages.map((page) => [page.id, page] as const));
  const evidenceLookup = buildEvidenceLineageLookup({
    evidenceLinks,
    fragments: sourceFragments,
    claimsById,
    sourcesById,
  });

  return catalysts.map((catalyst) => {
    const relatedClaims = catalyst.linkedClaimIds
      .map((id) => claimsById.get(id) ?? null)
      .filter((entry): entry is Claim => Boolean(entry));
    const relatedTimelineEvents = catalyst.linkedTimelineEventIds
      .map((id) => timelineById.get(id) ?? null)
      .filter((entry): entry is TimelineEvent => Boolean(entry));
    const relatedSources = catalyst.linkedSourceIds
      .map((id) => sourcesById.get(id) ?? null)
      .filter((entry): entry is Source => Boolean(entry));
    const relatedContradictions = catalyst.linkedContradictionIds
      .map((id) => contradictionsById.get(id) ?? null)
      .filter((entry): entry is Contradiction => Boolean(entry));
    const relatedPages = Array.from(
      new Set([
        ...relatedClaims.map((claim) => claim.wikiPageId),
        ...relatedTimelineEvents.flatMap((event) => event.wikiPageIds),
      ]),
    )
      .map((id) => pagesById.get(id) ?? null)
      .filter((entry): entry is WikiPage => Boolean(entry));

    return {
      catalyst,
      thesis: thesis && catalyst.linkedThesisId === thesis.id ? thesis : null,
      relatedTimelineEvents,
      relatedClaims,
      relatedSources,
      relatedContradictions,
      relatedPages,
      evidenceHighlights: collectEvidenceHighlights(
        {
          claimIds: catalyst.linkedClaimIds,
          sourceIds: catalyst.linkedSourceIds,
          limit: 3,
        },
        evidenceLookup,
      ),
    };
  });
}

export async function updateCatalystReviewStatus(input: {
  catalystId: string;
  reviewStatus: CatalystReviewStatus;
  reviewNote?: string | null;
}): Promise<Catalyst | null> {
  const catalyst = await catalystsRepository.updateReviewStatus(
    input.catalystId,
    input.reviewStatus,
    input.reviewNote,
  );

  if (!catalyst) {
    return null;
  }

  const eventType =
    input.reviewStatus === "resolved"
      ? "catalyst_resolved"
      : input.reviewStatus === "invalidated"
        ? "catalyst_invalidated"
        : "catalyst_reviewed";
  const title =
    input.reviewStatus === "resolved"
      ? "Catalyst resolved"
      : input.reviewStatus === "invalidated"
        ? "Catalyst invalidated"
        : "Catalyst reviewed";

  await recordOperationalAuditEvent({
    projectId: catalyst.projectId,
    eventType,
    title,
    description: input.reviewNote
      ? `${title}: ${catalyst.title}. Note: ${input.reviewNote}`
      : `${title}: ${catalyst.title}.`,
    relatedObjectType: "catalyst_tracker",
    relatedObjectId: catalyst.id,
    metadata: {
      catalystType: catalyst.catalystType,
      reviewStatus: catalyst.reviewStatus,
    },
  });

  return catalyst;
}

export async function getProjectCatalystPageData(
  projectId: string,
): Promise<CatalystPageData> {
  const [catalysts, compileState] = await Promise.all([
    listProjectCatalysts(projectId),
    catalystsRepository.getCompileState(projectId),
  ]);

  const summary = {
    totalCatalysts: catalysts.length,
    upcomingCatalysts: catalysts.filter((entry) => entry.catalyst.status === "upcoming")
      .length,
    reviewedCatalysts: catalysts.filter(
      (entry) => entry.catalyst.reviewStatus === "reviewed",
    ).length,
    resolvedCatalysts: catalysts.filter(
      (entry) => entry.catalyst.reviewStatus === "resolved",
    ).length,
    invalidatedCatalysts: catalysts.filter(
      (entry) => entry.catalyst.reviewStatus === "invalidated",
    ).length,
    highImportanceCatalysts: catalysts.filter(
      (entry) => entry.catalyst.importance === "high",
    ).length,
  };

  return {
    catalysts,
    compileState,
    summary,
    metrics: [
      {
        label: "Catalysts",
        value: String(summary.totalCatalysts),
        note: "Catalysts are compiled intelligence objects, not loose thesis bullets.",
      },
      {
        label: "Upcoming",
        value: String(summary.upcomingCatalysts),
        note: "Upcoming catalysts are those whose expected window still sits ahead of the current date.",
      },
      {
        label: "Reviewed",
        value: String(summary.reviewedCatalysts),
        note: "Reviewed catalysts have already been assessed by the operator but remain live in the tracker.",
      },
      {
        label: "High Importance",
        value: String(summary.highImportanceCatalysts),
        note: "Importance is heuristic and currently favors thesis-moving categories with stronger support.",
      },
      {
        label: "Last Compile",
        value: compileState.lastCompiledAt
          ? new Intl.DateTimeFormat("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            }).format(new Date(compileState.lastCompiledAt))
          : "Not compiled",
        note: compileState.summary,
      },
    ],
  };
}
