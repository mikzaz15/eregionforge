# Catalyst Tracker

## What A Catalyst Is In EregionForge

A catalyst in EregionForge is a compiled, source-grounded research object that tracks an event, condition, or inflection point that could move the active thesis.

It is not:

- a task
- an alerting rule
- a market-price trigger

It is a durable knowledge object that connects:

- thesis posture
- timeline events
- compiled claims
- supporting sources
- contradiction records where relevant

## How Catalysts Are Compiled

The current catalyst compiler reads from:

1. thesis context
2. compiled timeline events
3. compiled claims
4. contradiction records
5. source summaries

The first pass is heuristic-first and deterministic.

It currently identifies catalysts by looking for catalyst-like language around:

- earnings and result cycles
- launches and releases
- guidance changes
- customer or contract developments
- financing events
- industry or macro shifts
- regulatory signals

Timeline-linked catalysts get stronger timeframe structure when dated chronology already exists.

## Current Catalyst Fields

Each catalyst currently stores:

- title
- description
- catalyst type
- status
- expected timeframe
- timeframe precision
- importance
- confidence
- linked thesis id
- linked timeline events
- linked claims
- linked sources
- linked contradictions

This makes catalysts reusable by future thesis, ask, and artifact flows.

## Trust And Provenance

The catalyst tracker exposes supporting links for each catalyst:

- thesis
- timeline
- claims
- sources
- contradictions

This keeps catalysts inspectable and prevents them from collapsing into generic research bullets.

## Current Limitations

- catalyst state is now durable, but it still stores only the latest compiled set rather than a full catalyst revision history
- extraction is heuristic-heavy and keyword-driven
- status is inferred from timeframe windows rather than explicit event resolution tracking
- deduplication is still stable-key based, not semantic clustering
- catalysts do not yet keep revision history

## Future Direction

Likely follow-on improvements include:

- catalyst revisions and lifecycle history
- stronger contradiction-aware invalidation logic
- richer linkage into thesis revisions and dossier sections
- explicit operator review state for high-importance catalysts
- eventual ask-mode retrieval that can cite catalysts directly

The direction is investment intelligence grounded in compiled knowledge, not alerting infrastructure or task management.
