import type {
  Claim,
  RevisionConfidence,
  Source,
  SourceFragment,
  TimelineCompileState,
  TimelineEvent,
  TimelineEventDatePrecision,
  TimelineEventDraft,
  TimelineEventType,
  WikiPage,
  WikiPageRevision,
} from "@/lib/domain/types";
import { claimsRepository } from "@/lib/repositories/claims-repository";
import { sourceFragmentsRepository } from "@/lib/repositories/source-fragments-repository";
import { sourcesRepository } from "@/lib/repositories/sources-repository";
import { timelineEventsRepository } from "@/lib/repositories/timeline-events-repository";
import { wikiRepository } from "@/lib/repositories/wiki-repository";

type DateCandidate = {
  eventDate: string;
  eventDatePrecision: TimelineEventDatePrecision;
  matchedText: string;
};

export type TimelineReferenceRecord = {
  event: TimelineEvent;
  relatedSources: Source[];
  relatedPages: WikiPage[];
  relatedClaims: Claim[];
};

export type TimelinePageData = {
  events: TimelineReferenceRecord[];
  compileState: TimelineCompileState;
  metrics: Array<{ label: string; value: string; note: string }>;
};

const monthMap: Record<string, string> = {
  jan: "01",
  january: "01",
  feb: "02",
  february: "02",
  mar: "03",
  march: "03",
  apr: "04",
  april: "04",
  may: "05",
  jun: "06",
  june: "06",
  jul: "07",
  july: "07",
  aug: "08",
  august: "08",
  sep: "09",
  sept: "09",
  september: "09",
  oct: "10",
  october: "10",
  nov: "11",
  november: "11",
  dec: "12",
  december: "12",
};

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function stableKey(...parts: Array<string | null | undefined>): string {
  return parts
    .filter((part): part is string => Boolean(part))
    .map((part) => part.toLowerCase().replace(/[^a-z0-9]+/g, "-"))
    .join("-");
}

function preview(value: string | null, length = 220): string {
  if (!value) {
    return "No stored content is available.";
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > length
    ? `${normalized.slice(0, length).trimEnd()}...`
    : normalized;
}

function formatDateLabel(
  eventDate: string,
  precision: TimelineEventDatePrecision,
): string {
  if (precision === "exact_day" || precision === "unknown_estimated") {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(eventDate));
  }

  if (precision === "month") {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      year: "numeric",
    }).format(new Date(eventDate));
  }

  return eventDate.slice(0, 4);
}

function confidenceRank(confidence: RevisionConfidence): number {
  if (confidence === "high") {
    return 3;
  }

  if (confidence === "medium") {
    return 2;
  }

  return 1;
}

function chooseHigherConfidence(
  left: RevisionConfidence,
  right: RevisionConfidence,
): RevisionConfidence {
  return confidenceRank(right) > confidenceRank(left) ? right : left;
}

function sentenceForMatch(text: string, matchedText: string): string {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  return (
    sentences.find((sentence) => sentence.includes(matchedText)) ??
    preview(text, 200)
  );
}

function inferEventType(text: string): TimelineEventType {
  const normalized = normalizeText(text);

  if (
    normalized.includes("earnings") ||
    normalized.includes("pricing") ||
    normalized.includes("investor") ||
    normalized.includes("fy2025") ||
    normalized.includes("q4")
  ) {
    return "financial";
  }

  if (
    normalized.includes("roadmap") ||
    normalized.includes("sprint") ||
    normalized.includes("plan") ||
    normalized.includes("scope")
  ) {
    return "planning";
  }

  if (
    normalized.includes("question") ||
    normalized.includes("uncertain") ||
    normalized.includes("gap")
  ) {
    return "question";
  }

  if (
    normalized.includes("architecture") ||
    normalized.includes("compiler") ||
    normalized.includes("schema") ||
    normalized.includes("launch") ||
    normalized.includes("release")
  ) {
    return "system";
  }

  if (
    normalized.includes("summary") ||
    normalized.includes("document") ||
    normalized.includes("brief") ||
    normalized.includes("memo")
  ) {
    return "document";
  }

  if (
    normalized.includes("milestone") ||
    normalized.includes("decision") ||
    normalized.includes("canon")
  ) {
    return "milestone";
  }

  return "research";
}

