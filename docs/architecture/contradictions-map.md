# Contradictions Map

## What it is

The contradictions map is a compiled integrity layer for EregionForge.

It does not behave like a generic warning system.
It turns disagreement across project knowledge objects into durable contradiction records that can be reviewed, resolved, and revisited.

Current contradiction records can link back to:

- claims
- wiki pages
- sources
- timeline events

Each record carries:

- contradiction type
- severity
- status
- confidence
- rationale
- provenance through linked internal objects

## Why it exists

Compiled knowledge is only trustworthy if tension is visible.

Sources can disagree.
Claims can conflict.
Canonical summaries can drift from newer evidence.
Timeline entries can imply incompatible chronology.

The contradictions map makes those tensions operational instead of leaving them implicit inside pages or ask outputs.

## Current contradiction types

- `direct_claim_conflict`
- `timeline_tension`
- `source_disagreement`
- `stale_vs_newer_claim`
- `overlapping_but_inconsistent_summary`

These are first-pass categories and are intentionally practical rather than exhaustive.

## Current detection heuristics

The current contradiction service runs project-scoped heuristic analysis over:

1. claims
2. sources
3. canonical page summaries and markdown
4. compiled timeline events

Current heuristics include:

- overlapping topic language plus opposing directional statements
- canon-first versus raw-chat-first interaction-model tension
- conflicting numeric values on overlapping topics
- incompatible status statements
- newer claim versus older claim tension on similar scope
- timeline entries tied to related scope but placed at materially different dates

The current analysis is deterministic and lightweight.
It is designed to be rerunnable and easy to replace with stronger semantic comparison later.

## How records are built

The contradiction service:

- gathers current project knowledge objects
- compares candidate pairs with overlap and theme heuristics
- creates contradiction drafts with type, severity, confidence, and rationale
- syncs those records into the contradiction repository
- preserves local review status when records remain stable across reruns

This makes contradictions first-class analysis outputs rather than transient UI warnings.

## Status model

Current statuses:

- `open`
- `reviewed`
- `resolved`

The status model is intentionally lightweight for now.
It is enough to support triage without overbuilding workflow state.

## Limitations

Current limitations are real and expected:

- detection is heuristic rather than semantic
- entity resolution is shallow and mostly token/theme driven
- claim pairing depends on text overlap, not full subject extraction
- source disagreement can still produce false positives on broad thematic overlap
- contradiction records do not yet explain exact fragment-level evidence deltas
- timeline tension currently uses date-distance heuristics rather than a richer chronology model

## Future direction

Likely next upgrades:

- stronger entity and subject normalization
- fragment-level rationale with exact evidence deltas
- contradiction clustering across more than two objects
- contradiction-aware ask responses
- timeline-aware impossible-sequence detection
- tighter reopening logic when resolved contradictions reappear on rerun
