import type {
  Claim,
  Contradiction,
  RevisionConfidence,
  Source,
  Thesis,
  ThesisSectionReferences,
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

export type ThesisSupportRecord = {
  pages: WikiPage[];
  claims: Claim[];
  sources: Source[];
  timelineEvents: TimelineEvent[];
  contradictions: Contradiction[];
};

export type ThesisDetailRecord = {
  thesis: Thesis;
  supportBySection: {
    summary: ThesisSupportRecord;
    bullCase: ThesisSupportRecord;
    bearCase: ThesisSupportRecord;
    variantView: ThesisSupportRecord;
    keyRisks: ThesisSupportRecord;
    keyUnknowns: ThesisSupportRecord;
    catalystSummary: ThesisSupportRecord;
  };
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

export async function compileProjectThesis(projectId: string): Promise<Thesis> {
  const project = await projectsRepository.getById(projectId);

  if (!project) {
    throw new Error("Project is required to compile a thesis.");
  }

  const [pageContexts, claims, sources, artifacts, timelineEntries, contradictionEntries] =
    await Promise.all([
      buildPageContexts(projectId),
      claimsRepository.listByProjectId(projectId),
      sourcesRepository.listByProjectId(projectId),
      artifactsRepository.listByProjectId(projectId),
      listProjectTimelineEvents(projectId),
      listProjectContradictions(projectId),
    ]);

  const subjectName = detectSubjectName(project.name, sources);
  const ticker = detectTicker(sources);
  const positiveClaims = claims.filter(
    (claim) => claim.supportStatus === "supported" && textSignalScore(claim.text) > 0,
  );
  const negativeClaims = claims.filter((claim) => textSignalScore(claim.text) < 0);
  const unknownClaims = claims.filter(
    (claim) =>
      claim.supportStatus === "unresolved" || claim.claimType === "open-question",
  );
  const contradictionCount = contradictionEntries.filter(
    (entry) => entry.contradiction.status !== "resolved",
  ).length;
  const positivePageBullets = pageContexts
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
  const negativePageBullets = pageContexts
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
  const contradictionBullets = contradictionEntries.map<Bullet>((entry) => ({
    text: `${entry.contradiction.title}. ${entry.contradiction.rationale}`,
    references: referencesFromContradiction(entry),
    score:
      2 +
      confidenceRank(entry.contradiction.confidence) +
      (entry.contradiction.severity === "high" || entry.contradiction.severity === "critical"
        ? 1
        : 0),
  }));
  const timelineBullets = timelineEntries
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
    ...pageContexts
      .filter((context) => context.page.pageType === "open-questions" && context.revision)
      .map<Bullet>((context) => ({
        text: context.revision?.summary ?? `${context.page.title} remains unresolved.`,
        references: referencesFromPage(context),
        score: 2 + confidenceRank(context.revision?.confidence),
      })),
  ];
  const artifactSignalScore = artifacts.reduce(
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
    claims.length >= 6 && contradictionCount <= 1
      ? "high"
      : claims.length >= 3 || timelineEntries.length >= 3
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
  const supportBySection = {
    summary: summaryReferences,
    bullCase: mergeReferences(...bullBullets.map((bullet) => bullet.references)),
    bearCase: mergeReferences(...bearBullets.map((bullet) => bullet.references)),
    variantView: mergeReferences(...variantBullets.map((bullet) => bullet.references)),
    keyRisks: mergeReferences(...riskBullets.map((bullet) => bullet.references)),
    keyUnknowns: mergeReferences(...unknownBullets.map((bullet) => bullet.references)),
    catalystSummary: mergeReferences(...catalystBullets.map((bullet) => bullet.references)),
  };

  return thesesRepository.upsertForProject({
    projectId,
    title: `Investment Thesis: ${subjectName}`,
    subjectName,
    ticker,
    status:
      pageContexts.length > 0 || claims.length > 0 || timelineEntries.length > 0
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
    metadata: {
      catalystCount: String(catalystBullets.length),
      contradictionCount: String(contradictionCount),
      positiveSignalCount: String(positiveCount),
      negativeSignalCount: String(negativeCount),
      artifactSignalScore: String(artifactSignalScore),
    },
  });
}

export async function getStoredProjectThesis(projectId: string): Promise<Thesis | null> {
  return thesesRepository.getByProjectId(projectId);
}

export async function getProjectThesisDetail(
  projectId: string,
): Promise<ThesisDetailRecord | null> {
  const [thesis, pages, claims, sources, timelineEvents, contradictions] = await Promise.all([
    thesesRepository.getByProjectId(projectId),
    wikiRepository.listPagesByProjectId(projectId),
    claimsRepository.listByProjectId(projectId),
    sourcesRepository.listByProjectId(projectId),
    timelineEventsRepository.listByProjectId(projectId),
    contradictionsRepository.listByProjectId(projectId),
  ]);

  if (!thesis) {
    return null;
  }

  const lookup = {
    pagesById: new Map(pages.map((page) => [page.id, page] as const)),
    claimsById: new Map(claims.map((claim) => [claim.id, claim] as const)),
    sourcesById: new Map(sources.map((source) => [source.id, source] as const)),
    timelineById: new Map(timelineEvents.map((event) => [event.id, event] as const)),
    contradictionsById: new Map(
      contradictions.map((contradiction) => [contradiction.id, contradiction] as const),
    ),
  };

  return {
    thesis,
    supportBySection: {
      summary: supportRecordFromRefs(thesis.supportBySection.summary, lookup),
      bullCase: supportRecordFromRefs(thesis.supportBySection.bullCase, lookup),
      bearCase: supportRecordFromRefs(thesis.supportBySection.bearCase, lookup),
      variantView: supportRecordFromRefs(thesis.supportBySection.variantView, lookup),
      keyRisks: supportRecordFromRefs(thesis.supportBySection.keyRisks, lookup),
      keyUnknowns: supportRecordFromRefs(thesis.supportBySection.keyUnknowns, lookup),
      catalystSummary: supportRecordFromRefs(
        thesis.supportBySection.catalystSummary,
        lookup,
      ),
    },
  };
}
