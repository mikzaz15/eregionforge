import {
  activeProjectId,
} from "@/lib/domain/seed-data";
import type {
  Artifact,
  Claim,
  ClaimSupportStatus,
  CompileJob,
  CompileJobStatus,
  EvidenceLink,
  LintIssue,
  Project,
  Source,
  SourceFragment,
  WikiPage,
  WikiPageRevision,
} from "@/lib/domain/types";
import { artifactsRepository } from "@/lib/repositories/artifacts-repository";
import { claimsRepository } from "@/lib/repositories/claims-repository";
import { compileJobsRepository } from "@/lib/repositories/compile-jobs-repository";
import { evidenceLinksRepository } from "@/lib/repositories/evidence-links-repository";
import { projectsRepository } from "@/lib/repositories/projects-repository";
import { sourceFragmentsRepository } from "@/lib/repositories/source-fragments-repository";
import { sourcesRepository } from "@/lib/repositories/sources-repository";
import { wikiRepository } from "@/lib/repositories/wiki-repository";
import {
  getProjectLintSnapshot,
  type ProjectLintHealthSummary,
} from "@/lib/services/lint-service";

export type ProjectSummary = {
  project: Project;
  sourceCount: number;
  wikiPageCount: number;
  artifactCount: number;
  generatedPageCount: number;
  sourceSummaryPageCount: number;
  supportedClaimsCount: number;
  unresolvedClaimsCount: number;
  evidenceLinkedPageCount: number;
  latestCompileStatus: CompileJobStatus;
  latestCompileLabel: string;
  latestCompileAt: string | null;
  latestCompileSummary: string;
  health: ProjectLintHealthSummary;
};

export type WikiPageSummary = {
  page: WikiPage;
  currentRevision: WikiPageRevision | null;
  revisionCount: number;
  sourceCount: number;
  claimCount: number;
  supportedClaimCount: number;
  unresolvedClaimCount: number;
  evidenceLinkCount: number;
  latestRevisionAt: string | null;
  isGenerated: boolean;
};

export type ProjectDetailData = {
  summary: ProjectSummary;
  sources: Source[];
  wikiPages: WikiPageSummary[];
  artifacts: Artifact[];
  latestCompile: CompileJob | null;
};

export type ProjectLintIssueRecord = {
  issue: LintIssue;
  relatedPage: WikiPage | null;
};

export type LintIssuesPageData = {
  summary: ProjectSummary;
  health: ProjectLintHealthSummary;
  issues: ProjectLintIssueRecord[];
  openIssueCount: number;
  resolvedIssueCount: number;
};

export type SourceRecordSummary = {
  source: Source;
  fragmentCount: number;
  previewFragments: SourceFragment[];
  excerpt: string | null;
};

export type LinkedSourceDetail = {
  source: Source;
  fragments: SourceFragment[];
  fragmentCount: number;
  excerpt: string | null;
};

export type PageClaimDetail = {
  claim: Claim;
  evidenceLinks: EvidenceLink[];
  linkedFragments: SourceFragment[];
};

export type WikiPageDetailData = {
  summary: ProjectSummary;
  page: WikiPage;
  currentRevision: WikiPageRevision | null;
  revisions: WikiPageRevision[];
  claims: PageClaimDetail[];
  linkedSources: LinkedSourceDetail[];
  linkedPagesFromSameSource: WikiPage[];
  supportSummary: {
    supported: number;
    weakSupport: number;
    unresolved: number;
    evidenceLinks: number;
  };
};

export type SettingsGroup = {
  eyebrow: string;
  title: string;
  description: string;
  items: Array<{ label: string; value: string }>;
};

export const executionLane = [
  {
    title: "Connect the domain layer to Supabase",
    detail:
      "Swap the in-memory repositories for Supabase-backed adapters without changing route components or shell composition.",
  },
  {
    title: "Persist project-scoped source creation",
    detail:
      "Make pasted text and markdown ingestion create real source records under a chosen project boundary.",
  },
  {
    title: "Compile canonical wiki pages from stored records",
    detail:
      "Generate page revisions and compile job state from persisted projects, sources, and page inputs.",
  },
  {
    title: "Add evidence links and ask orchestration",
    detail:
      "Only after canonical pages exist should ask mode traverse claims, evidence, and source fragments.",
  },
] as const;

