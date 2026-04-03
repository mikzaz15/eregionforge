import type {
  Artifact,
  ArtifactType,
  AskAnswerMode,
  AskSession,
  Claim,
  RevisionConfidence,
  Source,
  SourceFragment,
  WikiPage,
  WikiPageRevision,
  WikiPageType,
} from "@/lib/domain/types";
import { artifactsRepository } from "@/lib/repositories/artifacts-repository";
import { askSessionsRepository } from "@/lib/repositories/ask-sessions-repository";
import { claimsRepository } from "@/lib/repositories/claims-repository";
import { evidenceLinksRepository } from "@/lib/repositories/evidence-links-repository";
import { sourceFragmentsRepository } from "@/lib/repositories/source-fragments-repository";
import { sourcesRepository } from "@/lib/repositories/sources-repository";
import { wikiRepository } from "@/lib/repositories/wiki-repository";

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

type AskSynthesisContext = {
  prompt: string;
  answerMode: AskAnswerMode;
  pages: PageCandidate[];
  claims: ClaimCandidate[];
  sources: SourceCandidate[];
  confidence: RevisionConfidence;
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
    tokens: ["overview", "summary", "canon", "what"],
    pageTypes: ["overview", "dossier", "investment-thesis"],
  },
  {
    tokens: ["architecture", "system", "service", "compiler"],
    pageTypes: ["architecture", "data-model"],
  },
  {
    tokens: ["scope", "mvp", "build", "immediately"],
    pageTypes: ["scope", "roadmap", "open-questions"],
  },
  {
    tokens: ["roadmap", "sprint", "sequence", "next"],
    pageTypes: ["roadmap", "open-questions", "concept-index"],
  },
  {
    tokens: ["risk", "contradiction", "conflict", "tension"],
    pageTypes: ["risk-register", "open-questions", "market-map"],
  },
  {
    tokens: ["compare", "versus", "viewpoint"],
    pageTypes: ["market-map", "investment-thesis", "dossier"],
  },
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
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

