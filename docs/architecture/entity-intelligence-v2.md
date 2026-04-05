# Entity Intelligence v2

## What improved

Entity Intelligence v2 focuses on resolution quality rather than adding a graph UI.

The main upgrades are:

- stronger competitor normalization so peer-group and market-cycle entities are less duplicative
- stronger operator normalization so management references collapse into cleaner operator entities
- stronger product and segment normalization so automotive modules, industrial sockets, and the Gen-4 platform remain distinct
- higher-priority entity matching so downstream consumers prefer clearer subject, segment, peer, and metric anchors
- better entity inspection so the `/entities` surface shows where an entity matters most and links into catalysts and contradictions

## Stronger normalization

### Competitors and market context

The compiler now normalizes:

- `power module vendors`
- `peer vendors`
- `competitor set`
- `peer group`

into a clearer peer-group entity.

It also normalizes wide-bandgap / silicon-carbide capacity language into a cleaner market-cycle entity so market context is less fragmented.

### Operators

The compiler now treats repeated management, leadership, executive-team, and company-management references as one normalized operator object rather than a noisy set of near-duplicates.

### Products and segments

The compiler now resolves:

- EV power modules
- automotive modules
- automotive power modules

into `Automotive power modules`.

It also keeps `Industrial sockets` and `Gen-4 automotive platform` distinct so thesis, catalysts, and contradictions can stay more segment-aware.

## Downstream improvements

### Thesis

The thesis now ranks entities with clearer priority:

- subject company first
- core segments and core metrics next
- peer-group and market entities after that

This makes bull, bear, and variant synthesis more specific and less theme-only.

### Dossier

The dossier now uses stronger entity influence summaries for:

- company profile
- products and segments
- management and operators
- market and competition
- key metrics and facts

That makes the dossier read more like an investment-research briefing and less like a loose category rollup.

### Catalysts and contradictions

Catalysts now choose stronger primary entities for titles and lineage summaries.

Contradictions now prefer higher-signal shared entities when summarizing what the disagreement is actually about.

### Ask

Ask now uses stronger entity ranking for prompt matching and consulted-entity summaries, which makes research outputs more explicit about what company, segment, peer, metric, or risk entity the answer is leaning on.

## Entity inspection quality

The entity view now shows:

- canonical name
- aliases
- normalized role
- influence summary
- where the entity matters most
- linked catalysts and contradictions, not only supporting pages/claims/sources

This keeps the surface compact while making the entity layer more inspectable.

## What remains heuristic

Entity Intelligence v2 is still heuristic.

Current limits:

- no fragment-level entity lineage yet
- no company-name resolver beyond practical alias and pattern normalization
- no hard relational truth for which catalyst or contradiction “belongs” to an entity
- no external identifier system for public companies, operators, or competitors

## Next likely upgrades

- entity-backed lineage at the evidence-link or fragment level
- stronger competitor-name extraction beyond peer-group normalization
- explicit entity influence on confidence explanations
- durable direct entity linkage on catalysts and contradictions instead of inferred linkage only
