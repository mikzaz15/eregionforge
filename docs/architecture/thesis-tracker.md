# Thesis Tracker

## What a thesis is in EregionForge

A thesis is a compiled project view that turns current knowledge into an investment-style research posture.

It is not a price target, screener, or portfolio tool.
It is a source-grounded workspace object built from:

- canonical wiki pages
- claims and their support posture
- source records
- timeline events
- contradictions
- durable artifacts

The thesis record currently stores:

- title
- subject name
- ticker if present
- status
- overall stance
- summary
- bull case
- bear case
- variant view
- key risks
- key unknowns
- catalyst summary
- confidence
- section-level support references

## How the thesis is compiled

The thesis service currently compiles one thesis record per project.

The current deterministic flow:

1. gather project wiki pages and current revisions
2. gather project claims and support posture
3. gather project sources
4. gather compiled timeline events
5. gather contradiction records
6. gather artifacts for additional directional signal
7. synthesize stance, risks, unknowns, and catalysts
8. persist the thesis record with section-level support references

This keeps the thesis tracker downstream of compiled knowledge rather than letting it become an isolated note editor.

## Current synthesis heuristics

The first pass is intentionally heuristic.

Current thesis compilation uses:

- constructive versus negative language in claims and page summaries
- page type hints such as `investment-thesis`, `dossier`, `risk-register`, and `open-questions`
- contradiction volume and severity
- unresolved and open-question claims
- timeline events as catalyst candidates
- artifact preview text as a secondary directional signal

The resulting thesis is practical and auditable, not semantically deep yet.

## Provenance model

Each major thesis section carries references to:

- supporting wiki pages
- relevant claims
- relevant sources
- relevant timeline entries
- relevant contradictions

This is mandatory.
The thesis tracker is only valuable if a user can inspect why a section was compiled the way it was.

## Current limitations

Current limitations are explicit:

- synthesis is deterministic and keyword driven
- section quality depends on the current density and quality of claims
- ticker detection is shallow and only uses present metadata
- artifact influence is lightweight and mostly directional
- catalysts are derived from timeline records, not future-event modeling
- the thesis does not yet version or diff across refreshes

## Future direction

Likely next upgrades:

- stronger entity and ticker detection
- section-level semantic ranking rather than keyword scoring
- thesis revisions and historical comparison
- contradiction-aware stance adjustments
- direct filing of thesis sections back into wiki pages or artifacts
- deeper investment-research vertical objects such as underwriting assumptions and variant scenarios