function preview(value: string | null, length = 180): string {
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

function downgradeConfidence(
  confidence: RevisionConfidence,
): RevisionConfidence {
  if (confidence === "high") {
    return "medium";
  }

  if (confidence === "medium") {
    return "low";
  }

  return confidence;
}

async function rankPages(projectId: string, prompt: string): Promise<PageCandidate[]> {
  const queryTokens = tokenize(prompt);
  const pages = await wikiRepository.listPagesByProjectId(projectId);
  const candidates = await Promise.all(
    pages.map(async (page) => {
      const [revision, sourceIds] = await Promise.all([
        wikiRepository.getCurrentRevision(page.id),
        wikiRepository.listSourceIdsForPage(page.id),
      ]);
      const titleOverlap = overlapTokens(queryTokens, page.title);
      const summaryOverlap = overlapTokens(
        queryTokens,
        [revision?.summary ?? "", revision?.markdownContent ?? ""].join(" "),
      );
      const score =
        titleOverlap.length * 6 +
        summaryOverlap.length * 3 +
        pageTypeBoost(queryTokens, page.pageType) +
        (page.status === "active" ? 2 : 0) +
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
        right.page.updatedAt.localeCompare(left.page.updatedAt),
    )
    .filter((candidate) => candidate.score > 0);

  if (ranked.length > 0) {
    return ranked.slice(0, 4);
  }

  return candidates
    .sort(
      (left, right) =>
        right.page.updatedAt.localeCompare(left.page.updatedAt) ||
        right.page.title.localeCompare(left.page.title),
    )
    .slice(0, 3);
}

async function rankClaims(
  projectId: string,
  prompt: string,
  pageCandidates: PageCandidate[],
): Promise<ClaimCandidate[]> {
  const queryTokens = tokenize(prompt);
  const relevantPageIds = new Set(pageCandidates.map((candidate) => candidate.page.id));
  const claims = await claimsRepository.listByProjectId(projectId);
  const candidates = claims.map((claim) => {
    const overlap = overlapTokens(queryTokens, claim.text);
    const supportWeight =
      claim.supportStatus === "supported"
        ? 3
        : claim.supportStatus === "weak-support"
          ? 1
          : -1;
    const score =
      overlap.length * 5 +
      (relevantPageIds.has(claim.wikiPageId) ? 4 : 0) +
      supportWeight;

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
}): Promise<SourceCandidate[]> {
  const queryTokens = tokenize(input.prompt);
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
      const viaEvidence = evidenceSourceIds.has(source.id);
      const linkedToPage = pageLinkedSourceIds.has(source.id);
      const score =
        overlap.length * 4 +
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

function deriveConfidence(
  claims: ClaimCandidate[],
  sources: SourceCandidate[],
): RevisionConfidence {
  const supportedClaims = claims.filter(
    (candidate) => candidate.claim.supportStatus === "supported",
  ).length;
  const unresolvedClaims = claims.filter(
    (candidate) => candidate.claim.supportStatus === "unresolved",
  ).length;
  const fallbackCount = sources.filter((candidate) => candidate.viaRawFallback).length;

  let confidence: RevisionConfidence =
    supportedClaims >= 2 && fallbackCount === 0
      ? "high"
      : claims.length > 0 || sources.length > 1
        ? "medium"
        : "low";

  if (unresolvedClaims > supportedClaims) {
    confidence = downgradeConfidence(confidence);
  }

  return confidence;
}

function evidencePostureLine(context: AskSynthesisContext): string {
  const supportedClaims = context.claims.filter(
    (candidate) => candidate.claim.supportStatus === "supported",
  ).length;
  const unresolvedClaims = context.claims.filter(
    (candidate) => candidate.claim.supportStatus === "unresolved",
  ).length;
  const rawFallbackCount = context.sources.filter(
    (candidate) => candidate.viaRawFallback,
  ).length;

  return `Confidence is ${context.confidence}. Consulted ${context.pages.length} wiki page(s), ${context.claims.length} claim(s), and ${context.sources.length} source record(s). Supported claims consulted: ${supportedClaims}. Unresolved claims consulted: ${unresolvedClaims}. Raw-source fallback count: ${rawFallbackCount}.`;
}

function buildAnswer(context: AskSynthesisContext): string {
  const pageLines = context.pages.map(
    (candidate) =>
      `${candidate.page.title}: ${candidate.revision?.summary ?? preview(candidate.revision?.markdownContent ?? null)}`,
  );
  const claimLines = context.claims.map(
    (candidate) =>
      `${candidate.claim.text} [${candidate.claim.supportStatus}]`,
  );
  const sourceLines = context.sources.map(
    (candidate) =>
      `${candidate.source.title}: ${preview(
        candidate.fragments.find((fragment) => fragment.fragmentType !== "heading")?.text ??
          candidate.source.body,
      )}`,
  );

  if (context.answerMode === "concise-answer") {
    return [
      "# Answer",
      `Primary answer to "${context.prompt}": the strongest available response comes from compiled canon first. ${pageLines[0] ?? "No directly relevant wiki page summary was found, so the system relied more heavily on source-level fallback."}`,
      context.claims[0]
        ? `The most relevant explicit claim is: ${context.claims[0].claim.text}`
        : "No compiled claim matched strongly enough to anchor the answer, so the response leans on page summaries and source context.",
      "",
      "## Canonical Basis",
      ...listLine(pageLines).map((line) => `- ${line}`),
      "",
      "## Evidence Posture",
      `- ${evidencePostureLine(context)}`,
      ...(claimLines.length > 0 ? claimLines.slice(0, 4).map((line) => `- ${line}`) : []),
      "",
      "## Source References",
      ...listLine(sourceLines.slice(0, 4)).map((line) => `- ${line}`),
    ].join("\n");
  }

  if (context.answerMode === "research-memo") {
    return [
      "# Research Memo",
      "## Executive Summary",
      `${pageLines[0] ?? "The wiki does not yet provide a strong top-level synthesis for this question."} ${context.claims[0] ? `The current claim layer reinforces this with: ${context.claims[0].claim.text}` : "The claim layer remains thin for this question."}`,
      "",
      "## Canonical Findings",
      ...listLine(pageLines.slice(0, 4)).map((line) => `- ${line}`),
      "",
      "## Claim Layer",
      ...listLine(claimLines.slice(0, 5)).map((line) => `- ${line}`),
      "",
      "## Supporting Sources",
      ...listLine(sourceLines.slice(0, 5)).map((line) => `- ${line}`),
      "",
      "## Confidence And Gaps",
      `- ${evidencePostureLine(context)}`,
      `- Next operational move: ${context.confidence === "high" ? "promote this answer into a durable artifact if it is decision-relevant." : "treat this as a working memo and improve canon or evidence before relying on it heavily."}`,
    ].join("\n");
  }

  if (context.answerMode === "compare-viewpoints") {
    const comparisonCandidates = context.pages.slice(0, 3);

    return [
      "# Compare Viewpoints",
      "## Compared Objects",
      ...listLine(
        comparisonCandidates.map(
          (candidate) =>
            `${candidate.page.title}: ${candidate.revision?.summary ?? preview(candidate.revision?.markdownContent ?? null)}`,
        ),
      ).map((line) => `- ${line}`),
      "",
      "## Shared Ground",
      `- ${comparisonCandidates.length > 1 ? "The consulted pages cluster around the same project canon, so they are more likely to differ by emphasis than by worldview." : "Only one strong canonical page matched, so viewpoint comparison is limited."}`,
      "",
      "## Differences In Emphasis",
      ...listLine(
        context.claims.slice(0, 4).map(
          (candidate) =>
            `${candidate.claim.text} [${candidate.claim.claimType}, ${candidate.claim.supportStatus}]`,
        ),
      ).map((line) => `- ${line}`),
      "",
      "## Source Perspective",
      ...listLine(sourceLines.slice(0, 4)).map((line) => `- ${line}`),
      "",
      "## Confidence",
      `- ${evidencePostureLine(context)}`,
    ].join("\n");
  }

  if (context.answerMode === "identify-contradictions") {
    const contradictionLines = [
      ...context.claims
        .filter((candidate) => candidate.claim.supportStatus !== "supported")
        .map(
          (candidate) =>
            `Potential tension: ${candidate.claim.text} [${candidate.claim.supportStatus}]`,
        ),
      ...context.sources
        .filter((candidate) => candidate.source.status === "failed")
        .map(
          (candidate) =>
            `Source reliability gap: ${candidate.source.title} is currently marked failed in ingestion.`,
        ),
    ];

    return [
      "# Contradiction Review",
      "## Assessment",
      contradictionLines.length > 0
        ? "The system found tension signals in the current compiled state. These are integrity issues to review, not proof of true contradiction."
        : "No explicit contradiction signal surfaced from the current wiki, claim, and source layers for this question.",
      "",
      "## Tension Signals",
      ...listLine(contradictionLines).map((line) => `- ${line}`),
      "",
      "## Canonical References",
      ...listLine(pageLines.slice(0, 4)).map((line) => `- ${line}`),
      "",
      "## Source Checks",
      ...listLine(sourceLines.slice(0, 4)).map((line) => `- ${line}`),
      "",
      "## Confidence",
      `- ${evidencePostureLine(context)}`,
    ].join("\n");
  }

  return [
    "# Follow-Up Questions",
    "## Recommended Next Questions",
    ...listLine([
      ...context.claims
        .filter((candidate) => candidate.claim.supportStatus !== "supported")
        .slice(0, 4)
        .map(
          (candidate) =>
            `What would convert this claim from ${candidate.claim.supportStatus} to supported: ${candidate.claim.text}?`,
        ),
      ...context.sources
        .filter((candidate) => candidate.source.status !== "compiled")
        .slice(0, 3)
        .map(
          (candidate) =>
            `What ingestion or verification work is still required before ${candidate.source.title} can be treated as stable canonical input?`,
        ),
      ...(context.pages.length > 0
        ? [
            `Which canonical page should be refreshed next if the question "${context.prompt}" becomes decision-critical?`,
          ]
        : []),
    ]).map((line) => `- ${line}`),
    "",
    "## Current Context Used",
    ...listLine(pageLines.slice(0, 4)).map((line) => `- ${line}`),
    "",
    "## Confidence",
    `- ${evidencePostureLine(context)}`,
  ].join("\n");
}

export async function runAskSession(input: {
  projectId: string;
  prompt: string;
  answerMode: AskAnswerMode;
}): Promise<AskSession> {
  const pages = await rankPages(input.projectId, input.prompt);
  const claims = await rankClaims(input.projectId, input.prompt, pages);
  const sources = await rankSources({
    projectId: input.projectId,
    prompt: input.prompt,
    pageCandidates: pages,
    claimCandidates: claims,
  });
  const confidence = deriveConfidence(claims, sources);
  const answer = buildAnswer({
    prompt: input.prompt,
    answerMode: input.answerMode,
    pages,
    claims,
    sources,
    confidence,
  });

  return askSessionsRepository.create({
    projectId: input.projectId,
    prompt: input.prompt,
    answer,
    answerMode: input.answerMode,
    confidence,
    consultedWikiPageIds: pages.map((candidate) => candidate.page.id),
    consultedClaimIds: claims.map((candidate) => candidate.claim.id),
    consultedSourceIds: sources.map((candidate) => candidate.source.id),
    metadata: {
      answerModeLabel: answerModeLabels[input.answerMode],
      retrievalOrder: "wiki-pages>claims>evidence-linked-sources>raw-source-fallback",
      consultedPageCount: String(pages.length),
      consultedClaimCount: String(claims.length),
      consultedSourceCount: String(sources.length),
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

  return artifactsRepository.create({
    projectId: input.projectId,
    artifactType: input.artifactType,
    title: titleFromPrompt(session.prompt, session.answerMode),
    markdownContent: session.answer,
    status: "draft",
    metadata: {
      derivedFrom: "Ask mode",
      provenance: "ask-session",
      originatingPrompt: session.prompt,
      answerMode: session.answerMode,
      askSessionId: session.id,
      confidence: session.confidence,
    },
  });
}
