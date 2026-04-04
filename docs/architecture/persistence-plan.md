# Persistence Plan

## Purpose

EregionForge started as an in-memory showcase so the product loop could be proven quickly.

This phase extends the first durable path into the canon layer without forcing a risky migration of every derived object at once.

## Current Persistence Shape

EregionForge now runs in an explicit hybrid mode:

- local SQLite-backed repositories for the first durable path
- seeded bootstrap data for the demo workspace
- in-memory repositories for the remaining objects that are still safer to leave in showcase mode for now

The local database is intended to make the system feel durable during development and demos, while preserving clean repository seams for a later production adapter.

## Durable Now

These repositories now persist to the local SQLite store:

1. `projects-repository.ts`
2. `sources-repository.ts`
3. `source-fragments-repository.ts`
4. `wiki-repository.ts`
5. `claims-repository.ts`
6. `evidence-links-repository.ts`
7. `artifacts-repository.ts`
8. `ask-sessions-repository.ts`
9. `theses-repository.ts`
10. `thesis-revisions-repository.ts`
11. `source-monitoring-repository.ts`

This means the following now survive app restarts:

- project loading
- created source records
- source fragments created from ingestion
- wiki pages and wiki revisions
- claims attached to canon pages
- evidence links back to source fragments
- saved artifacts
- ask sessions
- thesis state
- thesis revision history
- monitoring records and stale alerts

## Still In Memory

These repositories remain in-memory for now:

1. `compile-jobs-repository.ts`
2. `lint-issues-repository.ts`
3. `catalysts-repository.ts`
4. `contradictions-repository.ts`
5. `timeline-events-repository.ts`
6. `company-dossiers-repository.ts`

Those objects are still safe to keep in-memory for the current product story because:

- the seeded Northstar demo is still the canonical showcase
- the UI already demonstrates the full workflow without requiring full write-back on every object
- the canon layer is now durable, so the remaining gap is mostly higher-order compiled analysis rather than the research base itself

## Seed And Demo Strategy

The seeded Northstar workspace remains the bootstrap layer.

Current behavior:

- seed data is inserted into SQLite on first use
- later user-created durable records coexist with the seeded demo data
- the database does not overwrite existing durable rows on every start

This keeps the demo story stable while allowing persistent overrides and newly created records to survive restarts.

## Migration Order

The intended migration order remains:

1. projects
2. sources
3. source fragments
4. wiki pages and revisions
5. claims and evidence links
6. artifacts
7. thesis records and thesis revisions
8. ask sessions
9. monitoring alerts and monitoring state
10. catalysts
11. contradictions
12. timeline events
13. dossier records
14. compile jobs and lint issue history

The first nine are now on the durable path.

## Why SQLite First

SQLite is the safest hardening step right now because:

- it adds real durability immediately
- it requires no external service to run locally
- it preserves the current repo and demo flow
- it still sits behind repository interfaces, so a future Postgres-backed adapter remains cleanly possible

## What Remains Seeded Or Showcase-Only

For now, these can remain seeded or showcase-oriented:

- the current contradictions, catalysts, timeline, and dossier projections
- compile job history and lint issue state

Those systems already work well as research surfaces. Their persistence can be promoted next without changing the UI contract.

## Near-Term Next Step

The next persistence sprint should move the higher-order derived analysis layer into durable storage:

- timeline events
- contradictions
- catalysts
- dossier records
- compile jobs and lint issue history

That is the point where EregionForge stops at a durable canon and starts becoming durable across the full intelligence stack.
