import { parseSourceFragments } from "@/lib/domain/source-fragment-parser";
import type {
  ClaimCategory,
  ClaimPayload,
  ClaimSupportStatus,
  EvidenceLinkPayload,
  EvidenceRelationType,
  Project,
  RevisionConfidence,
  Source,
  SourceFragment,
  StringMetadata,
  WikiPage,
  WikiPageType,
} from "@/lib/domain/types";
import { claimsRepository } from "@/lib/repositories/claims-repository";
import { compileJobsRepository } from "@/lib/repositories/compile-jobs-repository";
import { evidenceLinksRepository } from "@/lib/repositories/evidence-links-repository";
import { projectsRepository } from "@/lib/repositories/projects-repository";
import { sourceFragmentsRepository } from "@/lib/repositories/source-fragments-repository";
import { sourcesRepository } from "@/lib/repositories/sources-repository";
import { wikiRepository } from "@/lib/repositories/wiki-repository";

type CompileTarget = {
  pageId: string;
  pageType: WikiPageType;
};

type SourceCompilationInput = {
  source: Source;
  fragments: SourceFragment[];
};

type ClaimDraft = {
  text: string;
  claimType: ClaimCategory;
  supportStatus: ClaimSupportStatus;
  confidence: RevisionConfidence | null;
  sourceId?: string | null;
  metadata?: StringMetadata;
  evidence: Array<{
    sourceId: string;
    sourceFragmentId: string;
    relationType: EvidenceRelationType;
    metadata?: StringMetadata;
  }>;
};

