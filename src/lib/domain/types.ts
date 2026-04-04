export type Timestamp = string;

export type ProjectStatus = "active" | "archived";
export type SourceType = "markdown" | "text" | "url" | "pdf";
export type SourceStatus =
  | "pending"
  | "parsed"
  | "extracted"
  | "compiled"
  | "failed";
export type SourceFragmentType =
  | "heading"
  | "paragraph"
  | "excerpt"
  | "metadata"
  | "fallback-chunk";
export type ClaimSupportStatus = "supported" | "weak-support" | "unresolved";
export type ClaimCategory =
  | "summary"
  | "key-signal"
  | "open-question"
  | "provenance"
  | "structural";
export type EvidenceRelationType =
  | "supports"
  | "context"
  | "raises-question"
  | "structural-support";
export type WikiPageStatus = "active" | "draft" | "stale";
export type WikiPageType =
  | "overview"
  | "source-summary"
  | "concept-index"
  | "scope"
  | "architecture"
  | "data-model"
  | "roadmap"
  | "open-questions"
  | "dossier"
  | "investment-thesis"
  | "market-map"
  | "risk-register";
export type ArtifactStatus = "draft" | "active" | "archived";
export type ArtifactType =
  | "memo"
  | "briefing"
  | "comparison_report"
  | "slide_outline"
  | "saved_answer";
export type ArtifactProvenance =
  | "ask-mode"
  | "manual"
  | "wiki-derived"
  | "research-synthesis";
export type DossierStatus = "draft" | "active" | "stale";
export type ThesisStatus = "draft" | "active" | "stale";
export type ThesisStance = "bullish" | "bearish" | "mixed" | "monitor";
export type SourceFreshnessStatus =
  | "current"
  | "new_since_compile"
  | "uncompiled"
  | "stale";
export type FreshnessImpactLevel = "high" | "medium" | "low";
export type StaleAlertType =
  | "thesis_may_be_stale"
  | "dossier_may_be_stale"
  | "catalyst_tracker_needs_refresh"
  | "contradictions_should_rerun";
export type StaleAlertSeverity = "critical" | "high" | "medium" | "low";
export type StaleAlertStatus = "open" | "resolved" | "dismissed";
export type CatalystType =
  | "earnings"
  | "product_launch"
  | "regulatory"
  | "guidance_change"
  | "customer_or_contract"
  | "financing"
  | "macro_or_industry"
  | "other";
export type CatalystStatus =
  | "upcoming"
  | "active"
  | "resolved"
  | "invalidated"
  | "unknown";
export type CatalystImportance = "high" | "medium" | "low";
export type ThesisChangedSection =
  | "summary"
  | "bullCase"
  | "bearCase"
  | "variantView"
  | "keyRisks"
  | "keyUnknowns"
  | "catalystSummary";
export type RevisionConfidence = "low" | "medium" | "high";
export type CompileJobStatus = "pending" | "running" | "completed" | "failed";
export type AskAnswerMode =
  | "concise-answer"
  | "research-memo"
  | "compare-viewpoints"
  | "identify-contradictions"
  | "follow-up-questions";
export type EntityType =
  | "company"
  | "product_or_segment"
  | "operator"
  | "market_or_competitor"
  | "metric"
  | "risk_theme";
export type TimelineEventDatePrecision =
  | "exact_day"
  | "month"
  | "year"
  | "unknown_estimated";
export type TimelineEventType =
  | "milestone"
  | "planning"
  | "research"
  | "financial"
  | "document"
  | "system"
  | "question";
export type TimelineEventProvenance =
  | "source-extraction"
  | "claim-extraction"
  | "wiki-extraction"
  | "object-timestamp-fallback";
export type ContradictionType =
  | "direct_claim_conflict"
  | "timeline_tension"
  | "source_disagreement"
  | "stale_vs_newer_claim"
  | "overlapping_but_inconsistent_summary";
