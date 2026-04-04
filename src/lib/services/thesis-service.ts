import type {
  Artifact,
  Claim,
  Contradiction,
  RevisionConfidence,
  Source,
  StringMetadata,
  Thesis,
  ThesisChangedSection,
  ThesisRevision,
  ThesisSectionReferences,
  ThesisSectionSupportMap,
  ThesisStance,
  TimelineEvent,
  WikiPage,
  WikiPageRevision,
} from "@/lib/domain/types";
import { artifactsRepository } from "@/lib/repositories/artifacts-repository";
import { claimsRepository } from "@/lib/repositories/claims-repository";
import { contradictionsRepository } from "@/lib/repositories/contradictions-repository";
import { projectsRepository } from "@/lib/repositories/projects-repository";
import { sourcesRepository } from "@/lib/repositories/sources-repository";
import { thesisRevisionsRepository } from "@/lib/repositories/thesis-revisions-repository";
import { thesesRepository } from "@/lib/repositories/theses-repository";
import { timelineEventsRepository } from "@/lib/repositories/timeline-events-repository";
import { wikiRepository } from "@/lib/repositories/wiki-repository";
import {
  listProjectContradictions,
  type ContradictionReferenceRecord,
} from "@/lib/services/contradiction-service";
import {
  listProjectTimelineEvents,
  type TimelineReferenceRecord,
} from "@/lib/services/timeline-service";

type PageContext = {
  page: WikiPage;
  revision: WikiPageRevision | null;
  sourceIds: string[];
};

type Bullet = {
  text: string;
  references: ThesisSectionReferences;
  score: number;
};

type SectionSupportRecordMap = {
  summary: ThesisSupportRecord;
  bullCase: ThesisSupportRecord;
  bearCase: ThesisSupportRecord;
  variantView: ThesisSupportRecord;
  keyRisks: ThesisSupportRecord;
  keyUnknowns: ThesisSupportRecord;
  catalystSummary: ThesisSupportRecord;
};

type ThesisKnowledgeState = {
  pageContexts: PageContext[];
  claims: Claim[];
  sources: Source[];
  artifacts: Artifact[];
  timelineEntries: TimelineReferenceRecord[];
  contradictionEntries: ContradictionReferenceRecord[];
};

type KnowledgeFingerprint = {
  signature: string;
  latestKnowledgeUpdateAt: string | null;
};

type CompiledThesisCandidate = {
  title: string;
  subjectName: string;
  ticker: string | null;
  status: Thesis["status"];
  overallStance: ThesisStance;
  summary: string;
  bullCaseMarkdown: string;
  bearCaseMarkdown: string;
  variantViewMarkdown: string;
  keyRisksMarkdown: string;
  keyUnknownsMarkdown: string;
  catalystSummaryMarkdown: string;
  confidence: RevisionConfidence;
  supportBySection: ThesisSectionSupportMap;
  metadata: StringMetadata;
  latestInputSignature: string;
  latestKnowledgeUpdateAt: string | null;
};

type DriverIdSet = {
  pageIds: string[];
  claimIds: string[];
  sourceIds: string[];
  timelineEventIds: string[];
  contradictionIds: string[];
  artifactIds: string[];
};

export type ThesisSupportRecord = {
  pages: WikiPage[];
  claims: Claim[];
  sources: Source[];
  timelineEvents: TimelineEvent[];
  contradictions: Contradiction[];
};

export type ThesisRevisionIntelligence = {
  changedSections: ThesisChangedSection[];
  confidenceShift: number;
  catalystCountShift: number;
  contradictionCountShift: number;
  likelyDriverSummary: string | null;
  likelyDrivers: {
    pages: WikiPage[];
    claims: Claim[];
    sources: Source[];
    timelineEvents: TimelineEvent[];
    contradictions: Contradiction[];
    artifacts: Artifact[];
  };
};

export type ThesisRevisionRecord = {
  revision: ThesisRevision;
  supportBySection: SectionSupportRecordMap;
  intelligence: ThesisRevisionIntelligence;
};

export type ThesisComparisonRecord = {
  baseRevision: ThesisRevisionRecord;
  currentRevision: ThesisRevisionRecord;
  changeSummary: string;
  sections: Array<{
    key: ThesisChangedSection;
    title: string;
    previousContent: string;
    currentContent: string;
  }>;
};

export type ThesisFreshnessRecord = {
  lastRefreshedAt: string | null;
  latestKnowledgeUpdateAt: string | null;
  potentiallyStale: boolean;
  reason: string;
};

export type ThesisSnapshotRecord = {
  thesis: Thesis | null;
  currentRevision: ThesisRevision | null;
  revisionCount: number;
  freshness: ThesisFreshnessRecord;
};

export type ThesisDetailRecord = {
  thesis: Thesis;
  currentRevision: ThesisRevisionRecord;
  revisions: ThesisRevisionRecord[];
  selectedRevision: ThesisRevisionRecord | null;
  comparison: ThesisComparisonRecord | null;
  freshness: ThesisFreshnessRecord;
};

const positiveTerms = [
  "upside",
  "durable",
  "premium",
  "stable",
  "improvement",
  "improve",
  "expansion",
  "expand",
  "advantage",
  "stickiness",
  "attractive",
  "discipline",
  "design wins",
  "growth",
];

