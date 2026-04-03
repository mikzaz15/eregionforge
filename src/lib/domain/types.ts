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
export type RevisionConfidence = "low" | "medium" | "high";
export type CompileJobStatus = "pending" | "running" | "completed" | "failed";
export type AskAnswerMode =
  | "concise-answer"
  | "research-memo"
  | "compare-viewpoints"
  | "identify-contradictions"
  | "follow-up-questions";
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