export const retrievalPolicy = [
  {
    title: "Resolve against canonical pages first",
    detail:
      "Ask mode should begin with project wiki pages and revisions rather than raw source fragments.",
  },
  {
    title: "Drop to evidence only when canon is insufficient",
    detail:
      "Claims and source links should tighten confidence when a page summary is not enough.",
  },
  {
    title: "Promote strong answers into durable outputs",
    detail:
      "Useful answers should become artifacts that remain attached to the project.",
  },
] as const;

export const settingsGroups: SettingsGroup[] = [
  {
    eyebrow: "Persistence",
    title: "Repository boundary",
    description:
      "The route layer now speaks to repository and service seams instead of a single presentation mock file.",
    items: [
      {
        label: "Current adapter",
        value: "In-memory repositories with async method signatures that mirror future database reads.",
      },
      {
        label: "Next adapter",
        value: "Supabase-backed repository implementations should replace the in-memory adapters without changing UI code.",
      },
      {
        label: "Guiding rule",
        value: "Projects, sources, wiki pages, revisions, and artifacts remain the core durable objects.",
      },
    ],
  },
  {
    eyebrow: "Compilation",
    title: "Canonical workflow",
    description:
      "The workspace stays centered on compiled knowledge rather than generic chat interactions.",
    items: [
      {
        label: "Compiler input",
        value: "Source records and provenance live under a project boundary and feed page compilation.",
      },
      {
        label: "Compiler output",
        value: "Wiki page revisions and artifacts remain durable outputs that can be revisited or refreshed.",
      },
      {
        label: "Ask posture",
        value: "Question workflows should route through project canon before touching raw source text.",
      },
    ],
  },
  {
    eyebrow: "Service design",
    title: "Application seam",
    description:
      "A thin workspace service now aggregates repository data for the shell and route views.",
    items: [
      {
        label: "UI coupling",
        value: "Routes consume project-scoped view data and avoid direct dependence on seed arrays.",
      },
      {
        label: "Scope",
        value: "Top-level workspace pages operate on the active project while explicit project detail routes cover the wider portfolio.",
      },
      {
        label: "Sprint 3 fit",
        value: "The existing service layer is ready for real persistence and compile pipeline wiring.",
      },
    ],
  },
];

function cloneArray<T>(value: T[]): T[] {
  return structuredClone(value);
}

function sortByCreatedAtDesc<T extends { createdAt: string }>(items: T[]): T[] {
  return cloneArray(items).sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
}

function sortWikiPageSummariesByUpdatedAtDesc(
  items: WikiPageSummary[],
): WikiPageSummary[] {
  return cloneArray(items).sort((left, right) =>
    right.page.updatedAt.localeCompare(left.page.updatedAt),
  );
}