const negativeTerms = [
  "risk",
  "pressure",
  "compression",
  "compress",
  "failed",
  "downside",
  "uncertain",
  "unknown",
  "weak",
  "unresolved",
  "normalization",
  "normalize",
  "volatility",
  "caution",
];

const sectionLabels: Record<ThesisChangedSection, string> = {
  summary: "Summary",
  bullCase: "Bull Case",
  bearCase: "Bear Case",
  variantView: "Variant View",
  keyRisks: "Key Risks",
  keyUnknowns: "Key Unknowns",
  catalystSummary: "Catalysts",
};

const sectionOrder: ThesisChangedSection[] = [
  "summary",
  "bullCase",
  "bearCase",
  "variantView",
  "keyRisks",
  "keyUnknowns",
  "catalystSummary",
];

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim();
}

function emptyReferences(): ThesisSectionReferences {
  return {
    wikiPageIds: [],
    claimIds: [],
    sourceIds: [],
    timelineEventIds: [],
    contradictionIds: [],
  };
}

function mergeReferences(
  ...references: ThesisSectionReferences[]
): ThesisSectionReferences {
  return references.reduce<ThesisSectionReferences>(
    (accumulator, refs) => ({
      wikiPageIds: Array.from(new Set([...accumulator.wikiPageIds, ...refs.wikiPageIds])),
      claimIds: Array.from(new Set([...accumulator.claimIds, ...refs.claimIds])),
      sourceIds: Array.from(new Set([...accumulator.sourceIds, ...refs.sourceIds])),
      timelineEventIds: Array.from(
        new Set([...accumulator.timelineEventIds, ...refs.timelineEventIds]),
      ),
      contradictionIds: Array.from(
        new Set([...accumulator.contradictionIds, ...refs.contradictionIds]),
      ),
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

function confidenceValue(confidence: RevisionConfidence): number {
  return confidence === "high" ? 3 : confidence === "medium" ? 2 : 1;
}

function textSignalScore(value: string): number {
  const normalized = normalizeText(value);
  let score = 0;

  for (const term of positiveTerms) {
    if (normalized.includes(term)) {
      score += 1;
    }
  }

  for (const term of negativeTerms) {
    if (normalized.includes(term)) {
      score -= 1;
    }
  }

  return score;
}

function referencesFromClaim(claim: Claim): ThesisSectionReferences {
  return {
    wikiPageIds: [claim.wikiPageId],
    claimIds: [claim.id],
    sourceIds: claim.sourceId ? [claim.sourceId] : [],
    timelineEventIds: [],
    contradictionIds: [],
  };
}

function referencesFromPage(context: PageContext): ThesisSectionReferences {
  return {
    wikiPageIds: [context.page.id],
    claimIds: [],
    sourceIds: context.sourceIds,
    timelineEventIds: [],
    contradictionIds: [],
  };
}

function referencesFromTimeline(entry: TimelineReferenceRecord): ThesisSectionReferences {
  return {
    wikiPageIds: entry.relatedPages.map((page) => page.id),
    claimIds: entry.relatedClaims.map((claim) => claim.id),
    sourceIds: entry.relatedSources.map((source) => source.id),
    timelineEventIds: [entry.event.id],
    contradictionIds: [],
  };
}

function referencesFromContradiction(
  entry: ContradictionReferenceRecord,
): ThesisSectionReferences {
  return {
    wikiPageIds: entry.relatedPages.map((page) => page.id),
    claimIds: [
      entry.leftClaim?.id ?? null,
      entry.rightClaim?.id ?? null,
    ].filter((value): value is string => Boolean(value)),
    sourceIds: entry.relatedSources.map((source) => source.id),
    timelineEventIds: entry.relatedTimelineEvents.map((event) => event.id),
    contradictionIds: [entry.contradiction.id],
  };
}

function renderBulletMarkdown(title: string, bullets: Bullet[], fallback: string): string {
  if (bullets.length === 0) {
    return `# ${title}\n\n- ${fallback}`;
  }

  return `# ${title}\n\n${bullets.map((bullet) => `- ${bullet.text}`).join("\n")}`;
}

function stanceLabel(stance: ThesisStance): string {
  switch (stance) {
    case "bullish":
      return "Bullish";
    case "bearish":
      return "Bearish";
    case "mixed":
      return "Mixed";
    default:
      return "Monitor";
  }
}

function supportRecordFromRefs(
  refs: ThesisSectionReferences,
  lookup: {
    pagesById: Map<string, WikiPage>;
    claimsById: Map<string, Claim>;
    sourcesById: Map<string, Source>;
    timelineById: Map<string, TimelineEvent>;
    contradictionsById: Map<string, Contradiction>;
  },
): ThesisSupportRecord {
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
    timelineEvents: refs.timelineEventIds
      .map((id) => lookup.timelineById.get(id) ?? null)
      .filter((value): value is TimelineEvent => Boolean(value)),
    contradictions: refs.contradictionIds
      .map((id) => lookup.contradictionsById.get(id) ?? null)
      .filter((value): value is Contradiction => Boolean(value)),
  };
}

function chooseTopBullets(bullets: Bullet[], limit: number): Bullet[] {
  return [...bullets]
    .sort((left, right) => right.score - left.score || left.text.localeCompare(right.text))
    .slice(0, limit);
}

function compileSummaryLine(input: {
  subjectName: string;
  stance: ThesisStance;
  confidence: RevisionConfidence;
  positiveCount: number;
  negativeCount: number;
  contradictionCount: number;
  catalystCount: number;
}): string {
  return `${input.subjectName} currently compiles as a ${stanceLabel(input.stance).toLowerCase()} thesis with ${input.confidence} confidence. The current knowledge base surfaces ${input.positiveCount} constructive signal(s), ${input.negativeCount} risk or pressure signal(s), ${input.contradictionCount} contradiction record(s), and ${input.catalystCount} chronology-based catalyst candidate(s).`;
}

async function buildPageContexts(projectId: string): Promise<PageContext[]> {
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

async function buildKnowledgeState(projectId: string): Promise<ThesisKnowledgeState> {
  const [pageContexts, claims, sources, artifacts, timelineEntries, contradictionEntries] =
    await Promise.all([
      buildPageContexts(projectId),
      claimsRepository.listByProjectId(projectId),
      sourcesRepository.listByProjectId(projectId),
      artifactsRepository.listByProjectId(projectId),
      listProjectTimelineEvents(projectId),
      listProjectContradictions(projectId),
    ]);

  return {
    pageContexts,
    claims,
    sources,
    artifacts,
    timelineEntries,
    contradictionEntries,
  };
}

function maxTimestamp(...values: Array<string | null | undefined>): string | null {
  const filtered = values.filter((value): value is string => Boolean(value));
  if (filtered.length === 0) {
    return null;
  }

  return filtered.sort((left, right) => right.localeCompare(left))[0] ?? null;
}

function buildKnowledgeFingerprint(state: ThesisKnowledgeState): KnowledgeFingerprint {
  const pageEntries = state.pageContexts.map((context) => ({
    signature: `page:${context.page.id}:${context.page.updatedAt}:${context.revision?.createdAt ?? ""}`,
    timestamps: [context.page.updatedAt, context.revision?.createdAt ?? null],
  }));
  const claimEntries = state.claims.map((claim) => ({
    signature: `claim:${claim.id}:${claim.updatedAt}`,
    timestamps: [claim.updatedAt],
  }));
  const sourceEntries = state.sources.map((source) => ({
    signature: `source:${source.id}:${source.updatedAt}`,
    timestamps: [source.updatedAt],
  }));
  const artifactEntries = state.artifacts.map((artifact) => ({
    signature: `artifact:${artifact.id}:${artifact.updatedAt}`,
    timestamps: [artifact.updatedAt],
  }));
  const timelineEntries = state.timelineEntries.map((entry) => ({
    signature: `timeline:${entry.event.id}:${entry.event.updatedAt}`,
    timestamps: [entry.event.updatedAt],
  }));
  const contradictionEntries = state.contradictionEntries.map((entry) => ({
    signature: `contradiction:${entry.contradiction.id}:${entry.contradiction.updatedAt}`,
    timestamps: [entry.contradiction.updatedAt],
  }));
  const fingerprintEntries = [
    ...pageEntries,
    ...claimEntries,
    ...sourceEntries,
    ...artifactEntries,
    ...timelineEntries,
    ...contradictionEntries,
  ];
  const latestKnowledgeUpdateAt = fingerprintEntries.reduce<string | null>(
    (latest, entry) => maxTimestamp(latest, ...entry.timestamps),
    null,
  );

  return {
    signature: fingerprintEntries
      .map((entry) => entry.signature)
      .sort()
      .join("|"),
    latestKnowledgeUpdateAt,
  };
}

function detectSubjectName(projectName: string, sources: Source[]): string {
  const issuer = sources.find((source) => source.metadata.issuer)?.metadata.issuer;
  return issuer ?? projectName;
}

function detectTicker(sources: Source[]): string | null {
  for (const source of sources) {
    const ticker = source.metadata.ticker ?? source.metadata.symbol ?? null;
    if (ticker) {
      return ticker.toUpperCase();
    }
  }

  return null;
}

function sectionContentFromCandidate(
  candidate: CompiledThesisCandidate,
  section: ThesisChangedSection,
): string {
  switch (section) {
    case "summary":
      return candidate.summary;
    case "bullCase":
      return candidate.bullCaseMarkdown;
    case "bearCase":
      return candidate.bearCaseMarkdown;
    case "variantView":
      return candidate.variantViewMarkdown;
    case "keyRisks":
      return candidate.keyRisksMarkdown;
    case "keyUnknowns":
      return candidate.keyUnknownsMarkdown;
    case "catalystSummary":
      return candidate.catalystSummaryMarkdown;
  }
}

function sectionContentFromRevision(
  revision: ThesisRevision,
  section: ThesisChangedSection,
): string {
  switch (section) {
    case "summary":
      return revision.summary;
    case "bullCase":
      return revision.bullCaseMarkdown;
    case "bearCase":
      return revision.bearCaseMarkdown;
    case "variantView":
      return revision.variantViewMarkdown;
    case "keyRisks":
      return revision.keyRisksMarkdown;
    case "keyUnknowns":
      return revision.keyUnknownsMarkdown;
    case "catalystSummary":
      return revision.catalystSummaryMarkdown;
  }
}

function parseInteger(value: string | undefined, fallback = 0): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseJsonArray(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

function buildChangedSections(
  previousRevision: ThesisRevision | null,
  candidate: CompiledThesisCandidate,
): ThesisChangedSection[] {
  if (!previousRevision) {
    return [];
  }

  return sectionOrder.filter(
    (section) =>
      normalizeText(sectionContentFromRevision(previousRevision, section)) !==
      normalizeText(sectionContentFromCandidate(candidate, section)),
  );
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function detectLikelyDrivers(
  previousRevision: ThesisRevision | null,
  state: ThesisKnowledgeState,
): {
  ids: DriverIdSet;
  summary: string | null;
} {
  if (!previousRevision) {
    return {
      ids: {
        pageIds: [],
        claimIds: [],
        sourceIds: [],
        timelineEventIds: [],
        contradictionIds: [],
        artifactIds: [],
      },
      summary: "Initial compile from current canon, chronology, contradiction state, and durable research outputs.",
    };
  }

  const cutoff = previousRevision.createdAt;
  const ids: DriverIdSet = {
    pageIds: state.pageContexts
      .filter(
        (context) =>
          context.page.updatedAt > cutoff || (context.revision?.createdAt ?? "") > cutoff,
      )
      .map((context) => context.page.id),
    claimIds: state.claims
      .filter((claim) => claim.updatedAt > cutoff)
      .map((claim) => claim.id),
    sourceIds: state.sources
      .filter((source) => source.updatedAt > cutoff)
      .map((source) => source.id),
    timelineEventIds: state.timelineEntries
      .filter((entry) => entry.event.updatedAt > cutoff)
      .map((entry) => entry.event.id),
    contradictionIds: state.contradictionEntries
      .filter((entry) => entry.contradiction.updatedAt > cutoff)
      .map((entry) => entry.contradiction.id),
    artifactIds: state.artifacts
      .filter((artifact) => artifact.updatedAt > cutoff)
      .map((artifact) => artifact.id),
  };

  const parts = [
    ids.pageIds.length > 0 ? pluralize(ids.pageIds.length, "updated wiki page") : null,
    ids.claimIds.length > 0 ? pluralize(ids.claimIds.length, "new or updated claim") : null,
    ids.sourceIds.length > 0 ? pluralize(ids.sourceIds.length, "updated source") : null,
    ids.timelineEventIds.length > 0
      ? pluralize(ids.timelineEventIds.length, "new timeline event")
      : null,
    ids.contradictionIds.length > 0
      ? pluralize(ids.contradictionIds.length, "new contradiction")
      : null,
    ids.artifactIds.length > 0 ? pluralize(ids.artifactIds.length, "new artifact") : null,
  ].filter((part): part is string => Boolean(part));

  return {
    ids,
    summary:
      parts.length > 0
        ? `Likely drivers: ${parts.join(", ")}.`
        : "No clearly newer knowledge objects were isolated; the refresh likely reflects a recompute over unchanged inputs.",
  };
}

function buildChangeSummary(input: {
  previousRevision: ThesisRevision | null;
  changedSections: ThesisChangedSection[];
  confidenceShift: number;
  contradictionCountShift: number;
  catalystCountShift: number;
  likelyDriverSummary: string | null;
}): string {
  if (!input.previousRevision) {
    return "Initial thesis compile established the first revision from the current compiled knowledge stack.";
  }

  const segments: string[] = [];

  if (input.changedSections.length > 0) {
    segments.push(
      `Changed sections: ${input.changedSections
        .map((section) => sectionLabels[section])
        .join(", ")}.`,
    );
  } else {
    segments.push("No major thesis sections changed.");
  }

  if (input.confidenceShift !== 0) {
    segments.push(
      `Confidence ${input.confidenceShift > 0 ? "rose" : "fell"} by ${Math.abs(input.confidenceShift)} step(s).`,
    );
  }

  if (input.contradictionCountShift !== 0) {
    segments.push(
      `Unresolved contradictions ${
        input.contradictionCountShift > 0 ? "increased" : "decreased"
      } by ${Math.abs(input.contradictionCountShift)}.`,
    );
  }

  if (input.catalystCountShift !== 0) {
    segments.push(
      `Catalyst count ${
        input.catalystCountShift > 0 ? "increased" : "decreased"
      } by ${Math.abs(input.catalystCountShift)}.`,
    );
  }

  if (input.likelyDriverSummary) {
    segments.push(input.likelyDriverSummary);
  }

  return segments.join(" ");
}

function buildCompiledThesisCandidate(
  projectName: string,
  state: ThesisKnowledgeState,
): CompiledThesisCandidate {
  const fingerprint = buildKnowledgeFingerprint(state);
  const subjectName = detectSubjectName(projectName, state.sources);
  const ticker = detectTicker(state.sources);
  const positiveClaims = state.claims.filter(
    (claim) => claim.supportStatus === "supported" && textSignalScore(claim.text) > 0,
  );
  const negativeClaims = state.claims.filter((claim) => textSignalScore(claim.text) < 0);
  const unknownClaims = state.claims.filter(
    (claim) =>
      claim.supportStatus === "unresolved" || claim.claimType === "open-question",
  );
  const contradictionCount = state.contradictionEntries.filter(
    (entry) => entry.contradiction.status !== "resolved",
  ).length;
  const positivePageBullets = state.pageContexts
    .filter(
      (context) =>
        context.revision &&
        (textSignalScore(context.revision.summary ?? context.revision.markdownContent) > 0 ||
          ["investment-thesis", "dossier", "overview", "market-map"].includes(
            context.page.pageType,
          )),
    )
    .map<Bullet>((context) => ({
      text:
        context.revision?.summary ??
        `${context.page.title} is currently a constructive canonical input.`,
      references: referencesFromPage(context),
      score:
        textSignalScore(
          `${context.page.title} ${context.revision?.summary ?? ""} ${context.revision?.markdownContent ?? ""}`,
        ) + confidenceRank(context.revision?.confidence),
    }));
  const negativePageBullets = state.pageContexts
    .filter(
      (context) =>
        context.revision &&
        (textSignalScore(context.revision.summary ?? context.revision.markdownContent) < 0 ||
          ["risk-register", "open-questions"].includes(context.page.pageType)),
    )
    .map<Bullet>((context) => ({
      text:
        context.revision?.summary ??
        `${context.page.title} currently emphasizes downside or unresolved posture.`,
      references: referencesFromPage(context),
      score:
        Math.abs(
          textSignalScore(
            `${context.page.title} ${context.revision?.summary ?? ""} ${context.revision?.markdownContent ?? ""}`,
          ),
        ) + confidenceRank(context.revision?.confidence),
    }));
  const positiveClaimBullets = positiveClaims.map<Bullet>((claim) => ({
    text: claim.text,
    references: referencesFromClaim(claim),
    score: 2 + confidenceRank(claim.confidence),
  }));
  const negativeClaimBullets = negativeClaims.map<Bullet>((claim) => ({
    text: claim.text,
    references: referencesFromClaim(claim),
    score: 2 + confidenceRank(claim.confidence),
  }));
  const contradictionBullets = state.contradictionEntries.map<Bullet>((entry) => ({
    text: `${entry.contradiction.title}. ${entry.contradiction.rationale}`,
    references: referencesFromContradiction(entry),
    score:
      2 +
      confidenceRank(entry.contradiction.confidence) +
      (entry.contradiction.severity === "high" || entry.contradiction.severity === "critical"
        ? 1
        : 0),
  }));
  const timelineBullets = state.timelineEntries
    .filter((entry) =>
      ["milestone", "planning", "financial", "system"].includes(entry.event.eventType),
    )
    .map<Bullet>((entry) => ({
      text: `${entry.event.title} (${new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(new Date(entry.event.eventDate))}): ${entry.event.description}`,
      references: referencesFromTimeline(entry),
      score:
        1 +
        confidenceRank(entry.event.confidence) +
        (entry.event.eventType === "financial" || entry.event.eventType === "milestone"
          ? 1
          : 0),
    }));
  const unknownBullets = [
    ...unknownClaims.map<Bullet>((claim) => ({
      text: claim.text,
      references: referencesFromClaim(claim),
      score: 2 + confidenceRank(claim.confidence),
    })),
    ...state.pageContexts
      .filter((context) => context.page.pageType === "open-questions" && context.revision)
      .map<Bullet>((context) => ({
        text: context.revision?.summary ?? `${context.page.title} remains unresolved.`,
        references: referencesFromPage(context),
        score: 2 + confidenceRank(context.revision?.confidence),
      })),
  ];
  const artifactSignalScore = state.artifacts.reduce(
    (sum, artifact) => sum + textSignalScore(`${artifact.title} ${artifact.previewText}`),
    0,
  );
  const positiveCount =
    positiveClaims.length + positivePageBullets.length + Math.max(artifactSignalScore, 0);
  const negativeCount =
    negativeClaims.length +
    negativePageBullets.length +
    contradictionCount +
    Math.max(-artifactSignalScore, 0);
  const stance: ThesisStance =
    positiveCount >= negativeCount + 3
      ? "bullish"
      : negativeCount >= positiveCount + 3
        ? "bearish"
        : positiveCount > 0 || negativeCount > 0
          ? "mixed"
          : "monitor";
  const confidence: RevisionConfidence =
    state.claims.length >= 6 && contradictionCount <= 1
      ? "high"
      : state.claims.length >= 3 || state.timelineEntries.length >= 3
        ? "medium"
        : "low";
  const bullBullets = chooseTopBullets(
    [...positiveClaimBullets, ...positivePageBullets],
    4,
  );
  const bearBullets = chooseTopBullets(
    [...negativeClaimBullets, ...negativePageBullets, ...contradictionBullets],
    4,
  );
  const variantBullets = chooseTopBullets(
    [
      ...contradictionBullets,
      ...timelineBullets.filter((entry) => entry.score >= 2),
    ],
    4,
  );
  const riskBullets = chooseTopBullets(
    [
      ...negativePageBullets,
      ...negativeClaimBullets,
      ...contradictionBullets.filter((entry) => entry.score >= 3),
    ],
    4,
  );
  const catalystBullets = chooseTopBullets(timelineBullets, 4);
  const summaryReferences = mergeReferences(
    ...[
      bullBullets[0]?.references ?? emptyReferences(),
      bearBullets[0]?.references ?? emptyReferences(),
      catalystBullets[0]?.references ?? emptyReferences(),
    ],
  );
  const summaryMarkdown = compileSummaryLine({
    subjectName,
    stance,
    confidence,
    positiveCount,
    negativeCount,
    contradictionCount,
    catalystCount: catalystBullets.length,
  });
  const supportBySection: ThesisSectionSupportMap = {
    summary: summaryReferences,
    bullCase: mergeReferences(...bullBullets.map((bullet) => bullet.references)),
    bearCase: mergeReferences(...bearBullets.map((bullet) => bullet.references)),
    variantView: mergeReferences(...variantBullets.map((bullet) => bullet.references)),
    keyRisks: mergeReferences(...riskBullets.map((bullet) => bullet.references)),
    keyUnknowns: mergeReferences(...unknownBullets.map((bullet) => bullet.references)),
    catalystSummary: mergeReferences(...catalystBullets.map((bullet) => bullet.references)),
  };

  return {
    title: `Investment Thesis: ${subjectName}`,
    subjectName,
    ticker,
    status:
      state.pageContexts.length > 0 ||
      state.claims.length > 0 ||
      state.timelineEntries.length > 0
        ? "active"
        : "draft",
    overallStance: stance,
    summary: summaryMarkdown,
    bullCaseMarkdown: renderBulletMarkdown(
      "Bull Case",
      bullBullets,
      "Constructive evidence has not been strongly compiled yet.",
    ),
    bearCaseMarkdown: renderBulletMarkdown(
      "Bear Case",
      bearBullets,
      "The current knowledge base does not yet surface a strong compiled bear case.",
    ),
    variantViewMarkdown: renderBulletMarkdown(
      "Variant View",
      variantBullets,
      "The variant view remains thin because contradictions and chronology tension are still sparse.",
    ),
    keyRisksMarkdown: renderBulletMarkdown(
      "Key Risks",
      riskBullets,
      "Key risks are still mostly implicit and need fuller source coverage.",
    ),
    keyUnknownsMarkdown: renderBulletMarkdown(
      "Key Unknowns",
      chooseTopBullets(unknownBullets, 4),
      "No major unresolved knowledge gaps are currently surfaced.",
    ),
    catalystSummaryMarkdown: renderBulletMarkdown(
      "Catalysts",
      catalystBullets,
      "No clear catalyst candidates are currently compiled from timeline state.",
    ),
    confidence,
    supportBySection,
    latestInputSignature: fingerprint.signature,
    latestKnowledgeUpdateAt: fingerprint.latestKnowledgeUpdateAt,
    metadata: {
      catalystCount: String(catalystBullets.length),
      contradictionCount: String(contradictionCount),
      positiveSignalCount: String(positiveCount),
      negativeSignalCount: String(negativeCount),
      artifactSignalScore: String(artifactSignalScore),
      latestKnowledgeUpdateAt: fingerprint.latestKnowledgeUpdateAt ?? "",
    },
  };
}

function buildRevisionLookup(input: {
  pages: WikiPage[];
  claims: Claim[];
  sources: Source[];
  timelineEvents: TimelineEvent[];
  contradictions: Contradiction[];
  artifacts: Artifact[];
}) {
  return {
    pagesById: new Map(input.pages.map((page) => [page.id, page] as const)),
    claimsById: new Map(input.claims.map((claim) => [claim.id, claim] as const)),
    sourcesById: new Map(input.sources.map((source) => [source.id, source] as const)),
    timelineById: new Map(
      input.timelineEvents.map((event) => [event.id, event] as const),
    ),
    contradictionsById: new Map(
      input.contradictions.map((contradiction) => [contradiction.id, contradiction] as const),
    ),
    artifactsById: new Map(input.artifacts.map((artifact) => [artifact.id, artifact] as const)),
  };
}

function hydrateIntelligence(
  metadata: StringMetadata | undefined,
  lookup: ReturnType<typeof buildRevisionLookup>,
): ThesisRevisionIntelligence {
  const changedSections = parseJsonArray(metadata?.changedSections).filter(
    (section): section is ThesisChangedSection => section in sectionLabels,
  );

  return {
    changedSections,
    confidenceShift: parseInteger(metadata?.confidenceShift),
    catalystCountShift: parseInteger(metadata?.catalystCountShift),
    contradictionCountShift: parseInteger(metadata?.contradictionCountShift),
    likelyDriverSummary: metadata?.likelyDriverSummary ?? null,
    likelyDrivers: {
      pages: parseJsonArray(metadata?.driverPageIds)
        .map((id) => lookup.pagesById.get(id) ?? null)
        .filter((value): value is WikiPage => Boolean(value)),
      claims: parseJsonArray(metadata?.driverClaimIds)
        .map((id) => lookup.claimsById.get(id) ?? null)
        .filter((value): value is Claim => Boolean(value)),
      sources: parseJsonArray(metadata?.driverSourceIds)
        .map((id) => lookup.sourcesById.get(id) ?? null)
        .filter((value): value is Source => Boolean(value)),
      timelineEvents: parseJsonArray(metadata?.driverTimelineEventIds)
        .map((id) => lookup.timelineById.get(id) ?? null)
        .filter((value): value is TimelineEvent => Boolean(value)),
      contradictions: parseJsonArray(metadata?.driverContradictionIds)
        .map((id) => lookup.contradictionsById.get(id) ?? null)
        .filter((value): value is Contradiction => Boolean(value)),
      artifacts: parseJsonArray(metadata?.driverArtifactIds)
        .map((id) => lookup.artifactsById.get(id) ?? null)
        .filter((value): value is Artifact => Boolean(value)),
    },
  };
}

function buildRevisionRecord(
  revision: ThesisRevision,
  lookup: ReturnType<typeof buildRevisionLookup>,
): ThesisRevisionRecord {
  return {
    revision,
    supportBySection: {
      summary: supportRecordFromRefs(revision.supportBySection.summary, lookup),
      bullCase: supportRecordFromRefs(revision.supportBySection.bullCase, lookup),
      bearCase: supportRecordFromRefs(revision.supportBySection.bearCase, lookup),
      variantView: supportRecordFromRefs(revision.supportBySection.variantView, lookup),
      keyRisks: supportRecordFromRefs(revision.supportBySection.keyRisks, lookup),
      keyUnknowns: supportRecordFromRefs(revision.supportBySection.keyUnknowns, lookup),
      catalystSummary: supportRecordFromRefs(
        revision.supportBySection.catalystSummary,
        lookup,
      ),
    },
    intelligence: hydrateIntelligence(revision.metadata, lookup),
  };
}

function buildComparison(
  currentRevision: ThesisRevisionRecord,
  baseRevision: ThesisRevisionRecord | null,
): ThesisComparisonRecord | null {
  if (!baseRevision || baseRevision.revision.id === currentRevision.revision.id) {
    return null;
  }

  const sections = sectionOrder
    .filter(
      (section) =>
        normalizeText(sectionContentFromRevision(currentRevision.revision, section)) !==
        normalizeText(sectionContentFromRevision(baseRevision.revision, section)),
    )
    .map((section) => ({
      key: section,
      title: sectionLabels[section],
      previousContent: sectionContentFromRevision(baseRevision.revision, section),
      currentContent: sectionContentFromRevision(currentRevision.revision, section),
    }));

  return {
    baseRevision,
    currentRevision,
    changeSummary:
      currentRevision.revision.changeSummary ||
      "The current thesis revision differs from the selected prior revision.",
    sections,
  };
}

export async function compileProjectThesis(projectId: string): Promise<Thesis> {
  const project = await projectsRepository.getById(projectId);

  if (!project) {
    throw new Error("Project is required to compile a thesis.");
  }

  const [state, existingThesis, existingRevisions] = await Promise.all([
    buildKnowledgeState(projectId),
    thesesRepository.getByProjectId(projectId),
    thesisRevisionsRepository.listByProjectId(projectId),
  ]);
  const previousRevision = existingThesis?.currentRevisionId
    ? (await thesisRevisionsRepository.getById(existingThesis.currentRevisionId)) ??
      existingRevisions[0] ??
      null
    : existingRevisions[0] ?? null;
  const candidate = buildCompiledThesisCandidate(project.name, state);
  const changedSections = buildChangedSections(previousRevision, candidate);
  const contradictionCount = parseInteger(candidate.metadata.contradictionCount);
  const catalystCount = parseInteger(candidate.metadata.catalystCount);
  const previousContradictionCount = parseInteger(previousRevision?.metadata?.contradictionCount);
  const previousCatalystCount = parseInteger(previousRevision?.metadata?.catalystCount);
  const confidenceShift =
    confidenceValue(candidate.confidence) -
    confidenceValue(previousRevision?.confidence ?? candidate.confidence);
  const contradictionCountShift = contradictionCount - previousContradictionCount;
  const catalystCountShift = catalystCount - previousCatalystCount;
  const likelyDrivers = detectLikelyDrivers(previousRevision, state);
  const changeSummary = buildChangeSummary({
    previousRevision,
    changedSections,
    confidenceShift,
    contradictionCountShift,
    catalystCountShift,
    likelyDriverSummary: likelyDrivers.summary,
  });
  const revisionNumber = (existingThesis?.revisionCount ?? existingRevisions.length) + 1;
  const thesisId = existingThesis?.id ?? `thesis-${projectId}`;
  const revision = await thesisRevisionsRepository.create({
    thesisId,
    projectId,
    revisionNumber,
    status: candidate.status,
    stance: candidate.overallStance,
    confidence: candidate.confidence,
    summary: candidate.summary,
    bullCaseMarkdown: candidate.bullCaseMarkdown,
    bearCaseMarkdown: candidate.bearCaseMarkdown,
    variantViewMarkdown: candidate.variantViewMarkdown,
    keyRisksMarkdown: candidate.keyRisksMarkdown,
    keyUnknownsMarkdown: candidate.keyUnknownsMarkdown,
    catalystSummaryMarkdown: candidate.catalystSummaryMarkdown,
    changeSummary,
    supportBySection: candidate.supportBySection,
    metadata: {
      ...candidate.metadata,
      changedSections: JSON.stringify(changedSections),
      confidenceShift: String(confidenceShift),
      contradictionCountShift: String(contradictionCountShift),
      catalystCountShift: String(catalystCountShift),
      likelyDriverSummary: likelyDrivers.summary ?? "",
      driverPageIds: JSON.stringify(likelyDrivers.ids.pageIds),
      driverClaimIds: JSON.stringify(likelyDrivers.ids.claimIds),
      driverSourceIds: JSON.stringify(likelyDrivers.ids.sourceIds),
      driverTimelineEventIds: JSON.stringify(likelyDrivers.ids.timelineEventIds),
      driverContradictionIds: JSON.stringify(likelyDrivers.ids.contradictionIds),
      driverArtifactIds: JSON.stringify(likelyDrivers.ids.artifactIds),
    },
  });

  return thesesRepository.upsertForProject({
    projectId,
    currentRevisionId: revision.id,
    revisionCount: revisionNumber,
    title: candidate.title,
    subjectName: candidate.subjectName,
    ticker: candidate.ticker,
    status: candidate.status,
    overallStance: candidate.overallStance,
    summary: candidate.summary,
    bullCaseMarkdown: candidate.bullCaseMarkdown,
    bearCaseMarkdown: candidate.bearCaseMarkdown,
    variantViewMarkdown: candidate.variantViewMarkdown,
    keyRisksMarkdown: candidate.keyRisksMarkdown,
    keyUnknownsMarkdown: candidate.keyUnknownsMarkdown,
    catalystSummaryMarkdown: candidate.catalystSummaryMarkdown,
    confidence: candidate.confidence,
    supportBySection: candidate.supportBySection,
    latestInputSignature: candidate.latestInputSignature,
    metadata: {
      ...candidate.metadata,
      currentChangeSummary: changeSummary,
      currentRevisionNumber: String(revisionNumber),
      latestKnowledgeUpdateAt: candidate.latestKnowledgeUpdateAt ?? "",
    },
  });
}

export async function getStoredProjectThesis(projectId: string): Promise<Thesis | null> {
  return thesesRepository.getByProjectId(projectId);
}

export async function getProjectThesisSnapshot(
  projectId: string,
): Promise<ThesisSnapshotRecord> {
  const [thesis, revisions, state] = await Promise.all([
    thesesRepository.getByProjectId(projectId),
    thesisRevisionsRepository.listByProjectId(projectId),
    buildKnowledgeState(projectId),
  ]);
  const currentRevision =
    thesis?.currentRevisionId
      ? (await thesisRevisionsRepository.getById(thesis.currentRevisionId)) ?? null
      : revisions[0] ?? null;
  const fingerprint = buildKnowledgeFingerprint(state);
  const potentiallyStale = Boolean(
    thesis &&
      (fingerprint.signature !== thesis.latestInputSignature ||
        (fingerprint.latestKnowledgeUpdateAt !== null &&
          fingerprint.latestKnowledgeUpdateAt > thesis.updatedAt)),
  );

  return {
    thesis,
    currentRevision,
    revisionCount: thesis?.revisionCount ?? revisions.length,
    freshness: {
      lastRefreshedAt: thesis?.updatedAt ?? currentRevision?.createdAt ?? null,
      latestKnowledgeUpdateAt: fingerprint.latestKnowledgeUpdateAt,
      potentiallyStale,
      reason: thesis
        ? potentiallyStale
          ? "New or updated project knowledge appears to postdate the current thesis revision."
          : "Current thesis matches the latest compiled project knowledge fingerprint."
        : "No thesis has been compiled for this project yet.",
    },
  };
}

export async function getProjectThesisDetail(
  projectId: string,
  selectedRevisionId?: string | null,
): Promise<ThesisDetailRecord | null> {
  const [thesis, revisions, pages, claims, sources, timelineEvents, contradictions, artifacts, snapshot] =
    await Promise.all([
      thesesRepository.getByProjectId(projectId),
      thesisRevisionsRepository.listByProjectId(projectId),
      wikiRepository.listPagesByProjectId(projectId),
      claimsRepository.listByProjectId(projectId),
      sourcesRepository.listByProjectId(projectId),
      timelineEventsRepository.listByProjectId(projectId),
      contradictionsRepository.listByProjectId(projectId),
      artifactsRepository.listByProjectId(projectId),
      getProjectThesisSnapshot(projectId),
    ]);

  if (!thesis) {
    return null;
  }

  const lookup = buildRevisionLookup({
    pages,
    claims,
    sources,
    timelineEvents,
    contradictions,
    artifacts,
  });
  const revisionRecords = revisions.map((revision) => buildRevisionRecord(revision, lookup));
  const currentRevision =
    revisionRecords.find((record) => record.revision.id === thesis.currentRevisionId) ??
    revisionRecords[0] ??
    null;

  if (!currentRevision) {
    return null;
  }

  const selectedRevision =
    revisionRecords.find((record) => record.revision.id === selectedRevisionId) ?? null;

  return {
    thesis,
    currentRevision,
    revisions: revisionRecords,
    selectedRevision,
    comparison: buildComparison(currentRevision, selectedRevision),
    freshness: snapshot.freshness,
  };
}
