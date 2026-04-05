# Canon Quality v1

## Purpose

Canon Quality v1 improves the compiled wiki itself so higher research surfaces start from stronger page structure, better revision fidelity, clearer support posture, and more useful freshness signals.

The goal is not a new product surface. The goal is to make the canonical layer more authoritative and more operational as the base for thesis, dossier, catalysts, contradictions, monitoring, and Ask mode.

## What Improved

### Stronger canonical page structure

- Source-summary pages now include a clearer canonical posture section, entity context, and less generic summaries.
- Project-level canon pages now use entity-aware context and evidence samples rather than only generic corpus counts.
- Overview, concept-index, and open-questions pages now emit deterministic claims instead of remaining trust-empty pages.

### Better revision fidelity

- Wiki revision churn now avoids creating a new revision when page content has not materially changed after normalization.
- Change notes are now section-aware and summarize which sections materially changed.
- Revision metadata records changed sections so canon inspection can show what actually moved.

### Better support posture

- Canon pages now carry page-level support density metadata derived from supported claim ratio and source diversity.
- Weakly supported pages are easier to identify because support posture is aggregated at the page level, not only at individual claim level.
- Project-level canon pages now participate in the trust layer, which improves downstream support coverage.

### Better canon freshness

- Wiki summaries and detail views now evaluate whether linked sources or claims are newer than the current page revision.
- Seeded or unrefreshed pages are treated as stale until they are refreshed through the deterministic compiler.
- These freshness signals are lightweight and heuristic, but they make canon maintenance more visible.

## How It Works

### Compilation quality

The deterministic compiler now:

1. compiles source-summary pages with entity-aware summary text
2. generates project-level overview, concept-index, and open-questions pages with stronger structure
3. emits deterministic claims for those project-level pages
4. stores support-density and changed-section metadata in page generation metadata

### Revision quality

Revision creation is now based on normalized page content rather than raw string equality alone. If page content has not materially changed, the compiler refreshes page metadata without creating a noisy new revision.

When content does change, the compiler:

- compares prior and current markdown sections
- records the changed section titles
- generates a more meaningful change note

### Support and freshness

Wiki support posture uses:

- supported claim count
- weak-support claim count
- unresolved claim count
- evidence-linked source diversity

Wiki freshness uses:

- current revision timestamp
- latest linked source update timestamp
- latest linked claim update timestamp
- whether the page is still seeded rather than compiler-generated

## Downstream Impact

These canon improvements should indirectly improve:

- thesis clarity and confidence inputs
- dossier structure and specificity
- contradiction grouping and rationale
- catalyst specificity
- Ask mode retrieval quality when canonical pages are consulted first

## What Remains Heuristic

- section quality is still deterministic and rule-based rather than model-authored
- changed-section detection is markdown-section based, not semantic diffing
- page freshness is timestamp driven rather than fragment-level dependency tracked
- support posture does not yet include explicit contradiction burden at page-section level

## Next Likely Improvements

- fragment-level dependency tracking for page freshness
- stronger page-section support maps instead of page-level aggregation only
- better claim-to-section attachment for page rendering
- smarter no-op detection that considers semantic equivalence, not only normalized markdown text
