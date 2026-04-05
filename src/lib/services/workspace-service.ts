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
  OperationalAuditEvent,
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
import { contradictionsRepository } from "@/lib/repositories/contradictions-repository";
import { evidenceLinksRepository } from "@/lib/repositories/evidence-links-repository";
import { operationalAuditEventsRepository } from "@/lib/repositories/operational-audit-events-repository";
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
  getProjectEntitiesPageData as buildProjectEntitiesPageData,
  getProjectEntitySnapshot,
  type EntityReferenceRecord,
} from "@/lib/services/entity-intelligence-service";
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
  getProjectMonitoringPageData as buildProjectMonitoringPageData,
  getProjectMonitoringSnapshot,
  type ProjectMonitoringSnapshot,
  type SourceMonitoringRecordDetail,
  type StaleAlertReferenceRecord,
} from "@/lib/services/source-monitoring-service";
import {
  getProjectThesisDetail,
  type ThesisDetailRecord,
  getProjectThesisSnapshot,
} from "@/lib/services/thesis-service";
import type { ConfidenceFactor } from "@/lib/services/confidence-model-v2";
import {
  buildConfidenceAssessment,
} from "@/lib/services/confidence-model-v2";
import {
  buildEvidenceLineageLookup,
  collectEvidenceHighlights,
  type EvidenceHighlight,
} from "@/lib/services/evidence-lineage-v3";

export type ProjectSummary = {
  project: Project;
  sourceCount: number;
  wikiPageCount: number;
  entityCount: number;
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
  reviewedContradictionCount: number;
  thesisStatus: Thesis["status"] | null;
  thesisStance: Thesis["overallStance"] | null;
  thesisConfidence: Thesis["confidence"] | null;
  thesisConfidenceSummary: string | null;
  thesisPostureSummary: string | null;
  thesisMajorTensionSummary: string | null;
  thesisRecentChangeSummary: string | null;
  thesisBestNextAction: string | null;
  thesisCatalystCount: number;
  thesisRevisionNumber: number;
  thesisLastRefreshedAt: string | null;
  thesisPotentiallyStale: boolean;
  thesisFreshnessReason: string;
  freshnessAlertCount: number;
  acknowledgedFreshnessAlertCount: number;
  dismissedFreshnessAlertCount: number;
  freshnessAlertNoteCount: number;
  highSeverityFreshnessAlertCount: number;
  sourcesNeedingReviewCount: number;
  monitoringLastEvaluatedAt: string | null;
  dossierCompanyName: string | null;
  dossierConfidence: CompanyDossier["confidence"] | null;
  dossierConfidenceSummary: string | null;
  dossierSectionCoverageLabel: string;
  dossierReady: boolean;
  dossierLastRefreshedAt: string | null;
  catalystCount: number;
  upcomingCatalystCount: number;
  reviewedCatalystCount: number;
  catalystNoteCount: number;
  resolvedCatalystCount: number;
  invalidatedCatalystCount: number;
  highImportanceCatalystCount: number;
  contradictionNoteCount: number;
  catalystsLastCompiledAt: string | null;
  timelineLastCompiledAt: string | null;
  contradictionsLastAnalyzedAt: string | null;
  health: ProjectLintHealthSummary;
};

export type WikiPageSummary = {
  page: WikiPage;
  currentRevision: WikiPageRevision | null;
  revisionCount: number;
  sourceCount: number;
  claimCount: number;
  supportedClaimCount: number;
  weakSupportClaimCount: number;
  unresolvedClaimCount: number;
  evidenceLinkCount: number;
  sourceDiversityCount: number;
  supportPosture: string;
  supportDensityLabel: string;
  confidence: string;
  confidenceSummary: string;
  confidenceFactors: ConfidenceFactor[];
  isStale: boolean;
  staleReason: string;
  changedSections: string[];
  revisionChangeSummary: string;
  latestRevisionAt: string | null;
  isGenerated: boolean;
};

