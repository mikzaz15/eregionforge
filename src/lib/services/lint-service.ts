import type {
  Claim,
  LintIssue,
  LintIssueDraft,
  LintIssueSeverity,
  LintIssueStatus,
  WikiPage,
  WikiPageRevision,
  WikiPageType,
} from "@/lib/domain/types";
import { claimsRepository } from "@/lib/repositories/claims-repository";
import { lintIssuesRepository } from "@/lib/repositories/lint-issues-repository";
import { sourcesRepository } from "@/lib/repositories/sources-repository";
import { wikiRepository } from "@/lib/repositories/wiki-repository";

const expectedTopLevelPages: Array<{
  pageType: WikiPageType;
  slug: string;
  title: string;
}> = [
  { pageType: "overview", slug: "overview", title: "Overview" },
  {
    pageType: "concept-index",
    slug: "concept-index",
    title: "Concept Index",
  },
  {
    pageType: "open-questions",
    slug: "open-questions",
    title: "Open Questions",
  },
];

const severityOrder: Record<LintIssueSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

type PageLintContext = {
  page: WikiPage;
  currentRevision: WikiPageRevision | null;
  claims: Claim[];
  sourceIds: string[];
};

export type ProjectLintHealthSummary = {
  totalIssues: number;
  issuesBySeverity: Record<LintIssueSeverity, number>;
  unsupportedClaimsCount: number;
  weakPagesCount: number;
  stalePagesCount: number;
  orphanPagesCount: number;
};

export type ProjectLintSnapshot = {
  issues: LintIssue[];
  health: ProjectLintHealthSummary;
};

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function tokenSet(value: string): Set<string> {
  const stopWords = new Set([
    "the",
    "and",
    "for",
    "with",
    "page",
    "index",
    "overview",
    "questions",
    "open",
  ]);

  return new Set(
    normalizeText(value)
      .split(/\s+/)
      .filter((token) => token.length > 2 && !stopWords.has(token)),
  );
}

function stableKey(...parts: Array<string | number | null | undefined>): string {
  return parts
    .filter((part): part is string | number => part !== null && part !== undefined)
    .map((part) => String(part).toLowerCase().replace(/[^a-z0-9]+/g, "-"))
    .join("-");
}

function maxTimestamp(values: string[]): string | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((latest, value) => (value > latest ? value : latest));
}

function jaccardSimilarity(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }

  let intersection = 0;

  for (const token of left) {
    if (right.has(token)) {
      intersection += 1;
    }
  }

  const union = new Set([...left, ...right]).size;
  return union === 0 ? 0 : intersection / union;
}

function buildHealthSummary(issues: LintIssue[]): ProjectLintHealthSummary {
  const openIssues = issues.filter((issue) => issue.status === "open");
  const base = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  } satisfies Record<LintIssueSeverity, number>;

  for (const issue of openIssues) {
    base[issue.severity] += 1;
  }

  return {
    totalIssues: openIssues.length,
    issuesBySeverity: base,
    unsupportedClaimsCount: openIssues.filter(
      (issue) => issue.issueType === "unsupported_claims",
    ).length,
    weakPagesCount: openIssues.filter(
      (issue) => issue.issueType === "weakly_supported_page",
    ).length,
    stalePagesCount: openIssues.filter(
      (issue) => issue.issueType === "stale_page",
    ).length,
    orphanPagesCount: openIssues.filter(
      (issue) => issue.issueType === "orphan_page",
    ).length,
  };
}

function sortIssues(issues: LintIssue[]): LintIssue[] {
  return structuredClone(issues).sort((left, right) => {
    if (left.status !== right.status) {
      return left.status === "open" ? -1 : 1;
    }

    return (
      severityOrder[left.severity] - severityOrder[right.severity] ||
      right.updatedAt.localeCompare(left.updatedAt)
    );
  });
}

async function buildPageContexts(projectId: string): Promise<PageLintContext[]> {
  const pages = await wikiRepository.listPagesByProjectId(projectId);

  return Promise.all(
    pages.map(async (page) => {
      const [currentRevision, claims, sourceIds] = await Promise.all([
        wikiRepository.getCurrentRevision(page.id),
        claimsRepository.listByWikiPageId(page.id),
        wikiRepository.listSourceIdsForPage(page.id),
      ]);

      return {
        page,
        currentRevision,
        claims,
        sourceIds,
      };
    }),
  );
}

