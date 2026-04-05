import type {
  Claim,
  Contradiction,
  ContradictionAnalysisState,
  ContradictionDraft,
  ContradictionSeverity,
  ResearchEntity,
  RevisionConfidence,
  Source,
  TimelineEvent,
  WikiPage,
  WikiPageRevision,
} from "@/lib/domain/types";
import { claimsRepository } from "@/lib/repositories/claims-repository";
import { contradictionsRepository } from "@/lib/repositories/contradictions-repository";
import { sourcesRepository } from "@/lib/repositories/sources-repository";
import { timelineEventsRepository } from "@/lib/repositories/timeline-events-repository";
import { wikiRepository } from "@/lib/repositories/wiki-repository";
import {
  compileProjectEntities,
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
  buildSemanticProfile,
  dominantConflictTheme,
  formatThemeLabel,
  jaccardSimilarity,
  sharedMeaningfulTokens,
  sharedThemes,
  summarizeThemeList,
  tokenizeMeaningful,
  type SemanticTheme,
} from "@/lib/services/semantic-intelligence-v1";

type PageContradictionContext = {
  page: WikiPage;
  revision: WikiPageRevision | null;
  sourceIds: string[];
};

type TextComparison = {
  signalKind: "canon-vs-chat" | "directional" | "numeric" | "status";
  reason: string;
  overlap: number;
  sharedThemes: SemanticTheme[];
  sharedTokens: string[];
  primaryTheme: SemanticTheme | null;
};

export type ContradictionReferenceRecord = {
  contradiction: Contradiction;
  leftClaim: Claim | null;
  rightClaim: Claim | null;
  relatedPages: WikiPage[];
  relatedSources: Source[];
  relatedTimelineEvents: TimelineEvent[];
};

export type ProjectContradictionSummary = {
  totalContradictions: number;
  highSeverityContradictions: number;
  unresolvedContradictions: number;
  reviewedContradictions: number;
};

export type ContradictionsPageData = {
  contradictions: ContradictionReferenceRecord[];
  analysisState: ContradictionAnalysisState;
  metrics: Array<{ label: string; value: string; note: string }>;
};

const severityOrder: Record<ContradictionSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim();
}

function stableKey(...parts: Array<string | null | undefined>): string {
  return parts
    .filter((part): part is string => Boolean(part))
    .map((part) => part.toLowerCase().replace(/[^a-z0-9]+/g, "-"))
    .join("-");
}

function preview(value: string, length = 220): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > length
    ? `${normalized.slice(0, length).trimEnd()}...`
    : normalized;
}

function sharedEntitiesForTexts(
  entities: ResearchEntity[],
  leftText: string,
  rightText: string,
): ResearchEntity[] {
  const leftMatches = matchEntitiesToText(entities, leftText);
  const rightMatches = matchEntitiesToText(entities, rightText);
  const rightIds = new Set(rightMatches.map((entity) => entity.id));

  return leftMatches.filter((entity) => rightIds.has(entity.id));
}

function entitySummary(sharedEntities: ResearchEntity[]): string | null {
  if (sharedEntities.length === 0) {
    return null;
  }

  return sharedEntities
    .slice(0, 2)
    .map((entity) => entity.canonicalName)
    .join(", ");
}

function extractNumbers(value: string): string[] {
  return Array.from(
    value.matchAll(/\b\d+(?:\.\d+)?%?\b/g),
    (match) => match[0],
  );
}

function hasNegation(value: string): boolean {
  const normalized = normalizeText(value);
  return (
    normalized.includes(" not ") ||
    normalized.startsWith("not ") ||
    normalized.includes(" never ") ||
    normalized.includes(" without ") ||
    normalized.includes(" rather than ") ||
    normalized.includes(" instead of ") ||
    normalized.includes(" must not ")
  );
}

function extractStatusTerms(value: string): string[] {
  const normalized = normalizeText(value);
  const statuses = [
    "compiled",
    "parsed",
    "failed",
    "pending",
    "draft",
    "active",
    "stale",
    "running",
    "completed",
    "archived",
  ];

  return statuses.filter((status) => normalized.includes(status));
}