export type ProjectDetailData = {
  summary: ProjectSummary;
  sources: Source[];
  wikiPages: WikiPageSummary[];
  artifacts: ArtifactSummaryRecord[];
  artifactTypeMix: Array<{ artifactType: ArtifactType; count: number }>;
  entityAnalysisState: {
    projectId: string;
    lastCompiledAt: string | null;
    entityCount: number;
    summary: string;
  };
  timelineEvents: TimelineReferenceRecord[];
  contradictions: ContradictionReferenceRecord[];
  catalysts: CatalystReferenceRecord[];
  thesis: ThesisDetailRecord | null;
  dossier: CompanyDossierDetailRecord | null;
  monitoring: ProjectMonitoringSnapshot;
  latestCompile: CompileJob | null;
  operationalEvents: OperationalAuditEvent[];
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
  consultedEvidenceHighlights: EvidenceHighlight[];
  relatedEntities: EntityReferenceRecord[];
  relatedCatalysts: CatalystReferenceRecord[];
  relatedContradictions: ContradictionReferenceRecord[];
  relatedTimelineEvents: TimelineReferenceRecord[];
  relatedAlerts: StaleAlertReferenceRecord[];
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
  freshnessAlerts: StaleAlertReferenceRecord[];
  selectedRevisionId: string | null;
  metrics: Array<{ label: string; value: string; note: string }>;
};

export type DossierPageData = {
  summary: ProjectSummary;
  dossier: CompanyDossierDetailRecord | null;
  metrics: Array<{ label: string; value: string; note: string }>;
};

export type EntitiesPageData = {
  summary: ProjectSummary;
  entities: EntityReferenceRecord[];
  analysisState: {
    projectId: string;
    lastCompiledAt: string | null;
    entityCount: number;
    summary: string;
  };
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

export type MonitoringPageData = {
  summary: ProjectSummary;
  sourceRecords: SourceMonitoringRecordDetail[];
  alerts: StaleAlertReferenceRecord[];
  analysisState: ProjectMonitoringSnapshot["analysisState"];
  monitoringSummary: ProjectMonitoringSnapshot["summary"];
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
    sourceDiversityCount: number;
    supportPosture: string;
    supportDensityLabel: string;
    confidence: string;
    confidenceSummary: string;
    confidenceFactors: ConfidenceFactor[];
  };
  freshness: {
    isStale: boolean;
    reason: string;
    latestSourceAt: string | null;
  };
  changedSections: string[];
};

export type SettingsGroup = {
  eyebrow: string;
  title: string;
  description: string;
  items: Array<{ label: string; value: string }>;
};