async function computeLintDrafts(projectId: string): Promise<LintIssueDraft[]> {
  const [pageContexts, sources] = await Promise.all([
    buildPageContexts(projectId),
    sourcesRepository.listByProjectId(projectId),
  ]);
  const sourceUpdateById = new Map(
    sources.map((source) => [source.id, source.updatedAt] as const),
  );
  const issues: LintIssueDraft[] = [];
  const pageTextById = new Map(
    pageContexts.map((context) => [
      context.page.id,
      normalizeText(
        [
          context.currentRevision?.markdownContent ?? "",
          context.currentRevision?.summary ?? "",
        ].join(" "),
      ),
    ]),
  );

  for (const context of pageContexts) {
    for (const claim of context.claims) {
      if (claim.supportStatus === "supported") {
        continue;
      }

      issues.push({
        stableKey: stableKey("unsupported-claim", claim.id),
        projectId,
        issueType: "unsupported_claims",
        severity: claim.supportStatus === "unresolved" ? "high" : "medium",
        relatedPageId: context.page.id,
        relatedClaimIds: [claim.id],
        title:
          claim.supportStatus === "unresolved"
            ? `Unsupported claim on ${context.page.title}`
            : `Weakly supported claim on ${context.page.title}`,
        description: `${claim.text} Current support status is ${claim.supportStatus}, so this claim should not yet be treated as stable canon.`,
        recommendedAction:
          "Review the page evidence trail, tighten the claim wording, or recompile after stronger source support is available.",
        metadata: {
          claimSupportStatus: claim.supportStatus,
          pageTitle: context.page.title,
        },
      });
    }

    const weakClaims = context.claims.filter(
      (claim) => claim.supportStatus === "weak-support",
    ).length;
    const unresolvedClaims = context.claims.filter(
      (claim) => claim.supportStatus === "unresolved",
    ).length;
    const unsupportedClaims = weakClaims + unresolvedClaims;
    const unsupportedRatio =
      context.claims.length > 0 ? unsupportedClaims / context.claims.length : 0;

    if (
      context.claims.length > 0 &&
      unsupportedClaims > 0 &&
      (unsupportedRatio >= 0.4 || unresolvedClaims >= 2)
    ) {
      issues.push({
        stableKey: stableKey("weak-page", context.page.id),
        projectId,
        issueType: "weakly_supported_page",
        severity:
          unsupportedRatio >= 0.6 || unresolvedClaims >= weakClaims
            ? "high"
            : "medium",
        relatedPageId: context.page.id,
        relatedClaimIds: context.claims
          .filter((claim) => claim.supportStatus !== "supported")
          .map((claim) => claim.id),
        title: `Weak support posture on ${context.page.title}`,
        description: `${unsupportedClaims} of ${context.claims.length} claim(s) on this page are weak or unresolved. This page is present in canon, but trust on the current synthesis is thin.`,
        recommendedAction:
          "Recompile the page after improving source structure, or review unsupported claims directly before relying on this page.",
        metadata: {
          claimCount: String(context.claims.length),
          unsupportedClaimCount: String(unsupportedClaims),
          unsupportedRatio: unsupportedRatio.toFixed(2),
        },
      });
    }

    const linkedSourceUpdates = context.sourceIds
      .map((sourceId) => sourceUpdateById.get(sourceId))
      .filter((timestamp): timestamp is string => Boolean(timestamp));
    const latestSourceUpdate = maxTimestamp(linkedSourceUpdates);
    const staleByTimestamp = Boolean(
      latestSourceUpdate &&
        context.currentRevision &&
        latestSourceUpdate > context.currentRevision.createdAt,
    );
    // Placeholder freshness strategy until source-version fingerprints exist.
    const staleByPlaceholderStrategy =
      !staleByTimestamp &&
      context.sourceIds.length > 0 &&
      !context.page.generationMetadata?.generatedBy;

    if (staleByTimestamp || staleByPlaceholderStrategy) {
      issues.push({
        stableKey: stableKey("stale-page", context.page.id),
        projectId,
        issueType: "stale_page",
        severity: staleByTimestamp ? "medium" : "low",
        relatedPageId: context.page.id,
        relatedClaimIds: [],
        title: `Freshness review needed for ${context.page.title}`,
        description: staleByTimestamp
          ? `At least one linked source changed after the current page revision was generated. The page may be lagging behind its source inputs.`
          : `This page predates deterministic compile metadata. Until source-version comparison is richer, seeded pages with linked sources are treated as placeholder stale candidates.`,
        recommendedAction:
          "Recompile the page so its current revision reflects the latest source-derived state.",
        metadata: {
          staleStrategy: staleByTimestamp
            ? "source-updated-after-revision"
            : "seeded-page-placeholder",
          latestSourceUpdate: latestSourceUpdate ?? "not-available",
          revisionCreatedAt: context.currentRevision?.createdAt ?? "not-available",
        },
      });
    }
  }

  const topLevelTypes = new Set(expectedTopLevelPages.map((page) => page.pageType));

  for (const context of pageContexts) {
    if (topLevelTypes.has(context.page.pageType)) {
      continue;
    }

    const normalizedTitle = normalizeText(context.page.title);
    const normalizedSlug = normalizeText(context.page.slug.replace(/-/g, " "));
    const backlinkCount = pageContexts.filter((candidate) => {
      if (candidate.page.id === context.page.id) {
        return false;
      }

      const candidateText = pageTextById.get(candidate.page.id) ?? "";
      return (
        normalizedTitle.length > 0 &&
        (candidateText.includes(normalizedTitle) ||
          (normalizedSlug.length > 0 && candidateText.includes(normalizedSlug)))
      );
    }).length;
    const sharedSourceConnections = pageContexts.filter((candidate) => {
      if (candidate.page.id === context.page.id) {
        return false;
      }

      return candidate.sourceIds.some((sourceId) => context.sourceIds.includes(sourceId));
    }).length;

    if (backlinkCount === 0 && sharedSourceConnections === 0) {
      issues.push({
        stableKey: stableKey("orphan-page", context.page.id),
        projectId,
        issueType: "orphan_page",
        severity: context.page.status === "draft" ? "low" : "medium",
        relatedPageId: context.page.id,
        relatedClaimIds: [],
        title: `${context.page.title} is weakly connected to canon`,
        description:
          "The current heuristic found no page backlinks and no shared-source connections from the surrounding wiki graph, so this page is operating like an orphan knowledge object.",
        recommendedAction:
          "Link this page from overview or concept index, or connect it to related pages through shared source coverage.",
        metadata: {
          backlinkCount: String(backlinkCount),
          sharedSourceConnections: String(sharedSourceConnections),
        },
      });
    }
  }

  const sourceSummaryPages = pageContexts.filter(
    (context) => context.page.pageType === "source-summary",
  );

  if (sourceSummaryPages.length > 0) {
    for (const expectedPage of expectedTopLevelPages) {
      const exists = pageContexts.some(
        (context) => context.page.pageType === expectedPage.pageType,
      );

      if (!exists) {
        issues.push({
          stableKey: stableKey("missing-expected-page", expectedPage.pageType),
          projectId,
          issueType: "missing_expected_page",
          severity: expectedPage.pageType === "overview" ? "high" : "medium",
          relatedPageId: null,
          relatedClaimIds: [],
          title: `Missing expected page: ${expectedPage.title}`,
          description: `The compiled wiki already has source-summary pages but is missing the ${expectedPage.title} page expected at the top level of canon.`,
          recommendedAction:
            "Create a placeholder page now or recompile the project so the top-level canonical structure is restored.",
          metadata: {
            missingPageType: expectedPage.pageType,
            missingSlug: expectedPage.slug,
            missingTitle: expectedPage.title,
          },
        });
      }
    }
  }

  const duplicateCandidatePages = pageContexts.filter(
    (context) => context.page.pageType !== "source-summary",
  );

  for (let index = 0; index < duplicateCandidatePages.length; index += 1) {
    const left = duplicateCandidatePages[index];
    const leftTokens = tokenSet(left.page.title);

    for (let otherIndex = index + 1; otherIndex < duplicateCandidatePages.length; otherIndex += 1) {
      const right = duplicateCandidatePages[otherIndex];
      const rightTokens = tokenSet(right.page.title);
      const similarity = jaccardSimilarity(leftTokens, rightTokens);
      const sameNormalizedTitle =
        normalizeText(left.page.title) === normalizeText(right.page.title);

      if (!sameNormalizedTitle && similarity < 0.8) {
        continue;
      }

      issues.push({
        stableKey: stableKey("duplicate-concept", left.page.id, right.page.id),
        projectId,
        issueType: "duplicate_or_overlapping_concept",
        severity: "low",
        relatedPageId: left.page.id,
        relatedClaimIds: [],
        title: `Possible concept overlap: ${left.page.title} / ${right.page.title}`,
        description:
          "Title normalization suggests these pages may be overlapping concepts. This is a heuristic placeholder and should be reviewed manually before consolidation.",
        recommendedAction:
          "Review both pages for consolidation, clearer naming, or sharper scope boundaries.",
        metadata: {
          pairedPageId: right.page.id,
          pairedPageTitle: right.page.title,
          similarity: similarity.toFixed(2),
        },
      });
    }
  }

  return issues;
}