function detectConflictSignal(leftText: string, rightText: string): TextComparison | null {
  const leftTokens = tokenizeMeaningful(leftText);
  const rightTokens = tokenizeMeaningful(rightText);
  const overlap = jaccardSimilarity(leftTokens, rightTokens);
  const leftProfile = buildSemanticProfile(leftText);
  const rightProfile = buildSemanticProfile(rightText);
  const commonThemes = sharedThemes(leftProfile, rightProfile);
  const commonTokens = sharedMeaningfulTokens(leftTokens, rightTokens);
  const leftNormalized = normalizeText(leftText);
  const rightNormalized = normalizeText(rightText);
  const hasComparableContext = overlap >= 0.12 || commonThemes.length > 0 || commonTokens.length >= 2;

  if (!hasComparableContext) {
    return null;
  }

  const leftCanon = ["canonical", "canon", "wiki", "compiled"].some((token) =>
    leftNormalized.includes(token),
  );
  const rightCanon = ["canonical", "canon", "wiki", "compiled"].some((token) =>
    rightNormalized.includes(token),
  );
  const leftChat = ["chat", "assistant", "conversational"].some((token) =>
    leftNormalized.includes(token),
  );
  const rightChat = ["chat", "assistant", "conversational"].some((token) =>
    rightNormalized.includes(token),
  );
  const leftRawFirst =
    leftNormalized.includes("raw files") ||
    leftNormalized.includes("raw file") ||
    leftNormalized.includes("raw sources") ||
    leftNormalized.includes("before canonical wiki") ||
    leftNormalized.includes("before canonical");
  const rightRawFirst =
    rightNormalized.includes("raw files") ||
    rightNormalized.includes("raw file") ||
    rightNormalized.includes("raw sources") ||
    rightNormalized.includes("before canonical wiki") ||
    rightNormalized.includes("before canonical");

  if (
    ((leftCanon || hasNegation(leftText)) && (rightChat || rightRawFirst)) ||
    ((rightCanon || hasNegation(rightText)) && (leftChat || leftRawFirst))
  ) {
    return {
      signalKind: "canon-vs-chat",
      reason:
        "One record centers canonical wiki compilation while the other argues for direct conversational retrieval from raw files or sources.",
      overlap,
      sharedThemes: commonThemes,
      sharedTokens: commonTokens,
      primaryTheme: null,
    };
  }

  const primaryTheme = dominantConflictTheme(leftProfile, rightProfile);

  if (primaryTheme) {
    return {
      signalKind: "directional",
      reason: `The compared records describe ${formatThemeLabel(primaryTheme)} with materially opposing directionality, mixing strengthening language with pressure, delay, or downside language.`,
      overlap,
      sharedThemes: commonThemes,
      sharedTokens: commonTokens,
      primaryTheme,
    };
  }

  const leftNumbers = extractNumbers(leftText);
  const rightNumbers = extractNumbers(rightText);

  if (
    leftNumbers.length > 0 &&
    rightNumbers.length > 0 &&
    leftNumbers.every((value) => !rightNumbers.includes(value)) &&
    (overlap >= 0.16 || commonThemes.length > 0)
  ) {
    return {
      signalKind: "numeric",
      reason: `The compared records cite different numeric values (${leftNumbers[0]} vs ${rightNumbers[0]}) for overlapping ${summarizeThemeList(commonThemes)}.`,
      overlap,
      sharedThemes: commonThemes,
      sharedTokens: commonTokens,
      primaryTheme: commonThemes[0] ?? null,
    };
  }

  const leftStatuses = extractStatusTerms(leftText);
  const rightStatuses = extractStatusTerms(rightText);

  if (
    leftStatuses.length > 0 &&
    rightStatuses.length > 0 &&
    leftStatuses.every((status) => !rightStatuses.includes(status))
  ) {
    return {
      signalKind: "status",
      reason: `The records describe overlapping scope with incompatible status signals (${leftStatuses[0]} vs ${rightStatuses[0]}).`,
      overlap,
      sharedThemes: commonThemes,
      sharedTokens: commonTokens,
      primaryTheme: commonThemes[0] ?? null,
    };
  }

  return null;
}

function severityForComparison(
  comparison: TextComparison,
  confidence: RevisionConfidence,
): ContradictionSeverity {
  if (
    comparison.primaryTheme &&
    ["pricing", "margin", "demand", "timing", "guidance", "earnings", "product", "regulatory", "customer"].includes(
      comparison.primaryTheme,
    ) &&
    confidence === "high"
  ) {
    return "high";
  }

  if (comparison.signalKind === "numeric" || comparison.signalKind === "canon-vs-chat") {
    return confidence === "high" ? "high" : "medium";
  }

  if (comparison.signalKind === "directional") {
    return confidence === "high" ? "high" : "medium";
  }

  return confidence === "high" ? "medium" : "low";
}