export const executionLane = [
  {
    title: "Expand the durable repository layer",
    detail:
      "The core durable path now runs through local SQLite-backed repositories with the same async interfaces the route layer already expects.",
  },
  {
    title: "Persist project-scoped source creation",
    detail:
      "Projects, sources, ask sessions, artifacts, theses, thesis revisions, and monitoring state should survive restarts without changing the current product flow.",
  },
  {
    title: "Persist the canonical research base",
    detail:
      "Wiki pages, revisions, claims, and evidence links now survive restarts and act as the stable base for the rest of the intelligence stack.",
  },
  {
    title: "Promote the same seam to production storage later",
    detail:
      "The repository interfaces are still the product seam, so a later Postgres-backed adapter can replace the local store without reworking the route layer.",
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
        value: "Hybrid repository layer: local SQLite for canon, outputs, monitoring, derived intelligence objects, compile jobs, and operational audit history.",
      },
      {
        label: "Next adapter",
        value: "Promote richer audit trails and object-level refresh lineage next, then add a production database adapter behind the same interfaces.",
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

function parseJsonArray(value: string | null | undefined): string[] {
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

function countClaimStatus(
  claims: Claim[],
  target: ClaimSupportStatus,
): number {
  return claims.filter((claim) => claim.supportStatus === target).length;
}

function buildWikiSupportSignals(input: {
  claimCount: number;
  supportedClaimCount: number;
  weakSupportClaimCount: number;
  unresolvedClaimCount: number;
  sourceDiversityCount: number;
}): { supportDensityLabel: string; supportPosture: string } {
  const supportDensityLabel =
    input.claimCount === 0
      ? "thin"
      : input.supportedClaimCount / input.claimCount >= 0.75 &&
          input.sourceDiversityCount >= 2
        ? "strong"
        : input.supportedClaimCount / input.claimCount >= 0.45
          ? "mixed"
          : "weak";

  if (input.claimCount === 0) {
    return {
      supportDensityLabel,
      supportPosture: "No deterministic claims are attached to this page yet.",
    };
  }

  if (supportDensityLabel === "strong") {
    return {
      supportDensityLabel,
      supportPosture: `Support is strong across ${input.supportedClaimCount}/${input.claimCount} claims with evidence drawn from ${input.sourceDiversityCount} source record(s).`,
    };
  }

  if (supportDensityLabel === "mixed") {
    return {
      supportDensityLabel,
      supportPosture: `Support is mixed: ${input.supportedClaimCount} supported, ${input.weakSupportClaimCount} weak, and ${input.unresolvedClaimCount} unresolved claim(s).`,
    };
  }

  return {
    supportDensityLabel,
    supportPosture: `Support is weak: unresolved or thinly grounded claims still materially affect this page.`,
  };
}

function buildWikiFreshnessSignals(input: {
  currentRevision: WikiPageRevision | null;
  latestSourceAt: string | null;
  latestClaimAt: string | null;
  isGenerated: boolean;
}): { isStale: boolean; staleReason: string } {
  if (!input.currentRevision) {
    return {
      isStale: true,
      staleReason: "This page does not have a current revision yet.",
    };
  }

  const latestDependencyAt = [input.latestSourceAt, input.latestClaimAt]
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.localeCompare(left))[0] ?? null;

  if (
    latestDependencyAt &&
    latestDependencyAt.localeCompare(input.currentRevision.createdAt) > 0
  ) {
    return {
      isStale: true,
      staleReason:
        "Linked source or claim updates are newer than the current page revision. Canon should be refreshed before downstream interpretation hardens.",
    };
  }

  if (!input.isGenerated) {
    return {
      isStale: true,
      staleReason:
        "This page still reflects seeded or manually carried-forward canon and has not been refreshed through the current deterministic compiler.",
    };
  }

  return {
    isStale: false,
    staleReason: "Current revision is aligned with the latest linked source and claim state.",
  };
}

function buildWikiConfidenceSignals(input: {
  claimCount: number;
  supportedClaimCount: number;
  sourceDiversityCount: number;
  activeContradictionCount: number;
  relatedEntityCount: number;
  isStale: boolean;
}) {
  const assessment = buildConfidenceAssessment({
    supportDensity:
      input.claimCount === 0 ? 0 : input.supportedClaimCount / input.claimCount,
    sourceDiversityCount: input.sourceDiversityCount,
    contradictionBurden: Math.min(input.activeContradictionCount / 3, 1),
    freshnessBurden: input.isStale ? 0.45 : 0,
    entityClarity: Math.min(input.relatedEntityCount / 3, 1),
    stalePosture: input.isStale ? 1 : 0,
  });

  return {
    confidence: assessment.label,
    confidenceSummary: assessment.summary,
    confidenceFactors: assessment.factors,
  };
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
    timelineData,
    lintSnapshot,
    contradictionSnapshot,
    contradictionRecords,
    thesisSnapshot,
    dossier,
    catalystPageData,
    monitoringSnapshot,
    entitySnapshot,
  ] =
    await Promise.all([
      sourcesRepository.listByProjectId(project.id),
      wikiRepository.listPagesByProjectId(project.id),
      listProjectArtifacts({ projectId: project.id }),
      compileJobsRepository.getLatestByProjectId(project.id),
      claimsRepository.listByProjectId(project.id),
      evidenceLinksRepository.listByProjectId(project.id),
      getProjectTimelinePageData(project.id),
      getProjectLintSnapshot(project.id),
      getProjectContradictionSnapshot(project.id),
      listProjectContradictions(project.id),
      getProjectThesisSnapshot(project.id),
      getStoredProjectCompanyDossier(project.id),
      getProjectCatalystPageData(project.id),
      getProjectMonitoringSnapshot(project.id),
      getProjectEntitySnapshot(project.id),
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
    entityCount: entitySnapshot.entities.length,
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
    timelineEventCount: timelineData.events.length,
    contradictionCount: contradictionSnapshot.summary.totalContradictions,
    highSeverityContradictionCount:
      contradictionSnapshot.summary.highSeverityContradictions,
    unresolvedContradictionCount:
      contradictionSnapshot.summary.unresolvedContradictions,
    reviewedContradictionCount:
      contradictionSnapshot.summary.reviewedContradictions,
    thesisStatus: thesis
      ? thesisSnapshot.freshness.potentiallyStale
        ? "stale"
        : thesis.status
      : null,
    thesisStance: thesis?.overallStance ?? null,
    thesisConfidence: thesis?.confidence ?? null,
    thesisConfidenceSummary: thesis?.metadata?.confidenceSummary ?? null,
    thesisPostureSummary: thesis?.metadata?.postureSummary ?? null,
    thesisMajorTensionSummary: thesis?.metadata?.majorTensionSummary ?? null,
    thesisRecentChangeSummary: thesis?.metadata?.currentChangeSummary ?? null,
    thesisBestNextAction: thesis?.metadata?.bestNextAction ?? null,
    thesisCatalystCount: Number(thesis?.metadata?.catalystCount ?? "0"),
    thesisRevisionNumber: thesisSnapshot.revisionCount,
    thesisLastRefreshedAt: thesisSnapshot.freshness.lastRefreshedAt,
    thesisPotentiallyStale: thesisSnapshot.freshness.potentiallyStale,
    thesisFreshnessReason: thesisSnapshot.freshness.reason,
    freshnessAlertCount: monitoringSnapshot.summary.activeAlerts,
    acknowledgedFreshnessAlertCount:
      monitoringSnapshot.summary.acknowledgedAlerts,
    dismissedFreshnessAlertCount: monitoringSnapshot.summary.dismissedAlerts,
    freshnessAlertNoteCount: monitoringSnapshot.alerts.filter(
      (entry) => entry.noteSummary.noteCount > 0,
    ).length,
    highSeverityFreshnessAlertCount: monitoringSnapshot.summary.highSeverityAlerts,
    sourcesNeedingReviewCount: monitoringSnapshot.summary.sourcesNeedingReview,
    monitoringLastEvaluatedAt: monitoringSnapshot.analysisState.lastEvaluatedAt,
    dossierCompanyName: dossier?.companyName ?? null,
    dossierConfidence: dossier?.confidence ?? null,
    dossierConfidenceSummary: dossier?.metadata?.confidenceSummary ?? null,
    dossierSectionCoverageLabel:
      dossier?.metadata?.sectionCoverageLabel ?? "0/6 sections supported",
    dossierReady: Number(dossier?.metadata?.coveredSections ?? "0") >= 4,
    dossierLastRefreshedAt: dossier?.updatedAt ?? null,
    catalystCount: catalystPageData.summary.totalCatalysts,
    upcomingCatalystCount: catalystPageData.summary.upcomingCatalysts,
    reviewedCatalystCount: catalystPageData.summary.reviewedCatalysts,
    catalystNoteCount: catalystPageData.catalysts.filter(
      (entry) => entry.noteSummary.noteCount > 0,
    ).length,
    resolvedCatalystCount: catalystPageData.summary.resolvedCatalysts,
    invalidatedCatalystCount: catalystPageData.summary.invalidatedCatalysts,
    highImportanceCatalystCount: catalystPageData.summary.highImportanceCatalysts,
    contradictionNoteCount: contradictionRecords.filter(
      (entry) => entry.noteSummary.noteCount > 0,
    ).length,
    catalystsLastCompiledAt: catalystPageData.compileState.lastCompiledAt,
    timelineLastCompiledAt: timelineData.compileState.lastCompiledAt,
    contradictionsLastAnalyzedAt: contradictionSnapshot.analysisState.lastAnalyzedAt,
    health: lintSnapshot.health,
  };
});

const buildWikiPageSummaries = cache(async function buildWikiPageSummaries(
  projectId: string,
): Promise<WikiPageSummary[]> {
  const [pages, contradictions, entitySnapshot] = await Promise.all([
    wikiRepository.listPagesByProjectId(projectId),
    contradictionsRepository.listByProjectId(projectId),
    getProjectEntitySnapshot(projectId),
  ]);

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
      const linkedSourceIds = await wikiRepository.listSourceIdsForPage(page.id);
      const linkedSources = await Promise.all(
        linkedSourceIds.map((sourceId) => sourcesRepository.getById(sourceId)),
      );
      const latestSourceAt =
        linkedSources
          .filter((source): source is Source => Boolean(source))
          .map((source) => source.updatedAt)
          .sort((left, right) => right.localeCompare(left))[0] ?? null;
      const latestClaimAt =
        claims
          .map((claim) => claim.updatedAt)
          .sort((left, right) => right.localeCompare(left))[0] ?? null;
      const weakSupportClaimCount = countClaimStatus(claims, "weak-support");
      const sourceDiversityCount = new Set(
        claims
          .flatMap((claim) =>
            evidenceLinks
              .filter((link) => link.claimId === claim.id)
              .map((link) => link.sourceId),
          )
          .filter(Boolean),
      ).size;
      const supportSignals = buildWikiSupportSignals({
        claimCount: claims.length,
        supportedClaimCount: countClaimStatus(claims, "supported"),
        weakSupportClaimCount,
        unresolvedClaimCount: countClaimStatus(claims, "unresolved"),
        sourceDiversityCount,
      });
      const isGenerated =
        page.generationMetadata?.generatedBy === "deterministic-compiler";
      const freshnessSignals = buildWikiFreshnessSignals({
        currentRevision,
        latestSourceAt,
        latestClaimAt,
        isGenerated,
      });
      const activeContradictionCount = contradictions.filter(
        (entry) => entry.status !== "resolved" && entry.relatedPageIds.includes(page.id),
      ).length;
      const relatedEntityCount = entitySnapshot.entities.filter((entity) =>
        entity.relatedWikiPageIds.includes(page.id),
      ).length;
      const confidenceSignals = buildWikiConfidenceSignals({
        claimCount: claims.length,
        supportedClaimCount: countClaimStatus(claims, "supported"),
        sourceDiversityCount: Math.max(sourceDiversityCount, linkedSourceIds.length),
        activeContradictionCount,
        relatedEntityCount,
        isStale: freshnessSignals.isStale,
      });
      const changedSections = parseJsonArray(
        currentRevision?.generationMetadata?.changedSections ??
          page.generationMetadata?.changedSections,
      );
      const revisionChangeSummary =
        currentRevision?.changeNote ??
        currentRevision?.summary ??
        "No revision change summary is available yet.";

      return {
        page,
        currentRevision,
        revisionCount: revisions.length,
        sourceCount,
        claimCount: claims.length,
        supportedClaimCount: countClaimStatus(claims, "supported"),
        weakSupportClaimCount,
        unresolvedClaimCount: countClaimStatus(claims, "unresolved"),
        evidenceLinkCount: evidenceLinks.length,
        sourceDiversityCount,
        supportPosture: supportSignals.supportPosture,
        supportDensityLabel: supportSignals.supportDensityLabel,
        confidence: confidenceSignals.confidence,
        confidenceSummary: confidenceSignals.confidenceSummary,
        confidenceFactors: confidenceSignals.confidenceFactors,
        isStale: freshnessSignals.isStale,
        staleReason: freshnessSignals.staleReason,
        changedSections,
        revisionChangeSummary,
        latestRevisionAt: currentRevision?.createdAt ?? null,
        isGenerated,
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
      "EregionForge operates as a research OS: sources compile into canon, canon drives the investment view, and strong outputs remain durable project assets.",
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
        note: "Each project is its own compiled research program with sources, canon, outputs, and freshness state.",
      },
      {
        label: "Canon Pages",
        value: String(
          summaries.reduce((sum, project) => sum + project.generatedPageCount, 0),
        ),
        note: "These pages are the canonical layer that thesis, ask, contradictions, and artifacts build on top of.",
      },
      {
        label: "Supported Claims",
        value: String(
          summaries.reduce((sum, project) => sum + project.supportedClaimsCount, 0),
        ),
        note: "Claims make the research stack auditable by tying key statements back to source-grounded evidence.",
      },
      {
        label: "Integrity Alerts",
        value: String(
          summaries.reduce((sum, project) => sum + project.health.totalIssues, 0),
        ),
        note: "Lint and monitoring make weak trust zones visible before they leak into the investment view.",
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

  const [sources, wikiPages, artifacts, entitySnapshot, timelineEvents, contradictions, catalysts, thesis, dossier, monitoring, operationalEvents] =
    await Promise.all([
      sourcesRepository.listByProjectId(projectId),
      buildWikiPageSummaries(projectId),
      listProjectArtifacts({ projectId }),
      getProjectEntitySnapshot(projectId),
      listProjectTimelineEvents(projectId),
      listProjectContradictions(projectId),
      listProjectCatalysts(projectId),
      getProjectThesisDetail(projectId),
      getProjectCompanyDossierDetail(projectId),
      getProjectMonitoringSnapshot(projectId),
      operationalAuditEventsRepository.listByProjectId(projectId),
    ]);
  const latestCompile = await compileJobsRepository.getLatestByProjectId(projectId);

  return {
    summary,
    sources: sortByCreatedAtDesc(sources),
    wikiPages: sortWikiPageSummariesByUpdatedAtDesc(wikiPages),
    artifacts,
    artifactTypeMix: buildArtifactTypeMix(artifacts),
    entityAnalysisState: entitySnapshot.analysisState,
    timelineEvents,
    contradictions,
    catalysts,
    thesis,
    dossier,
    monitoring,
    latestCompile,
    operationalEvents: operationalEvents.slice(0, 8),
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
        label: "Strong Support Pages",
        value: String(
          pages.filter((page) => page.supportDensityLabel === "strong").length,
        ),
        note: "These pages currently carry stronger support density and source diversity across their claim set.",
      },
      {
        label: "Unresolved Claims",
        value: String(
          pages.reduce((sum, page) => sum + page.unresolvedClaimCount, 0),
        ),
        note: "Unresolved claims expose areas where canon is still weak, sparse, or structurally incomplete.",
      },
      {
        label: "Stale Pages",
        value: String(pages.filter((page) => page.isStale).length),
        note: "These pages likely lag newer source or claim changes and should be reviewed before downstream refreshes.",
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
      ? "Current canon reflects deterministic compilation with page-level support posture, revision-aware change summaries, and first-pass freshness signals."
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
    const [
      allSources,
      allEvidenceLinks,
      allSourceFragments,
      consultedSources,
      catalystRecords,
      contradictionRecords,
      timelineRecords,
      entityPageData,
      monitoringSnapshot,
    ] = await Promise.all([
      sourcesRepository.listByProjectId(projectId),
      evidenceLinksRepository.listByProjectId(projectId),
      sourceFragmentsRepository.listByProjectId(projectId),
      Promise.all(
        currentSessionRecord.consultedSourceIds.map((sourceId) =>
          buildLinkedSourceDetail(sourceId),
        ),
      ),
      listProjectCatalysts(projectId),
      listProjectContradictions(projectId),
      listProjectTimelineEvents(projectId),
      buildProjectEntitiesPageData(projectId),
      getProjectMonitoringSnapshot(projectId),
    ]);
    const relatedEntityIds = new Set(
      parseJsonArray(currentSessionRecord.metadata?.consultedEntityIds),
    );
    const relatedCatalystIds = new Set(
      parseJsonArray(currentSessionRecord.metadata?.consultedCatalystIds),
    );
    const relatedContradictionIds = new Set(
      parseJsonArray(currentSessionRecord.metadata?.consultedContradictionIds),
    );
    const relatedTimelineEventIds = new Set(
      parseJsonArray(currentSessionRecord.metadata?.consultedTimelineEventIds),
    );
    const relatedAlertIds = new Set(
      parseJsonArray(currentSessionRecord.metadata?.consultedAlertIds),
    );
    const consultedEvidenceHighlights = collectEvidenceHighlights(
      {
        claimIds: currentSessionRecord.consultedClaimIds,
        sourceIds: currentSessionRecord.consultedSourceIds,
        evidenceLinkIds: parseJsonArray(
          currentSessionRecord.metadata?.consultedEvidenceLinkIds,
        ),
        sourceFragmentIds: parseJsonArray(
          currentSessionRecord.metadata?.consultedSourceFragmentIds,
        ),
        limit: 6,
      },
      buildEvidenceLineageLookup({
        evidenceLinks: allEvidenceLinks,
        fragments: allSourceFragments,
        claimsById: claimsById,
        sourcesById: new Map(allSources.map((source) => [source.id, source] as const)),
      }),
    );

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
      consultedSources: consultedSources.filter(
        (source): source is LinkedSourceDetail => Boolean(source),
      ),
      consultedEvidenceHighlights,
      relatedEntities: entityPageData.entities.filter((entry) =>
        relatedEntityIds.has(entry.entity.id),
      ),
      relatedCatalysts: catalystRecords.filter((entry) =>
        relatedCatalystIds.has(entry.catalyst.id),
      ),
      relatedContradictions: contradictionRecords.filter((entry) =>
        relatedContradictionIds.has(entry.contradiction.id),
      ),
      relatedTimelineEvents: timelineRecords.filter((entry) =>
        relatedTimelineEventIds.has(entry.event.id),
      ),
      relatedAlerts: monitoringSnapshot.alerts.filter((entry) =>
        relatedAlertIds.has(entry.alert.id),
      ),
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
      reviewedContradictions: summary.reviewedContradictionCount,
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
  const [summary, thesisDetail, monitoringSnapshot] = await Promise.all([
    getProjectSummary(projectId),
    getProjectThesisDetail(projectId, selectedRevisionId),
    getProjectMonitoringSnapshot(projectId),
  ]);

  if (!summary) {
    return null;
  }

  return {
    summary,
    thesis: thesisDetail,
    freshnessAlerts: monitoringSnapshot.alerts.filter(
      (entry) =>
        entry.alert.status === "open" &&
        (entry.alert.alertType === "thesis_may_be_stale" ||
          entry.relatedThesis?.id === thesisDetail?.thesis.id),
    ),
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
        note:
          summary.thesisPostureSummary ??
          "Overall stance is derived from current canon, contradictions, timeline state, and supporting research outputs.",
      },
      {
        label: "Confidence",
        value: summary.thesisConfidence ?? "Not set",
        note:
          summary.thesisConfidenceSummary ??
          "Confidence reflects the current density and consistency of compiled supporting knowledge.",
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
        note:
          monitoringSnapshot.summary.activeAlerts > 0
            ? `${summary.thesisFreshnessReason} Monitoring has ${monitoringSnapshot.summary.activeAlerts} active stale alert(s).`
            : summary.thesisFreshnessReason,
      },
    ],
  };
}

export async function getDossierPageData(
  projectId: string,
): Promise<DossierPageData | null> {
  const [summary, dossier, monitoringSnapshot] = await Promise.all([
    getProjectSummary(projectId),
    getProjectCompanyDossierDetail(projectId),
    getProjectMonitoringSnapshot(projectId),
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
        note:
          summary.dossierConfidenceSummary ??
          "Confidence reflects the breadth and consistency of current dossier-supporting knowledge objects.",
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
      {
        label: "Freshness",
        value: monitoringSnapshot.alerts.some(
          (entry) =>
            entry.alert.status === "open" &&
            (entry.alert.alertType === "dossier_may_be_stale" ||
              entry.relatedDossier?.id === dossier?.dossier.id),
        )
          ? "Attention"
          : "Current",
        note: monitoringSnapshot.alerts
          .filter(
            (entry) =>
              entry.alert.status === "open" &&
              (entry.alert.alertType === "dossier_may_be_stale" ||
                entry.relatedDossier?.id === dossier?.dossier.id),
          )
          .map((entry) => entry.alert.metadata?.driverSummary || entry.alert.description)
          .slice(0, 1)[0] ??
          "Current dossier appears aligned with the latest monitored knowledge inputs.",
      },
    ],
  };
}

export async function getEntitiesPageData(
  projectId: string,
): Promise<EntitiesPageData | null> {
  const [summary, entityData] = await Promise.all([
    getProjectSummary(projectId),
    buildProjectEntitiesPageData(projectId),
  ]);

  if (!summary) {
    return null;
  }

  return {
    summary,
    entities: entityData.entities,
    analysisState: entityData.analysisState,
    metrics: entityData.metrics,
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

export async function getMonitoringPageData(
  projectId: string,
): Promise<MonitoringPageData | null> {
  const [summary, monitoringData] = await Promise.all([
    getProjectSummary(projectId),
    buildProjectMonitoringPageData(projectId),
  ]);

  if (!summary) {
    return null;
  }

  return {
    summary,
    sourceRecords: monitoringData.sourceRecords,
    alerts: monitoringData.alerts,
    analysisState: monitoringData.analysisState,
    monitoringSummary: monitoringData.summary,
    metrics: monitoringData.metrics,
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
            value: "Local SQLite",
            note: "The durable path now persists to a local database file, and the same repository seam can later target Postgres without a route refactor.",
          },
          {
            label: "Repository Mode",
            value: "Hybrid",
            note: "Projects, sources, source fragments, canon pages, claims, evidence, artifacts, ask sessions, thesis records, thesis revisions, monitoring, catalysts, contradictions, timeline events, dossiers, lint issues, and compile jobs now persist locally with operational audit history attached.",
          },
          {
            label: "Domain Center",
            value: "Compiled wiki",
            note: "The canonical page and revision model remains the center of the system.",
          },
          {
            label: "Compile Jobs",
            value: latestCompile?.status ?? "pending",
            note: "Compile jobs now persist locally with job type, target object, status, and timestamps so refresh history survives restarts.",
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

  const [revisions, currentRevision, sourceIds, claims, contradictions, entitySnapshot] =
    await Promise.all([
    wikiRepository.listRevisionsByPageId(pageId),
    wikiRepository.getCurrentRevision(pageId),
    wikiRepository.listSourceIdsForPage(pageId),
    claimsRepository.listByWikiPageId(pageId),
    contradictionsRepository.listByProjectId(projectId),
    getProjectEntitySnapshot(projectId),
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
  const latestSourceAt =
    linkedSources
      .map((entry) => entry.source.updatedAt)
      .sort((left, right) => right.localeCompare(left))[0] ?? null;
  const weakSupport = countClaimStatus(claims, "weak-support");
  const unresolved = countClaimStatus(claims, "unresolved");
  const supported = countClaimStatus(claims, "supported");
  const sourceDiversityCount = new Set(
    claimDetails
      .flatMap((entry) => entry.evidenceLinks.map((link) => link.sourceId))
      .filter(Boolean),
  ).size;
  const supportSignals = buildWikiSupportSignals({
    claimCount: claims.length,
    supportedClaimCount: supported,
    weakSupportClaimCount: weakSupport,
    unresolvedClaimCount: unresolved,
    sourceDiversityCount,
  });
  const freshnessSignals = buildWikiFreshnessSignals({
    currentRevision,
    latestSourceAt,
    latestClaimAt:
      claims
        .map((claim) => claim.updatedAt)
        .sort((left, right) => right.localeCompare(left))[0] ?? null,
    isGenerated: page.generationMetadata?.generatedBy === "deterministic-compiler",
  });
  const confidenceSignals = buildWikiConfidenceSignals({
    claimCount: claims.length,
    supportedClaimCount: supported,
    sourceDiversityCount: Math.max(sourceDiversityCount, linkedSources.length),
    activeContradictionCount: contradictions.filter(
      (entry) => entry.status !== "resolved" && entry.relatedPageIds.includes(page.id),
    ).length,
    relatedEntityCount: entitySnapshot.entities.filter((entity) =>
      entity.relatedWikiPageIds.includes(page.id),
    ).length,
    isStale: freshnessSignals.isStale,
  });
  const changedSections = parseJsonArray(
    currentRevision?.generationMetadata?.changedSections ??
      page.generationMetadata?.changedSections,
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
      supported,
      weakSupport,
      unresolved,
      evidenceLinks: claimDetails.reduce(
        (sum, claimDetail) => sum + claimDetail.evidenceLinks.length,
        0,
      ),
      sourceDiversityCount,
      supportPosture: supportSignals.supportPosture,
      supportDensityLabel: supportSignals.supportDensityLabel,
      confidence: confidenceSignals.confidence,
      confidenceSummary: confidenceSignals.confidenceSummary,
      confidenceFactors: confidenceSignals.confidenceFactors,
    },
    freshness: {
      isStale: freshnessSignals.isStale,
      reason: freshnessSignals.staleReason,
      latestSourceAt,
    },
    changedSections,
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