function exactDayCandidates(text: string): DateCandidate[] {
  const matches = text.matchAll(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(20\d{2})\b/gi,
  );

  return Array.from(matches, (match) => {
    const month = monthMap[match[1].toLowerCase()];
    const day = match[2].padStart(2, "0");
    const year = match[3];

    return {
      eventDate: `${year}-${month}-${day}`,
      eventDatePrecision: "exact_day",
      matchedText: match[0],
    };
  });
}

function monthCandidates(text: string): DateCandidate[] {
  const matches = text.matchAll(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(20\d{2})\b/gi,
  );

  return Array.from(matches, (match) => {
    const month = monthMap[match[1].toLowerCase()];
    const year = match[2];

    return {
      eventDate: `${year}-${month}-01`,
      eventDatePrecision: "month",
      matchedText: match[0],
    };
  });
}

function quarterCandidates(text: string): DateCandidate[] {
  const matches = text.matchAll(/\b(Q([1-4])|FY)(\s*|-)?(20\d{2})\b/gi);

  return Array.from(matches, (match) => {
    const year = match[4];
    const quarter = match[2] ? Number(match[2]) : null;
    const month =
      quarter === 1 ? "01" : quarter === 2 ? "04" : quarter === 3 ? "07" : "10";

    return {
      eventDate: `${year}-${month}-01`,
      eventDatePrecision: "unknown_estimated",
      matchedText: match[0],
    };
  });
}

function yearCandidates(text: string): DateCandidate[] {
  const matches = text.matchAll(/\b(20\d{2})\b/g);

  return Array.from(matches, (match) => ({
    eventDate: `${match[1]}-01-01`,
    eventDatePrecision: "year",
    matchedText: match[0],
  }));
}

function extractDateCandidates(text: string): DateCandidate[] {
  const exact = exactDayCandidates(text);
  const months = monthCandidates(text).filter(
    (candidate) =>
      !exact.some((exactCandidate) => exactCandidate.matchedText.includes(candidate.matchedText)),
  );
  const quarters = quarterCandidates(text);
  const years = yearCandidates(text).filter(
    (candidate) =>
      !exact.some((exactCandidate) => exactCandidate.eventDate.startsWith(candidate.eventDate.slice(0, 4))) &&
      !months.some((monthCandidate) => monthCandidate.eventDate.startsWith(candidate.eventDate.slice(0, 4))) &&
      !quarters.some((quarterCandidate) => quarterCandidate.eventDate.startsWith(candidate.eventDate.slice(0, 4))),
  );

  return [...exact, ...months, ...quarters, ...years];
}

function buildExplicitSourceEvents(input: {
  source: Source;
  fragments: SourceFragment[];
}): TimelineEventDraft[] {
  const drafts: TimelineEventDraft[] = [];

  for (const fragment of input.fragments) {
    const dateCandidates = extractDateCandidates(fragment.text);

    for (const candidate of dateCandidates.slice(0, 2)) {
      const contextualLine = sentenceForMatch(fragment.text, candidate.matchedText);
      const titleContext = fragment.title ?? input.source.title;
      drafts.push({
        stableKey: stableKey("source", input.source.id, candidate.eventDate, titleContext),
        projectId: input.source.projectId,
        title: `${titleContext} (${candidate.matchedText})`,
        description: contextualLine,
        eventDate: candidate.eventDate,
        eventDatePrecision: candidate.eventDatePrecision,
        eventType: inferEventType(`${input.source.title} ${fragment.title ?? ""} ${contextualLine}`),
        confidence:
          candidate.eventDatePrecision === "exact_day"
            ? "high"
            : candidate.eventDatePrecision === "month"
              ? "medium"
              : "low",
        sourceIds: [input.source.id],
        wikiPageIds: [],
        claimIds: [],
        provenance: "source-extraction",
        metadata: {
          matchedDate: candidate.matchedText,
          sourceTitle: input.source.title,
        },
      });
    }
  }

  return drafts;
}

function buildSourceFallbackEvent(source: Source): TimelineEventDraft {
  return {
    stableKey: stableKey("source-fallback", source.id, source.createdAt),
    projectId: source.projectId,
    title: `Source added to project: ${source.title}`,
    description: `${source.title} entered the project knowledge base with source type ${source.sourceType} and status ${source.status}.`,
    eventDate: source.createdAt.slice(0, 10),
    eventDatePrecision: "exact_day",
    eventType: "document",
    confidence: "medium",
    sourceIds: [source.id],
    wikiPageIds: [],
    claimIds: [],
    provenance: "object-timestamp-fallback",
    metadata: {
      sourceTitle: source.title,
      fallbackType: "source-created-at",
    },
  };
}