function contradictionConfidenceAssessment(input: {
  overlap: number;
  sourceDiversityCount: number;
  freshnessBurden?: number;
  entityClarity: number;
  datePrecision?: number;
  anchoredByClaims?: boolean;
  reviewPosture?: number;
}): {
  label: RevisionConfidence;
  score: number;
  summary: string;
  factors: string;
} {
  const supportDensity = Math.max(
    0,
    Math.min(
      input.overlap * 2 + (input.anchoredByClaims ? 0.2 : 0) + (input.sourceDiversityCount > 0 ? 0.1 : 0),
      1,
    ),
  );
  const assessment = buildConfidenceAssessment({
    supportDensity,
    sourceDiversityCount: input.sourceDiversityCount,
    contradictionBurden: 0,
    freshnessBurden: input.freshnessBurden ?? 0,
    entityClarity: input.entityClarity,
    datePrecision: input.datePrecision ?? 0.4,
    reviewPosture: input.reviewPosture ?? 0,
  });

  return {
    label: assessment.label,
    score: assessment.score,
    summary: assessment.summary,
    factors: serializeConfidenceFactors(assessment.factors),
  };
}

function confidenceRank(value: RevisionConfidence | null | undefined): number {
  if (value === "high") {
    return 3;
  }

  if (value === "medium") {
    return 2;
  }

  return 1;
}

function maxConfidence(
  left: RevisionConfidence | null | undefined,
  right: RevisionConfidence | null | undefined,
): RevisionConfidence {
  return confidenceRank(left) >= confidenceRank(right)
    ? (left ?? "low")
    : (right ?? "low");
}

function sortContradictions(contradictions: Contradiction[]): Contradiction[] {
  const statusOrder = {
    open: 0,
    reviewed: 1,
    resolved: 2,
  } as const;

  return structuredClone(contradictions).sort((left, right) => {
    if (left.status !== right.status) {
      return statusOrder[left.status] - statusOrder[right.status];
    }

    return (
      severityOrder[left.severity] - severityOrder[right.severity] ||
      right.updatedAt.localeCompare(left.updatedAt)
    );
  });
}

function summarizeContradictions(
  contradictions: Contradiction[],
): ProjectContradictionSummary {
  return {
    totalContradictions: contradictions.length,
    highSeverityContradictions: contradictions.filter(
      (contradiction) =>
        contradiction.severity === "critical" || contradiction.severity === "high",
    ).length,
    unresolvedContradictions: contradictions.filter(
      (contradiction) => contradiction.status !== "resolved",
    ).length,
    reviewedContradictions: contradictions.filter(
      (contradiction) => contradiction.status === "reviewed",
    ).length,
  };
}

async function buildPageContexts(projectId: string): Promise<PageContradictionContext[]> {
  const pages = await wikiRepository.listPagesByProjectId(projectId);

  return Promise.all(
    pages.map(async (page) => {
      const [revision, sourceIds] = await Promise.all([
        wikiRepository.getCurrentRevision(page.id),
        wikiRepository.listSourceIdsForPage(page.id),
      ]);

      return {
        page,
        revision,
        sourceIds,
      };
    }),
  );
}

