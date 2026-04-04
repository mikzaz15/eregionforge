import { cache } from "react";
import {
  activeProjectId,
} from "@/lib/domain/seed-data";
import type {
  Artifact,
  ArtifactType,
  AskAnswerMode,
  AskSession,
  Claim,
  ClaimSupportStatus,
  CompanyDossier,
  CompileJob,
  CompileJobStatus,
  EvidenceLink,
  LintIssue,
  Project,
  Thesis,
  Source,
  SourceFragment,
  WikiPage,
  WikiPageRevision,
} from "@/lib/domain/types";
import { askSessionsRepository } from "@/lib/repositories/ask-sessions-repository";
import { claimsRepository } from "@/lib/repositories/claims-repository";
import { compileJobsRepository } from "@/lib/repositories/compile-jobs-repository";
import { evidenceLinksRepository } from "@/lib/repositories/evidence-links-repository";
import { projectsRepository } from "@/lib/repositories/projects-repository";
import { sourceFragmentsRepository } from "@/lib/repositories/source-fragments-repository";
import { sourcesRepository } from "@/lib/repositories/sources-repository";
import { wikiRepository } from "@/lib/repositories/wiki-repository";
import {
  artifactTypeOptions,
  getArtifactDetail,
  listProjectArtifacts,
  type ArtifactDetailRecord,
  type ArtifactSummaryRecord,
  type ArtifactTypeOption,
} from "@/lib/services/artifact-service";
import {
  getProjectCatalystPageData,
  listProjectCatalysts,
  type CatalystReferenceRecord,
} from "@/lib/services/catalyst-service";
import {
  getProjectCompanyDossierDetail,
  getStoredProjectCompanyDossier,
  type CompanyDossierDetailRecord,
} from "@/lib/services/company-dossier-service";
import {
  getProjectLintSnapshot,
  type ProjectLintHealthSummary,
} from "@/lib/services/lint-service";
import {
  getProjectContradictionSnapshot,
  getProjectContradictionsPageData,
  listProjectContradictions,
  type ContradictionReferenceRecord,
  type ProjectContradictionSummary,
} from "@/lib/services/contradiction-service";
import {
  getProjectTimelinePageData,
  listProjectTimelineEvents,
  type TimelineReferenceRecord,
} from "@/lib/services/timeline-service";
import {
  getProjectThesisDetail,
  type ThesisDetailRecord,
  getProjectThesisSnapshot,
} from "@/lib/services/thesis-service";

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
  timelineEventCount: number;
  contradictionCount: number;
  highSeverityContradictionCount: number;
  unresolvedContradictionCount: number;
  thesisStatus: Thesis["status"] | null;
  thesisStance: Thesis["overallStance"] | null;
  thesisConfidence: Thesis["confidence"] | null;
  thesisCatalystCount: number;
  thesisRevisionNumber: number;
  thesisLastRefreshedAt: string | null;
  thesisPotentiallyStale: boolean;
  thesisFreshnessReason: string;
  dossierCompanyName: string | null;
  dossierConfidence: CompanyDossier["confidence"] | null;
  dossierSectionCoverageLabel: string;
  dossierReady: boolean;
  catalystCount: number;
  upcomingCatalystCount: number;
  resolvedCatalystCount: number;
  highImportanceCatalystCount: number;
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
  artifacts: ArtifactSummaryRecord[];
  artifactTypeMix: Array<{ artifactType: ArtifactType; count: number }>;
  timelineEvents: TimelineReferenceRecord[];
  contradictions: ContradictionReferenceRecord[];
  catalysts: CatalystReferenceRecord[];
  thesis: ThesisDetailRecord | null;
  dossier: CompanyDossierDetailRecord | null;
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