function buildClaimEvents(claims: Claim[]): TimelineEventDraft[] {
  const drafts: TimelineEventDraft[] = [];

  for (const claim of claims) {
    const dateCandidates = extractDateCandidates(claim.text);

    for (const candidate of dateCandidates.slice(0, 1)) {
      drafts.push({
        stableKey: stableKey("claim", claim.id, candidate.eventDate),
        projectId: claim.projectId,
        title: `Claim signal (${candidate.matchedText})`,
        description: claim.text,
        eventDate: candidate.eventDate,
        eventDatePrecision: candidate.eventDatePrecision,
        eventType: inferEventType(claim.text),
        confidence:
          claim.supportStatus === "supported"
            ? "high"
            : claim.supportStatus === "weak-support"
              ? "medium"
              : "low",
        sourceIds: claim.sourceId ? [claim.sourceId] : [],
        wikiPageIds: [claim.wikiPageId],
        claimIds: [claim.id],
        provenance: "claim-extraction",
        metadata: {
          matchedDate: candidate.matchedText,
          claimSupportStatus: claim.supportStatus,
        },
      });
    }
  }

  return drafts;
}

function buildWikiExplicitEvents(input: {
  page: WikiPage;
  revision: WikiPageRevision | null;
  sourceIds: string[];
}): TimelineEventDraft[] {
  if (!input.revision) {
    return [];
  }

  const revision = input.revision;
  const text = [revision.summary ?? "", revision.markdownContent].join(" ");
  const dateCandidates = extractDateCandidates(text);

  return dateCandidates.slice(0, 2).map((candidate) => ({
    stableKey: stableKey("wiki", input.page.id, candidate.eventDate, input.page.title),
    projectId: input.page.projectId,
    title: `${input.page.title} (${candidate.matchedText})`,
    description:
      sentenceForMatch(text, candidate.matchedText) ??
      revision.summary ??
      preview(revision.markdownContent),
    eventDate: candidate.eventDate,
    eventDatePrecision: candidate.eventDatePrecision,
    eventType: inferEventType(`${input.page.title} ${text}`),
    confidence:
      revision.confidence ??
      (candidate.eventDatePrecision === "exact_day" ? "high" : "medium"),
    sourceIds: input.sourceIds,
    wikiPageIds: [input.page.id],
    claimIds: [],
    provenance: "wiki-extraction",
    metadata: {
      matchedDate: candidate.matchedText,
      pageType: input.page.pageType,
    },
  }));
}

function buildWikiFallbackEvent(input: {
  page: WikiPage;
  revision: WikiPageRevision | null;
  sourceIds: string[];
}): TimelineEventDraft {
  const revisionDate = input.revision?.createdAt ?? input.page.updatedAt;

  return {
    stableKey: stableKey("wiki-fallback", input.page.id, revisionDate),
    projectId: input.page.projectId,
    title: `Canonical page updated: ${input.page.title}`,
    description:
      input.revision?.summary ??
      `The ${input.page.pageType} page was refreshed in project canon.`,
    eventDate: revisionDate.slice(0, 10),
    eventDatePrecision: "exact_day",
    eventType: inferEventType(`${input.page.title} ${input.page.pageType}`),
    confidence: input.revision?.confidence ?? "medium",
    sourceIds: input.sourceIds,
    wikiPageIds: [input.page.id],
    claimIds: [],
    provenance: "object-timestamp-fallback",
    metadata: {
      pageType: input.page.pageType,
      fallbackType: "wiki-revision-created-at",
    },
  };
}

function mergeDrafts(drafts: TimelineEventDraft[]): TimelineEventDraft[] {
  const merged = new Map<string, TimelineEventDraft>();

  for (const draft of drafts) {
    const existing = merged.get(draft.stableKey);

    if (!existing) {
      merged.set(draft.stableKey, {
        ...draft,
        sourceIds: Array.from(new Set(draft.sourceIds)),
        wikiPageIds: Array.from(new Set(draft.wikiPageIds)),
        claimIds: Array.from(new Set(draft.claimIds)),
      });
      continue;
    }

    existing.description =
      existing.description.length >= draft.description.length
        ? existing.description
        : draft.description;
    existing.confidence = chooseHigherConfidence(existing.confidence, draft.confidence);
    existing.sourceIds = Array.from(new Set([...existing.sourceIds, ...draft.sourceIds]));
    existing.wikiPageIds = Array.from(
      new Set([...existing.wikiPageIds, ...draft.wikiPageIds]),
    );
    existing.claimIds = Array.from(new Set([...existing.claimIds, ...draft.claimIds]));
    existing.metadata = {
      ...(existing.metadata ?? {}),
      ...(draft.metadata ?? {}),
    };
  }

  return Array.from(merged.values()).sort(
    (left, right) =>
      left.eventDate.localeCompare(right.eventDate) ||
      left.title.localeCompare(right.title),
  );
}