async function computeContradictionDrafts(projectId: string): Promise<ContradictionDraft[]> {
  const [claims, sources, pageContexts, timelineEvents, entityCompileResult] = await Promise.all([
    claimsRepository.listByProjectId(projectId),
    sourcesRepository.listByProjectId(projectId),
    buildPageContexts(projectId),
    timelineEventsRepository.listByProjectId(projectId),
    compileProjectEntities(projectId),
  ]);
  const entities = entityCompileResult.entities;
  const issues: ContradictionDraft[] = [];
  const pageIdsBySourceId = new Map<string, string[]>();

  for (const context of pageContexts) {
    for (const sourceId of context.sourceIds) {
      pageIdsBySourceId.set(sourceId, [
        ...(pageIdsBySourceId.get(sourceId) ?? []),
        context.page.id,
      ]);
    }
  }

  for (let index = 0; index < claims.length; index += 1) {
    for (let pairIndex = index + 1; pairIndex < claims.length; pairIndex += 1) {
      const left = claims[index];
      const right = claims[pairIndex];
      const comparison = detectConflictSignal(left.text, right.text);

      if (!comparison) {
        continue;
      }

      const sharedEntities = sharedEntitiesForTexts(entities, left.text, right.text);

      if (
        sharedEntities.length === 0 &&
        comparison.primaryTheme === null &&
        comparison.sharedTokens.length < 3
      ) {
        continue;
      }

      const newer = left.createdAt >= right.createdAt ? left : right;
      const older = newer.id === left.id ? right : left;
      const contradictionType =
        newer.createdAt.localeCompare(older.createdAt) > 0 &&
        (comparison.primaryTheme !== null ||
          left.wikiPageId === right.wikiPageId ||
          left.sourceId === right.sourceId)
          ? "stale_vs_newer_claim"
          : "direct_claim_conflict";
      const confidenceAssessment = contradictionConfidenceAssessment({
        overlap:
        comparison.overlap +
          comparison.sharedThemes.length * 0.18 +
          comparison.sharedTokens.length * 0.03 +
          sharedEntities.length * 0.08 +
          (comparison.primaryTheme ? 0.08 : 0) +
          (contradictionType === "stale_vs_newer_claim" ? 0.06 : 0) +
          (maxConfidence(left.confidence, right.confidence) === "high" ? 0.1 : 0),
        sourceDiversityCount: new Set(
          [left.sourceId ?? null, right.sourceId ?? null].filter((value): value is string => Boolean(value)),
        ).size,
        freshnessBurden: contradictionType === "stale_vs_newer_claim" ? 0.35 : 0,
        entityClarity: sharedEntities.length > 0 ? Math.min(sharedEntities.length / 2, 1) : comparison.primaryTheme ? 0.65 : 0.35,
        anchoredByClaims: true,
      });
      const confidence = confidenceAssessment.label;
      const scopeLabel = sharedEntities[0]?.canonicalName ?? (comparison.primaryTheme
        ? formatThemeLabel(comparison.primaryTheme)
        : "claim");

      issues.push({
        stableKey: stableKey("claim", contradictionType, left.id, right.id),
        projectId,
        contradictionType,
        title:
          contradictionType === "stale_vs_newer_claim"
            ? `Newer ${scopeLabel} claim conflicts with older canon`
            : `${scopeLabel[0]?.toUpperCase() ?? "C"}${scopeLabel.slice(1)} claim conflict`,
        description: `${preview(left.text, 140)} / ${preview(right.text, 140)}`,
        severity: severityForComparison(comparison, confidence),
        confidence,
        leftClaimId: left.id,
        rightClaimId: right.id,
        relatedPageIds: Array.from(new Set([left.wikiPageId, right.wikiPageId])),
        relatedSourceIds: Array.from(
          new Set([left.sourceId ?? null, right.sourceId ?? null].filter(Boolean) as string[]),
        ),
        relatedTimelineEventIds: [],
        rationale: `${comparison.reason} ${entitySummary(sharedEntities) ? `Shared entity scope: ${entitySummary(sharedEntities)}. ` : ""}Shared tokens: ${comparison.sharedTokens.join(", ") || "theme overlap only"}. Newer claim timestamp: ${newer.createdAt.slice(0, 10)}.`,
        metadata: {
          newerClaimId: newer.id,
          olderClaimId: older.id,
          primaryTheme: comparison.primaryTheme ?? "",
          entityNames: sharedEntities.map((entity) => entity.canonicalName).join(", "),
          confidenceScore: confidenceAssessment.score.toFixed(2),
          confidenceSummary: confidenceAssessment.summary,
          confidenceFactors: confidenceAssessment.factors,
        },
      });
    }
  }

  for (let index = 0; index < sources.length; index += 1) {
    for (let pairIndex = index + 1; pairIndex < sources.length; pairIndex += 1) {
      const left = sources[index];
      const right = sources[pairIndex];
      const comparison = detectConflictSignal(
        `${left.title}. ${left.body ?? ""}`,
        `${right.title}. ${right.body ?? ""}`,
      );

      if (!comparison) {
        continue;
      }

      const leftText = `${left.title}. ${left.body ?? ""}`;
      const rightText = `${right.title}. ${right.body ?? ""}`;
      const sharedEntities = sharedEntitiesForTexts(entities, leftText, rightText);

      if (
        sharedEntities.length === 0 &&
        comparison.primaryTheme === null &&
        comparison.sharedTokens.length < 3
      ) {
        continue;
      }

      const confidenceAssessment = contradictionConfidenceAssessment({
        overlap:
        comparison.overlap +
          comparison.sharedThemes.length * 0.18 +
          comparison.sharedTokens.length * 0.03 +
          sharedEntities.length * 0.08 +
          (comparison.primaryTheme ? 0.06 : 0),
        sourceDiversityCount: 2,
        entityClarity: sharedEntities.length > 0 ? Math.min(sharedEntities.length / 2, 1) : comparison.primaryTheme ? 0.65 : 0.35,
      });
      const confidence = confidenceAssessment.label;

      issues.push({
        stableKey: stableKey("source", left.id, right.id, comparison.signalKind),
        projectId,
        contradictionType: "source_disagreement",
        title: sharedEntities[0]
          ? `Source disagreement on ${sharedEntities[0].canonicalName}`
          : comparison.primaryTheme
          ? `Source disagreement on ${formatThemeLabel(comparison.primaryTheme)}`
          : `Source disagreement: ${left.title} vs ${right.title}`,
        description: `${preview(left.body ?? left.title, 120)} / ${preview(right.body ?? right.title, 120)}`,
        severity: severityForComparison(comparison, confidence),
        confidence,
        leftClaimId: null,
        rightClaimId: null,
        relatedPageIds: Array.from(
          new Set([
            ...(pageIdsBySourceId.get(left.id) ?? []),
            ...(pageIdsBySourceId.get(right.id) ?? []),
          ]),
        ),
        relatedSourceIds: [left.id, right.id],
        relatedTimelineEventIds: [],
        rationale: `${comparison.reason} ${entitySummary(sharedEntities) ? `Shared entity scope: ${entitySummary(sharedEntities)}. ` : ""}This pair was flagged from overlapping source narratives rather than canonical claim ids.`,
        metadata: {
          primaryTheme: comparison.primaryTheme ?? "",
          entityNames: sharedEntities.map((entity) => entity.canonicalName).join(", "),
          confidenceScore: confidenceAssessment.score.toFixed(2),
          confidenceSummary: confidenceAssessment.summary,
          confidenceFactors: confidenceAssessment.factors,
        },
      });
    }
  }

  for (let index = 0; index < pageContexts.length; index += 1) {
    for (let pairIndex = index + 1; pairIndex < pageContexts.length; pairIndex += 1) {
      const left = pageContexts[index];
      const right = pageContexts[pairIndex];
      const leftText = [left.page.title, left.revision?.summary ?? "", left.revision?.markdownContent ?? ""].join(" ");
      const rightText = [right.page.title, right.revision?.summary ?? "", right.revision?.markdownContent ?? ""].join(" ");
      const comparison = detectConflictSignal(leftText, rightText);

      if (!comparison) {
        continue;
      }

      const sharedEntities = sharedEntitiesForTexts(entities, leftText, rightText);

      if (
        sharedEntities.length === 0 &&
        comparison.primaryTheme === null &&
        comparison.sharedTokens.length < 3
      ) {
        continue;
      }

      const confidenceAssessment = contradictionConfidenceAssessment({
        overlap:
        comparison.overlap +
          comparison.sharedThemes.length * 0.18 +
          comparison.sharedTokens.length * 0.03 +
          sharedEntities.length * 0.08 +
          (left.revision?.confidence === "high" || right.revision?.confidence === "high"
            ? 0.08
            : 0),
        sourceDiversityCount: new Set([...left.sourceIds, ...right.sourceIds]).size,
        entityClarity: sharedEntities.length > 0 ? Math.min(sharedEntities.length / 2, 1) : comparison.primaryTheme ? 0.65 : 0.35,
      });
      const confidence = confidenceAssessment.label;

      issues.push({
        stableKey: stableKey("page", left.page.id, right.page.id, comparison.signalKind),
        projectId,
        contradictionType: "overlapping_but_inconsistent_summary",
        title: sharedEntities[0]
          ? `Canonical tension on ${sharedEntities[0].canonicalName}`
          : comparison.primaryTheme
          ? `Canonical summary tension on ${formatThemeLabel(comparison.primaryTheme)}`
          : `Canonical summary tension: ${left.page.title} vs ${right.page.title}`,
        description: `${preview(left.revision?.summary ?? leftText, 120)} / ${preview(right.revision?.summary ?? rightText, 120)}`,
        severity: severityForComparison(comparison, confidence),
        confidence,
        leftClaimId: null,
        rightClaimId: null,
        relatedPageIds: [left.page.id, right.page.id],
        relatedSourceIds: Array.from(new Set([...left.sourceIds, ...right.sourceIds])),
        relatedTimelineEventIds: [],
        rationale: `${comparison.reason} ${entitySummary(sharedEntities) ? `Shared entity scope: ${entitySummary(sharedEntities)}. ` : ""}The current page summaries overlap enough to warrant review as canonical tension rather than isolated note variance.`,
        metadata: {
          primaryTheme: comparison.primaryTheme ?? "",
          entityNames: sharedEntities.map((entity) => entity.canonicalName).join(", "),
          confidenceScore: confidenceAssessment.score.toFixed(2),
          confidenceSummary: confidenceAssessment.summary,
          confidenceFactors: confidenceAssessment.factors,
        },
      });
    }
  }

  for (const pageContext of pageContexts) {
    const pageText = [
      pageContext.page.title,
      pageContext.revision?.summary ?? "",
      pageContext.revision?.markdownContent ?? "",
    ].join(" ");

    for (const source of sources) {
      const comparison = detectConflictSignal(pageText, `${source.title}. ${source.body ?? ""}`);

      if (!comparison) {
        continue;
      }

      const sourceText = `${source.title}. ${source.body ?? ""}`;
      const sharedEntities = sharedEntitiesForTexts(entities, pageText, sourceText);

      if (
        pageContext.sourceIds.includes(source.id) &&
        comparison.signalKind !== "status" &&
        comparison.signalKind !== "numeric"
      ) {
        continue;
      }

      if (
        sharedEntities.length === 0 &&
        comparison.primaryTheme === null &&
        comparison.sharedTokens.length < 3
      ) {
        continue;
      }

      const confidenceAssessment = contradictionConfidenceAssessment({
        overlap:
        comparison.overlap +
          comparison.sharedThemes.length * 0.18 +
          comparison.sharedTokens.length * 0.03 +
          sharedEntities.length * 0.08 +
          (comparison.primaryTheme ? 0.05 : 0),
        sourceDiversityCount: 1,
        entityClarity: sharedEntities.length > 0 ? Math.min(sharedEntities.length / 2, 1) : comparison.primaryTheme ? 0.65 : 0.35,
      });
      const confidence = confidenceAssessment.label;

      issues.push({
        stableKey: stableKey("page-source", pageContext.page.id, source.id, comparison.signalKind),
        projectId,
        contradictionType: "source_disagreement",
        title: sharedEntities[0]
          ? `Canon disagrees on ${sharedEntities[0].canonicalName}`
          : comparison.primaryTheme
          ? `Canon disagrees with source on ${formatThemeLabel(comparison.primaryTheme)}`
          : `Canonical summary disagrees with source note: ${pageContext.page.title}`,
        description: `${preview(pageContext.revision?.summary ?? pageContext.page.title, 120)} / ${preview(source.body ?? source.title, 120)}`,
        severity: severityForComparison(comparison, confidence),
        confidence,
        leftClaimId: null,
        rightClaimId: null,
        relatedPageIds: [pageContext.page.id],
        relatedSourceIds: [source.id],
        relatedTimelineEventIds: [],
        rationale: `${comparison.reason} ${entitySummary(sharedEntities) ? `Shared entity scope: ${entitySummary(sharedEntities)}. ` : ""}The contradiction was detected between canon and a project source record, not between two claims.`,
        metadata: {
          primaryTheme: comparison.primaryTheme ?? "",
          entityNames: sharedEntities.map((entity) => entity.canonicalName).join(", "),
          confidenceScore: confidenceAssessment.score.toFixed(2),
          confidenceSummary: confidenceAssessment.summary,
          confidenceFactors: confidenceAssessment.factors,
        },
      });
    }
  }

  for (let index = 0; index < timelineEvents.length; index += 1) {
    for (let pairIndex = index + 1; pairIndex < timelineEvents.length; pairIndex += 1) {
      const left = timelineEvents[index];
      const right = timelineEvents[pairIndex];
      const sourceOverlap = left.sourceIds.some((sourceId) => right.sourceIds.includes(sourceId));
      const pageOverlap = left.wikiPageIds.some((pageId) => right.wikiPageIds.includes(pageId));
      const leftText = `${left.title} ${left.description}`;
      const rightText = `${right.title} ${right.description}`;
      const titleOverlap = jaccardSimilarity(
        tokenizeMeaningful(left.title),
        tokenizeMeaningful(right.title),
      );
      const comparison = detectConflictSignal(leftText, rightText);
      const sharedEntities = sharedEntitiesForTexts(entities, leftText, rightText);
      const impactTheme = comparison?.primaryTheme ?? null;
      const dayDiff = Math.abs(
        new Date(left.eventDate).getTime() - new Date(right.eventDate).getTime(),
      ) / (1000 * 60 * 60 * 24);
      const highImpactTiming =
        impactTheme &&
        ["pricing", "margin", "demand", "timing", "product", "regulatory", "customer", "earnings", "guidance"].includes(
          impactTheme,
        );

      if (
        !(sourceOverlap || pageOverlap || titleOverlap >= 0.28 || comparison || sharedEntities.length > 0) ||
        dayDiff < (highImpactTiming ? 45 : 90)
      ) {
        continue;
      }

      const confidenceAssessment = contradictionConfidenceAssessment({
        overlap:
        titleOverlap +
          (comparison ? comparison.sharedThemes.length * 0.16 : 0) +
          sharedEntities.length * 0.08 +
          (left.eventDatePrecision === "exact_day" && right.eventDatePrecision === "exact_day"
            ? 0.2
            : 0.08),
        sourceDiversityCount: new Set([...left.sourceIds, ...right.sourceIds]).size,
        entityClarity: sharedEntities.length > 0 ? Math.min(sharedEntities.length / 2, 1) : impactTheme ? 0.65 : 0.35,
        datePrecision:
          left.eventDatePrecision === "exact_day" && right.eventDatePrecision === "exact_day"
            ? 1
            : left.eventDatePrecision === "month" || right.eventDatePrecision === "month"
              ? 0.65
              : 0.35,
      });
      const confidence = confidenceAssessment.label;

      issues.push({
        stableKey: stableKey("timeline", left.id, right.id),
        projectId,
        contradictionType: "timeline_tension",
        title: sharedEntities[0]
          ? `Timeline tension on ${sharedEntities[0].canonicalName}`
          : impactTheme
          ? `Timeline tension on ${formatThemeLabel(impactTheme)}`
          : `Timeline tension between ${left.title} and ${right.title}`,
        description: `${preview(left.description, 110)} / ${preview(right.description, 110)}`,
        severity:
          highImpactTiming && dayDiff >= 180
            ? "critical"
            : highImpactTiming || dayDiff >= 365
              ? "high"
              : "medium",
        confidence,
        leftClaimId: null,
        rightClaimId: null,
        relatedPageIds: Array.from(new Set([...left.wikiPageIds, ...right.wikiPageIds])),
        relatedSourceIds: Array.from(new Set([...left.sourceIds, ...right.sourceIds])),
        relatedTimelineEventIds: [left.id, right.id],
        rationale: comparison
          ? `${comparison.reason} ${entitySummary(sharedEntities) ? `Shared entity scope: ${entitySummary(sharedEntities)}. ` : ""}The timeline compiler placed related ${formatThemeLabel(
              impactTheme ?? comparison.sharedThemes[0] ?? "timing",
            )} events ${Math.round(dayDiff)} days apart, which can change thesis timing and catalyst posture.`
          : `${entitySummary(sharedEntities) ? `Shared entity scope: ${entitySummary(sharedEntities)}. ` : ""}The timeline compiler produced overlapping events tied to related scope but placed them ${Math.round(dayDiff)} days apart. Review chronology, date precision, and source provenance together.`,
        metadata: {
          primaryTheme: impactTheme ?? "",
          dayDiff: String(Math.round(dayDiff)),
          entityNames: sharedEntities.map((entity) => entity.canonicalName).join(", "),
          confidenceScore: confidenceAssessment.score.toFixed(2),
          confidenceSummary: confidenceAssessment.summary,
          confidenceFactors: confidenceAssessment.factors,
        },
      });
    }
  }

  return issues;
}