export async function getProjectLintSnapshot(
  projectId: string,
): Promise<ProjectLintSnapshot> {
  const drafts = await computeLintDrafts(projectId);
  const syncedIssues = await lintIssuesRepository.syncProjectIssues(projectId, drafts);
  const issues = sortIssues(syncedIssues);

  return {
    issues,
    health: buildHealthSummary(issues),
  };
}

export async function updateLintIssueStatus(
  issueId: string,
  status: LintIssueStatus,
): Promise<LintIssue | null> {
  return lintIssuesRepository.updateStatus(issueId, status);
}

export async function createMissingExpectedPagePlaceholder(input: {
  projectId: string;
  pageType: WikiPageType;
  slug: string;
  title: string;
}): Promise<WikiPage> {
  const page = await wikiRepository.upsertPageRevision({
    projectId: input.projectId,
    slug: input.slug,
    title: input.title,
    pageType: input.pageType,
    status: "draft",
    markdownContent: `# ${input.title}\nThis placeholder page was created by the knowledge linting workflow to restore expected canonical structure.`,
    summary: `${input.title} placeholder created from a lint action while richer compile coverage is still landing.`,
    changeNote: `Placeholder created for missing ${input.pageType} page`,
    confidence: "low",
    createdBy: "knowledge-linter",
    generationMetadata: {
      generatedBy: "knowledge-linter",
      pageRole: "placeholder-expected-page",
      placeholderForIssueType: "missing_expected_page",
    },
  });

  await wikiRepository.replacePageSourceLinks(page.id, []);
  return page;
}