export async function compileProjectTimeline(projectId: string): Promise<TimelineEvent[]> {
  const [sources, claims, pages] = await Promise.all([
    sourcesRepository.listByProjectId(projectId),
    claimsRepository.listByProjectId(projectId),
    wikiRepository.listPagesByProjectId(projectId),
  ]);
  const sourceDrafts = (
    await Promise.all(
      sources.map(async (source) => {
        const fragments = await sourceFragmentsRepository.listBySourceId(source.id);
        const explicitDrafts = buildExplicitSourceEvents({ source, fragments });

        return explicitDrafts.length > 0
          ? explicitDrafts
          : [buildSourceFallbackEvent(source)];
      }),
    )
  ).flat();
  const claimDrafts = buildClaimEvents(claims);
  const wikiDrafts = (
    await Promise.all(
      pages.map(async (page) => {
        const [revision, sourceIds] = await Promise.all([
          wikiRepository.getCurrentRevision(page.id),
          wikiRepository.listSourceIdsForPage(page.id),
        ]);
        const explicitDrafts = buildWikiExplicitEvents({ page, revision, sourceIds });

        return explicitDrafts.length > 0
          ? explicitDrafts
          : [buildWikiFallbackEvent({ page, revision, sourceIds })];
      }),
    )
  ).flat();
  const mergedDrafts = mergeDrafts([...sourceDrafts, ...claimDrafts, ...wikiDrafts]);
  const summary = `Timeline compile produced ${mergedDrafts.length} canonical event(s) from ${sources.length} source record(s), ${claims.length} claim(s), and ${pages.length} wiki page(s).`;

  return timelineEventsRepository.syncProjectEvents(projectId, mergedDrafts, summary);
}

export async function listProjectTimelineEvents(
  projectId: string,
): Promise<TimelineReferenceRecord[]> {
  const [events, sources, claims, pages] = await Promise.all([
    timelineEventsRepository.listByProjectId(projectId),
    sourcesRepository.listByProjectId(projectId),
    claimsRepository.listByProjectId(projectId),
    wikiRepository.listPagesByProjectId(projectId),
  ]);
  const sourcesById = new Map(sources.map((source) => [source.id, source] as const));
  const claimsById = new Map(claims.map((claim) => [claim.id, claim] as const));
  const pagesById = new Map(pages.map((page) => [page.id, page] as const));

  return events.map((event) => ({
    event,
    relatedSources: event.sourceIds
      .map((sourceId) => sourcesById.get(sourceId) ?? null)
      .filter((source): source is Source => Boolean(source)),
    relatedPages: event.wikiPageIds
      .map((pageId) => pagesById.get(pageId) ?? null)
      .filter((page): page is WikiPage => Boolean(page)),
    relatedClaims: event.claimIds
      .map((claimId) => claimsById.get(claimId) ?? null)
      .filter((claim): claim is Claim => Boolean(claim)),
  }));
}

export async function getProjectTimelinePageData(
  projectId: string,
): Promise<TimelinePageData> {
  const [events, compileState] = await Promise.all([
    listProjectTimelineEvents(projectId),
    timelineEventsRepository.getCompileState(projectId),
  ]);

  return {
    events,
    compileState,
    metrics: [
      {
        label: "Events",
        value: String(events.length),
        note: "Canonical timeline events are deduplicated chronology records, not raw date search hits.",
      },
      {
        label: "High Confidence",
        value: String(
          events.filter((entry) => entry.event.confidence === "high").length,
        ),
        note: "High-confidence entries are grounded in stronger exact dates or stronger compiled signals.",
      },
      {
        label: "Source Linked",
        value: String(
          events.filter((entry) => entry.relatedSources.length > 0).length,
        ),
        note: "Every timeline event should stay tethered to project knowledge objects where possible.",
      },
      {
        label: "Last Compile",
        value: compileState.lastCompiledAt
          ? formatDateLabel(compileState.lastCompiledAt, "exact_day")
          : "Not compiled",
        note: compileState.summary,
      },
    ],
  };
}
