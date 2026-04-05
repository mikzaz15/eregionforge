import type {
  Artifact,
  ArtifactType,
  AskAnswerMode,
  AskSession,
  Claim,
  CompanyDossier,
  ResearchEntity,
  RevisionConfidence,
  Source,
  SourceFragment,
  Thesis,
  WikiPage,
  WikiPageRevision,
  WikiPageType,
} from "@/lib/domain/types";
import { askSessionsRepository } from "@/lib/repositories/ask-sessions-repository";
import { claimsRepository } from "@/lib/repositories/claims-repository";
import { companyDossiersRepository } from "@/lib/repositories/company-dossiers-repository";
import { evidenceLinksRepository } from "@/lib/repositories/evidence-links-repository";
import { sourceFragmentsRepository } from "@/lib/repositories/source-fragments-repository";
import { sourcesRepository } from "@/lib/repositories/sources-repository";
import { thesesRepository } from "@/lib/repositories/theses-repository";
import { wikiRepository } from "@/lib/repositories/wiki-repository";
import {
  artifactTitleFromAskSession,
  createArtifact,
} from "@/lib/services/artifact-service";
import {
  listProjectCatalysts,
  type CatalystReferenceRecord,
} from "@/lib/services/catalyst-service";
import {
  buildConfidenceAssessment,
} from "@/lib/services/confidence-model-v2";
import {
  listProjectContradictions,
  type ContradictionReferenceRecord,
} from "@/lib/services/contradiction-service";
import {
  entityInfluenceSummary,
  entityPriority,
  listProjectEntities,
  matchEntitiesToText,
} from "@/lib/services/entity-intelligence-service";
import {
  getProjectMonitoringSnapshot,
  type StaleAlertReferenceRecord,
} from "@/lib/services/source-monitoring-service";
import {
} from "@/lib/services/semantic-intelligence-v1";
import {
  listProjectTimelineEvents,
  type TimelineReferenceRecord,
} from "@/lib/services/timeline-service";

type PageCandidate = {
  page: WikiPage;
  revision: WikiPageRevision | null;
  sourceIds: string[];
  score: number;
  overlap: string[];
};

type ClaimCandidate = {
  claim: Claim;
  score: number;
  overlap: string[];
};

type SourceCandidate = {
  source: Source;
  fragments: SourceFragment[];
  score: number;
  viaEvidence: boolean;
  viaRawFallback: boolean;
  overlap: string[];
};

type AskDerivedContext = {
  thesis: Thesis | null;
  dossier: CompanyDossier | null;
  contradictions: ContradictionReferenceRecord[];
  catalysts: CatalystReferenceRecord[];
  timelineEntries: TimelineReferenceRecord[];
  freshnessAlerts: StaleAlertReferenceRecord[];
  entities: ResearchEntity[];
  selectedEntities: ResearchEntity[];
};

type AskTrustContext = {
  confidence: RevisionConfidence;
  confidenceSummary: string;
  consultedObjectSummary: string;
  tensionSummary: string;
  freshnessCaveat: string;
  supportingFactorSummary: string;
  lineageSummary: string;
  artifactTitle: string;
};

type AskSynthesisContext = {
  prompt: string;
  answerMode: AskAnswerMode;
  pages: PageCandidate[];
  claims: ClaimCandidate[];
  sources: SourceCandidate[];
  derived: AskDerivedContext;
  trust: AskTrustContext;
};

const answerModeLabels: Record<AskAnswerMode, string> = {
  "concise-answer": "Concise Answer",
  "research-memo": "Research Memo",
  "compare-viewpoints": "Compare Viewpoints",
  "identify-contradictions": "Identify Contradictions",
  "follow-up-questions": "Follow-up Questions",
};

const pageTypeIntentMap: Array<{
  tokens: string[];
  pageTypes: WikiPageType[];
}> = [
  {
    tokens: ["overview", "summary", "canon", "what", "business"],
    pageTypes: ["overview", "dossier", "investment-thesis"],
  },
  {
    tokens: ["thesis", "underwriting", "case", "bull", "bear"],
    pageTypes: ["investment-thesis", "risk-register", "overview"],
  },
  {
    tokens: ["catalyst", "launch", "earnings", "timing", "next quarter"],
    pageTypes: ["roadmap", "investment-thesis", "market-map"],
  },
  {
    tokens: ["risk", "contradiction", "conflict", "tension", "break"],
    pageTypes: ["risk-register", "open-questions", "market-map"],
  },
  {
    tokens: ["compare", "versus", "viewpoint", "competition"],
    pageTypes: ["market-map", "investment-thesis", "dossier"],
  },
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim();
}

function tokenize(value: string): string[] {
  const stopWords = new Set([
    "the",
    "and",
    "for",
    "that",
    "with",
    "into",
    "from",
    "what",
    "which",
    "should",
    "would",
    "this",
    "these",
    "those",
    "their",
    "about",
    "against",
    "mode",
    "project",
    "current",
    "over",
    "next",
  ]);

  return Array.from(
    new Set(
      normalize(value)
        .split(/\s+/)
        .filter((token) => token.length > 2 && !stopWords.has(token)),
    ),
  );
}

function overlapTokens(queryTokens: string[], text: string): string[] {
  const normalizedText = normalize(text);
  return queryTokens.filter((token) => normalizedText.includes(token));
}

function preview(value: string | null | undefined, length = 180): string {
  if (!value) {
    return "No stored content is available.";
  }

  const normalizedValue = value.replace(/\s+/g, " ").trim();
  return normalizedValue.length > length
    ? `${normalizedValue.slice(0, length).trimEnd()}...`
    : normalizedValue;
}

