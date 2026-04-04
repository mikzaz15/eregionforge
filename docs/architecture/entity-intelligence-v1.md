# Entity Intelligence v1

## What entities are in EregionForge

Entity intelligence turns repeated research subjects into durable structured objects instead of leaving them as loose strings across claims, pages, thesis sections, dossier bullets, contradictions, and catalysts.

Entity types in v1:

- `company`
- `product_or_segment`
- `operator`
- `market_or_competitor`
- `metric`
- `risk_theme`

Each entity keeps a canonical name, aliases, confidence, and linked source, claim, and wiki page ids.

## How extraction works

The first pass is heuristic and source-grounded.

Inputs:

- canonical wiki pages and current revisions
- compiled claims
- source records and summaries
- stored thesis content
- stored dossier content

Heuristics:

- repeated named subjects across multiple supporting objects
- heading and page-title structure
- claim text pattern matching
- issuer and identifier normalization for the core company
- investment-native patterns for products, operators, competitors, metrics, and risk themes

The compiler promotes only entities with enough supporting linkage to be useful, then persists the compiled set and an analysis state record.

## How entity intelligence improves the product

### Dossier

The dossier now uses entity records to sharpen:

- company profile
- products and segments
- management and operators
- market and competition
- key metrics and facts

This makes the dossier more specific and less dependent on whichever page summary happened to win a heuristic ranking.

### Thesis

The thesis now uses entity records to improve:

- subject clarity
- bull and bear specificity
- risk-theme articulation
- variant framing around operators, competitors, and product scope

### Catalysts

Catalysts now try to attach a primary entity so catalyst titles and descriptions read more like investment objects than generic dated events.

### Contradictions

Contradiction detection now uses shared entity scope to reduce shallow matches and to explain what the disagreement is actually about.

## What remains heuristic

This is not a full entity-resolution or knowledge-graph system yet.

Current limitations:

- extraction is pattern-based and biased toward the seeded investment workflow
- aliases are normalized heuristically, not by a full entity linker
- operator and competitor detection is still coarse
- metric extraction is phrase-based, not schema-aware
- downstream services still use entities as guidance, not as hard relational truth

## Next semantic targets

The next useful upgrades would be:

- stronger company / competitor / operator resolution
- fragment-level attribution for why an entity exists
- entity-aware confidence explanations in the UI
- entity-linked contradiction clusters instead of pairwise issue generation
- entity-backed catalyst invalidation and state changes
