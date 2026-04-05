import type {
  Claim,
  EvidenceLink,
  Source,
  SourceFragment,
} from "@/lib/domain/types";

export type EvidenceLineageLookup = {
  evidenceByClaimId: Map<string, EvidenceLink[]>;
  evidenceById: Map<string, EvidenceLink>;
  fragmentsById: Map<string, SourceFragment>;
  fragmentsBySourceId: Map<string, SourceFragment[]>;
  claimsById?: Map<string, Claim>;
  sourcesById?: Map<string, Source>;
};

export type EvidenceLineageRefShape = {
  claimIds: string[];
  sourceIds: string[];
  evidenceLinkIds?: string[];
  sourceFragmentIds?: string[];
};

export type EvidenceHighlight = {
  evidenceLink: EvidenceLink | null;
  fragment: SourceFragment;
  source: Source | null;
  claim: Claim | null;
  snippet: string;
};

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function fallbackFragmentsForSource(
  fragments: SourceFragment[],
  limit = 1,
): SourceFragment[] {
  const preferred = fragments.filter(
    (fragment) => fragment.fragmentType !== "heading",
  );

  return (preferred.length > 0 ? preferred : fragments).slice(0, limit);
}

export function buildEvidenceLineageLookup(input: {
  evidenceLinks: EvidenceLink[];
  fragments: SourceFragment[];
  claimsById?: Map<string, Claim>;
  sourcesById?: Map<string, Source>;
}): EvidenceLineageLookup {
  return {
    evidenceByClaimId: input.evidenceLinks.reduce<Map<string, EvidenceLink[]>>(
      (map, link) => {
        map.set(link.claimId, [...(map.get(link.claimId) ?? []), link]);
        return map;
      },
      new Map(),
    ),
    evidenceById: new Map(
      input.evidenceLinks.map((link) => [link.id, link] as const),
    ),
    fragmentsById: new Map(
      input.fragments.map((fragment) => [fragment.id, fragment] as const),
    ),
    fragmentsBySourceId: input.fragments.reduce<Map<string, SourceFragment[]>>(
      (map, fragment) => {
        map.set(fragment.sourceId, [...(map.get(fragment.sourceId) ?? []), fragment]);
        return map;
      },
      new Map(),
    ),
    claimsById: input.claimsById,
    sourcesById: input.sourcesById,
  };
}

export function attachEvidenceLineage<T extends EvidenceLineageRefShape>(
  refs: T,
  lookup: EvidenceLineageLookup,
): T {
  const evidenceLinks = refs.claimIds.flatMap(
    (claimId) => lookup.evidenceByClaimId.get(claimId) ?? [],
  );
  const directFragmentIds = evidenceLinks.map((link) => link.sourceFragmentId);
  const fallbackFragmentIds = refs.sourceIds.flatMap((sourceId) =>
    fallbackFragmentsForSource(lookup.fragmentsBySourceId.get(sourceId) ?? [], 1).map(
      (fragment) => fragment.id,
    ),
  );

  return {
    ...refs,
    evidenceLinkIds: dedupeStrings([
      ...(refs.evidenceLinkIds ?? []),
      ...evidenceLinks.map((link) => link.id),
    ]),
    sourceFragmentIds: dedupeStrings([
      ...(refs.sourceFragmentIds ?? []),
      ...directFragmentIds,
      ...fallbackFragmentIds,
    ]),
  };
}

export function hydrateEvidenceLinks(
  evidenceLinkIds: string[] | undefined,
  lookup: EvidenceLineageLookup,
): EvidenceLink[] {
  return dedupeStrings(evidenceLinkIds ?? [])
    .map((id) => lookup.evidenceById.get(id) ?? null)
    .filter((value): value is EvidenceLink => Boolean(value));
}

export function hydrateSourceFragments(
  fragmentIds: string[] | undefined,
  lookup: EvidenceLineageLookup,
): SourceFragment[] {
  return dedupeStrings(fragmentIds ?? [])
    .map((id) => lookup.fragmentsById.get(id) ?? null)
    .filter((value): value is SourceFragment => Boolean(value));
}

export function buildFragmentSnippet(fragment: SourceFragment): string {
  const raw =
    fragment.excerpt?.trim() ||
    fragment.text.trim() ||
    fragment.title?.trim() ||
    "No fragment text available.";
  const normalized = raw.replace(/\s+/g, " ").trim();

  return normalized.length > 180
    ? `${normalized.slice(0, 180).trimEnd()}...`
    : normalized;
}

export function collectEvidenceHighlights(
  input: EvidenceLineageRefShape & { limit?: number },
  lookup: EvidenceLineageLookup,
): EvidenceHighlight[] {
  const attached = attachEvidenceLineage(input, lookup);
  const evidenceLinks = hydrateEvidenceLinks(attached.evidenceLinkIds, lookup);
  const evidenceHighlights = evidenceLinks
    .map<EvidenceHighlight | null>((link) => {
      const fragment = lookup.fragmentsById.get(link.sourceFragmentId) ?? null;

      if (!fragment) {
        return null;
      }

      return {
        evidenceLink: link,
        fragment,
        source: lookup.sourcesById?.get(fragment.sourceId) ?? null,
        claim: lookup.claimsById?.get(link.claimId) ?? null,
        snippet: buildFragmentSnippet(fragment),
      };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null);

  const seenFragmentIds = new Set(evidenceHighlights.map((entry) => entry.fragment.id));
  const fallbackHighlights = hydrateSourceFragments(attached.sourceFragmentIds, lookup)
    .filter((fragment) => !seenFragmentIds.has(fragment.id))
    .map((fragment) => ({
      evidenceLink: null,
      fragment,
      source: lookup.sourcesById?.get(fragment.sourceId) ?? null,
      claim: null,
      snippet: buildFragmentSnippet(fragment),
    }));

  return [...evidenceHighlights, ...fallbackHighlights].slice(0, input.limit ?? 4);
}
