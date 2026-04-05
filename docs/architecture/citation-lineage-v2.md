# Citation / Lineage v2

## What Lineage Means In EregionForge

EregionForge does not aim to be an academic citation engine.

Lineage means:

- which canon pages, claims, and sources support a compiled conclusion
- which higher-order objects influenced a surface the most
- which timeline, contradiction, catalyst, or entity objects sit behind the current posture
- which likely drivers moved a thesis refresh or Ask output

The goal is practical traceability for an intelligence workflow.

## What Improved

Citation / Lineage v2 improves trust traceability across:

- thesis section support
- dossier section support
- thesis revision change drivers
- Ask sessions and saved Ask artifacts
- catalyst cards
- contradiction cards

The main improvements are:

- thesis section lineage now carries entity and catalyst support in addition to pages, claims, sources, timeline, and contradictions
- dossier section lineage now carries entity support alongside pages, claims, sources, and artifacts
- Ask sessions now persist consulted derived-object lineage for entities, catalysts, contradictions, timeline events, and freshness alerts
- saved Ask artifacts now retain stronger provenance and lineage metadata
- catalyst and contradiction records now store compact anchor and lineage summaries for UI traceability

## Thesis And Dossier Lineage

Thesis section references now surface:

- canon pages
- claims
- sources
- entities
- catalysts
- timeline events
- contradictions

Dossier section references now surface:

- canon pages
- claims
- sources
- artifacts
- entities

This keeps section support inspectable without turning every section into a dense raw object dump.

## Revision Change Lineage

Thesis revision history already stored likely drivers.

This sprint makes that lineage more useful by:

- keeping catalyst drivers visible alongside pages, claims, sources, timeline, contradictions, and artifacts
- pairing change materiality with likely drivers so maintenance refreshes are easier to distinguish from meaningful movement

The revision model is still heuristic. It is intended to show the most likely moving parts, not claim exact causal certainty.

## Ask Lineage

Ask sessions now preserve lineage beyond consulted pages, claims, and sources.

They also capture:

- consulted entity ids
- consulted catalyst ids
- consulted contradiction ids
- consulted timeline event ids
- consulted alert ids

The Ask surface uses that data to show a more explicit derived-intelligence scope, and saved Ask artifacts carry stronger provenance blocks so they remain inspectable after the original session scrolls away.

## Catalyst And Contradiction Traceability

Catalyst records now expose:

- primary anchor summary
- thesis linkage summary
- lineage summary across claims, sources, timeline events, and contradictions

Contradiction records now expose:

- anchor summary
- lineage summary across claims, canon pages, sources, and timeline events

This keeps the cards compact while making it clearer what each object is actually tied to.

## What Remains Coarse

Lineage is still intentionally lightweight.

What remains coarse or heuristic:

- no fragment-level inline citation rendering inside thesis or dossier markdown
- no exact causal guarantee that a listed driver fully explains a revision change
- no full graph traversal UI
- Ask artifact lineage is still metadata-driven rather than a separate first-class lineage table

## Next Likely Upgrades

- fragment-level and evidence-link-level lineage for thesis and Ask
- explicit lineage ranking per section instead of flat support lists
- a richer durable lineage model for saved artifacts and revision diffs
- stronger lineage-aware confidence and freshness explanations