function listLine(items: string[]): string[] {
  return items.length > 0 ? items : ["No direct references were captured."];
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

function pageTypeBoost(queryTokens: string[], pageType: WikiPageType): number {
  let boost = 0;

  for (const rule of pageTypeIntentMap) {
    if (
      rule.tokens.some((token) => queryTokens.includes(token)) &&
      rule.pageTypes.includes(pageType)
    ) {
      boost += 5;
    }
  }

  return boost;
}

function titleFromPrompt(prompt: string, answerMode: AskAnswerMode): string {
  const compactPrompt = prompt.replace(/\s+/g, " ").trim();
  const titleStem =
    compactPrompt.length > 68
      ? `${compactPrompt.slice(0, 68).trimEnd()}...`
      : compactPrompt;
  return `${answerModeLabels[answerMode]}: ${titleStem}`;
}

function metadataList(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function pageLink(page: WikiPage): string {
  return `[${page.title}](/wiki/${page.id})`;
}

function claimLink(claim: Claim, page: WikiPage | null): string {
  const label = page ? `${page.title} claim` : "Claim";
  return `[${label}](/wiki/${claim.wikiPageId}#claim-${claim.id})`;
}

function sourceLink(source: Source): string {
  return `[${source.title}](/sources#${source.id})`;
}

function contradictionLink(entry: ContradictionReferenceRecord): string {
  return `[${entry.contradiction.title}](/contradictions#${entry.contradiction.id})`;
}

function catalystLink(entry: CatalystReferenceRecord): string {
  return `[${entry.catalyst.title}](/catalysts#${entry.catalyst.id})`;
}

function timelineLink(entry: TimelineReferenceRecord): string {
  return `[${entry.event.title}](/timeline#${entry.event.id})`;
}

function entityLink(entity: ResearchEntity): string {
  return `[${entity.canonicalName}](/entities#${entity.id})`;
}

function formatTimeframe(value: string | null): string {
  if (!value) {
    return "timing still unclear";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function buildPromptEntitySet(
  prompt: string,
  entities: ResearchEntity[],
): ResearchEntity[] {
  return matchEntitiesToText(entities, prompt, [
    "company",
    "product_or_segment",
    "operator",
    "market_or_competitor",
    "metric",
    "risk_theme",
  ])
    .sort(
      (left, right) =>
        entityPriority(right) - entityPriority(left) ||
        left.canonicalName.localeCompare(right.canonicalName),
    )
    .slice(0, 5);
}

function relatedEntityMatches(
  entities: ResearchEntity[],
  promptEntities: ResearchEntity[],
  pageId?: string | null,
  claimId?: string | null,
  sourceId?: string | null,
  text?: string | null,
): ResearchEntity[] {
  const promptEntityIds = new Set(promptEntities.map((entity) => entity.id));
  const linkedMatches = entities.filter(
    (entity) =>
      (pageId ? entity.relatedWikiPageIds.includes(pageId) : false) ||
      (claimId ? entity.relatedClaimIds.includes(claimId) : false) ||
      (sourceId ? entity.relatedSourceIds.includes(sourceId) : false),
  );
  const textMatches = text
    ? matchEntitiesToText(entities, text, [
        "company",
        "product_or_segment",
        "operator",
        "market_or_competitor",
        "metric",
        "risk_theme",
      ])
    : [];

  return Array.from(
    new Map(
      [...linkedMatches, ...textMatches]
        .filter((entity) => promptEntityIds.size === 0 || promptEntityIds.has(entity.id))
        .map((entity) => [entity.id, entity] as const),
    ).values(),
  );
}

async function rankPages(
  projectId: string,
  prompt: string,
  entities: ResearchEntity[],
): Promise<PageCandidate[]> {
  const queryTokens = tokenize(prompt);
  const promptEntities = buildPromptEntitySet(prompt, entities);
  const pages = await wikiRepository.listPagesByProjectId(projectId);
  const candidates = await Promise.all(
    pages.map(async (page) => {
      const [revision, sourceIds] = await Promise.all([
        wikiRepository.getCurrentRevision(page.id),
        wikiRepository.listSourceIdsForPage(page.id),
      ]);
      const searchableText = [
        page.title,
        revision?.summary ?? "",
        revision?.markdownContent ?? "",
      ].join(" ");
      const titleOverlap = overlapTokens(queryTokens, page.title);
      const summaryOverlap = overlapTokens(queryTokens, searchableText);
      const entityMatches = relatedEntityMatches(
        entities,
        promptEntities,
        page.id,
        null,
        null,
        searchableText,
      );
      const score =
        titleOverlap.length * 6 +
        summaryOverlap.length * 3 +
        pageTypeBoost(queryTokens, page.pageType) +
        entityMatches.length * 4 +
        (page.status === "active" ? 2 : page.status === "stale" ? -2 : 0) +
        confidenceRank(revision?.confidence) * 2 +
        (page.generationMetadata?.generatedBy ? 1 : 0);

      return {
        page,
        revision,
        sourceIds,
        score,
        overlap: Array.from(new Set([...titleOverlap, ...summaryOverlap])),
      };
    }),
  );

  const ranked = candidates
    .sort(
      (left, right) =>
        right.score - left.score ||
        confidenceRank(right.revision?.confidence) -
          confidenceRank(left.revision?.confidence) ||
        right.page.updatedAt.localeCompare(left.page.updatedAt),
    )
    .filter((candidate) => candidate.score > 0);

  if (ranked.length > 0) {
    return ranked.slice(0, 4);
  }

  return candidates
    .sort(
      (left, right) =>
        confidenceRank(right.revision?.confidence) -
          confidenceRank(left.revision?.confidence) ||
        right.page.updatedAt.localeCompare(left.page.updatedAt),
    )
    .slice(0, 3);
}

async function rankClaims(
  projectId: string,
  prompt: string,
  pageCandidates: PageCandidate[],
  entities: ResearchEntity[],
): Promise<ClaimCandidate[]> {
  const queryTokens = tokenize(prompt);
  const promptEntities = buildPromptEntitySet(prompt, entities);
  const relevantPageIds = new Set(pageCandidates.map((candidate) => candidate.page.id));
  const claims = await claimsRepository.listByProjectId(projectId);
  const candidates = claims.map((claim) => {
    const overlap = overlapTokens(queryTokens, claim.text);
    const entityMatches = relatedEntityMatches(
      entities,
      promptEntities,
      claim.wikiPageId,
      claim.id,
      claim.sourceId,
      claim.text,
    );
    const supportWeight =
      claim.supportStatus === "supported"
        ? 5
        : claim.supportStatus === "weak-support"
          ? 1
          : -2;
    const score =
      overlap.length * 5 +
      entityMatches.length * 4 +
      (relevantPageIds.has(claim.wikiPageId) ? 4 : 0) +
      supportWeight +
      confidenceRank(claim.confidence);

    return {
      claim,
      score,
      overlap,
    };
  });

  const ranked = candidates
    .sort(
      (left, right) =>
        right.score - left.score ||
        confidenceRank(right.claim.confidence) -
          confidenceRank(left.claim.confidence) ||
        right.claim.updatedAt.localeCompare(left.claim.updatedAt),
    )
    .filter((candidate) => candidate.score > 0);

  if (ranked.length > 0) {
    return ranked.slice(0, 6);
  }

  return candidates
    .filter((candidate) => relevantPageIds.has(candidate.claim.wikiPageId))
    .sort((left, right) => right.score - left.score)
    .slice(0, 4);
}

async function rankSources(input: {
  projectId: string;
  prompt: string;
  pageCandidates: PageCandidate[];
  claimCandidates: ClaimCandidate[];
  entities: ResearchEntity[];
}): Promise<SourceCandidate[]> {
  const queryTokens = tokenize(input.prompt);
  const promptEntities = buildPromptEntitySet(input.prompt, input.entities);
  const [sources, evidenceLinks] = await Promise.all([
    sourcesRepository.listByProjectId(input.projectId),
    evidenceLinksRepository.listByProjectId(input.projectId),
  ]);
  const evidenceClaimIds = new Set(
    input.claimCandidates.map((candidate) => candidate.claim.id),
  );
  const evidenceSourceIds = new Set(
    evidenceLinks
      .filter((link) => evidenceClaimIds.has(link.claimId))
      .map((link) => link.sourceId),
  );
  const pageLinkedSourceIds = new Set(
    input.pageCandidates.flatMap((candidate) => candidate.sourceIds),
  );
  const sourceCandidates = await Promise.all(
    sources.map(async (source) => {
      const fragments = await sourceFragmentsRepository.listBySourceId(source.id);
      const searchableText = [
        source.title,
        source.body ?? "",
        fragments.slice(0, 3).map((fragment) => fragment.text).join(" "),
      ].join(" ");
      const overlap = overlapTokens(queryTokens, searchableText);
      const entityMatches = relatedEntityMatches(
        input.entities,
        promptEntities,
        null,
        null,
        source.id,
        searchableText,
      );
      const viaEvidence = evidenceSourceIds.has(source.id);
      const linkedToPage = pageLinkedSourceIds.has(source.id);
      const score =
        overlap.length * 4 +
        entityMatches.length * 4 +
        (viaEvidence ? 6 : 0) +
        (linkedToPage ? 2 : 0) +
        (source.status === "compiled" ? 2 : source.status === "failed" ? -2 : 0);

      return {
        source,
        fragments,
        score,
        viaEvidence,
        viaRawFallback: false,
        overlap,
      };
    }),
  );

  const ranked = sourceCandidates
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.source.updatedAt.localeCompare(left.source.updatedAt),
    )
    .filter((candidate) => candidate.score > 0)
    .slice(0, 5);

  if (ranked.length > 0) {
    return ranked;
  }

  return sourceCandidates
    .sort(
      (left, right) =>
        (right.source.status === "compiled" ? 1 : 0) -
          (left.source.status === "compiled" ? 1 : 0) ||
        right.source.updatedAt.localeCompare(left.source.updatedAt),
    )
    .slice(0, 3)
    .map((candidate) => ({
      ...candidate,
      viaRawFallback: true,
    }));
}

function overlapScore(
  promptTokens: string[],
  entities: ResearchEntity[],
  text: string,
  linkedIds?: {
    pageIds?: string[];
    claimIds?: string[];
    sourceIds?: string[];
  },
): number {
  const tokenHits = overlapTokens(promptTokens, text).length;
  const entityHits = matchEntitiesToText(entities, text).length;
  const linkage =
    (linkedIds?.pageIds?.length ?? 0) +
    (linkedIds?.claimIds?.length ?? 0) +
    (linkedIds?.sourceIds?.length ?? 0);

  return tokenHits * 4 + entityHits * 5 + Math.min(linkage, 3);
}

function selectRelevantContradictions(input: {
  prompt: string;
  contradictions: ContradictionReferenceRecord[];
  selectedEntities: ResearchEntity[];
  consultedPageIds: Set<string>;
  consultedClaimIds: Set<string>;
  consultedSourceIds: Set<string>;
}): ContradictionReferenceRecord[] {
  const promptTokens = tokenize(input.prompt);

  return [...input.contradictions]
    .map((entry) => {
      const themeBoost = metadataList(entry.contradiction.metadata?.primaryTheme).length > 0 ? 1 : 0;
      const linkedClaimBoost =
        (entry.leftClaim && input.consultedClaimIds.has(entry.leftClaim.id) ? 4 : 0) +
        (entry.rightClaim && input.consultedClaimIds.has(entry.rightClaim.id) ? 4 : 0);
      const linkedPageBoost = entry.relatedPages.filter((page) =>
        input.consultedPageIds.has(page.id),
      ).length * 3;
      const linkedSourceBoost = entry.relatedSources.filter((source) =>
        input.consultedSourceIds.has(source.id),
      ).length * 2;
      const score =
        overlapScore(
          promptTokens,
          input.selectedEntities,
          `${entry.contradiction.title} ${entry.contradiction.description} ${entry.contradiction.rationale}`,
          {
            pageIds: entry.relatedPages.map((page) => page.id),
            claimIds: [entry.leftClaim?.id ?? "", entry.rightClaim?.id ?? ""].filter(Boolean),
            sourceIds: entry.relatedSources.map((source) => source.id),
          },
        ) +
        linkedClaimBoost +
        linkedPageBoost +
        linkedSourceBoost +
        themeBoost +
        (entry.contradiction.status === "open" ? 3 : entry.contradiction.status === "reviewed" ? 1 : -2);

      return { entry, score };
    })
    .filter(({ score }) => score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        confidenceRank(right.entry.contradiction.confidence) -
          confidenceRank(left.entry.contradiction.confidence) ||
        right.entry.contradiction.updatedAt.localeCompare(left.entry.contradiction.updatedAt),
    )
    .map(({ entry }) => entry)
    .slice(0, 4);
}

function selectRelevantCatalysts(input: {
  prompt: string;
  catalysts: CatalystReferenceRecord[];
  selectedEntities: ResearchEntity[];
  consultedPageIds: Set<string>;
  consultedClaimIds: Set<string>;
  consultedSourceIds: Set<string>;
}): CatalystReferenceRecord[] {
  const promptTokens = tokenize(input.prompt);

  return [...input.catalysts]
    .map((entry) => {
      const score =
        overlapScore(
          promptTokens,
          input.selectedEntities,
          `${entry.catalyst.title} ${entry.catalyst.description}`,
          {
            pageIds: entry.relatedPages.map((page) => page.id),
            claimIds: entry.relatedClaims.map((claim) => claim.id),
            sourceIds: entry.relatedSources.map((source) => source.id),
          },
        ) +
        (entry.catalyst.importance === "high" ? 5 : entry.catalyst.importance === "medium" ? 2 : 0) +
        (entry.catalyst.reviewStatus === "invalidated" ? -6 : 0) +
        (entry.catalyst.reviewStatus === "reviewed" ? 2 : 0) +
        (entry.catalyst.status === "upcoming" || entry.catalyst.status === "active" ? 3 : 0);

      return { entry, score };
    })
    .filter(({ score }) => score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        confidenceRank(right.entry.catalyst.confidence) -
          confidenceRank(left.entry.catalyst.confidence) ||
        right.entry.catalyst.updatedAt.localeCompare(left.entry.catalyst.updatedAt),
    )
    .map(({ entry }) => entry)
    .slice(0, 4);
}

function selectRelevantTimeline(input: {
  prompt: string;
  timelineEntries: TimelineReferenceRecord[];
  selectedEntities: ResearchEntity[];
  consultedPageIds: Set<string>;
  consultedClaimIds: Set<string>;
  consultedSourceIds: Set<string>;
  relevantCatalystIds: Set<string>;
}): TimelineReferenceRecord[] {
  const promptTokens = tokenize(input.prompt);

  return [...input.timelineEntries]
    .map((entry) => {
      const linkedBoost =
        entry.relatedPages.filter((page) => input.consultedPageIds.has(page.id)).length * 3 +
        entry.relatedClaims.filter((claim) => input.consultedClaimIds.has(claim.id)).length * 2 +
        entry.relatedSources.filter((source) => input.consultedSourceIds.has(source.id)).length * 2;
      const catalystBoost = entry.event.claimIds.some((claimId) => input.relevantCatalystIds.has(claimId))
        ? 3
        : 0;
      const score =
        overlapScore(
          promptTokens,
          input.selectedEntities,
          `${entry.event.title} ${entry.event.description}`,
          {
            pageIds: entry.relatedPages.map((page) => page.id),
            claimIds: entry.relatedClaims.map((claim) => claim.id),
            sourceIds: entry.relatedSources.map((source) => source.id),
          },
        ) +
        linkedBoost +
        catalystBoost +
        (entry.event.eventDatePrecision === "exact_day" ? 3 : entry.event.eventDatePrecision === "month" ? 2 : 0);

      return { entry, score };
    })
    .filter(({ score }) => score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        confidenceRank(right.entry.event.confidence) -
          confidenceRank(left.entry.event.confidence) ||
        right.entry.event.eventDate.localeCompare(left.entry.event.eventDate),
    )
    .map(({ entry }) => entry)
    .slice(0, 4);
}

function selectRelevantAlerts(input: {
  prompt: string;
  alerts: StaleAlertReferenceRecord[];
  selectedEntities: ResearchEntity[];
  consultedSourceIds: Set<string>;
}): StaleAlertReferenceRecord[] {
  const promptTokens = tokenize(input.prompt);

  return [...input.alerts]
    .map((entry) => {
      const score =
        overlapScore(
          promptTokens,
          input.selectedEntities,
          `${entry.alert.title} ${entry.alert.description} ${entry.alert.metadata?.driverSummary ?? ""}`,
          {
            sourceIds: entry.relatedSources.map((source) => source.id),
          },
        ) +
        entry.relatedSources.filter((source) => input.consultedSourceIds.has(source.id)).length * 3 +
        (entry.alert.status === "open" ? 5 : entry.alert.status === "acknowledged" ? 2 : -2);

      return { entry, score };
    })
    .filter(({ score }) => score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.entry.alert.updatedAt.localeCompare(left.entry.alert.updatedAt),
    )
    .map(({ entry }) => entry)
    .slice(0, 3);
}

async function buildDerivedContext(input: {
  projectId: string;
  prompt: string;
  pages: PageCandidate[];
  claims: ClaimCandidate[];
  sources: SourceCandidate[];
  entities: ResearchEntity[];
}): Promise<AskDerivedContext> {
  const [thesis, dossier, contradictions, catalysts, timelineEntries, monitoring] =
    await Promise.all([
      thesesRepository.getByProjectId(input.projectId),
      companyDossiersRepository.getByProjectId(input.projectId),
      listProjectContradictions(input.projectId),
      listProjectCatalysts(input.projectId),
      listProjectTimelineEvents(input.projectId),
      getProjectMonitoringSnapshot(input.projectId),
    ]);

  const consultedPageIds = new Set(input.pages.map((candidate) => candidate.page.id));
  const consultedClaimIds = new Set(input.claims.map((candidate) => candidate.claim.id));
  const consultedSourceIds = new Set(input.sources.map((candidate) => candidate.source.id));
  const selectedEntities = Array.from(
    new Map(
      [
        ...buildPromptEntitySet(input.prompt, input.entities),
        ...input.pages.flatMap((candidate) =>
          relatedEntityMatches(
            input.entities,
            buildPromptEntitySet(input.prompt, input.entities),
            candidate.page.id,
            null,
            null,
            `${candidate.page.title} ${candidate.revision?.summary ?? ""}`,
          ),
        ),
        ...input.claims.flatMap((candidate) =>
          relatedEntityMatches(
            input.entities,
            buildPromptEntitySet(input.prompt, input.entities),
            candidate.claim.wikiPageId,
            candidate.claim.id,
            candidate.claim.sourceId,
            candidate.claim.text,
          ),
        ),
      ].map((entity) => [entity.id, entity] as const),
    ).values(),
  ).slice(0, 5);

  const relevantContradictions = selectRelevantContradictions({
    prompt: input.prompt,
    contradictions,
    selectedEntities,
    consultedPageIds,
    consultedClaimIds,
    consultedSourceIds,
  });
  const relevantCatalysts = selectRelevantCatalysts({
    prompt: input.prompt,
    catalysts,
    selectedEntities,
    consultedPageIds,
    consultedClaimIds,
    consultedSourceIds,
  });
  const relevantTimeline = selectRelevantTimeline({
    prompt: input.prompt,
    timelineEntries,
    selectedEntities,
    consultedPageIds,
    consultedClaimIds,
    consultedSourceIds,
    relevantCatalystIds: new Set(
      relevantCatalysts.flatMap((entry) => entry.catalyst.linkedClaimIds),
    ),
  });
  const relevantAlerts = selectRelevantAlerts({
    prompt: input.prompt,
    alerts: monitoring.alerts,
    selectedEntities,
    consultedSourceIds,
  });

  return {
    thesis,
    dossier,
    contradictions: relevantContradictions,
    catalysts: relevantCatalysts,
    timelineEntries: relevantTimeline,
    freshnessAlerts: relevantAlerts,
    entities: input.entities,
    selectedEntities,
  };
}

function buildTrustContext(input: {
  prompt: string;
  answerMode: AskAnswerMode;
  pages: PageCandidate[];
  claims: ClaimCandidate[];
  sources: SourceCandidate[];
  derived: AskDerivedContext;
}): AskTrustContext {
  const supportedClaims = input.claims.filter(
    (candidate) => candidate.claim.supportStatus === "supported",
  ).length;
  const sourceDiversityCount = new Set(
    input.sources.map((candidate) => candidate.source.id),
  ).size;
  const openContradictions = input.derived.contradictions.filter(
    (entry) => entry.contradiction.status !== "resolved",
  ).length;
  const openAlerts = input.derived.freshnessAlerts.filter(
    (entry) => entry.alert.status === "open",
  ).length;
  const exactTimelineSignals = input.derived.timelineEntries.filter(
    (entry) => entry.event.eventDatePrecision === "exact_day",
  ).length;
  const rawFallbackCount = input.sources.filter((candidate) => candidate.viaRawFallback).length;
  const reviewedSignalCount =
    input.derived.catalysts.filter((entry) => entry.catalyst.reviewStatus === "reviewed").length +
    input.derived.contradictions.filter(
      (entry) => entry.contradiction.status === "reviewed",
    ).length;
  const confidenceAssessment = buildConfidenceAssessment({
    supportDensity:
      input.claims.length === 0 ? 0 : supportedClaims / input.claims.length,
    sourceDiversityCount,
    contradictionBurden: Math.min(openContradictions / 3, 1),
    freshnessBurden: Math.min((openAlerts + rawFallbackCount) / 4, 1),
    entityClarity: Math.min(input.derived.selectedEntities.length / 3, 1),
    datePrecision:
      input.derived.timelineEntries.length === 0
        ? 0.35
        : exactTimelineSignals / input.derived.timelineEntries.length,
    stalePosture: openAlerts > 0 ? 1 : 0,
    reviewPosture:
      input.derived.catalysts.length + input.derived.contradictions.length === 0
        ? 0
        : Math.min(
            reviewedSignalCount /
              (input.derived.catalysts.length + input.derived.contradictions.length),
            1,
          ),
  });

  const consultedObjectSummary = `Consulted ${input.pages.length} canon page(s), ${input.claims.length} claim(s), ${input.sources.length} source record(s), ${input.derived.contradictions.length} contradiction record(s), ${input.derived.catalysts.length} catalyst object(s), and ${input.derived.timelineEntries.length} timeline entry(ies).`;
  const tensionSummary =
    openContradictions > 0
      ? `Open tension remains visible through ${openContradictions} contradiction record(s), led by ${input.derived.contradictions
          .slice(0, 2)
          .map((entry) => entry.contradiction.title)
          .join("; ")}.`
      : "No major contradiction burden surfaced inside the consulted scope.";
  const freshnessCaveat =
    openAlerts > 0
      ? `Freshness caveat: ${input.derived.freshnessAlerts
          .slice(0, 2)
          .map((entry) => entry.alert.metadata?.driverSummary || entry.alert.title)
          .join("; ")}.`
      : "No active freshness alert materially constrained the consulted scope.";
  const selectedEntityNames = input.derived.selectedEntities.map((entity) => entity.canonicalName);
  const supportingFactorSummary = `Entity-aware context centered on ${selectedEntityNames.length > 0 ? selectedEntityNames.join(", ") : "general project scope"}, with ${supportedClaims} supported consulted claim(s), source diversity across ${sourceDiversityCount} source record(s), and ${exactTimelineSignals} precise dated signal(s).`;
  const lineageSummary = `Lineage centers on ${
    selectedEntityNames.length > 0 ? selectedEntityNames.join(", ") : "general project scope"
  }, ${input.derived.catalysts.length} catalyst object(s), ${input.derived.contradictions.length} contradiction record(s), ${input.derived.timelineEntries.length} timeline entry(ies), and ${openAlerts} freshness alert(s) in scope.`;

  return {
    confidence: confidenceAssessment.label,
    confidenceSummary: confidenceAssessment.summary,
    consultedObjectSummary,
    tensionSummary,
    freshnessCaveat,
    supportingFactorSummary,
    lineageSummary,
    artifactTitle:
      input.answerMode === "research-memo"
        ? `Research Memo: ${selectedEntityNames[0] ?? input.prompt}`
        : input.answerMode === "compare-viewpoints"
          ? `Viewpoint Comparison: ${selectedEntityNames[0] ?? input.prompt}`
          : input.answerMode === "identify-contradictions"
            ? `Contradiction Brief: ${selectedEntityNames[0] ?? input.prompt}`
            : input.answerMode === "follow-up-questions"
              ? `Research Questions: ${selectedEntityNames[0] ?? input.prompt}`
              : `Answer Brief: ${selectedEntityNames[0] ?? input.prompt}`,
  };
}

function topPageLine(candidate: PageCandidate | undefined): string {
  if (!candidate) {
    return "The current canon does not yet provide a strong directly matched page summary.";
  }

  return `${pageLink(candidate.page)}: ${candidate.revision?.summary ?? preview(candidate.revision?.markdownContent)}`;
}

function topClaimLine(candidate: ClaimCandidate | undefined, pages: PageCandidate[]): string {
  if (!candidate) {
    return "The claim layer remains thin for this exact question.";
  }

  const page = pages.find((pageCandidate) => pageCandidate.page.id === candidate.claim.wikiPageId);
  return `${claimLink(candidate.claim, page?.page ?? null)}: ${candidate.claim.text} [${candidate.claim.supportStatus}]`;
}

function thesisPostureLine(derived: AskDerivedContext): string {
  if (!derived.thesis) {
    return "No compiled thesis currently anchors this answer, so Ask is leaning more directly on canon pages and evidence-linked claims.";
  }

  return `Current thesis posture is ${derived.thesis.overallStance} with ${derived.thesis.confidence} confidence: ${preview(derived.thesis.summary, 220)}`;
}

function catalystLines(derived: AskDerivedContext): string[] {
  return derived.catalysts.slice(0, 3).map((entry) => {
    const operatorNote =
      entry.catalyst.reviewStatus !== "active"
        ? ` Operator posture: ${entry.catalyst.reviewStatus}.`
        : "";
    return `${catalystLink(entry)} (${entry.catalyst.importance}, ${entry.catalyst.confidence}) targeted for ${formatTimeframe(entry.catalyst.expectedTimeframe)}.${operatorNote} ${preview(entry.catalyst.description, 180)}`;
  });
}

function contradictionLines(derived: AskDerivedContext): string[] {
  return derived.contradictions.slice(0, 3).map((entry) => {
    const statusNote =
      entry.contradiction.status !== "open"
        ? ` Operator posture: ${entry.contradiction.status}.`
        : "";
    return `${contradictionLink(entry)} (${entry.contradiction.severity}, ${entry.contradiction.confidence}). ${entry.contradiction.rationale}${statusNote}`;
  });
}

function timelineLines(derived: AskDerivedContext): string[] {
  return derived.timelineEntries.slice(0, 3).map((entry) => {
    return `${timelineLink(entry)} (${entry.event.eventDatePrecision}, ${entry.event.confidence}): ${preview(entry.event.description, 180)}`;
  });
}

function entityLines(derived: AskDerivedContext): string[] {
  return derived.selectedEntities
    .slice()
    .sort(
      (left, right) =>
        entityPriority(right) - entityPriority(left) ||
        left.canonicalName.localeCompare(right.canonicalName),
    )
    .slice(0, 4)
    .map((entity) => {
      return `${entityLink(entity)} (${entity.entityType}, ${entity.confidence}): ${entityInfluenceSummary(entity)} ${entity.description}`;
    });
}

function pageLines(pages: PageCandidate[]): string[] {
  return pages.map((candidate) => {
    return `${pageLink(candidate.page)}: ${candidate.revision?.summary ?? preview(candidate.revision?.markdownContent)}`;
  });
}

function claimLines(claims: ClaimCandidate[], pages: PageCandidate[]): string[] {
  return claims.map((candidate) => {
    const page = pages.find((entry) => entry.page.id === candidate.claim.wikiPageId);
    return `${claimLink(candidate.claim, page?.page ?? null)}: ${candidate.claim.text} [${candidate.claim.supportStatus}]`;
  });
}

function sourceLines(sources: SourceCandidate[]): string[] {
  return sources.map((candidate) => {
    const excerpt = preview(
      candidate.fragments.find((fragment) => fragment.fragmentType !== "heading")?.text ??
        candidate.source.body,
    );
    const fallbackNote = candidate.viaRawFallback ? " Raw-source fallback was required." : "";
    return `${sourceLink(candidate.source)} (${candidate.source.status}). ${excerpt}${fallbackNote}`;
  });
}

function buildReferenceAppendix(context: AskSynthesisContext): string[] {
  return [
    "## Internal References",
    ...listLine(pageLines(context.pages).slice(0, 4)).map((line) => `- ${line}`),
    ...listLine(claimLines(context.claims.slice(0, 4), context.pages)).map((line) => `- ${line}`),
    ...listLine(sourceLines(context.sources.slice(0, 4))).map((line) => `- ${line}`),
    "",
    "## Derived Lineage",
    ...listLine(entityLines(context.derived).slice(0, 4)).map((line) => `- ${line}`),
    ...listLine(catalystLines(context.derived).slice(0, 3)).map((line) => `- ${line}`),
    ...listLine(contradictionLines(context.derived).slice(0, 3)).map((line) => `- ${line}`),
    ...listLine(timelineLines(context.derived).slice(0, 3)).map((line) => `- ${line}`),
  ];
}

function buildConciseAnswer(context: AskSynthesisContext): string {
  return [
    "# Answer",
    `${topPageLine(context.pages[0])} ${topClaimLine(context.claims[0], context.pages)} ${thesisPostureLine(context.derived)}`,
    "",
    "## Why This Holds",
    `- ${context.trust.supportingFactorSummary}`,
    `- ${context.trust.lineageSummary}`,
    ...listLine(catalystLines(context.derived).slice(0, 2)).map((line) => `- ${line}`),
    "",
    "## Main Caveats",
    `- ${context.trust.tensionSummary}`,
    `- ${context.trust.freshnessCaveat}`,
    `- Confidence posture: ${context.trust.confidence}. ${context.trust.confidenceSummary}`,
    "",
    ...buildReferenceAppendix(context),
  ].join("\n");
}

function buildResearchMemo(context: AskSynthesisContext): string {
  return [
    "# Research Memo",
    "## Bottom Line",
    `${thesisPostureLine(context.derived)} ${topPageLine(context.pages[0])}`,
    "",
    "## Canonical Read",
    ...listLine(pageLines(context.pages).slice(0, 4)).map((line) => `- ${line}`),
    "",
    "## Evidence Layer",
    ...listLine(claimLines(context.claims.slice(0, 5), context.pages)).map((line) => `- ${line}`),
    "",
    "## Catalysts And Timing",
    ...listLine([
      ...catalystLines(context.derived),
      ...timelineLines(context.derived),
    ]).map((line) => `- ${line}`),
    "",
    "## Tensions And Uncertainty",
    ...listLine([
      context.trust.tensionSummary,
      context.trust.freshnessCaveat,
      ...contradictionLines(context.derived),
    ]).map((line) => `- ${line}`),
    "",
    "## Trust Posture",
    `- Confidence posture: ${context.trust.confidence}. ${context.trust.confidenceSummary}`,
    `- ${context.trust.supportingFactorSummary}`,
    `- ${context.trust.lineageSummary}`,
    `- ${context.trust.consultedObjectSummary}`,
    "",
    ...buildReferenceAppendix(context),
  ].join("\n");
}

function buildCompareViewpoints(context: AskSynthesisContext): string {
  const positiveClaims = context.claims
    .filter((candidate) => candidate.claim.supportStatus === "supported")
    .slice(0, 3);
  const cautiousClaims = context.claims
    .filter((candidate) => candidate.claim.supportStatus !== "supported")
    .slice(0, 3);

  return [
    "# Compare Viewpoints",
    "## Constructive Read",
    `- ${thesisPostureLine(context.derived)}`,
    ...listLine(claimLines(positiveClaims, context.pages)).map((line) => `- ${line}`),
    ...listLine(catalystLines(context.derived).slice(0, 2)).map((line) => `- ${line}`),
    "",
    "## Cautious Read",
    ...listLine([
      context.trust.tensionSummary,
      context.trust.freshnessCaveat,
      ...contradictionLines(context.derived),
      ...claimLines(cautiousClaims, context.pages),
    ]).map((line) => `- ${line}`),
    "",
    "## What Likely Decides It",
    ...listLine([
      ...timelineLines(context.derived),
      ...entityLines(context.derived).slice(0, 2),
    ]).map((line) => `- ${line}`),
    "",
    "## Trust Posture",
    `- Confidence posture: ${context.trust.confidence}. ${context.trust.confidenceSummary}`,
    `- ${context.trust.lineageSummary}`,
    `- ${context.trust.consultedObjectSummary}`,
    "",
    ...buildReferenceAppendix(context),
  ].join("\n");
}

function buildContradictionReview(context: AskSynthesisContext): string {
  return [
    "# Contradiction Review",
    "## Primary Tensions",
    ...listLine([
      context.trust.tensionSummary,
      ...contradictionLines(context.derived),
    ]).map((line) => `- ${line}`),
    "",
    "## Canonical Claims In Scope",
    ...listLine(claimLines(context.claims.slice(0, 5), context.pages)).map((line) => `- ${line}`),
    "",
    "## Timing Or Catalyst Relevance",
    ...listLine([
      ...catalystLines(context.derived).slice(0, 2),
      ...timelineLines(context.derived).slice(0, 2),
    ]).map((line) => `- ${line}`),
    "",
    "## What To Resolve Next",
    ...listLine([
      context.trust.freshnessCaveat,
      `Review the highest-confidence canon pages first: ${pageLines(context.pages).slice(0, 2).join("; ") || "none yet"}.`,
      `Use evidence-linked sources before raw-source fallback records: ${sourceLines(
        context.sources.filter((entry) => !entry.viaRawFallback).slice(0, 2),
      ).join("; ") || "no evidence-linked source surfaced strongly."}`,
    ]).map((line) => `- ${line}`),
    "",
    "## Trust Posture",
    `- Confidence posture: ${context.trust.confidence}. ${context.trust.confidenceSummary}`,
    `- ${context.trust.lineageSummary}`,
    "",
    ...buildReferenceAppendix(context),
  ].join("\n");
}

function buildFollowUpQuestions(context: AskSynthesisContext): string {
  const questions = [
    ...context.claims
      .filter((candidate) => candidate.claim.supportStatus !== "supported")
      .slice(0, 3)
      .map(
        (candidate) =>
          `What evidence would move this claim from ${candidate.claim.supportStatus} to supported: ${candidate.claim.text}?`,
      ),
    ...context.derived.freshnessAlerts.slice(0, 2).map(
      (entry) =>
        `What changed behind this freshness alert, and does it require a thesis or dossier refresh: ${entry.alert.title}?`,
    ),
    ...context.derived.contradictions.slice(0, 2).map(
      (entry) =>
        `Which record is more credible in this contradiction, and what would resolve it: ${entry.contradiction.title}?`,
    ),
    ...context.derived.catalysts
      .filter((entry) => entry.catalyst.reviewStatus !== "invalidated")
      .slice(0, 2)
      .map(
        (entry) =>
          `What needs to happen for this catalyst to materially move the thesis: ${entry.catalyst.title}?`,
      ),
  ];

  return [
    "# Follow-Up Questions",
    "## Best Next Questions",
    ...listLine(questions).map((line) => `- ${line}`),
    "",
    "## Why These Matter Now",
    `- ${context.trust.tensionSummary}`,
    `- ${context.trust.freshnessCaveat}`,
    `- ${context.trust.supportingFactorSummary}`,
    `- ${context.trust.lineageSummary}`,
    "",
    "## Current Context Used",
    ...listLine([
      ...pageLines(context.pages).slice(0, 3),
      ...entityLines(context.derived).slice(0, 3),
    ]).map((line) => `- ${line}`),
    "",
    "## Trust Posture",
    `- Confidence posture: ${context.trust.confidence}. ${context.trust.confidenceSummary}`,
    `- ${context.trust.lineageSummary}`,
    "",
    ...buildReferenceAppendix(context),
  ].join("\n");
}

function buildAnswer(context: AskSynthesisContext): string {
  switch (context.answerMode) {
    case "concise-answer":
      return buildConciseAnswer(context);
    case "research-memo":
      return buildResearchMemo(context);
    case "compare-viewpoints":
      return buildCompareViewpoints(context);
    case "identify-contradictions":
      return buildContradictionReview(context);
    case "follow-up-questions":
      return buildFollowUpQuestions(context);
  }
}

function artifactMarkdownFromSession(session: AskSession): string {
  const provenanceLines = [
    "## Ask Provenance",
    `- Prompt: ${session.prompt}`,
    `- Answer mode: ${answerModeLabels[session.answerMode]}`,
    `- Confidence posture: ${session.confidence}. ${session.metadata?.confidenceSummary ?? session.metadata?.trustSummary ?? ""}`.trim(),
    ...(session.metadata?.freshnessCaveat
      ? [`- Freshness caveat: ${session.metadata.freshnessCaveat}`]
      : []),
    ...(session.metadata?.tensionSummary
      ? [`- Tension summary: ${session.metadata.tensionSummary}`]
      : []),
    ...(session.metadata?.consultedObjectSummary
      ? [`- Consulted objects: ${session.metadata.consultedObjectSummary}`]
      : []),
    ...(session.metadata?.lineageSummary
      ? [`- Lineage summary: ${session.metadata.lineageSummary}`]
      : []),
  ];

  return [session.answer, "", ...provenanceLines].join("\n");
}

export async function runAskSession(input: {
  projectId: string;
  prompt: string;
  answerMode: AskAnswerMode;
}): Promise<AskSession> {
  const entities = await listProjectEntities(input.projectId);
  const pages = await rankPages(input.projectId, input.prompt, entities);
  const claims = await rankClaims(input.projectId, input.prompt, pages, entities);
  const sources = await rankSources({
    projectId: input.projectId,
    prompt: input.prompt,
    pageCandidates: pages,
    claimCandidates: claims,
    entities,
  });
  const derived = await buildDerivedContext({
    projectId: input.projectId,
    prompt: input.prompt,
    pages,
    claims,
    sources,
    entities,
  });
  const trust = buildTrustContext({
    prompt: input.prompt,
    answerMode: input.answerMode,
    pages,
    claims,
    sources,
    derived,
  });
  const answer = buildAnswer({
    prompt: input.prompt,
    answerMode: input.answerMode,
    pages,
    claims,
    sources,
    derived,
    trust,
  });

  return askSessionsRepository.create({
    projectId: input.projectId,
    prompt: input.prompt,
    answer,
    answerMode: input.answerMode,
    confidence: trust.confidence,
    consultedWikiPageIds: pages.map((candidate) => candidate.page.id),
    consultedClaimIds: claims.map((candidate) => candidate.claim.id),
    consultedSourceIds: sources.map((candidate) => candidate.source.id),
    metadata: {
      answerModeLabel: answerModeLabels[input.answerMode],
      retrievalOrder: "wiki-pages>claims>evidence-linked-sources>raw-source-fallback",
      consultedPageCount: String(pages.length),
      consultedClaimCount: String(claims.length),
      consultedSourceCount: String(sources.length),
      consultedObjectSummary: trust.consultedObjectSummary,
      trustSummary: trust.supportingFactorSummary,
      confidenceSummary: trust.confidenceSummary,
      tensionSummary: trust.tensionSummary,
      freshnessCaveat: trust.freshnessCaveat,
      lineageSummary: trust.lineageSummary,
      entitySummary:
        derived.selectedEntities.map((entity) => entity.canonicalName).join(", ") ||
        "general project scope",
      consultedEntityIds: JSON.stringify(
        derived.selectedEntities.map((entity) => entity.id),
      ),
      consultedCatalystIds: JSON.stringify(
        derived.catalysts.map((entry) => entry.catalyst.id),
      ),
      consultedContradictionIds: JSON.stringify(
        derived.contradictions.map((entry) => entry.contradiction.id),
      ),
      consultedTimelineEventIds: JSON.stringify(
        derived.timelineEntries.map((entry) => entry.event.id),
      ),
      consultedAlertIds: JSON.stringify(
        derived.freshnessAlerts.map((entry) => entry.alert.id),
      ),
      contradictionCount: String(derived.contradictions.length),
      catalystCount: String(derived.catalysts.length),
      timelineCount: String(derived.timelineEntries.length),
      freshnessAlertCount: String(derived.freshnessAlerts.length),
      artifactTitle: trust.artifactTitle,
      artifactProvenance:
        "Ask mode synthesis over canon, contradictions, catalysts, timeline, entities, and freshness state.",
    },
  });
}

export async function saveAskSessionAsArtifact(input: {
  projectId: string;
  sessionId: string;
  artifactType: ArtifactType;
}): Promise<Artifact> {
  const session = await askSessionsRepository.getById(input.sessionId);

  if (!session || session.projectId !== input.projectId) {
    throw new Error("Ask session is missing for artifact creation.");
  }

  return createArtifact({
    projectId: input.projectId,
    artifactType: input.artifactType,
    title:
      input.artifactType === "saved_answer"
        ? artifactTitleFromAskSession(session)
        : session.metadata?.artifactTitle ?? titleFromPrompt(session.prompt, session.answerMode),
    markdownContent: artifactMarkdownFromSession(session),
    provenance: "ask-mode",
    status: "draft",
    originatingPrompt: session.prompt,
    derivedFromAskSessionId: session.id,
    referencedWikiPageIds: session.consultedWikiPageIds,
    referencedSourceIds: session.consultedSourceIds,
    referencedClaimIds: session.consultedClaimIds,
    eligibleForWikiFiling: false,
    metadata: {
      derivedFrom: "Ask mode",
      answerMode: session.answerMode,
      answerModeLabel: answerModeLabels[session.answerMode],
      askSessionId: session.id,
      confidence: session.confidence,
      trustSummary: session.metadata?.trustSummary ?? "",
      confidenceSummary: session.metadata?.confidenceSummary ?? "",
      freshnessCaveat: session.metadata?.freshnessCaveat ?? "",
      lineageSummary: session.metadata?.lineageSummary ?? "",
      consultedEntityIds: session.metadata?.consultedEntityIds ?? "[]",
      consultedCatalystIds: session.metadata?.consultedCatalystIds ?? "[]",
      consultedContradictionIds: session.metadata?.consultedContradictionIds ?? "[]",
      consultedTimelineEventIds: session.metadata?.consultedTimelineEventIds ?? "[]",
      consultedAlertIds: session.metadata?.consultedAlertIds ?? "[]",
      consultedObjectSummary: session.metadata?.consultedObjectSummary ?? "",
      provenanceNote:
        session.metadata?.artifactProvenance ??
        "Ask mode synthesis over compiled canon and adjacent research state.",
    },
  });
}