export async function runProjectContradictionAnalysis(
  projectId: string,
): Promise<Contradiction[]> {
  const job = await startOperationalJob({
    projectId,
    jobType: "rerun_contradictions",
    targetObjectType: "contradictions",
    targetObjectId: projectId,
    triggeredBy: "workspace-user",
    summary: "Contradiction analysis started.",
  });

  try {
    const drafts = await computeContradictionDrafts(projectId);
    const summary = `Contradiction analysis produced ${drafts.length} record(s) across claims, sources, page summaries, and timeline events.`;
    const contradictions = await contradictionsRepository.syncProjectContradictions(
      projectId,
      drafts,
      summary,
    );
    await completeOperationalJob({
      jobId: job.id,
      summary,
      targetObjectId: projectId,
      metadata: {
        contradictionCount: String(contradictions.length),
        unresolvedCount: String(
          contradictions.filter((entry) => entry.status !== "resolved").length,
        ),
      },
    });
    await recordOperationalAuditEvent({
      projectId,
      eventType: "contradictions_reran",
      title: "Contradictions re-ran",
      description: summary,
      relatedObjectType: "contradictions",
      relatedObjectId: projectId,
      relatedJobId: job.id,
      metadata: {
        contradictionCount: String(contradictions.length),
      },
    });

    return contradictions;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown contradiction analysis failure.";
    await failOperationalJob(job.id, `Contradiction analysis failed: ${message}`);
    await recordOperationalAuditEvent({
      projectId,
      eventType: "job_failed",
      title: "Contradiction analysis failed",
      description: `Contradiction analysis failed for project ${projectId}: ${message}`,
      relatedObjectType: "contradictions",
      relatedObjectId: projectId,
      relatedJobId: job.id,
      metadata: { jobType: "rerun_contradictions" },
    });
    throw error;
  }
}

