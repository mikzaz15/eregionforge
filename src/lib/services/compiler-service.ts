import { parseSourceFragments } from "@/lib/domain/source-fragment-parser";
import type {
  ClaimCategory,
  ClaimPayload,
  ClaimSupportStatus,
  EvidenceLinkPayload,
  EvidenceRelationType,
  Project,
  ResearchEntity,
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
import { compileProjectEntities } from "@/lib/services/entity-intelligence-service";
import {
  completeOperationalJob,
  failOperationalJob,
  recordOperationalAuditEvent,
  startOperationalJob,
} from "@/lib/services/operational-history-service";

type CompileTarget = {
  pageId: string;
  revisionId: string;
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

function normalizeForComparison(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function parseMarkdownSections(markdown: string): Array<{ title: string; body: string }> {
  const lines = markdown.split("\n");
  const sections: Array<{ title: string; body: string }> = [];
  let currentTitle = "Document";
  let currentLines: string[] = [];

  for (const line of lines) {
    if (/^##?\s+/.test(line.trim())) {
      if (currentLines.length > 0 || sections.length === 0) {
        sections.push({
          title: currentTitle,
          body: currentLines.join("\n").trim(),
        });
      }
      currentTitle = line.replace(/^##?\s+/, "").trim();
      currentLines = [];
      continue;
    }

    currentLines.push(line);
  }

  sections.push({
    title: currentTitle,
    body: currentLines.join("\n").trim(),
  });

  return sections.filter(
    (section, index) =>
      index > 0 || normalizeForComparison(section.body).length > 0,
  );
}

function changedSectionTitles(
  previousMarkdown: string | null | undefined,
  nextMarkdown: string,
): string[] {
  if (!previousMarkdown) {
    return parseMarkdownSections(nextMarkdown)
      .map((section) => section.title)
      .slice(0, 4);
  }

  const previousByTitle = new Map(
    parseMarkdownSections(previousMarkdown).map((section) => [
      section.title,
      normalizeForComparison(section.body),
    ]),
  );

  return parseMarkdownSections(nextMarkdown)
    .filter(
      (section) =>
        previousByTitle.get(section.title) !== normalizeForComparison(section.body),
    )
    .map((section) => section.title)
    .slice(0, 4);
}

function summarizeChangeNote(
  pageTitle: string,
  previousMarkdown: string | null | undefined,
  nextMarkdown: string,
): string {
  const changedSections = changedSectionTitles(previousMarkdown, nextMarkdown);

  if (!previousMarkdown) {
    return `${pageTitle} created with ${changedSections.length} structured section(s).`;
  }

  if (changedSections.length === 0) {
    return `${pageTitle} refreshed with no material section changes.`;
  }

  return `${pageTitle} updated: ${changedSections.join(", ")} changed.`;
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

function sampleFragments(
  sourceInputs: SourceCompilationInput[],
  limit: number,
): Array<{ source: Source; fragment: SourceFragment }> {
  return sourceInputs
    .flatMap((sourceInput) =>
      contentFragments(sourceInput.fragments)
        .slice(0, 2)
        .map((fragment) => ({
          source: sourceInput.source,
          fragment,
        })),
    )
    .slice(0, limit);
}

function supportDensityLabel(input: {
  supportedCount: number;
  totalClaims: number;
  sourceDiversityCount: number;
}): string {
  if (input.totalClaims === 0) {
    return "thin";
  }

  const ratio = input.supportedCount / input.totalClaims;

  if (ratio >= 0.75 && input.sourceDiversityCount >= 2) {
    return "strong";
  }

  if (ratio >= 0.45) {
    return "mixed";
  }

  return "weak";
}

function entityLines(
  entities: ResearchEntity[],
  entityTypes: ResearchEntity["entityType"][],
  limit = 4,
): string[] {
  return entities
    .filter((entity) => entityTypes.includes(entity.entityType))
    .slice(0, limit)
    .map((entity) => `- ${entity.canonicalName}: ${excerpt(entity.description, 140)}`);
}

function sourceEntityContext(
  entities: ResearchEntity[],
  sourceId: string,
): ResearchEntity[] {
  return entities.filter((entity) => entity.relatedSourceIds.includes(sourceId));
}

function projectEvidenceFromSamples(
  samples: Array<{ source: Source; fragment: SourceFragment }>,
  relationType: EvidenceRelationType,
  metadata?: StringMetadata,
): Array<Omit<EvidenceLinkPayload, "claimId" | "projectId">> {
  return samples.map((sample) => ({
    sourceId: sample.source.id,
    sourceFragmentId: sample.fragment.id,
    relationType,
    metadata,
  }));
}

function buildPageGenerationMetadata(input: {
  pageRole: string;
  jobId: string;
  sourceIds: string[];
  fragmentIds: string[];
  claimDrafts: ClaimDraft[];
  previousMarkdown?: string | null;
  nextMarkdown: string;
  additional?: StringMetadata;
}): StringMetadata {
  const supportedCount = input.claimDrafts.filter(
    (claim) => claim.supportStatus === "supported",
  ).length;
  const unresolvedCount = input.claimDrafts.filter(
    (claim) => claim.supportStatus === "unresolved",
  ).length;
  const sourceDiversityCount = new Set(
    input.claimDrafts.flatMap((claim) => claim.evidence.map((evidence) => evidence.sourceId)),
  ).size;

  return {
    generatedBy: "deterministic-compiler",
    pageRole: input.pageRole,
    generatedFromCompileJobId: input.jobId,
    generationMode: "deterministic-claim-compiler",
    contributingSourceIds: encodeIds(input.sourceIds),
    contributingFragmentIds: encodeIds(input.fragmentIds),
    fragmentCount: String(input.fragmentIds.length),
    claimCount: String(input.claimDrafts.length),
    supportedClaimCount: String(supportedCount),
    unresolvedClaimCount: String(unresolvedCount),
    sourceDiversityCount: String(sourceDiversityCount),
    supportDensity: supportDensityLabel({
      supportedCount,
      totalClaims: input.claimDrafts.length,
      sourceDiversityCount,
    }),
    changedSections: encodeIds(
      changedSectionTitles(input.previousMarkdown, input.nextMarkdown),
    ),
    ...input.additional,
  };
}

function summarySection(
  sourceInput: SourceCompilationInput,
  entities: ResearchEntity[],
): string {
  const headings = signalFragments(sourceInput.fragments, "heading");
  const primaryContent = primaryFragment(sourceInput);
  const relatedEntities = sourceEntityContext(entities, sourceInput.source.id);

  if (!primaryContent) {
    return "No parsed source fragments are available yet. The page is preserving source registration and provenance until parsing improves.";
  }

  if (headings.length > 0) {
    return `${sourceInput.source.title} is currently anchored by ${headings
      .slice(0, 3)
      .map((fragment) => fragment.title ?? `fragment ${fragment.index + 1}`)
      .join(", ")}. Canonical interpretation is grounded in ${primaryContent.fragmentType} fragment ${primaryContent.index + 1}: ${excerpt(primaryContent.text, 180)}${
        relatedEntities.length > 0
          ? ` The current entity layer links this source to ${relatedEntities
              .slice(0, 2)
              .map((entity) => entity.canonicalName)
              .join(" and ")}.`
          : ""
      }`;
  }

  return `${sourceInput.source.title} currently yields ${sourceInput.fragments.length} parsed fragment(s) without strong heading structure. The strongest available canonical excerpt comes from fragment ${primaryContent.index + 1}: ${excerpt(primaryContent.text, 180)}${
    relatedEntities.length > 0
      ? ` This source currently informs ${relatedEntities
          .slice(0, 2)
          .map((entity) => entity.canonicalName)
          .join(" and ")}.`
      : ""
  }`;
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

function sourceSummaryMarkdown(
  sourceInput: SourceCompilationInput,
  entities: ResearchEntity[],
): string {
  const { source, fragments } = sourceInput;
  const headings = signalFragments(fragments, "heading");
  const primaryContent = contentFragments(fragments).slice(0, 3);
  const relatedEntities = sourceEntityContext(entities, source.id);
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
    summarySection(sourceInput, entities),
    "",
    "## Canonical Posture",
    `- Structural posture: ${headings.length > 0 ? "sectioned source with explicit headings" : "lightly structured source that still relies on fragment-level interpretation"}`,
    `- Canon role: source-grounded page with direct provenance back to ${fragments.length} parsed fragment(s)`,
    `- Support posture: ${
      fragments.length >= 3 ? "enough fragment coverage for first-pass supported claims" : "thin fragment coverage that still benefits from deeper parsing"
    }`,
    "",
    "## Entity Context",
    ...(relatedEntities.length > 0
      ? relatedEntities.slice(0, 5).map(
          (entity) =>
            `- ${entity.canonicalName} (${entity.entityType}): confidence ${entity.confidence}`,
        )
      : ["- No focused entity context has been linked to this source yet."]),
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

function sourceSummarySummary(
  sourceInput: SourceCompilationInput,
  entities: ResearchEntity[],
): string {
  const relatedEntities = sourceEntityContext(entities, sourceInput.source.id);
  return `Canonical summary page for ${sourceInput.source.title}, generated from ${sourceInput.fragments.length} source fragment(s)${
    relatedEntities.length > 0
      ? ` with linked entity context spanning ${relatedEntities
          .slice(0, 3)
          .map((entity) => entity.canonicalName)
          .join(", ")}`
      : ""
  } and current provenance metadata.`;
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
  entities: ResearchEntity[],
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
  const companies = entityLines(entities, ["company"], 3);
  const products = entityLines(entities, ["product_or_segment"], 4);
  const risks = entityLines(entities, ["risk_theme"], 4);
  const sampleEvidence = sampleFragments(sourceInputs, 3).map(
    (sample) => `- ${sample.source.title}: ${excerpt(sample.fragment.text, 120)}`,
  );

  return [
    "# Overview",
    "",
    "## Summary",
    `${project.name} currently has ${sourceInputs.length} active source records feeding ${totalFragments} parsed fragment(s) and ${generatedPages} generated canonical pages in this compile pass. The canon is organized around the current operating subject, repeated entity structure, and the strongest fragment-level evidence available right now.`,
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
    "## Entity Context",
    ...(companies.length > 0 ? companies : ["- No company entity has been stabilized yet."]),
    ...(products.length > 0
      ? ["", "## Products And Segments", ...products]
      : []),
    ...(risks.length > 0 ? ["", "## Risk Themes", ...risks] : []),
    "",
    "## Evidence Sample",
    ...(sampleEvidence.length > 0
      ? sampleEvidence
      : ["- No source fragments are available yet to anchor the overview."]),
    "",
    "## Compiler Note",
    "This overview is generated deterministically from source records, entity context, and extracted fragments so downstream thesis, dossier, contradictions, and ask flows can begin from a stronger canonical frame.",
  ].join("\n");
}

function conceptIndexMarkdown(
  sourceInputs: SourceCompilationInput[],
  entities: ResearchEntity[],
): string {
  const concepts = conceptTokens(sourceInputs);
  const groupedEntities: Array<{
    title: string;
    lines: string[];
  }> = [
    {
      title: "Companies",
      lines: entityLines(entities, ["company"], 4),
    },
    {
      title: "Products And Segments",
      lines: entityLines(entities, ["product_or_segment"], 5),
    },
    {
      title: "Operators And Competitors",
      lines: entityLines(entities, ["operator", "market_or_competitor"], 5),
    },
    {
      title: "Metrics And Risks",
      lines: entityLines(entities, ["metric", "risk_theme"], 6),
    },
  ].filter((group) => group.lines.length > 0);

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
    ...(groupedEntities.length > 0
      ? groupedEntities.flatMap((group) => ["", `## ${group.title}`, ...group.lines])
      : []),
    "",
    "## Compiler Note",
    "These concepts remain heuristic, but they now align repeated tokens with the focused entity layer so canon pages and downstream research views can group around more stable subjects.",
  ].join("\n");
}

function openQuestionsMarkdown(
  project: Project,
  sourceInputs: SourceCompilationInput[],
  entities: ResearchEntity[],
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
    ...entityLines(entities, ["risk_theme"], 3).map(
      (line) =>
        `${line.replace(/^- /, "- ")}: how fully is this risk theme supported across current sources?`,
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
    "This page is generated deterministically from source lifecycle state, fragment structure, and early entity-aware risk context so canon can preserve open questions before they harden into conclusions.",
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

function buildSourceSummaryClaims(
  sourceInput: SourceCompilationInput,
  entities: ResearchEntity[],
): ClaimDraft[] {
  const { source, fragments } = sourceInput;
  const headings = signalFragments(fragments, "heading");
  const primary = primaryFragment(sourceInput);
  const relatedEntities = sourceEntityContext(entities, source.id);
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

  if (relatedEntities.length > 0 && primary) {
    drafts.push({
      text: `${source.title} currently informs ${relatedEntities
        .slice(0, 3)
        .map((entity) => `${entity.canonicalName} (${entity.entityType})`)
        .join(", ")} within the compiled canon.`,
      claimType: "summary",
      supportStatus: relatedEntities.length >= 2 ? "supported" : "weak-support",
      confidence: relatedEntities.length >= 2 ? "medium" : "low",
      sourceId: source.id,
      metadata: { fragmentRole: "entity-context" },
      evidence: evidencePayloads(source, [primary], "context", {
        evidenceRole: "entity-context",
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

  return drafts.slice(0, 5);
}

function buildOverviewClaims(input: {
  project: Project;
  sourceInputs: SourceCompilationInput[];
  entities: ResearchEntity[];
  generatedPages: number;
}): ClaimDraft[] {
  const samples = sampleFragments(input.sourceInputs, 3);
  const companies = input.entities.filter((entity) => entity.entityType === "company");
  const products = input.entities.filter(
    (entity) => entity.entityType === "product_or_segment",
  );

  const drafts: ClaimDraft[] = [
    {
      text: `${input.project.name} currently compiles ${input.sourceInputs.length} active source record(s) into ${input.generatedPages} canonical page(s).`,
      claimType: "summary",
      supportStatus: samples.length >= 2 ? "supported" : "weak-support",
      confidence: samples.length >= 2 ? "medium" : "low",
      metadata: { pageRole: "overview" },
      evidence: projectEvidenceFromSamples(samples, "supports", {
        evidenceRole: "overview-coverage",
      }),
    },
    {
      text:
        companies.length > 0
          ? `Current canon is centered on ${companies[0].canonicalName}${
              products.length > 0
                ? ` with product or segment context across ${products
                    .slice(0, 3)
                    .map((entity) => entity.canonicalName)
                    .join(", ")}`
                : ""
            }.`
          : "Current canon has not yet stabilized around a clearly extracted company entity.",
      claimType: "key-signal",
      supportStatus: companies.length > 0 ? "supported" : "unresolved",
      confidence: companies.length > 0 ? "medium" : "low",
      metadata: { pageRole: "overview", subjectRole: "entity-center" },
      evidence: projectEvidenceFromSamples(samples.slice(0, 2), "context", {
        evidenceRole: "overview-entity-context",
      }),
    },
    {
      text: `The overview currently reflects fragment-level evidence from ${new Set(
        samples.map((sample) => sample.source.id),
      ).size} source record(s), which sets the present source-diversity posture for downstream intelligence surfaces.`,
      claimType: "provenance",
      supportStatus: samples.length >= 2 ? "supported" : "weak-support",
      confidence: "medium",
      metadata: { pageRole: "overview", subjectRole: "support-diversity" },
      evidence: projectEvidenceFromSamples(samples, "context", {
        evidenceRole: "overview-provenance",
      }),
    },
  ];

  return drafts.filter((claim) => claim.evidence.length > 0);
}

function buildConceptIndexClaims(input: {
  sourceInputs: SourceCompilationInput[];
  entities: ResearchEntity[];
}): ClaimDraft[] {
  const samples = sampleFragments(input.sourceInputs, 3);
  const concepts = conceptTokens(input.sourceInputs);
  const entityCount = input.entities.length;

  const drafts: ClaimDraft[] = [
    {
      text:
        entityCount > 0
          ? `The concept index currently stabilizes ${entityCount} extracted entity record(s) alongside repeated corpus terms.`
          : "The concept index currently relies on repeated corpus terms because entity extraction remains thin.",
      claimType: "summary",
      supportStatus: entityCount > 0 ? "supported" : "weak-support",
      confidence: entityCount > 0 ? "medium" : "low",
      metadata: { pageRole: "concept-index" },
      evidence: projectEvidenceFromSamples(samples.slice(0, 2), "context", {
        evidenceRole: "concept-index-entity-alignment",
      }),
    },
    {
      text:
        concepts.length > 0
          ? `Repeated concept signals currently include ${concepts
              .slice(0, 4)
              .map((concept) => concept.label)
              .join(", ")}.`
          : "No repeatable concept signals were detected from the current source set.",
      claimType: "key-signal",
      supportStatus: concepts.length > 0 ? "supported" : "unresolved",
      confidence: concepts.length > 0 ? "medium" : "low",
      metadata: { pageRole: "concept-index", subjectRole: "token-cluster" },
      evidence: projectEvidenceFromSamples(samples, "context", {
        evidenceRole: "concept-index-token-sample",
      }),
    },
  ];

  return drafts.filter((claim) => claim.evidence.length > 0);
}

function buildOpenQuestionClaims(input: {
  sourceInputs: SourceCompilationInput[];
  entities: ResearchEntity[];
}): ClaimDraft[] {
  const samples = sampleFragments(input.sourceInputs, 3);
  const nonCompiled = input.sourceInputs.filter(
    (sourceInput) => sourceInput.source.status !== "compiled",
  );
  const lowStructure = input.sourceInputs.filter(
    (sourceInput) =>
      sourceInput.fragments.length === 0 ||
      sourceInput.fragments.every((fragment) => fragment.fragmentType !== "heading"),
  );
  const risks = input.entities.filter((entity) => entity.entityType === "risk_theme");

  const drafts: ClaimDraft[] = [
    {
      text: `Open questions currently concentrate in ${lowStructure.length} low-structure source record(s) and ${nonCompiled.length} source record(s) that still need fuller canonical treatment.`,
      claimType: "structural",
      supportStatus: samples.length > 0 ? "weak-support" : "unresolved",
      confidence: "low",
      metadata: { pageRole: "open-questions" },
      evidence: projectEvidenceFromSamples(samples, "raises-question", {
        evidenceRole: "open-question-structure",
      }),
    },
    {
      text:
        risks.length > 0
          ? `The open-question set now intersects risk themes such as ${risks
              .slice(0, 3)
              .map((risk) => risk.canonicalName)
              .join(", ")}.`
          : "No clear risk-theme entity is yet anchoring the open-question set.",
      claimType: "open-question",
      supportStatus: risks.length > 0 ? "unresolved" : "weak-support",
      confidence: "low",
      metadata: { pageRole: "open-questions", subjectRole: "risk-theme" },
      evidence: projectEvidenceFromSamples(samples.slice(0, 2), "raises-question", {
        evidenceRole: "open-question-risk",
      }),
    },
  ];

  return drafts.filter((claim) => claim.evidence.length > 0);
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

  const hasMaterialChange =
    !page ||
    normalizeForComparison(currentRevision?.markdownContent) !==
      normalizeForComparison(input.markdownContent);

  if (hasMaterialChange) {
    const changeNote = summarizeChangeNote(
      input.title,
      currentRevision?.markdownContent,
      input.markdownContent,
    );
    page = await wikiRepository.upsertPageRevision({
      projectId: input.projectId,
      slug: input.slug,
      title: input.title,
      pageType: input.pageType,
      sourceId: input.sourceId,
      status: "active",
      markdownContent: input.markdownContent,
      summary: input.summary,
      changeNote,
      confidence: "medium",
      createdBy: "compiler",
      generationMetadata: input.generationMetadata,
    });
  } else {
    if (!page) {
      throw new Error("Expected an existing wiki page before refreshing metadata.");
    }

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
    revisionId: page.currentRevisionId,
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

  const job = await startOperationalJob({
    projectId,
    jobType: "compile_wiki",
    targetObjectType: "wiki",
    targetObjectId: projectId,
    triggeredBy,
    summary: "Wiki compile started.",
    metadata: { mode: "deterministic-claim-compiler" },
  });

  try {
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

    const entityCompileResult = await compileProjectEntities(projectId);
    const entities = entityCompileResult.entities;

    const targets: CompileTarget[] = [];
    let totalClaims = 0;
    let totalEvidenceLinks = 0;
    let unresolvedClaims = 0;

  for (const sourceInput of sourceInputs) {
    const fragmentIds = sourceInput.fragments.map((fragment) => fragment.id);
    const existingPage = await wikiRepository.getPageByProjectAndSlug(
      projectId,
      `source-summary-${slugify(sourceInput.source.title)}-${sourceInput.source.id.slice(0, 8)}`,
    );
    const existingRevision = existingPage
      ? await wikiRepository.getCurrentRevision(existingPage.id)
      : null;
    const claimDrafts = buildSourceSummaryClaims(sourceInput, entities);
    const markdownContent = sourceSummaryMarkdown(sourceInput, entities);
    const summary = sourceSummarySummary(sourceInput, entities);
    const target = await syncCompiledPage({
      projectId,
      slug: `source-summary-${slugify(sourceInput.source.title)}-${sourceInput.source.id.slice(0, 8)}`,
      title: `Source Summary: ${sourceInput.source.title}`,
      pageType: "source-summary",
      sourceId: sourceInput.source.id,
      markdownContent,
      summary,
      changeNote: `Source summary refreshed from ${sourceInput.source.title}`,
      sourceIds: [sourceInput.source.id],
      generationMetadata: buildPageGenerationMetadata({
        pageRole: "source-summary",
        jobId: job.id,
        sourceIds: [sourceInput.source.id],
        fragmentIds,
        claimDrafts,
        previousMarkdown: existingRevision?.markdownContent,
        nextMarkdown: markdownContent,
        additional: {
          generatedFromSourceId: sourceInput.source.id,
          summary: summary,
        },
      }),
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
  const overviewSamples = sampleFragments(sourceInputs, 3);
  const overviewClaims = buildOverviewClaims({
    project,
    sourceInputs,
    entities,
    generatedPages: summaryPageCount + nonSummaryCount,
  });
  const overviewExisting = await wikiRepository.getPageByProjectAndSlug(projectId, "overview");
  const overviewExistingRevision = overviewExisting
    ? await wikiRepository.getCurrentRevision(overviewExisting.id)
    : null;
  const overviewContent = overviewMarkdown(
    project,
    sourceInputs,
    summaryPageCount + nonSummaryCount,
    entities,
  );

  const overviewTarget = await syncCompiledPage({
      projectId,
      slug: "overview",
      title: "Overview",
      pageType: "overview",
      markdownContent: overviewContent,
      summary: `Project overview compiled from ${sourceInputs.length} current source records and ${allFragmentIds.length} source fragments.`,
      changeNote: `Overview refreshed from ${sourceInputs.length} sources`,
      sourceIds: allSourceIds,
      generationMetadata: buildPageGenerationMetadata({
        pageRole: "overview",
        jobId: job.id,
        sourceIds: allSourceIds,
        fragmentIds: overviewSamples.map((sample) => sample.fragment.id),
        claimDrafts: overviewClaims,
        previousMarkdown: overviewExistingRevision?.markdownContent,
        nextMarkdown: overviewContent,
      }),
    });
  const overviewTrust = await syncClaimsForPage({
    projectId,
    wikiPageId: overviewTarget.pageId,
    claimDrafts: overviewClaims,
  });
  totalClaims += overviewTrust.claimCount;
  totalEvidenceLinks += overviewTrust.evidenceCount;
  unresolvedClaims += overviewTrust.unresolvedCount;
  targets.push(overviewTarget);

  const conceptClaims = buildConceptIndexClaims({ sourceInputs, entities });
  const conceptExisting = await wikiRepository.getPageByProjectAndSlug(
    projectId,
    "concept-index",
  );
  const conceptExistingRevision = conceptExisting
    ? await wikiRepository.getCurrentRevision(conceptExisting.id)
    : null;
  const conceptContent = conceptIndexMarkdown(sourceInputs, entities);
  const conceptTarget = await syncCompiledPage({
      projectId,
      slug: "concept-index",
      title: "Concept Index",
      pageType: "concept-index",
      markdownContent: conceptContent,
      summary: `Concept index derived deterministically from ${sourceInputs.length} current source records and their extracted fragments.`,
      changeNote: `Concept index refreshed from ${sourceInputs.length} sources`,
      sourceIds: allSourceIds,
      generationMetadata: buildPageGenerationMetadata({
        pageRole: "concept-index",
        jobId: job.id,
        sourceIds: allSourceIds,
        fragmentIds: sampleFragments(sourceInputs, 3).map((sample) => sample.fragment.id),
        claimDrafts: conceptClaims,
        previousMarkdown: conceptExistingRevision?.markdownContent,
        nextMarkdown: conceptContent,
      }),
    });
  const conceptTrust = await syncClaimsForPage({
    projectId,
    wikiPageId: conceptTarget.pageId,
    claimDrafts: conceptClaims,
  });
  totalClaims += conceptTrust.claimCount;
  totalEvidenceLinks += conceptTrust.evidenceCount;
  unresolvedClaims += conceptTrust.unresolvedCount;
  targets.push(conceptTarget);

  const openQuestionClaims = buildOpenQuestionClaims({ sourceInputs, entities });
  const openQuestionsExisting = await wikiRepository.getPageByProjectAndSlug(
    projectId,
    "open-questions",
  );
  const openQuestionsExistingRevision = openQuestionsExisting
    ? await wikiRepository.getCurrentRevision(openQuestionsExisting.id)
    : null;
  const openQuestionsContent = openQuestionsMarkdown(project, sourceInputs, entities);
  const openQuestionsTarget = await syncCompiledPage({
      projectId,
      slug: "open-questions",
      title: "Open Questions",
      pageType: "open-questions",
      markdownContent: openQuestionsContent,
      summary:
        "Open questions generated from current source coverage, lifecycle state, and fragment structure.",
      changeNote: "Open questions refreshed from current source set",
      sourceIds: allSourceIds,
      generationMetadata: buildPageGenerationMetadata({
        pageRole: "open-questions",
        jobId: job.id,
        sourceIds: allSourceIds,
        fragmentIds: sampleFragments(sourceInputs, 3).map((sample) => sample.fragment.id),
        claimDrafts: openQuestionClaims,
        previousMarkdown: openQuestionsExistingRevision?.markdownContent,
        nextMarkdown: openQuestionsContent,
      }),
    });
  const openQuestionTrust = await syncClaimsForPage({
    projectId,
    wikiPageId: openQuestionsTarget.pageId,
    claimDrafts: openQuestionClaims,
  });
  totalClaims += openQuestionTrust.claimCount;
  totalEvidenceLinks += openQuestionTrust.evidenceCount;
  unresolvedClaims += openQuestionTrust.unresolvedCount;
  targets.push(openQuestionsTarget);

    const affectedPageIds = targets.map((target) => target.pageId);
    const sourceSummaryPages = targets.filter(
      (target) => target.pageType === "source-summary",
    ).length;
    const summary = `Compile produced ${affectedPageIds.length} canonical pages from ${eligibleSources.length} source records and ${allFragmentIds.length} parsed fragments, yielding ${totalClaims} claims and ${totalEvidenceLinks} evidence links across ${sourceSummaryPages} source-summary pages.`;

    const updatedJob = await completeOperationalJob({
      jobId: job.id,
      summary,
      targetObjectId: projectId,
      metadata: {
        mode: "deterministic-claim-compiler",
        projectSlug: project.slug,
        sourceSummaryPages: String(sourceSummaryPages),
        fragmentCount: String(allFragmentIds.length),
        claimCount: String(totalClaims),
        unresolvedClaimCount: String(unresolvedClaims),
        evidenceLinkCount: String(totalEvidenceLinks),
        affectedPageCount: String(affectedPageIds.length),
      },
    });

    await compileJobsRepository.update(job.id, {
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
        affectedPageCount: String(affectedPageIds.length),
      },
    });

    await recordOperationalAuditEvent({
      projectId,
      eventType: "wiki_compiled",
      title: "Wiki compiled",
      description: summary,
      relatedObjectType: "wiki",
      relatedObjectId: projectId,
      relatedJobId: job.id,
      metadata: {
        affectedPageCount: String(affectedPageIds.length),
        sourceCount: String(eligibleSources.length),
      },
    });

    if (!updatedJob) {
      throw new Error("Compile job disappeared before completion.");
    }

    return updatedJob;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown compile failure.";
    await failOperationalJob(job.id, `Wiki compile failed: ${message}`, {
      mode: "deterministic-claim-compiler",
      projectSlug: project.slug,
    });
    await recordOperationalAuditEvent({
      projectId,
      eventType: "job_failed",
      title: "Wiki compile failed",
      description: `Wiki compile failed for ${project.name}: ${message}`,
      relatedObjectType: "wiki",
      relatedObjectId: projectId,
      relatedJobId: job.id,
      metadata: { jobType: "compile_wiki" },
    });
    throw error;
  }
}