export type ContradictionsPageData = {
  summary: ProjectSummary;
  contradictionSummary: ProjectContradictionSummary;
  contradictions: ContradictionReferenceRecord[];
  analysisState: {
    projectId: string;
    lastAnalyzedAt: string | null;
    contradictionCount: number;
    summary: string;
  };
  metrics: Array<{ label: string; value: string; note: string }>;
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

export type AskModeOption = {
  value: AskAnswerMode;
  label: string;
  description: string;
};

export type AskSessionSummary = {
  session: AskSession;
  consultedWikiPageCount: number;
  consultedClaimCount: number;
  consultedSourceCount: number;
};

export type AskConsultedClaim = {
  claim: Claim;
  page: WikiPage | null;
};

export type AskSessionDetail = {
  session: AskSession;
  consultedPages: WikiPageSummary[];
  consultedClaims: AskConsultedClaim[];
  consultedSources: LinkedSourceDetail[];
};

export type AskPageData = {
  summary: ProjectSummary;
  metrics: Array<{ label: string; value: string; note: string }>;
  currentSession: AskSessionDetail | null;
  recentSessions: AskSessionSummary[];
  answerModes: AskModeOption[];
  artifactTypes: ArtifactTypeOption[];
  artifacts: ArtifactSummaryRecord[];
  savedArtifact: Artifact | null;
};

export type ArtifactsPageData = {
  summary: ProjectSummary;
  artifacts: ArtifactSummaryRecord[];
  metrics: Array<{ label: string; value: string; note: string }>;
  artifactTypes: ArtifactTypeOption[];
  activeFilter: ArtifactType | "all";
};

export type ArtifactDetailPageData = {
  summary: ProjectSummary;
  artifact: ArtifactDetailRecord;
};

export type TimelinePageData = {
  summary: ProjectSummary;
  events: TimelineReferenceRecord[];
  compileState: {
    projectId: string;
    lastCompiledAt: string | null;
    eventCount: number;
    summary: string;
  };
  metrics: Array<{ label: string; value: string; note: string }>;
};

export type ThesisPageData = {
  summary: ProjectSummary;
  thesis: ThesisDetailRecord | null;
  selectedRevisionId: string | null;
  metrics: Array<{ label: string; value: string; note: string }>;
};

export type DossierPageData = {
  summary: ProjectSummary;
  dossier: CompanyDossierDetailRecord | null;
  metrics: Array<{ label: string; value: string; note: string }>;
};

export type CatalystsPageData = {
  summary: ProjectSummary;
  catalysts: CatalystReferenceRecord[];
  compileState: {
    projectId: string;
    lastCompiledAt: string | null;
    catalystCount: number;
    summary: string;
  };
  metrics: Array<{ label: string; value: string; note: string }>;
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

export const askAnswerModes: AskModeOption[] = [
  {
    value: "concise-answer",
    label: "Concise Answer",
    description: "Direct answer with canonical basis and current evidence posture.",
  },
  {
    value: "research-memo",
    label: "Research Memo",
    description: "Longer structured synthesis for decision support and handoff.",
  },
  {
    value: "compare-viewpoints",
    label: "Compare Viewpoints",
    description: "Contrast relevant canonical objects and source perspectives.",
  },
  {
    value: "identify-contradictions",
    label: "Identify Contradictions",
    description: "Surface tension signals across canon, claims, and source state.",
  },
  {
    value: "follow-up-questions",
    label: "Follow-Up Questions",
    description: "Generate the next research questions from current gaps and weak support.",
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

async function buildLinkedSourceDetail(sourceId: string): Promise<LinkedSourceDetail | null> {
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
        fragments.find((fragment) => fragment.fragmentType !== "heading")?.text ?? null,
      ) ?? previewText(source.body),
  };
}

function countByStatus<T extends string>(
  statuses: T[],
  target: T,
): number {
  return statuses.filter((status) => status === target).length;
}

function buildArtifactTypeMix(
  artifacts: ArtifactSummaryRecord[],
): Array<{ artifactType: ArtifactType; count: number }> {
  const counts = new Map<ArtifactType, number>();

  for (const entry of artifacts) {
    counts.set(
      entry.artifact.artifactType,
      (counts.get(entry.artifact.artifactType) ?? 0) + 1,
    );
  }

  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([artifactType, count]) => ({ artifactType, count }));
}

const buildProjectSummary = cache(async function buildProjectSummary(
  projectId: string,
): Promise<ProjectSummary | null> {
  const project = await projectsRepository.getById(projectId);

  if (!project) {
    return null;
  }

  const [
    sources,
    pages,
    artifacts,
    latestCompile,
    claims,
    evidenceLinks,
    timelineEvents,
    lintSnapshot,
    contradictionSnapshot,
    thesisSnapshot,
    dossier,
    catalystPageData,
  ] =
    await Promise.all([
      sourcesRepository.listByProjectId(project.id),
      wikiRepository.listPagesByProjectId(project.id),
      listProjectArtifacts({ projectId: project.id }),
      compileJobsRepository.getLatestByProjectId(project.id),
      claimsRepository.listByProjectId(project.id),
      evidenceLinksRepository.listByProjectId(project.id),
      listProjectTimelineEvents(project.id),
      getProjectLintSnapshot(project.id),
      getProjectContradictionSnapshot(project.id),
      getProjectThesisSnapshot(project.id),
      getStoredProjectCompanyDossier(project.id),
      getProjectCatalystPageData(project.id),
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

  const thesis = thesisSnapshot.thesis;

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
    timelineEventCount: timelineEvents.length,
    contradictionCount: contradictionSnapshot.summary.totalContradictions,
    highSeverityContradictionCount:
      contradictionSnapshot.summary.highSeverityContradictions,
    unresolvedContradictionCount:
      contradictionSnapshot.summary.unresolvedContradictions,
    thesisStatus: thesis
      ? thesisSnapshot.freshness.potentiallyStale
        ? "stale"
        : thesis.status
      : null,
    thesisStance: thesis?.overallStance ?? null,
    thesisConfidence: thesis?.confidence ?? null,
    thesisCatalystCount: Number(thesis?.metadata?.catalystCount ?? "0"),
    thesisRevisionNumber: thesisSnapshot.revisionCount,
    thesisLastRefreshedAt: thesisSnapshot.freshness.lastRefreshedAt,
    thesisPotentiallyStale: thesisSnapshot.freshness.potentiallyStale,
    thesisFreshnessReason: thesisSnapshot.freshness.reason,
    dossierCompanyName: dossier?.companyName ?? null,
    dossierConfidence: dossier?.confidence ?? null,
    dossierSectionCoverageLabel:
      dossier?.metadata?.sectionCoverageLabel ?? "0/6 sections supported",
    dossierReady: Number(dossier?.metadata?.coveredSections ?? "0") >= 4,
    catalystCount: catalystPageData.summary.totalCatalysts,
    upcomingCatalystCount: catalystPageData.summary.upcomingCatalysts,
    resolvedCatalystCount: catalystPageData.summary.resolvedCatalysts,
    highImportanceCatalystCount: catalystPageData.summary.highImportanceCatalysts,
    health: lintSnapshot.health,
  };
});

const buildWikiPageSummaries = cache(async function buildWikiPageSummaries(
  projectId: string,
): Promise<WikiPageSummary[]> {
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
});

export async function getActiveProjectId(): Promise<string> {
  const repositoryValue = await projectsRepository.getActiveProjectId();
  return repositoryValue || activeProjectId;
}

export const listProjectSummaries = cache(async function listProjectSummaries(): Promise<
  ProjectSummary[]
> {
  const projects = await projectsRepository.list();
  const summaries = await Promise.all(
    projects.map((project) => buildProjectSummary(project.id)),
  );
  return summaries.filter((summary): summary is ProjectSummary => Boolean(summary));
});

export const getProjectSummary = cache(async function getProjectSummary(
  projectId: string,
): Promise<ProjectSummary | null> {
  return buildProjectSummary(projectId);
});

export const getActiveProjectSummary = cache(async function getActiveProjectSummary(): Promise<
  ProjectSummary
> {
  const projectId = await getActiveProjectId();
  const summary = await getProjectSummary(projectId);

  if (!summary) {
    throw new Error("Active project is missing from the repository.");
  }

  return summary;
});

export const getShellData = cache(async function getShellData() {
  const [projectSummaries, activeProjectId] = await Promise.all([
    listProjectSummaries(),
    getActiveProjectId(),
  ]);
  const activeSummary =
    projectSummaries.find((summary) => summary.project.id === activeProjectId) ?? null;

  if (!activeSummary) {
    throw new Error("Active project is missing from the repository.");
  }

  return {
    activeSummary,
    projectSummaries,
    statusNote:
      "The workspace shell now runs through project-scoped repositories, with deterministic claims and fragment-level evidence links ready for later Supabase-backed persistence.",
  };
});

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

  const [sources, wikiPages, artifacts, timelineEvents, contradictions, catalysts, thesis, dossier] = await Promise.all([
    sourcesRepository.listByProjectId(projectId),
    buildWikiPageSummaries(projectId),
    listProjectArtifacts({ projectId }),
    listProjectTimelineEvents(projectId),
    listProjectContradictions(projectId),
    listProjectCatalysts(projectId),
    getProjectThesisDetail(projectId),
    getProjectCompanyDossierDetail(projectId),
  ]);
  const latestCompile = await compileJobsRepository.getLatestByProjectId(projectId);

  return {
    summary,
    sources: sortByCreatedAtDesc(sources),
    wikiPages: sortWikiPageSummariesByUpdatedAtDesc(wikiPages),
    artifacts,
    artifactTypeMix: buildArtifactTypeMix(artifacts),
    timelineEvents,
    contradictions,
    catalysts,
    thesis,
    dossier,
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

export async function getArtifactsPageData(
  projectId: string,
  artifactType?: ArtifactType | "all",
): Promise<ArtifactsPageData | null> {
  const activeFilter = artifactType && artifactType !== "all" ? artifactType : "all";
  const [summary, artifacts] = await Promise.all([
    getProjectSummary(projectId),
    listProjectArtifacts({
      projectId,
      artifactType: activeFilter === "all" ? null : activeFilter,
    }),
  ]);

  if (!summary) {
    return null;
  }

  const artifactStatuses = artifacts.map((entry) => entry.artifact.status);

  return {
    summary,
    artifacts,
    artifactTypes: [...artifactTypeOptions],
    activeFilter,
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
      {
        label: "Wiki Filing",
        value: String(
          artifacts.filter((entry) => entry.artifact.eligibleForWikiFiling).length,
        ),
        note: "This is only groundwork for future filing into wiki pages or source inputs.",
      },
    ],
  };
}

export async function getAskPageData(projectId: string) {
  const [summary, wikiData, artifactsData, askSessions] = await Promise.all([
    getProjectSummary(projectId),
    getWikiPageData(projectId),
    getArtifactsPageData(projectId),
    askSessionsRepository.listByProjectId(projectId),
  ]);

  if (!summary || !wikiData || !artifactsData) {
    return null;
  }

  return {
    summary,
    currentSession: null,
    recentSessions: askSessions.slice(0, 4).map((session) => ({
      session,
      consultedWikiPageCount: session.consultedWikiPageIds.length,
      consultedClaimCount: session.consultedClaimIds.length,
      consultedSourceCount: session.consultedSourceIds.length,
    })),
    answerModes: [...askAnswerModes],
    artifactTypes: [...artifactTypeOptions],
    artifacts: artifactsData.artifacts.slice(0, 4),
    savedArtifact: null,
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
      {
        label: "Ask Sessions",
        value: String(askSessions.length),
        note: "Ask sessions become project memory only after the query is resolved against canonical knowledge.",
      },
    ],
  };
}

export async function getAskPageDataWithSession(
  projectId: string,
  sessionId?: string | null,
  savedArtifactId?: string | null,
): Promise<AskPageData | null> {
  const baseData = await getAskPageData(projectId);

  if (!baseData) {
    return null;
  }

  const [wikiPages, claims, savedArtifactDetail] = await Promise.all([
    buildWikiPageSummaries(projectId),
    claimsRepository.listByProjectId(projectId),
    savedArtifactId ? getArtifactDetail(savedArtifactId) : Promise.resolve(null),
  ]);

  const pagesById = new Map(wikiPages.map((page) => [page.page.id, page] as const));
  const rawPagesById = new Map(wikiPages.map((page) => [page.page.id, page.page] as const));
  const claimsById = new Map(claims.map((claim) => [claim.id, claim] as const));
  const sessions = await askSessionsRepository.listByProjectId(projectId);
  const currentSessionRecord = sessionId
    ? sessions.find((session) => session.id === sessionId) ?? null
    : sessions[0] ?? null;

  let currentSession: AskSessionDetail | null = null;

  if (currentSessionRecord) {
    const consultedSources = (
      await Promise.all(
        currentSessionRecord.consultedSourceIds.map((sourceId) =>
          buildLinkedSourceDetail(sourceId),
        ),
      )
    ).filter((source): source is LinkedSourceDetail => Boolean(source));

    currentSession = {
      session: currentSessionRecord,
      consultedPages: currentSessionRecord.consultedWikiPageIds
        .map((pageId) => pagesById.get(pageId) ?? null)
        .filter((page): page is WikiPageSummary => Boolean(page)),
      consultedClaims: currentSessionRecord.consultedClaimIds
        .map((claimId) => {
          const claim = claimsById.get(claimId);
          return claim
            ? {
                claim,
                page: rawPagesById.get(claim.wikiPageId) ?? null,
              }
            : null;
        })
        .filter((claim): claim is AskConsultedClaim => Boolean(claim)),
      consultedSources,
    };
  }

  return {
    ...baseData,
    currentSession,
    recentSessions: sessions.slice(0, 6).map((session) => ({
      session,
      consultedWikiPageCount: session.consultedWikiPageIds.length,
      consultedClaimCount: session.consultedClaimIds.length,
      consultedSourceCount: session.consultedSourceIds.length,
    })),
    savedArtifact:
      savedArtifactDetail?.artifact.projectId === projectId
        ? savedArtifactDetail.artifact
        : null,
  };
}

export async function getArtifactDetailPageData(
  projectId: string,
  artifactId: string,
): Promise<ArtifactDetailPageData | null> {
  const [summary, artifact] = await Promise.all([
    getProjectSummary(projectId),
    getArtifactDetail(artifactId),
  ]);

  if (!summary || !artifact || artifact.artifact.projectId !== projectId) {
    return null;
  }

  return {
    summary,
    artifact,
  };
}

export async function getTimelinePageData(
  projectId: string,
): Promise<TimelinePageData | null> {
  const summary = await getProjectSummary(projectId);

  if (!summary) {
    return null;
  }

  const timelineData = await getProjectTimelinePageData(projectId);

  return {
    summary,
    events: timelineData.events,
    compileState: timelineData.compileState,
    metrics: timelineData.metrics,
  };
}

export async function getContradictionsPageData(
  projectId: string,
): Promise<ContradictionsPageData | null> {
  const summary = await getProjectSummary(projectId);

  if (!summary) {
    return null;
  }

  const contradictionData = await getProjectContradictionsPageData(projectId);

  return {
    summary,
    contradictionSummary: {
      totalContradictions: summary.contradictionCount,
      highSeverityContradictions: summary.highSeverityContradictionCount,
      unresolvedContradictions: summary.unresolvedContradictionCount,
    },
    contradictions: contradictionData.contradictions,
    analysisState: contradictionData.analysisState,
    metrics: contradictionData.metrics,
  };
}

export async function getThesisPageData(
  projectId: string,
  selectedRevisionId?: string | null,
): Promise<ThesisPageData | null> {
  const [summary, thesisDetail] = await Promise.all([
    getProjectSummary(projectId),
    getProjectThesisDetail(projectId, selectedRevisionId),
  ]);

  if (!summary) {
    return null;
  }

  return {
    summary,
    thesis: thesisDetail,
    selectedRevisionId: selectedRevisionId ?? null,
    metrics: [
      {
        label: "Thesis Status",
        value: summary.thesisStatus ?? "Not compiled",
        note: "The thesis is a compiled project view, not a manually typed note.",
      },
      {
        label: "Stance",
        value: summary.thesisStance ?? "Not set",
        note: "Overall stance is derived from current canon, contradictions, timeline state, and supporting research outputs.",
      },
      {
        label: "Confidence",
        value: summary.thesisConfidence ?? "Not set",
        note: "Confidence reflects the current density and consistency of compiled supporting knowledge.",
      },
      {
        label: "Catalysts",
        value: String(summary.thesisCatalystCount),
        note: "Catalysts are currently sourced from compiled timeline events and related knowledge objects.",
      },
      {
        label: "Revision",
        value: summary.thesisRevisionNumber > 0 ? `R${summary.thesisRevisionNumber}` : "None",
        note: "Each thesis refresh creates a durable revision instead of overwriting the prior thesis state.",
      },
      {
        label: "Freshness",
        value: summary.thesisPotentiallyStale ? "Attention" : "Current",
        note: summary.thesisFreshnessReason,
      },
    ],
  };
}

export async function getDossierPageData(
  projectId: string,
): Promise<DossierPageData | null> {
  const [summary, dossier] = await Promise.all([
    getProjectSummary(projectId),
    getProjectCompanyDossierDetail(projectId),
  ]);

  if (!summary) {
    return null;
  }

  return {
    summary,
    dossier,
    metrics: [
      {
        label: "Company",
        value: summary.dossierCompanyName ?? "Not compiled",
        note: "The dossier compiles company identity and research posture from canon rather than acting like a market data profile.",
      },
      {
        label: "Confidence",
        value: summary.dossierConfidence ?? "Not set",
        note: "Confidence reflects the breadth and consistency of current dossier-supporting knowledge objects.",
      },
      {
        label: "Coverage",
        value: summary.dossierSectionCoverageLabel,
        note: "Section coverage is a practical readiness signal for how complete the current dossier is.",
      },
      {
        label: "Readiness",
        value: summary.dossierReady ? "Research-ready" : "In progress",
        note: "Readiness stays tied to compiled section coverage rather than a generic completeness flag.",
      },
    ],
  };
}

export async function getCatalystsPageData(
  projectId: string,
): Promise<CatalystsPageData | null> {
  const summary = await getProjectSummary(projectId);

  if (!summary) {
    return null;
  }

  const catalystData = await getProjectCatalystPageData(projectId);

  return {
    summary,
    catalysts: catalystData.catalysts,
    compileState: catalystData.compileState,
    metrics: catalystData.metrics,
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