export async function updateContradictionStatus(
  contradictionId: string,
  status: Contradiction["status"],
  reviewNote?: string | null,
): Promise<Contradiction | null> {
  const contradiction = await contradictionsRepository.updateStatus(
    contradictionId,
    status,
    reviewNote,
  );

  if (!contradiction) {
    return null;
  }

  const eventType =
    status === "resolved" ? "contradiction_resolved" : "contradiction_reviewed";
  const title =
    status === "resolved" ? "Contradiction resolved" : "Contradiction reviewed";
  const description = reviewNote
    ? `${title}: ${contradiction.title}. Note: ${reviewNote}`
    : `${title}: ${contradiction.title}.`;

  await recordOperationalAuditEvent({
    projectId: contradiction.projectId,
    eventType,
    title,
    description,
    relatedObjectType: "contradictions",
    relatedObjectId: contradiction.id,
    metadata: {
      contradictionType: contradiction.contradictionType,
      status: contradiction.status,
    },
  });

  return contradiction;
}

export async function listProjectContradictions(
  projectId: string,
): Promise<ContradictionReferenceRecord[]> {
  const [contradictions, claims, sources, pages, timelineEvents] = await Promise.all([
    contradictionsRepository.listByProjectId(projectId),
    claimsRepository.listByProjectId(projectId),
    sourcesRepository.listByProjectId(projectId),
    wikiRepository.listPagesByProjectId(projectId),
    timelineEventsRepository.listByProjectId(projectId),
  ]);
  const claimsById = new Map(claims.map((claim) => [claim.id, claim] as const));
  const sourcesById = new Map(sources.map((source) => [source.id, source] as const));
  const pagesById = new Map(pages.map((page) => [page.id, page] as const));
  const eventsById = new Map(timelineEvents.map((event) => [event.id, event] as const));

  return sortContradictions(contradictions).map((contradiction) => ({
    contradiction,
    leftClaim: contradiction.leftClaimId
      ? claimsById.get(contradiction.leftClaimId) ?? null
      : null,
    rightClaim: contradiction.rightClaimId
      ? claimsById.get(contradiction.rightClaimId) ?? null
      : null,
    relatedPages: contradiction.relatedPageIds
      .map((pageId) => pagesById.get(pageId) ?? null)
      .filter((page): page is WikiPage => Boolean(page)),
    relatedSources: contradiction.relatedSourceIds
      .map((sourceId) => sourcesById.get(sourceId) ?? null)
      .filter((source): source is Source => Boolean(source)),
    relatedTimelineEvents: contradiction.relatedTimelineEventIds
      .map((eventId) => eventsById.get(eventId) ?? null)
      .filter((event): event is TimelineEvent => Boolean(event)),
  }));
}

