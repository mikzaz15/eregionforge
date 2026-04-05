import type {
  Artifact,
  ArtifactProvenance,
  ArtifactType,
  AskSession,
  Claim,
  Source,
  WikiPage,
} from "@/lib/domain/types";
import { artifactsRepository } from "@/lib/repositories/artifacts-repository";
import { askSessionsRepository } from "@/lib/repositories/ask-sessions-repository";
import { claimsRepository } from "@/lib/repositories/claims-repository";
import { sourcesRepository } from "@/lib/repositories/sources-repository";
import { wikiRepository } from "@/lib/repositories/wiki-repository";

export type ArtifactTypeOption = {
  value: ArtifactType;
  label: string;
};

export type ArtifactSummaryRecord = {
  artifact: Artifact;
  wikiPageCount: number;
  sourceCount: number;
  claimCount: number;
};

export type ArtifactDetailRecord = {
  artifact: Artifact;
  askSession: AskSession | null;
  referencedPages: WikiPage[];
  referencedSources: Source[];
  referencedClaims: Claim[];
};

export const artifactTypeOptions: ArtifactTypeOption[] = [
  { value: "memo", label: "Memo" },
  { value: "briefing", label: "Briefing" },
  { value: "comparison_report", label: "Comparison Report" },
  { value: "slide_outline", label: "Slide Outline" },
  { value: "saved_answer", label: "Saved Answer" },
];

export function artifactTypeLabel(artifactType: ArtifactType): string {
  return (
    artifactTypeOptions.find((option) => option.value === artifactType)?.label ??
    artifactType
  );
}

export function artifactProvenanceLabel(provenance: ArtifactProvenance): string {
  switch (provenance) {
    case "ask-mode":
      return "Saved from Ask";
    case "manual":
      return "Manual";
    case "wiki-derived":
      return "Wiki Derived";
    case "research-synthesis":
      return "Research Synthesis";
    default:
      return provenance;
  }
}

function previewText(markdownContent: string, length = 180): string {
  const normalized = markdownContent.replace(/\s+/g, " ").trim();
  return normalized.length > length
    ? `${normalized.slice(0, length).trimEnd()}...`
    : normalized;
}

export function artifactTitleFromAskSession(session: AskSession): string {
  if (session.metadata?.artifactTitle) {
    return session.metadata.artifactTitle;
  }

  const normalizedPrompt = session.prompt.replace(/\s+/g, " ").trim();
  const compactPrompt =
    normalizedPrompt.length > 60
      ? `${normalizedPrompt.slice(0, 60).trimEnd()}...`
      : normalizedPrompt;

  return `Saved Answer: ${compactPrompt}`;
}

export async function createArtifact(input: {
  projectId: string;
  artifactType: ArtifactType;
  title: string;
  markdownContent: string;
  provenance: ArtifactProvenance;
  status?: Artifact["status"];
  originatingPrompt?: string | null;
  derivedFromAskSessionId?: string | null;
  referencedWikiPageIds?: string[];
  referencedSourceIds?: string[];
  referencedClaimIds?: string[];
  eligibleForWikiFiling?: boolean;
  metadata?: Artifact["metadata"];
}): Promise<Artifact> {
  return artifactsRepository.create({
    projectId: input.projectId,
    artifactType: input.artifactType,
    title: input.title,
    markdownContent: input.markdownContent,
    previewText: previewText(input.markdownContent),
    provenance: input.provenance,
    originatingPrompt: input.originatingPrompt ?? null,
    derivedFromAskSessionId: input.derivedFromAskSessionId ?? null,
    referencedWikiPageIds: input.referencedWikiPageIds ?? [],
    referencedSourceIds: input.referencedSourceIds ?? [],
    referencedClaimIds: input.referencedClaimIds ?? [],
    eligibleForWikiFiling: input.eligibleForWikiFiling ?? false,
    status: input.status ?? "draft",
    metadata: input.metadata ?? {},
  });
}

export async function listProjectArtifacts(input: {
  projectId: string;
  artifactType?: ArtifactType | null;
}): Promise<ArtifactSummaryRecord[]> {
  const artifacts = await artifactsRepository.listByProjectId(input.projectId);
  const filtered = input.artifactType
    ? artifacts.filter((artifact) => artifact.artifactType === input.artifactType)
    : artifacts;

  return filtered.map((artifact) => ({
    artifact,
    wikiPageCount: artifact.referencedWikiPageIds.length,
    sourceCount: artifact.referencedSourceIds.length,
    claimCount: artifact.referencedClaimIds.length,
  }));
}

export async function getArtifactDetail(
  artifactId: string,
): Promise<ArtifactDetailRecord | null> {
  const artifact = await artifactsRepository.getById(artifactId);

  if (!artifact) {
    return null;
  }

  const [askSession, referencedPages, referencedSources, allClaims] = await Promise.all([
    artifact.derivedFromAskSessionId
      ? askSessionsRepository.getById(artifact.derivedFromAskSessionId)
      : Promise.resolve(null),
    Promise.all(
      artifact.referencedWikiPageIds.map((pageId) => wikiRepository.getPageById(pageId)),
    ),
    Promise.all(
      artifact.referencedSourceIds.map((sourceId) => sourcesRepository.getById(sourceId)),
    ),
    claimsRepository.listByProjectId(artifact.projectId),
  ]);

  return {
    artifact,
    askSession,
    referencedPages: referencedPages.filter((page): page is WikiPage => Boolean(page)),
    referencedSources: referencedSources.filter(
      (source): source is Source => Boolean(source),
    ),
    referencedClaims: allClaims.filter((claim) =>
      artifact.referencedClaimIds.includes(claim.id),
    ),
  };
}

export async function setArtifactWikiFilingEligibility(input: {
  artifactId: string;
  eligibleForWikiFiling: boolean;
}): Promise<Artifact | null> {
  return artifactsRepository.updateWikiFilingEligibility(
    input.artifactId,
    input.eligibleForWikiFiling,
  );
}
