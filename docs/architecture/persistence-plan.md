# Persistence Plan

## Purpose

EregionForge started as an in-memory showcase so the product loop could be proven quickly.

This phase extends the durable path through the major derived intelligence layer without forcing a risky migration of every operational record at once.

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
12. `catalysts-repository.ts`
13. `contradictions-repository.ts`
14. `timeline-events-repository.ts`
15. `company-dossiers-repository.ts`
16. `lint-issues-repository.ts`
17. `compile-jobs-repository.ts`
18. `operational-audit-events-repository.ts`

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
- catalysts and catalyst compile state
- contradictions and contradiction analysis state
- timeline events and timeline compile state
- company dossiers
- lint issues and local workflow status
- compile jobs
- operational audit events

## Still In Memory

No first-class repositories remain in-memory in the current main product path.

What remains non-durable is deeper lineage and audit detail that has not yet been modeled as its own repository layer.

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
14. lint issues
15. compile jobs
16. operational audit history
17. deeper object-level refresh lineage

The first sixteen are now on the durable path.

## Why SQLite First

SQLite is the safest hardening step right now because:

- it adds real durability immediately
- it requires no external service to run locally
- it preserves the current repo and demo flow
- it still sits behind repository interfaces, so a future Postgres-backed adapter remains cleanly possible

## What Remains Seeded Or Showcase-Only

For now, these can remain seeded or showcase-oriented:

- any future richer audit trails beyond current object snapshots
- deeper object-to-object lineage for refresh causality

The main research surfaces and first-pass operations history now persist. The remaining migration work is about richer explanation, not basic durability.

## Near-Term Next Step

The next persistence sprint should focus on operational durability:

- object refresh ledgers or audit trails beyond the current job/event layer
- explicit revision history for catalysts, dossiers, contradictions, and timeline compiles where needed

EregionForge now has a durable canon, durable derived intelligence objects, and durable first-pass operational history. The next gap is richer lineage and revision semantics.