type TrustSyncResult = {
  claimCount: number;
  evidenceCount: number;
  supportedCount: number;
  unresolvedCount: number;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function encodeIds(values: string[]): string {
  return JSON.stringify(Array.from(new Set(values)));
}

function excerpt(value: string | null, length = 220): string {
  if (!value) {
    return "No body content is currently attached to this source.";
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > length
    ? `${normalized.slice(0, length).trimEnd()}...`
    : normalized;
}

function safeLabel(value: string | null | undefined, fallback = "Not provided"): string {
  return value && value.trim().length > 0 ? value : fallback;
}

function formatTimestamp(value: string | null): string {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function fragmentLine(fragment: SourceFragment): string {
  const label = fragment.title ?? `Fragment ${fragment.index + 1}`;
  return `${label}: ${excerpt(fragment.text, 150)}`;
}

function signalFragments(
  fragments: SourceFragment[],
  type: SourceFragment["fragmentType"],
): SourceFragment[] {
  return fragments.filter((fragment) => fragment.fragmentType === type);
}

function contentFragments(fragments: SourceFragment[]): SourceFragment[] {
  return fragments.filter((fragment) => fragment.fragmentType !== "heading");
}

function primaryFragment(sourceInput: SourceCompilationInput): SourceFragment | null {
  return (
    contentFragments(sourceInput.fragments)[0] ??
    sourceInput.fragments[0] ??
    null
  );
}

function summarySection(sourceInput: SourceCompilationInput): string {
  const headings = signalFragments(sourceInput.fragments, "heading");
  const primaryContent = primaryFragment(sourceInput);

  if (!primaryContent) {
    return "No parsed source fragments are available yet. The page is preserving source registration and provenance until parsing improves.";
  }

  if (headings.length > 0) {
    return `${sourceInput.source.title} is structured around ${headings
      .slice(0, 3)
      .map((fragment) => fragment.title ?? `fragment ${fragment.index + 1}`)
      .join(", ")}. Current canonical summary is grounded in ${primaryContent.fragmentType} fragment ${primaryContent.index + 1}: ${excerpt(primaryContent.text, 220)}`;
  }

  return `${sourceInput.source.title} currently yields ${sourceInput.fragments.length} parsed fragment(s). The strongest available canonical excerpt comes from fragment ${primaryContent.index + 1}: ${excerpt(primaryContent.text, 220)}`;
}

function keySignalsForSource(sourceInput: SourceCompilationInput): string[] {
  const { source, fragments } = sourceInput;
  const headings = signalFragments(fragments, "heading");
  const content = contentFragments(fragments);
  const signals = [
    `The source is classified as **${source.sourceType}** and currently sits at **${source.status}** in the ingestion lifecycle.`,
    `Fragment extraction produced **${fragments.length}** explicit source unit(s) for later claim and evidence work.`,
  ];

  if (headings.length > 0) {
    signals.push(
      `Structured headings detected: ${headings
        .slice(0, 3)
        .map((fragment) => `"${fragment.title ?? fragment.text}"`)
        .join(", ")}.`,
    );
  } else if (content.length > 1) {
    signals.push(
      "The source currently parses as unheaded prose and will benefit from stronger structural segmentation in later ingestion work.",
    );
  }

  if (content[0]) {
    signals.push(`Primary content fragment: ${fragmentLine(content[0])}`);
  }

  if (source.metadata.layer) {
    signals.push(`This record is tagged to the **${source.metadata.layer}** layer.`);
  }

  if (source.url) {
    signals.push(
      "An external URL is attached and should remain stable provenance even after fetch and normalization workflows arrive.",
    );
  }

  return signals;
}

function openQuestionsForSource(sourceInput: SourceCompilationInput): string[] {
  const { source, fragments } = sourceInput;
  const headings = signalFragments(fragments, "heading");
  const questions = [];

  if (!source.body) {
    questions.push(
      "What source body or file-derived text should be attached before deeper compilation?",
    );
  }

  if (fragments.length === 0) {
    questions.push(
      "Why did parsing yield zero fragments, and should this source remain canonical input yet?",
    );
  }

  if (fragments.length === 1 && headings.length === 0) {
    questions.push(
      "Should this source be split into more explicit fragments before claim extraction starts?",
    );
  }

  if (source.sourceType === "pdf") {
    questions.push(
      "When should the PDF upload and parser path be connected so fragment extraction reflects document structure rather than placeholder text?",
    );
  }

  if (source.sourceType === "url") {
    questions.push(
      "Should the URL be fetched directly, snapshotted, or normalized through a later ingestion worker?",
    );
  }

  if (source.status !== "compiled") {
    questions.push(
      "What extraction or verification step is still needed before this source can be treated as stable canonical input?",
    );
  }

  if (questions.length === 0) {
    questions.push(
      "No immediate source-specific questions were generated during this compile pass.",
    );
  }

  return questions;
}

function sourceSummaryMarkdown(sourceInput: SourceCompilationInput): string {
  const { source, fragments } = sourceInput;
  const headings = signalFragments(fragments, "heading");
  const primaryContent = contentFragments(fragments).slice(0, 3);
  const metadataLines = [
    `- Source type: ${source.sourceType}`,
    `- Status: ${source.status}`,
    `- Created: ${formatTimestamp(source.createdAt)}`,
    `- URL: ${safeLabel(source.url)}`,
    `- File path: ${safeLabel(source.filePath)}`,
    `- Fragment count: ${fragments.length}`,
    `- Structured headings: ${headings.length}`,
  ];
  const provenanceLines = [
    `- Source id: ${source.id}`,
    `- Linked fragment count: ${fragments.length}`,
    `- Provenance label: ${source.provenance.label}`,
    ...Object.entries(source.provenance).map(([key, value]) => `- ${key}: ${value}`),
  ];
  const signalLines = keySignalsForSource(sourceInput).map((signal) => `- ${signal}`);
  const questionLines = openQuestionsForSource(sourceInput).map(
    (question) => `- ${question}`,
  );

  return [
    `# Source Summary: ${source.title}`,
    "",
    "## Summary",
    summarySection(sourceInput),
    "",
    "## Source Metadata",
    ...metadataLines,
    "",
    "## Key Signals",
    ...(signalLines.length > 0 ? signalLines : ["- No signals were generated."]),
    ...(primaryContent.length > 0
      ? ["", ...primaryContent.map((fragment) => `- ${fragmentLine(fragment)}`)]
      : []),
    "",
    "## Open Questions",
    ...questionLines,
    "",
    "## Provenance",
    ...provenanceLines,
  ].join("\n");
}

function sourceSummarySummary(sourceInput: SourceCompilationInput): string {
  return `Canonical summary page for ${sourceInput.source.title}, generated deterministically from ${sourceInput.fragments.length} source fragment(s) and current provenance metadata.`;
}

function conceptTokens(
  sourceInputs: SourceCompilationInput[],
): Array<{ label: string; count: number }> {
  const stopWords = new Set([
    "the",
    "and",
    "for",
    "from",
    "with",
    "into",
    "page",
    "note",
    "data",
    "system",
    "project",
    "source",
    "sources",
    "fragment",
    "summary",
  ]);
  const counts = new Map<string, number>();

  for (const sourceInput of sourceInputs) {
    const headingTitles = signalFragments(sourceInput.fragments, "heading")
      .map((fragment) => fragment.title ?? fragment.text)
      .join(" ");
    const previewText = sourceInput.fragments
      .slice(0, 3)
      .map((fragment) => fragment.text)
      .join(" ");
    const tokens = `${sourceInput.source.title} ${headingTitles} ${previewText} ${Object.values(sourceInput.source.metadata).join(" ")}`
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2 && !stopWords.has(token));

    for (const token of new Set(tokens)) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 10)
    .map(([label, count]) => ({ label, count }));
}

function overviewMarkdown(
  project: Project,
  sourceInputs: SourceCompilationInput[],
  generatedPages: number,
): string {
  const totalFragments = sourceInputs.reduce(
    (sum, sourceInput) => sum + sourceInput.fragments.length,
    0,
  );
  const typeBreakdown = Array.from(
    sourceInputs.reduce((map, sourceInput) => {
      map.set(
        sourceInput.source.sourceType,
        (map.get(sourceInput.source.sourceType) ?? 0) + 1,
      );
      return map;
    }, new Map<string, number>()),
  ).map(([type, count]) => `- ${type}: ${count}`);

  return [
    "# Overview",
    "",
    "## Summary",
    `${project.name} currently has ${sourceInputs.length} active source records feeding ${totalFragments} parsed fragment(s) and ${generatedPages} generated canonical pages in this compile pass.`,
    "",
    "## Project Coverage",
    `- Domain: ${project.domain}`,
    `- Active sources: ${sourceInputs.length}`,
    `- Parsed fragments: ${totalFragments}`,
    `- Generated pages in this run: ${generatedPages}`,
    "",
    "## Source Mix",
    ...(typeBreakdown.length > 0
      ? typeBreakdown
      : ["- No source records are available yet."]),
    "",
    "## Compiler Note",
    "This overview is generated deterministically from source records and extracted fragments so later model-powered compilation can swap in behind the same page contract.",
  ].join("\n");
}

function conceptIndexMarkdown(sourceInputs: SourceCompilationInput[]): string {
  const concepts = conceptTokens(sourceInputs);

  return [
    "# Concept Index",
    "",
    "## Summary",
    "This deterministic concept index highlights repeated terms from current source titles, fragments, and metadata as a first-pass map of the project corpus.",
    "",
    "## Concepts",
    ...(concepts.length > 0
      ? concepts.map(
          (concept) =>
            `- ${concept.label}: appears in ${concept.count} source record(s)`,
        )
      : ["- No repeatable concepts were detected from the current source set."]),
    "",
    "## Compiler Note",
    "These concepts are rule-based and intentionally conservative until entity and concept extraction land in a later sprint.",
  ].join("\n");
}

function openQuestionsMarkdown(
  project: Project,
  sourceInputs: SourceCompilationInput[],
): string {
  const failed = sourceInputs.filter(
    (sourceInput) => sourceInput.source.status === "failed",
  );
  const lowStructure = sourceInputs.filter(
    (sourceInput) =>
      sourceInput.fragments.length === 0 ||
      sourceInput.fragments.every((fragment) => fragment.fragmentType !== "heading"),
  );
  const nonCompiled = sourceInputs.filter(
    (sourceInput) => sourceInput.source.status !== "compiled",
  );

  const questions = [
    ...failed.map(
      (sourceInput) =>
        `- ${sourceInput.source.title}: why did this source fail, and what retry or cleanup path is required?`,
    ),
    ...lowStructure.slice(0, 5).map(
      (sourceInput) =>
        `- ${sourceInput.source.title}: should fragment extraction become more structured before evidence linking starts?`,
    ),
    ...nonCompiled.slice(0, 5).map(
      (sourceInput) =>
        `- ${sourceInput.source.title}: what additional parsing or verification is required before this source is fully canonical input?`,
    ),
  ];

  return [
    "# Open Questions",
    "",
    "## Summary",
    `${project.name} still has structural and operational questions that should inform the next ingestion and compile pass.`,
    "",
    "## Questions",
    ...(questions.length > 0
      ? questions
      : ["- No unresolved source-driven questions were generated in this compile pass."]),
    "",
    "## Compiler Note",
    "This page is generated deterministically from source lifecycle state and fragment structure and should later absorb evidence-aware linting signals.",
  ].join("\n");
}

function evidencePayloads(
  source: Source,
  fragments: SourceFragment[],
  relationType: EvidenceRelationType,
  metadata?: StringMetadata,
): Array<Omit<EvidenceLinkPayload, "claimId" | "projectId">> {
  return Array.from(new Set(fragments.map((fragment) => fragment.id)))
    .map((fragmentId) => fragments.find((fragment) => fragment.id === fragmentId))
    .filter((fragment): fragment is SourceFragment => Boolean(fragment))
    .map((fragment) => ({
      sourceId: source.id,
      sourceFragmentId: fragment.id,
      relationType,
      metadata,
    }));
}

function buildSourceSummaryClaims(sourceInput: SourceCompilationInput): ClaimDraft[] {
  const { source, fragments } = sourceInput;
  const headings = signalFragments(fragments, "heading");
  const primary = primaryFragment(sourceInput);
  const drafts: ClaimDraft[] = [];

  if (primary) {
    drafts.push({
      text: `Current source summary is grounded in fragment ${primary.index + 1}: ${excerpt(primary.text, 180)}`,
      claimType: "summary",
      supportStatus: "supported",
      confidence: "medium",
      sourceId: source.id,
      metadata: { fragmentRole: "primary-summary" },
      evidence: evidencePayloads(source, [primary], "supports", {
        evidenceRole: "primary-summary-fragment",
      }),
    });
  }

  if (headings[0]) {
    drafts.push({
      text: `The source explicitly foregrounds "${headings[0].title ?? headings[0].text}" as a top-level structural signal.`,
      claimType: "key-signal",
      supportStatus: "supported",
      confidence: "medium",
      sourceId: source.id,
      metadata: { fragmentRole: "heading-signal" },
      evidence: evidencePayloads(source, [headings[0]], "supports", {
        evidenceRole: "heading-signal",
      }),
    });
  } else if (primary) {
    drafts.push({
      text: "The source currently compiles without explicit heading structure and relies on block-level fragments for canonical interpretation.",
      claimType: "structural",
      supportStatus: "weak-support",
      confidence: "low",
      sourceId: source.id,
      metadata: { fragmentRole: "structure-check" },
      evidence: evidencePayloads(source, [primary], "structural-support", {
        evidenceRole: "block-structure",
      }),
    });
  }

  const provenanceEvidence = fragments.slice(0, Math.min(2, fragments.length));

  if (provenanceEvidence.length > 0) {
    drafts.push({
      text: `This canonical page is grounded in ${fragments.length} parsed fragment(s) from ${source.title}.`,
      claimType: "provenance",
      supportStatus: "supported",
      confidence: "high",
      sourceId: source.id,
      metadata: { fragmentRole: "provenance" },
      evidence: evidencePayloads(source, provenanceEvidence, "context", {
        evidenceRole: "provenance-sample",
      }),
    });
  }

  const firstQuestion = openQuestionsForSource(sourceInput)[0];
  const questionEvidence = [headings[0] ?? primary].filter(
    (fragment): fragment is SourceFragment => Boolean(fragment),
  );

  if (firstQuestion && questionEvidence.length > 0) {
    drafts.push({
      text: firstQuestion,
      claimType: "open-question",
      supportStatus: "unresolved",
      confidence: "low",
      sourceId: source.id,
      metadata: { fragmentRole: "open-question" },
      evidence: evidencePayloads(source, questionEvidence, "raises-question", {
        evidenceRole: "question-trigger",
      }),
    });
  }

  return drafts.slice(0, 4);
}

async function syncCompiledPage(input: {
  projectId: string;
  slug: string;
  title: string;
  pageType: WikiPageType;
  sourceId?: string | null;
  markdownContent: string;
  summary: string;
  changeNote: string;
  sourceIds: string[];
  generationMetadata: StringMetadata;
}): Promise<CompileTarget> {
  let page: WikiPage | null = input.sourceId
    ? (
        await wikiRepository.listPagesBySourceId(input.projectId, input.sourceId)
      ).find((candidate) => candidate.slug === input.slug) ?? null
    : await wikiRepository.getPageByProjectAndSlug(input.projectId, input.slug);

  const currentRevision = page
    ? await wikiRepository.getCurrentRevision(page.id)
    : null;

  if (!page || currentRevision?.markdownContent !== input.markdownContent) {
    page = await wikiRepository.upsertPageRevision({
      projectId: input.projectId,
      slug: input.slug,
      title: input.title,
      pageType: input.pageType,
      sourceId: input.sourceId,
      status: "active",
      markdownContent: input.markdownContent,
      summary: input.summary,
      changeNote: input.changeNote,
      confidence: "medium",
      createdBy: "compiler",
      generationMetadata: input.generationMetadata,
    });
  } else {
    const refreshed = await wikiRepository.updateCurrentRevision(
      page.id,
      page.currentRevisionId,
      "active",
      input.generationMetadata,
    );

    if (refreshed) {
      page = refreshed;
    }
  }

  await wikiRepository.replacePageSourceLinks(page.id, input.sourceIds);

  return {
    pageId: page.id,
    pageType: input.pageType,
  };
}

async function syncClaimsForPage(input: {
  projectId: string;
  wikiPageId: string;
  claimDrafts: ClaimDraft[];
}): Promise<TrustSyncResult> {
  const existingClaims = await claimsRepository.listByWikiPageId(input.wikiPageId);
  await evidenceLinksRepository.deleteByClaimIds(existingClaims.map((claim) => claim.id));

  if (input.claimDrafts.length === 0) {
    await claimsRepository.replaceForWikiPage(input.wikiPageId, input.projectId, []);
    return {
      claimCount: 0,
      evidenceCount: 0,
      supportedCount: 0,
      unresolvedCount: 0,
    };
  }

  const storedClaims = await claimsRepository.replaceForWikiPage(
    input.wikiPageId,
    input.projectId,
    input.claimDrafts.map<ClaimPayload>((draft) => ({
      projectId: input.projectId,
      wikiPageId: input.wikiPageId,
      sourceId: draft.sourceId ?? null,
      text: draft.text,
      claimType: draft.claimType,
      supportStatus: draft.supportStatus,
      confidence: draft.confidence,
      metadata: draft.metadata ?? {},
    })),
  );

  let evidenceCount = 0;

  for (const [index, claim] of storedClaims.entries()) {
    const storedEvidence = await evidenceLinksRepository.replaceForClaim(
      claim.id,
      input.projectId,
      input.claimDrafts[index].evidence.map<EvidenceLinkPayload>((evidence) => ({
        projectId: input.projectId,
        claimId: claim.id,
        sourceId: evidence.sourceId,
        sourceFragmentId: evidence.sourceFragmentId,
        relationType: evidence.relationType,
        metadata: evidence.metadata ?? {},
      })),
    );
    evidenceCount += storedEvidence.length;
  }

  return {
    claimCount: storedClaims.length,
    evidenceCount,
    supportedCount: storedClaims.filter(
      (claim) => claim.supportStatus === "supported",
    ).length,
    unresolvedCount: storedClaims.filter(
      (claim) => claim.supportStatus === "unresolved",
    ).length,
  };
}

async function ensureSourceFragments(source: Source): Promise<SourceFragment[]> {
  const existingFragments = await sourceFragmentsRepository.listBySourceId(source.id);

  if (existingFragments.length > 0 || !source.body) {
    return existingFragments;
  }

  const parsed = parseSourceFragments(source);
  return sourceFragmentsRepository.replaceForSource(source.id, parsed);
}

export async function compileProject(projectId: string, triggeredBy: string) {
  const project = await projectsRepository.getById(projectId);

  if (!project) {
    throw new Error("Cannot compile a missing project.");
  }

  const job = await compileJobsRepository.create({
    projectId,
    triggeredBy,
    status: "running",
    summary: "Compile started.",
    startedAt: new Date().toISOString(),
    metadata: { mode: "deterministic-claim-compiler" },
  });

  const eligibleSources = (await sourcesRepository.listByProjectId(projectId)).filter(
    (source) => source.status !== "failed",
  );
  const sourceInputs = await Promise.all(
    eligibleSources.map(async (source) => ({
      source,
      fragments: await ensureSourceFragments(source),
    })),
  );

  for (const sourceInput of sourceInputs) {
    const updatedSource = await sourcesRepository.updateStatus(
      sourceInput.source.id,
      "compiled",
    );

    if (updatedSource) {
      sourceInput.source = updatedSource;
    }
  }

  const targets: CompileTarget[] = [];
  let totalClaims = 0;
  let totalEvidenceLinks = 0;
  let unresolvedClaims = 0;

  for (const sourceInput of sourceInputs) {
    const fragmentIds = sourceInput.fragments.map((fragment) => fragment.id);
    const claimDrafts = buildSourceSummaryClaims(sourceInput);
    const target = await syncCompiledPage({
      projectId,
      slug: `source-summary-${slugify(sourceInput.source.title)}-${sourceInput.source.id.slice(0, 8)}`,
      title: `Source Summary: ${sourceInput.source.title}`,
      pageType: "source-summary",
      sourceId: sourceInput.source.id,
      markdownContent: sourceSummaryMarkdown(sourceInput),
      summary: sourceSummarySummary(sourceInput),
      changeNote: `Source summary refreshed from ${sourceInput.source.title}`,
      sourceIds: [sourceInput.source.id],
      generationMetadata: {
        generatedBy: "deterministic-compiler",
        pageRole: "source-summary",
        generatedFromSourceId: sourceInput.source.id,
        generatedFromCompileJobId: job.id,
        generationMode: "deterministic-claim-compiler",
        contributingSourceIds: encodeIds([sourceInput.source.id]),
        contributingFragmentIds: encodeIds(fragmentIds),
        fragmentCount: String(fragmentIds.length),
        claimCount: String(claimDrafts.length),
      },
    });

    const trust = await syncClaimsForPage({
      projectId,
      wikiPageId: target.pageId,
      claimDrafts,
    });

    totalClaims += trust.claimCount;
    totalEvidenceLinks += trust.evidenceCount;
    unresolvedClaims += trust.unresolvedCount;
    targets.push(target);
  }

  const allSourceIds = sourceInputs.map((sourceInput) => sourceInput.source.id);
  const allFragmentIds = sourceInputs.flatMap((sourceInput) =>
    sourceInput.fragments.map((fragment) => fragment.id),
  );
  const nonSummaryCount = 3;
  const summaryPageCount = targets.filter(
    (target) => target.pageType === "source-summary",
  ).length;

  targets.push(
    await syncCompiledPage({
      projectId,
      slug: "overview",
      title: "Overview",
      pageType: "overview",
      markdownContent: overviewMarkdown(
        project,
        sourceInputs,
        summaryPageCount + nonSummaryCount,
      ),
      summary: `Project overview compiled from ${sourceInputs.length} current source records and ${allFragmentIds.length} source fragments.`,
      changeNote: `Overview refreshed from ${sourceInputs.length} sources`,
      sourceIds: allSourceIds,
      generationMetadata: {
        generatedBy: "deterministic-compiler",
        pageRole: "overview",
        generatedFromCompileJobId: job.id,
        generationMode: "deterministic-claim-compiler",
        contributingSourceIds: encodeIds(allSourceIds),
        contributingFragmentIds: encodeIds(allFragmentIds),
        fragmentCount: String(allFragmentIds.length),
        claimCount: "0",
      },
    }),
  );

  targets.push(
    await syncCompiledPage({
      projectId,
      slug: "concept-index",
      title: "Concept Index",
      pageType: "concept-index",
      markdownContent: conceptIndexMarkdown(sourceInputs),
      summary: `Concept index derived deterministically from ${sourceInputs.length} current source records and their extracted fragments.`,
      changeNote: `Concept index refreshed from ${sourceInputs.length} sources`,
      sourceIds: allSourceIds,
      generationMetadata: {
        generatedBy: "deterministic-compiler",
        pageRole: "concept-index",
        generatedFromCompileJobId: job.id,
        generationMode: "deterministic-claim-compiler",
        contributingSourceIds: encodeIds(allSourceIds),
        contributingFragmentIds: encodeIds(allFragmentIds),
        fragmentCount: String(allFragmentIds.length),
        claimCount: "0",
      },
    }),
  );

  targets.push(
    await syncCompiledPage({
      projectId,
      slug: "open-questions",
      title: "Open Questions",
      pageType: "open-questions",
      markdownContent: openQuestionsMarkdown(project, sourceInputs),
      summary:
        "Open questions generated from current source coverage, lifecycle state, and fragment structure.",
      changeNote: "Open questions refreshed from current source set",
      sourceIds: allSourceIds,
      generationMetadata: {
        generatedBy: "deterministic-compiler",
        pageRole: "open-questions",
        generatedFromCompileJobId: job.id,
        generationMode: "deterministic-claim-compiler",
        contributingSourceIds: encodeIds(allSourceIds),
        contributingFragmentIds: encodeIds(allFragmentIds),
        fragmentCount: String(allFragmentIds.length),
        claimCount: "0",
      },
    }),
  );

  const affectedPageIds = targets.map((target) => target.pageId);
  const sourceSummaryPages = targets.filter(
    (target) => target.pageType === "source-summary",
  ).length;
  const completedAt = new Date().toISOString();
  const summary = `Compile produced ${affectedPageIds.length} canonical pages from ${eligibleSources.length} source records and ${allFragmentIds.length} parsed fragments, yielding ${totalClaims} claims and ${totalEvidenceLinks} evidence links across ${sourceSummaryPages} source-summary pages.`;

  const updatedJob = await compileJobsRepository.update(job.id, {
    status: "completed",
    completedAt,
    summary,
    affectedPageIds,
    sourceCount: eligibleSources.length,
    metadata: {
      mode: "deterministic-claim-compiler",
      projectSlug: project.slug,
      sourceSummaryPages: String(sourceSummaryPages),
      fragmentCount: String(allFragmentIds.length),
      claimCount: String(totalClaims),
      unresolvedClaimCount: String(unresolvedClaims),
      evidenceLinkCount: String(totalEvidenceLinks),
    },
  });

  if (!updatedJob) {
    throw new Error("Compile job disappeared before completion.");
  }

  return updatedJob;
}