function formatShortDate(date: string | null): string {
  if (!date) {
    return "Not compiled yet";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

function formatDateTime(date: string | null): string {
  if (!date) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

function previewText(value: string | null, length = 180): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return null;
  }

  return normalized.length > length
    ? `${normalized.slice(0, length).trimEnd()}...`
    : normalized;
}

function countClaimStatus(
  claims: Claim[],
  target: ClaimSupportStatus,
): number {
  return claims.filter((claim) => claim.supportStatus === target).length;
}

async function buildSourceRecordSummary(source: Source): Promise<SourceRecordSummary> {
  const fragments = await sourceFragmentsRepository.listBySourceId(source.id);

  return {
    source,
    fragmentCount: fragments.length,
    previewFragments: fragments.slice(0, 4),
    excerpt:
      previewText(
        fragments.find((fragment) => fragment.fragmentType !== "heading")?.text ?? null,
      ) ??
      previewText(source.body),
  };
}

function countByStatus<T extends string>(
  statuses: T[],
  target: T,
): number {
  return statuses.filter((status) => status === target).length;
}

async function buildProjectSummary(project: Project): Promise<ProjectSummary> {
  const [
    sources,
    pages,
    artifacts,
    latestCompile,
    claims,
    evidenceLinks,
    lintSnapshot,
  ] =
    await Promise.all([
      sourcesRepository.listByProjectId(project.id),
      wikiRepository.listPagesByProjectId(project.id),
      artifactsRepository.listByProjectId(project.id),
      compileJobsRepository.getLatestByProjectId(project.id),
      claimsRepository.listByProjectId(project.id),
      evidenceLinksRepository.listByProjectId(project.id),
      getProjectLintSnapshot(project.id),
    ]);
  const generatedPageCount = pages.filter(
    (page) => page.generationMetadata?.generatedBy === "deterministic-compiler",
  ).length;
  const sourceSummaryPageCount = pages.filter(
    (page) => page.pageType === "source-summary",
  ).length;
  const evidenceClaimIds = new Set(evidenceLinks.map((link) => link.claimId));
  const evidenceLinkedPageCount = new Set(
    claims
      .filter((claim) => evidenceClaimIds.has(claim.id))
      .map((claim) => claim.wikiPageId),
  ).size;

  return {
    project,
    sourceCount: sources.length,
    wikiPageCount: pages.length,
    artifactCount: artifacts.length,
    generatedPageCount,
    sourceSummaryPageCount,
    supportedClaimsCount: countClaimStatus(claims, "supported"),
    unresolvedClaimsCount: countClaimStatus(claims, "unresolved"),
    evidenceLinkedPageCount,
    latestCompileStatus: latestCompile?.status ?? "pending",
    latestCompileLabel: formatShortDate(latestCompile?.completedAt ?? null),
    latestCompileAt: latestCompile?.completedAt ?? null,
    latestCompileSummary:
      latestCompile?.summary ?? "No compile job has been run against this project yet.",
    health: lintSnapshot.health,
  };
}

async function buildWikiPageSummaries(projectId: string): Promise<WikiPageSummary[]> {
  const pages = await wikiRepository.listPagesByProjectId(projectId);

  return Promise.all(
    pages.map(async (page) => {
      const [revisions, currentRevision, claims] = await Promise.all([
        wikiRepository.listRevisionsByPageId(page.id),
        wikiRepository.getCurrentRevision(page.id),
        claimsRepository.listByWikiPageId(page.id),
      ]);
      const sourceCount = (await wikiRepository.listSourceIdsForPage(page.id)).length;
      const evidenceLinks = (
        await Promise.all(
          claims.map((claim) => evidenceLinksRepository.listByClaimId(claim.id)),
        )
      ).flat();

      return {
        page,
        currentRevision,
        revisionCount: revisions.length,
        sourceCount,
        claimCount: claims.length,
        supportedClaimCount: countClaimStatus(claims, "supported"),
        unresolvedClaimCount: countClaimStatus(claims, "unresolved"),
        evidenceLinkCount: evidenceLinks.length,
        latestRevisionAt: currentRevision?.createdAt ?? null,
        isGenerated:
          page.generationMetadata?.generatedBy === "deterministic-compiler",
      };
    }),
  );
}

export async function getActiveProjectId(): Promise<string> {
  const repositoryValue = await projectsRepository.getActiveProjectId();
  return repositoryValue || activeProjectId;
}

export async function listProjectSummaries(): Promise<ProjectSummary[]> {
  const projects = await projectsRepository.list();
  return Promise.all(projects.map((project) => buildProjectSummary(project)));
}

export async function getProjectSummary(
  projectId: string,
): Promise<ProjectSummary | null> {
  const project = await projectsRepository.getById(projectId);
  return project ? buildProjectSummary(project) : null;
}

export async function getActiveProjectSummary(): Promise<ProjectSummary> {
  const projectId = await getActiveProjectId();
  const summary = await getProjectSummary(projectId);

  if (!summary) {
    throw new Error("Active project is missing from the repository.");
  }

  return summary;
}

export async function getShellData() {
  const [activeSummary, projectSummaries] = await Promise.all([
    getActiveProjectSummary(),
    listProjectSummaries(),
  ]);

  return {
    activeSummary,
    projectSummaries,
    statusNote:
      "The workspace shell now runs through project-scoped repositories, with deterministic claims and fragment-level evidence links ready for later Supabase-backed persistence.",
  };
}

export async function getProjectsPageData() {
  const summaries = await listProjectSummaries();

  return {
    summaries,
    metrics: [
      {
        label: "Projects",
        value: String(summaries.length),
        note: "Each project is a durable boundary for sources, wiki pages, compile state, and artifacts.",
      },
      {
        label: "Generated Pages",
        value: String(
          summaries.reduce((sum, project) => sum + project.generatedPageCount, 0),
        ),
        note: "Canonical pages are now measurable generated objects rather than seeded display rows.",
      },
      {
        label: "Supported Claims",
        value: String(
          summaries.reduce((sum, project) => sum + project.supportedClaimsCount, 0),
        ),
        note: "Trust metrics now begin at the project level through deterministic claims linked back to source fragments.",
      },
      {
        label: "Open Lint Issues",
        value: String(
          summaries.reduce((sum, project) => sum + project.health.totalIssues, 0),
        ),
        note: "Knowledge linting now surfaces weak trust zones across compiled canon instead of leaving them implicit.",
      },
    ],
  };
}

export async function getProjectDetailData(
  projectId: string,
): Promise<ProjectDetailData | null> {
  const summary = await getProjectSummary(projectId);

  if (!summary) {
    return null;
  }

  const [sources, wikiPages, artifacts] = await Promise.all([
    sourcesRepository.listByProjectId(projectId),
    buildWikiPageSummaries(projectId),
    artifactsRepository.listByProjectId(projectId),
  ]);
  const latestCompile = await compileJobsRepository.getLatestByProjectId(projectId);

  return {
    summary,
    sources: sortByCreatedAtDesc(sources),
    wikiPages: sortWikiPageSummariesByUpdatedAtDesc(wikiPages),
    artifacts: sortByCreatedAtDesc(artifacts),
    latestCompile,
  };
}

export async function getSourcesPageData(projectId: string) {
  const [summary, sources] = await Promise.all([
    getProjectSummary(projectId),
    sourcesRepository.listByProjectId(projectId),
  ]);

  if (!summary) {
    return null;
  }

  const sourceStatuses = sources.map((source) => source.status);
  const sourceRecords = await Promise.all(
    sortByCreatedAtDesc(sources).map((source) => buildSourceRecordSummary(source)),
  );
  const fragmentCount = sourceRecords.reduce(
    (sum, record) => sum + record.fragmentCount,
    0,
  );

  return {
    summary,
    sources: sourceRecords,
    metrics: [
      {
        label: "Source Records",
        value: String(sources.length),
        note: "These records belong to the active project and already align with the source schema boundary.",
      },
      {
        label: "Fragments",
        value: String(fragmentCount),
        note: "Fragments are now first-class source units and prepare the corpus for later claim and evidence linking.",
      },
      {
        label: "Compiled",
        value: String(
          countByStatus(sourceStatuses, "compiled"),
        ),
        note: "Compiled sources have already informed the current canonical wiki state.",
      },
    ],
    lifecycle: [
      { label: "Pending", value: countByStatus(sourceStatuses, "pending") },
      { label: "Parsed", value: countByStatus(sourceStatuses, "parsed") },
      { label: "Extracted", value: countByStatus(sourceStatuses, "extracted") },
      { label: "Compiled", value: countByStatus(sourceStatuses, "compiled") },
      { label: "Failed", value: countByStatus(sourceStatuses, "failed") },
    ] as Array<{ label: string; value: number }>,
  };
}

export async function getWikiPageData(projectId: string) {
  const summary = await getProjectSummary(projectId);

  if (!summary) {
    return null;
  }

  const [pages, latestCompile, sources] = await Promise.all([
    buildWikiPageSummaries(projectId),
    compileJobsRepository.getLatestByProjectId(projectId),
    sourcesRepository.listByProjectId(projectId),
  ]);
  const revisions = pages
    .map((page) => page.currentRevision)
    .filter((revision): revision is WikiPageRevision => Boolean(revision))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return {
    summary,
    pages: pages.sort((left, right) =>
      right.page.updatedAt.localeCompare(left.page.updatedAt),
    ),
    recentRevisions: revisions.slice(0, 4),
    metrics: [
      {
        label: "Generated Pages",
        value: String(pages.filter((page) => page.isGenerated).length),
        note: "These pages were generated or refreshed by the deterministic compiler rather than carried forward as seeded placeholders.",
      },
      {
        label: "Supported Claims",
        value: String(
          pages.reduce((sum, page) => sum + page.supportedClaimCount, 0),
        ),
        note: "Supported claims now express first-pass traceable knowledge over the compiled wiki.",
      },
      {
        label: "Unresolved Claims",
        value: String(
          pages.reduce((sum, page) => sum + page.unresolvedClaimCount, 0),
        ),
        note: "Unresolved claims expose areas where canon is still weak, sparse, or structurally incomplete.",
      },
      {
        label: "Latest Compile",
        value: latestCompile?.status ?? "pending",
        note:
          latestCompile?.summary ??
          "The current canon is still in seeded mode and has not been compiled in this session.",
      },
    ],
    latestCompile,
    compilerNote: latestCompile
      ? "Current canon reflects the deterministic compiler with first-pass claims, fragment-level evidence links, and project-scoped linting signals."
      : "Current canon is still seeded from project setup data and has not yet been refreshed from active project sources.",
    compiledSourceCount: sources.filter((source) => source.status === "compiled").length,
    latestCompileAtLabel: formatDateTime(latestCompile?.completedAt ?? null),
  };
}

export async function getArtifactsPageData(projectId: string) {
  const [summary, artifacts] = await Promise.all([
    getProjectSummary(projectId),
    artifactsRepository.listByProjectId(projectId),
  ]);

  if (!summary) {
    return null;
  }

  const artifactStatuses = artifacts.map((artifact) => artifact.status);

  return {
    summary,
    artifacts: sortByCreatedAtDesc(artifacts),
    metrics: [
      {
        label: "Artifacts",
        value: String(artifacts.length),
        note: "Artifacts remain durable outputs attached to a project boundary and derived from canonical research objects.",
      },
      {
        label: "Active",
        value: String(countByStatus(artifactStatuses, "active")),
        note: "Active artifacts are reusable deliverables that should compound over time.",
      },
      {
        label: "Drafts",
        value: String(countByStatus(artifactStatuses, "draft")),
        note: "Draft outputs are still attached to the project and ready for further compilation or review.",
      },
    ],
  };
}

export async function getAskPageData(projectId: string) {
  const [summary, wikiData, artifactsData] = await Promise.all([
    getProjectSummary(projectId),
    getWikiPageData(projectId),
    getArtifactsPageData(projectId),
  ]);

  if (!summary || !wikiData || !artifactsData) {
    return null;
  }

  return {
    summary,
    wikiPages: wikiData.pages.slice(0, 4),
    artifacts: artifactsData.artifacts.slice(0, 3),
    metrics: [
      {
        label: "Ask Mode",
        value: "Project scoped",
        note: "Question flows now anchor to an explicit project boundary and can resolve against its canonical wiki.",
      },
      {
        label: "Wiki Coverage",
        value: String(wikiData.pages.length),
        note: "These canonical pages form the primary retrieval surface before raw evidence is consulted.",
      },
      {
        label: "Artifact Targets",
        value: String(artifactsData.artifacts.length),
        note: "Strong answers should become durable outputs inside the same project workspace.",
      },
    ],
  };
}

export async function getSettingsPageData(projectId: string) {
  const summary = await getProjectSummary(projectId);
  const latestCompile = await compileJobsRepository.getLatestByProjectId(projectId);
  return summary
    ? {
        summary,
        metrics: [
          {
            label: "Storage Plan",
            value: "Supabase",
            note: "The repository layer is structured so Postgres-backed adapters can replace in-memory data without a route refactor.",
          },
          {
            label: "Repository Mode",
            value: "In memory",
            note: "Async interfaces already match the shape of future persistence-backed reads.",
          },
          {
            label: "Domain Center",
            value: "Compiled wiki",
            note: "The canonical page and revision model remains the center of the system.",
          },
          {
            label: "Compile Jobs",
            value: latestCompile?.status ?? "pending",
            note: "Compile jobs are now a first-class repository seam and can later map directly onto persisted job records.",
          },
        ],
      }
    : null;
}

export async function getWikiPageDetailData(
  projectId: string,
  pageId: string,
): Promise<WikiPageDetailData | null> {
  const summary = await getProjectSummary(projectId);
  const page = await wikiRepository.getPageById(pageId);

  if (!summary || !page || page.projectId !== projectId) {
    return null;
  }

  const [revisions, currentRevision, sourceIds, claims] = await Promise.all([
    wikiRepository.listRevisionsByPageId(pageId),
    wikiRepository.getCurrentRevision(pageId),
    wikiRepository.listSourceIdsForPage(pageId),
    claimsRepository.listByWikiPageId(pageId),
  ]);

  const linkedSources = (
    await Promise.all(
      sourceIds.map(async (sourceId) => {
        const source = await sourcesRepository.getById(sourceId);

        if (!source) {
          return null;
        }

        const fragments = await sourceFragmentsRepository.listBySourceId(sourceId);

        return {
          source,
          fragments,
          fragmentCount: fragments.length,
          excerpt:
            previewText(
              fragments.find((fragment) => fragment.fragmentType !== "heading")?.text ??
                null,
            ) ?? previewText(source.body),
        };
      }),
    )
  ).filter((source): source is LinkedSourceDetail => Boolean(source));

  const linkedPagesFromSameSource = page.sourceId
    ? await wikiRepository.listPagesBySourceId(projectId, page.sourceId)
    : [];
  const claimDetails = await Promise.all(
    claims.map(async (claim) => {
      const evidenceLinks = await evidenceLinksRepository.listByClaimId(claim.id);
      const linkedFragments = (
        await Promise.all(
          evidenceLinks.map(async (link) => {
            const fragments = await sourceFragmentsRepository.listBySourceId(link.sourceId);
            return (
              fragments.find((fragment) => fragment.id === link.sourceFragmentId) ?? null
            );
          }),
        )
      ).filter((fragment): fragment is SourceFragment => Boolean(fragment));

      return {
        claim,
        evidenceLinks,
        linkedFragments,
      };
    }),
  );

  return {
    summary,
    page,
    currentRevision,
    revisions: revisions.sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    ),
    claims: claimDetails,
    linkedSources,
    linkedPagesFromSameSource,
    supportSummary: {
      supported: countClaimStatus(claims, "supported"),
      weakSupport: countClaimStatus(claims, "weak-support"),
      unresolved: countClaimStatus(claims, "unresolved"),
      evidenceLinks: claimDetails.reduce(
        (sum, claimDetail) => sum + claimDetail.evidenceLinks.length,
        0,
      ),
    },
  };
}

export async function getLintIssuesPageData(
  projectId: string,
): Promise<LintIssuesPageData | null> {
  const summary = await getProjectSummary(projectId);

  if (!summary) {
    return null;
  }

  const [lintSnapshot, pages] = await Promise.all([
    getProjectLintSnapshot(projectId),
    wikiRepository.listPagesByProjectId(projectId),
  ]);
  const pagesById = new Map(pages.map((page) => [page.id, page] as const));

  return {
    summary,
    health: lintSnapshot.health,
    issues: lintSnapshot.issues.map((issue) => ({
      issue,
      relatedPage: issue.relatedPageId
        ? pagesById.get(issue.relatedPageId) ?? null
        : null,
    })),
    openIssueCount: lintSnapshot.issues.filter((issue) => issue.status === "open").length,
    resolvedIssueCount: lintSnapshot.issues.filter(
      (issue) => issue.status !== "open",
    ).length,
  };
}
