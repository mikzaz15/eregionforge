# Knowledge Linting

## Purpose

EregionForge linting is the first operational trust layer for the compiled wiki.

It does not try to prove truth in the abstract. It inspects the current compiled canon and identifies places where the system should not behave as if knowledge is settled. The output is a project-scoped issue queue that can drive refresh, review, and future automation.

The compiled wiki remains the center:

- sources feed pages
- pages emit claims
- evidence links support claims
- linting evaluates the health of that compiled state

## Current Domain Model

Each lint issue currently carries:

- `id`
- `projectId`
- `issueType`
- `severity`
- `status`
- `relatedPageId`
- `relatedClaimIds`
- `title`
- `description`
- `recommendedAction`
- `createdAt`
- `updatedAt`
- optional `metadata`

The repository is in-memory today, but it is isolated behind `lint-issues-repository.ts` so persistent storage can replace it later without changing the route layer.

## Current Heuristics

The first pass is intentionally practical and explicit.

### `unsupported_claims`

Generated for any claim whose support status is not `supported`.

- `unresolved` claims are treated as higher severity
- `weak-support` claims remain actionable but slightly lower severity

### `weakly_supported_page`

Generated for pages where unsupported claims are a meaningful share of the page.

Current heuristic:

- at least one unsupported claim
- and either at least 40% of claims are weak or unresolved
- or at least 2 claims are unresolved

This is meant to catch pages that look canonical in the UI but are still thinly supported.

### `stale_page`

Generated when a page appears behind its inputs.

Current heuristic has two modes:

1. direct timestamp comparison
   - if a linked source was updated after the current page revision timestamp
2. placeholder seeded-page strategy
   - if a page has linked sources but predates deterministic compile metadata

The second mode is explicitly temporary. We do not yet track source-version fingerprints or compile input hashes.

### `orphan_page`

Generated for non-top-level pages when the current wiki graph suggests the page is disconnected.

Current heuristic:

- no detected backlinks from other page bodies or summaries
- no shared-source connections to other pages

This is a graph-quality check, not a truth claim.

### `missing_expected_page`

Generated when source-summary pages exist but top-level canon is missing an expected page:

- `overview`
- `concept-index`
- `open-questions`

This keeps the wiki from degrading into isolated page fragments without project-level structure.

### `duplicate_or_overlapping_concept`

Currently a low-confidence placeholder heuristic.

- compares normalized page titles
- flags exact normalized matches or very high token overlap

This is only a review prompt for now, not an automatic merge signal.

## Status And Actions

Issues currently support lightweight operational actions:

- recompile canon
- open page
- review evidence
- mark resolved
- create placeholder for missing expected page

Status is mutable in-memory. This is enough to test the workflow shape before durable persistence lands.

## Known Placeholder Areas

The following logic is explicitly temporary:

- stale detection for seeded pages without generation fingerprints
- duplicate concept detection based only on title overlap
- orphan detection without a first-class link graph
- local in-memory issue status instead of persistent audit history
- project-wide recompilation standing in for page-scoped rebuild orchestration

## Likely Next Steps

- persist lint issues and status history in the database
- store compile input fingerprints so freshness is based on source versions, not timestamps alone
- add richer page graph analysis using explicit page links and concept references
- promote lint output into compiler and ask-mode retrieval policies
- let future agents use lint state as part of trust-aware execution planning
