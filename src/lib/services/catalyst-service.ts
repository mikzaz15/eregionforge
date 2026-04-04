import type {
  Catalyst,
  CatalystCompileState,
  CatalystDraft,
  CatalystImportance,
  CatalystStatus,
  CatalystType,
  Claim,
  Contradiction,
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
import { sourcesRepository } from "@/lib/repositories/sources-repository";
import { thesesRepository } from "@/lib/repositories/theses-repository";
import { timelineEventsRepository } from "@/lib/repositories/timeline-events-repository";
import { wikiRepository } from "@/lib/repositories/wiki-repository";

export type CatalystReferenceRecord = {
  catalyst: Catalyst;
  thesis: Thesis | null;
  relatedTimelineEvents: TimelineEvent[];
  relatedClaims: Claim[];
  relatedSources: Source[];
  relatedContradictions: Contradiction[];
  relatedPages: WikiPage[];
};

export type CatalystPageData = {
  catalysts: CatalystReferenceRecord[];
  compileState: CatalystCompileState;
  summary: {
    totalCatalysts: number;
    upcomingCatalysts: number;
    resolvedCatalysts: number;
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

function preview(value: string | null | undefined, length = 180): string {
  if (!value) {
    return "No supporting description is currently available.";
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > length
    ? `${normalized.slice(0, length).trimEnd()}...`
    : normalized;
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

function inferCatalystType(text: string): CatalystType {
  const normalized = normalizeText(text);

  if (/\bearnings|investor day|q[1-4]|fy20\d{2}|results\b/.test(normalized)) {
    return "earnings";
  }

  if (/\blaunch|release|rollout|design win|product|module|platform\b/.test(normalized)) {
    return "product_launch";
  }

  if (/\bregulator|regulatory|approval|compliance|permit\b/.test(normalized)) {
    return "regulatory";
  }

  if (/\bguidance|outlook|forecast\b/.test(normalized)) {
    return "guidance_change";
  }

  if (/\bcustomer|contract|backlog|qualification|order\b/.test(normalized)) {
    return "customer_or_contract";
  }

  if (/\bfinancing|capital|raise|debt|liquidity\b/.test(normalized)) {
    return "financing";
  }

  if (/\bindustry|macro|capacity|pricing|asp|normalization\b/.test(normalized)) {
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
}): CatalystImportance {
  if (
    ["earnings", "guidance_change", "customer_or_contract", "product_launch"].includes(
      input.catalystType,
    ) &&
    (input.confidence === "high" || input.sourceCount >= 2)
  ) {
    return "high";
  }

  if (input.contradictionCount > 0 || input.confidence === "medium") {
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

function buildDraftFromTimelineEvent(
  event: TimelineEvent,
  input: CandidateInput,
): CatalystDraft | null {
  const catalystType = inferCatalystType(`${event.title} ${event.description}`);

  if (catalystType === "other" && !["financial", "milestone", "system"].includes(event.eventType)) {
    return null;
  }

  const relatedContradictions = input.contradictions.filter((contradiction) =>
    contradiction.relatedTimelineEventIds.includes(event.id),
  );

  return {
    stableKey: stableKey("timeline", catalystType, event.title, event.eventDate),
    projectId: event.projectId,
    title: event.title,
    description: `${preview(event.description)} Why it matters: this event is already present in the compiled chronology and can move the active research view as it resolves.`,
    catalystType,
    status: inferStatus(event.eventDate),
    expectedTimeframe: event.eventDate,
    timeframePrecision: event.eventDatePrecision,
    importance: inferImportance({
      catalystType,
      confidence: event.confidence,
      contradictionCount: relatedContradictions.length,
      sourceCount: event.sourceIds.length,
    }),
    confidence: event.confidence,
    linkedThesisId: input.thesis?.id ?? null,
    linkedTimelineEventIds: [event.id],
    linkedClaimIds: [...event.claimIds],
    linkedSourceIds: [...event.sourceIds],
    linkedContradictionIds: relatedContradictions.map((entry) => entry.id),
    metadata: {
      timeframeLabel: formatDateLabel(event.eventDate, event.eventDatePrecision),
      derivedFrom: "timeline",
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
  const linkedContradictions = input.contradictions.filter(
    (entry) => entry.leftClaimId === claim.id || entry.rightClaimId === claim.id,
  );
  const expectedTimeframe = linkedTimelineEvents[0]?.eventDate ?? null;
  const timeframePrecision =
    linkedTimelineEvents[0]?.eventDatePrecision ?? "unknown_estimated";

  return {
    stableKey: stableKey("claim", catalystType, claim.text.slice(0, 80)),
    projectId: claim.projectId,
    title: preview(claim.text, 90),
    description: `${claim.text} Why it matters: the claim layer surfaces this as a potential thesis-moving event or condition that should be tracked explicitly.`,
    catalystType,
    status: inferStatus(expectedTimeframe),
    expectedTimeframe,
    timeframePrecision,
    importance: inferImportance({
      catalystType,
      confidence: claim.confidence ?? "low",
      contradictionCount: linkedContradictions.length,
      sourceCount: claim.sourceId ? 1 : 0,
    }),
    confidence: claim.confidence ?? "low",
    linkedThesisId: input.thesis?.id ?? null,
    linkedTimelineEventIds: linkedTimelineEvents.map((event) => event.id),
    linkedClaimIds: [claim.id],
    linkedSourceIds: claim.sourceId ? [claim.sourceId] : [],
    linkedContradictionIds: linkedContradictions.map((entry) => entry.id),
    metadata: {
      derivedFrom: "claim",
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
  const expectedTimeframe = relatedTimelineEvents[0]?.eventDate ?? null;
  const timeframePrecision =
    relatedTimelineEvents[0]?.eventDatePrecision ?? "unknown_estimated";
  const confidence = relatedClaims.reduce<RevisionConfidence>(
    (current, claim) => chooseHigherConfidence(current, claim.confidence ?? "low"),
    relatedTimelineEvents[0]?.confidence ?? "low",
  );

  return {
    stableKey: stableKey("source", catalystType, source.title),
    projectId: source.projectId,
    title: source.title,
    description: `${preview(source.body)} Why it matters: this source already carries catalyst-like language that should be tracked at the project level.`,
    catalystType,
    status: inferStatus(expectedTimeframe),
    expectedTimeframe,
    timeframePrecision,
    importance: inferImportance({
      catalystType,
      confidence,
      contradictionCount: 0,
      sourceCount: 1,
    }),
    confidence,
    linkedThesisId: input.thesis?.id ?? null,
    linkedTimelineEventIds: relatedTimelineEvents.map((event) => event.id),
    linkedClaimIds: relatedClaims.map((claim) => claim.id),
    linkedSourceIds: [source.id],
    linkedContradictionIds: [],
    metadata: {
      derivedFrom: "source",
    },
  };
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
  const [thesis, timelineEvents, claims, contradictions, sources] = await Promise.all([
    thesesRepository.getByProjectId(projectId),
    timelineEventsRepository.listByProjectId(projectId),
    claimsRepository.listByProjectId(projectId),
    contradictionsRepository.listByProjectId(projectId),
    sourcesRepository.listByProjectId(projectId),
  ]);

  const input: CandidateInput = {
    thesis,
    timelineEvents,
    claims,
    contradictions,
    sources,
  };
  const drafts = [
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

  return catalystsRepository.syncProjectCatalysts(projectId, mergedDrafts, summary);
}

export async function listProjectCatalysts(
  projectId: string,
): Promise<CatalystReferenceRecord[]> {
  const [catalysts, thesis, timelineEvents, claims, sources, contradictions, pages] =
    await Promise.all([
      catalystsRepository.listByProjectId(projectId),
      thesesRepository.getByProjectId(projectId),
      timelineEventsRepository.listByProjectId(projectId),
      claimsRepository.listByProjectId(projectId),
      sourcesRepository.listByProjectId(projectId),
      contradictionsRepository.listByProjectId(projectId),
      wikiRepository.listPagesByProjectId(projectId),
    ]);

  const timelineById = new Map(timelineEvents.map((event) => [event.id, event] as const));
  const claimsById = new Map(claims.map((claim) => [claim.id, claim] as const));
  const sourcesById = new Map(sources.map((source) => [source.id, source] as const));
  const contradictionsById = new Map(
    contradictions.map((entry) => [entry.id, entry] as const),
  );
  const pagesById = new Map(pages.map((page) => [page.id, page] as const));

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
    };
  });
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
    resolvedCatalysts: catalysts.filter((entry) => entry.catalyst.status === "resolved")
      .length,
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