export async function getProjectContradictionSnapshot(projectId: string): Promise<{
  contradictions: Contradiction[];
  summary: ProjectContradictionSummary;
  analysisState: ContradictionAnalysisState;
}> {
  const [contradictions, analysisState] = await Promise.all([
    contradictionsRepository.listByProjectId(projectId),
    contradictionsRepository.getAnalysisState(projectId),
  ]);

  return {
    contradictions: sortContradictions(contradictions),
    summary: summarizeContradictions(contradictions),
    analysisState,
  };
}

export async function getProjectContradictionsPageData(
  projectId: string,
): Promise<ContradictionsPageData> {
  const [contradictions, analysisState] = await Promise.all([
    listProjectContradictions(projectId),
    contradictionsRepository.getAnalysisState(projectId),
  ]);
  const summary = summarizeContradictions(contradictions.map((entry) => entry.contradiction));

  return {
    contradictions,
    analysisState,
    metrics: [
      {
        label: "Contradictions",
        value: String(summary.totalContradictions),
        note: "These records are compiled disagreement objects, not generic warning banners.",
      },
      {
        label: "High Severity",
        value: String(summary.highSeverityContradictions),
        note: "High-severity contradictions should be reviewed before treating the affected canon as stable.",
      },
      {
        label: "Unresolved",
        value: String(summary.unresolvedContradictions),
        note: "Reviewed and open items remain active integrity work until explicitly resolved.",
      },
      {
        label: "Reviewed",
        value: String(summary.reviewedContradictions),
        note: "Reviewed contradictions remain visible so operator judgment does not disappear into a binary resolved state.",
      },
      {
        label: "Last Analysis",
        value: analysisState.lastAnalyzedAt
          ? new Intl.DateTimeFormat("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            }).format(new Date(analysisState.lastAnalyzedAt))
          : "Not analyzed",
        note: analysisState.summary,
      },
    ],
  };
}
