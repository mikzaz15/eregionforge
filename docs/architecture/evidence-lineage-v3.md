# Evidence / Fragment Lineage v3

## What Improved

Evidence lineage now moves beyond coarse object references in the highest-value trust surfaces.

- Thesis section support can carry `evidenceLinkIds` and `sourceFragmentIds`, then hydrate them into fragment-level support on read.
- Dossier section support uses the same evidence-aware support shape.
- Thesis revision intelligence now records evidence-link and source-fragment drivers so change summaries can point closer to what actually moved.
- Catalyst and contradiction records expose compact evidence highlights instead of only broad page/source references.
- Ask sessions now persist consulted evidence-link ids and source-fragment ids in metadata.
- Ask-derived artifacts retain the same evidence lineage so saved outputs can show fragment-level provenance.

## Supported Surfaces

The following surfaces now show stronger evidence specificity where practical:

- Thesis section support panels
- Thesis revision likely-driver panel
- Dossier section support panels
- Catalyst cards
- Contradiction cards
- Ask consulted-object inspection
- Ask-derived artifact detail pages

## How It Works

`evidence-lineage-v3.ts` provides the shared utility layer.

- `buildEvidenceLineageLookup(...)` creates maps over evidence links and fragments.
- `attachEvidenceLineage(...)` expands a coarse reference set with evidence-link ids and fallback fragment ids.
- `collectEvidenceHighlights(...)` returns compact highlight records with:
  - the evidence link when one exists
  - the backing fragment
  - the related source
  - the linked claim when available
  - a short snippet for UI display

The model is intentionally practical:

- prefer claim-backed evidence links first
- fall back to source fragments when a surface only has source-level grounding
- keep highlights short and compact to avoid noisy trust panels

## What Remains Heuristic

- Fragment selection still uses a best-effort heuristic when a surface only carries source-level references.
- Ask sessions persist evidence lineage in metadata rather than a dedicated normalized lineage table.
- Revision-driver evidence is still derived from likely-driver claims, not a full diff over evidence-link changes.
- Surfaces show a compact subset of evidence highlights rather than a complete citation ledger.

## Future Direction

Likely next upgrades:

- persist first-class lineage records instead of metadata-heavy arrays
- add section-level and revision-level material-driver ranking
- connect evidence changes directly into canon and thesis diff logic
- support fragment-level lineage for more thesis and dossier subsections
