# Confidence Model v2

## Purpose

Confidence Model v2 makes trust posture more explicit across the core research surfaces. The goal is not numerical precision. The goal is to make it easier to inspect why a thesis, dossier, catalyst, contradiction, or canon page is currently considered low, medium, or high confidence.

## Shared Factors

Confidence is now derived from a shared factor vocabulary:

- `support_density`
- `source_diversity`
- `contradiction_burden`
- `freshness_burden`
- `entity_clarity`
- `date_precision`
- `stale_posture`
- `review_posture`

Not every surface uses every factor. The model is intentionally partial and explainable.

## Surface Use

### Thesis

The thesis now stores a confidence summary plus factor breakdown in metadata. Current compilation emphasizes:

- support density across thesis-supporting claims
- source diversity
- high-severity contradiction burden
- freshness burden from unstable source state
- entity clarity from the entity layer
- date precision from timeline support

### Dossier

The dossier now uses the same shared factor model, with emphasis on:

- supported claim density
- source diversity across dossier sections
- open contradiction burden
- freshness burden
- entity clarity
- section coverage as a light precision proxy

### Catalysts

Catalyst confidence now reflects:

- source and claim support density
- source diversity
- contradiction linkage burden
- timeframe precision
- entity specificity

Each catalyst stores a confidence summary and factor breakdown in metadata.

### Contradictions

Contradiction confidence is now more inspectable. It is influenced by:

- overlap and anchoring strength
- source diversity
- entity clarity
- timing precision for timeline tension
- freshness burden for stale-vs-newer conflicts

### Canon Pages

Key canon pages now get a derived page-level confidence posture in workspace reads. The current page-level model emphasizes:

- support density
- source diversity
- active contradiction burden
- entity clarity
- stale posture

This is currently computed at read time instead of being stored as a first-class persisted canon confidence record.

## UI Exposure

Confidence is now surfaced with lightweight explainability:

- compact confidence summaries
- factor chips
- command-view confidence notes for thesis and dossier
- wiki page confidence posture

The UI stays compact. Confidence reasoning is visible, but it is not expanded into a large scoring dashboard.

## What Remains Heuristic

- Factor weights are still hand-tuned.
- Contradiction confidence still relies on heuristic overlap and theme analysis.
- Canon page confidence is derived from currently linked objects, not fragment-level lineage.
- Review posture is only lightly integrated where it is already durable and meaningful.

## Next Likely Upgrades

- factor-level UI on more surfaces, especially command view summaries
- explicit confidence lineage from evidence fragments and entity matches
- stronger operator-review influence where human judgment should intentionally override weak automated posture
- section-level confidence within canon, thesis, and dossier instead of only object-level summaries