export type ContradictionSeverity = "critical" | "high" | "medium" | "low";
export type ContradictionStatus = "open" | "reviewed" | "resolved";
export type LintIssueType =
  | "unsupported_claims"
  | "weakly_supported_page"
  | "stale_page"
  | "orphan_page"
  | "missing_expected_page"
  | "duplicate_or_overlapping_concept";
export type LintIssueSeverity = "critical" | "high" | "medium" | "low";
export type LintIssueStatus = "open" | "resolved" | "dismissed";

export type StringMetadata = Record<string, string>;

export interface SourceInput {
  title: string;
  sourceType: SourceType;
  url?: string | null;
  body?: string | null;
  filePath?: string | null;
  status: SourceStatus;
}

export interface Project {
  id: string;
  ownerId: string | null;
  slug: string;
  name: string;
  description: string;
  domain: string;
  status: ProjectStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Source {
  id: string;
  projectId: string;
  sourceType: SourceType;
  title: string;
  body: string | null;
  url: string | null;
  filePath: string | null;
  status: SourceStatus;
  provenance: StringMetadata;
  metadata: StringMetadata;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SourceFragment {
  id: string;
  sourceId: string;
  projectId: string;
  index: number;
  fragmentType: SourceFragmentType;
  title?: string | null;
  text: string;
  excerpt?: string | null;
  tokenCount?: number | null;
  charCount?: number | null;
  metadata?: StringMetadata;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type SourceFragmentPayload = Omit<
  SourceFragment,
  "id" | "createdAt" | "updatedAt"
>;

export interface Claim {
  id: string;
  projectId: string;
  wikiPageId: string;
  sourceId?: string | null;
  text: string;
  claimType: ClaimCategory;
  supportStatus: ClaimSupportStatus;
  confidence?: RevisionConfidence | null;
  metadata?: StringMetadata;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type ClaimPayload = Omit<Claim, "id" | "createdAt" | "updatedAt">;

export interface EvidenceLink {
  id: string;
  projectId: string;
  claimId: string;
  sourceId: string;
  sourceFragmentId: string;
  relationType: EvidenceRelationType;
  createdAt: Timestamp;
  metadata?: StringMetadata;
}

export type EvidenceLinkPayload = Omit<EvidenceLink, "id" | "createdAt">;

export interface WikiPage {
  id: string;
  projectId: string;
  slug: string;
  title: string;
  pageType: WikiPageType;
  sourceId?: string | null;
  currentRevisionId: string;
  status: WikiPageStatus;
  generationMetadata?: StringMetadata;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface WikiPageRevision {
  id: string;
  pageId: string;
  markdownContent: string;
  summary: string | null;
  changeNote: string | null;
  confidence: RevisionConfidence | null;
  createdBy: string;
  generationMetadata?: StringMetadata;
  createdAt: Timestamp;
}

export interface Artifact {
  id: string;
  projectId: string;
  artifactType: ArtifactType;
  title: string;
  markdownContent: string;
  previewText: string;
  provenance: ArtifactProvenance;
  originatingPrompt?: string | null;
  derivedFromAskSessionId?: string | null;
  referencedWikiPageIds: string[];
  referencedSourceIds: string[];
  referencedClaimIds: string[];
  eligibleForWikiFiling: boolean;
  status: ArtifactStatus;
  metadata: StringMetadata;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface DossierSectionReferences {
  wikiPageIds: string[];
  claimIds: string[];
  sourceIds: string[];
  artifactIds: string[];
}

export interface DossierSectionSupportMap {
  businessOverview: DossierSectionReferences;
  productsAndSegments: DossierSectionReferences;
  managementAndOperators: DossierSectionReferences;
  marketAndCompetition: DossierSectionReferences;
  keyMetricsAndFacts: DossierSectionReferences;
  sourceCoverageSummary: DossierSectionReferences;
}

export interface CompanyDossier {
  id: string;
  projectId: string;
  companyName: string;
  ticker: string | null;
  sector: string | null;
  geography: string | null;
  status: DossierStatus;
  businessOverviewMarkdown: string;
  productsAndSegmentsMarkdown: string;
  managementAndOperatorsMarkdown: string;
  marketAndCompetitionMarkdown: string;
  keyMetricsAndFactsMarkdown: string;
  sourceCoverageSummaryMarkdown: string;
  confidence: RevisionConfidence;
  supportBySection: DossierSectionSupportMap;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  metadata?: StringMetadata;
}

export interface Catalyst {
  id: string;
  projectId: string;
  title: string;
  description: string;
  catalystType: CatalystType;
  status: CatalystStatus;
  expectedTimeframe: string | null;
  timeframePrecision: TimelineEventDatePrecision;
  importance: CatalystImportance;
  confidence: RevisionConfidence;
  linkedThesisId?: string | null;
  linkedTimelineEventIds: string[];
  linkedClaimIds: string[];
  linkedSourceIds: string[];
  linkedContradictionIds: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  metadata?: StringMetadata;
}

export type CatalystDraft = Omit<
  Catalyst,
  "id" | "createdAt" | "updatedAt"
> & {
  stableKey: string;
};

export interface CatalystCompileState {
  projectId: string;
  lastCompiledAt: Timestamp | null;
  catalystCount: number;
  summary: string;
}

export interface SourceMonitoringRecord {
  id: string;
  projectId: string;
  sourceId: string;
  lastSeenAt: Timestamp;
  lastCompiledAt: Timestamp | null;
  freshnessStatus: SourceFreshnessStatus;
  possibleImpactLevel: FreshnessImpactLevel;
  staleReason: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  metadata?: StringMetadata;
}

export type SourceMonitoringDraft = Omit<
  SourceMonitoringRecord,
  "id" | "createdAt" | "updatedAt"
> & {
  stableKey: string;
};

export interface StaleAlert {
  id: string;
  projectId: string;
  alertType: StaleAlertType;
  title: string;
  description: string;
  severity: StaleAlertSeverity;
  status: StaleAlertStatus;
  relatedSourceIds: string[];
  relatedThesisId?: string | null;
  relatedDossierId?: string | null;
  relatedCatalystIds: string[];
  relatedTimelineIds: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  metadata?: StringMetadata;
}

export type StaleAlertDraft = Omit<
  StaleAlert,
  "id" | "status" | "createdAt" | "updatedAt"
> & {
  stableKey: string;
  status?: StaleAlertStatus;
};

export interface MonitoringAnalysisState {
  projectId: string;
  lastEvaluatedAt: Timestamp | null;
  sourceRecordCount: number;
  alertCount: number;
  summary: string;
}

export interface ThesisSectionReferences {
  wikiPageIds: string[];
  claimIds: string[];
  sourceIds: string[];
  timelineEventIds: string[];
  contradictionIds: string[];
}

export interface ThesisSectionSupportMap {
  summary: ThesisSectionReferences;
  bullCase: ThesisSectionReferences;
  bearCase: ThesisSectionReferences;
  variantView: ThesisSectionReferences;
  keyRisks: ThesisSectionReferences;
  keyUnknowns: ThesisSectionReferences;
  catalystSummary: ThesisSectionReferences;
}

export interface Thesis {
  id: string;
  projectId: string;
  currentRevisionId: string | null;
  revisionCount: number;
  title: string;
  subjectName: string;
  ticker: string | null;
  status: ThesisStatus;
  overallStance: ThesisStance;
  summary: string;
  bullCaseMarkdown: string;
  bearCaseMarkdown: string;
  variantViewMarkdown: string;
  keyRisksMarkdown: string;
  keyUnknownsMarkdown: string;
  catalystSummaryMarkdown: string;
  confidence: RevisionConfidence;
  supportBySection: ThesisSectionSupportMap;
  latestInputSignature: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  metadata?: StringMetadata;
}

export interface ThesisRevision {
  id: string;
  thesisId: string;
  projectId: string;
  revisionNumber: number;
  status: ThesisStatus;
  stance: ThesisStance;
  confidence: RevisionConfidence;
  summary: string;
  bullCaseMarkdown: string;
  bearCaseMarkdown: string;
  variantViewMarkdown: string;
  keyRisksMarkdown: string;
  keyUnknownsMarkdown: string;
  catalystSummaryMarkdown: string;
  changeSummary: string;
  supportBySection: ThesisSectionSupportMap;
  createdAt: Timestamp;
  metadata?: StringMetadata;
}

export interface CompileJob {
  id: string;
  projectId: string;
  status: CompileJobStatus;
  triggeredBy: string;
  startedAt: Timestamp | null;
  completedAt: Timestamp | null;
  summary: string;
  affectedPageIds: string[];
  sourceCount: number;
  metadata: StringMetadata;
  createdAt: Timestamp;
}

export interface WikiPageSourceLink {
  pageId: string;
  sourceId: string;
}

export interface AskSession {
  id: string;
  projectId: string;
  prompt: string;
  answer: string;
  answerMode: AskAnswerMode;
  confidence: RevisionConfidence;
  consultedWikiPageIds: string[];
  consultedClaimIds: string[];
  consultedSourceIds: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  metadata?: StringMetadata;
}

export type AskSessionPayload = Omit<AskSession, "id" | "createdAt" | "updatedAt">;

export interface ResearchEntity {
  id: string;
  projectId: string;
  entityType: EntityType;
  canonicalName: string;
  aliases: string[];
  description: string;
  confidence: RevisionConfidence;
  relatedSourceIds: string[];
  relatedClaimIds: string[];
  relatedWikiPageIds: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
  metadata?: StringMetadata;
}

export type ResearchEntityDraft = Omit<
  ResearchEntity,
  "id" | "createdAt" | "updatedAt"
> & {
  stableKey: string;
};

export interface EntityAnalysisState {
  projectId: string;
  lastCompiledAt: Timestamp | null;
  entityCount: number;
  summary: string;
}

export interface TimelineEvent {
  id: string;
  projectId: string;
  title: string;
  description: string;
  eventDate: string;
  eventDatePrecision: TimelineEventDatePrecision;
  eventType: TimelineEventType;
  confidence: RevisionConfidence;
  sourceIds: string[];
  wikiPageIds: string[];
  claimIds: string[];
  provenance: TimelineEventProvenance;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  metadata?: StringMetadata;
}

export type TimelineEventDraft = Omit<
  TimelineEvent,
  "id" | "createdAt" | "updatedAt"
> & {
  stableKey: string;
};

export interface TimelineCompileState {
  projectId: string;
  lastCompiledAt: Timestamp | null;
  eventCount: number;
  summary: string;
}

export interface Contradiction {
  id: string;
  projectId: string;
  contradictionType: ContradictionType;
  title: string;
  description: string;
  severity: ContradictionSeverity;
  status: ContradictionStatus;
  confidence: RevisionConfidence;
  leftClaimId?: string | null;
  rightClaimId?: string | null;
  relatedPageIds: string[];
  relatedSourceIds: string[];
  relatedTimelineEventIds: string[];
  rationale: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  metadata?: StringMetadata;
}

export type ContradictionDraft = Omit<
  Contradiction,
  "id" | "status" | "createdAt" | "updatedAt"
> & {
  stableKey: string;
  status?: ContradictionStatus;
};

export interface ContradictionAnalysisState {
  projectId: string;
  lastAnalyzedAt: Timestamp | null;
  contradictionCount: number;
  summary: string;
}

export interface LintIssue {
  id: string;
  projectId: string;
  issueType: LintIssueType;
  severity: LintIssueSeverity;
  status: LintIssueStatus;
  relatedPageId?: string | null;
  relatedClaimIds: string[];
  title: string;
  description: string;
  recommendedAction: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  metadata?: StringMetadata;
}

export type LintIssueDraft = Omit<
  LintIssue,
  "id" | "status" | "createdAt" | "updatedAt"
> & {
  stableKey: string;
  status?: LintIssueStatus;
};
