# Source Monitoring

## Purpose

Source monitoring is EregionForge's first freshness-intelligence layer.

It does not crawl the web or run background jobs yet.
Instead, it evaluates the current project state and answers a narrower operational question:

- has new knowledge arrived after major compiled views were produced?
- which compiled views may now be stale?
- what should the operator refresh next?

The goal is to keep thesis-quality research outputs aligned with the compiled knowledge base.

## Core Objects

### Source monitoring record

A source monitoring record tracks a single source against the latest compile boundary and records:

- when the source was last seen
- the last completed project compile timestamp
- a freshness status
- an impact estimate
- a human-readable stale reason

This is intentionally source-grounded. Monitoring starts from concrete inputs, not generic health scores.

### Stale alert

A stale alert is a project-level warning that a major compiled intelligence surface may need refresh.

Current alert types:

- `thesis_may_be_stale`
- `dossier_may_be_stale`
- `catalyst_tracker_needs_refresh`
- `contradictions_should_rerun`

Each alert carries severity, status, related object ids, and suggested action metadata.

## Detection Heuristics

Current monitoring is heuristic and intentionally practical.

### Source freshness

Per-source freshness is determined by:

- source processing state
- whether a completed project compile exists
- whether the source `updatedAt` is newer than the latest completed compile

Current statuses:

- `current`
- `new_since_compile`
- `uncompiled`
- `stale`

### Impact estimation

Impact is inferred from whether a source is referenced by:

- thesis support
- dossier support
- catalysts
- compiled wiki pages

This is a first-pass proxy for likely decision impact.

### Thesis stale alert

The thesis is flagged when it predates material project changes such as:

- newer relevant sources
- newer timeline events
- newer contradiction analysis
- newer catalyst compilation
- contradiction-count or catalyst-count deltas versus thesis metadata

### Dossier stale alert

The dossier is flagged when it predates:

- changed source-summary pages
- changed dossier-linked sources

### Catalyst stale alert

The catalyst tracker is flagged when it predates:

- newer relevant sources
- newer timeline compile state
- newer thesis state

### Contradictions stale alert

Contradiction analysis is flagged when it predates:

- updated pages or revisions
- updated timeline events
- changed sources

## UI Role

Monitoring currently appears in three places:

- the workspace monitoring page
- the project detail freshness panel
- the thesis freshness area

This keeps stale intelligence visible where research operators are already working, while preserving a dedicated queue for freshness review.

## Limitations

Current limitations are intentional:

- no background scheduler
- no external polling
- no fragment-level change attribution
- no semantic estimate of how much an update changes the thesis
- no per-project monitoring route outside the active workspace surface

The system answers "what may now be stale?" before it attempts "what exactly changed in meaning?"

## Future Direction

Planned expansion areas:

- persisted monitoring history
- automated source check runs
- stronger input lineage from source fragments to thesis sections
- richer materiality scoring
- automatic reopen or dismissal policy for stale alerts
- direct refresh bundles that rerun only the affected compile layers
