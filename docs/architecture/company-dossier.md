# Company Dossier

## What A Dossier Is

In EregionForge, a company dossier is a compiled research view for a project subject.

It is not:

- a CRM record
- a quote page
- a generic company profile

It is a structured, source-grounded dossier that consolidates the most important business, product, operator, market, and coverage context already present in the project knowledge stack.

## How It Is Compiled

The current dossier compiler reads from:

1. wiki pages and current revisions
2. compiled claims
3. source records
4. artifacts
5. thesis context where useful

The first pass is deterministic and heuristic-driven.

The compiler currently produces:

- business overview
- products and segments
- management and operators
- market and competition
- key metrics and facts
- source coverage summary

Each section carries supporting references so the dossier remains inspectable instead of becoming detached synthesis.

## Provenance Model

Each dossier section can reference:

- wiki pages
- claims
- sources
- artifacts

This keeps trust visible and makes the dossier useful as an operator-facing research object rather than a polished but opaque summary.

## Current Readiness Model

The dossier currently tracks simple readiness through section coverage.

Coverage is based on whether a section has at least some compiled supporting references behind it. This is intentionally practical:

- it shows whether the dossier is thin or usable
- it avoids pretending to measure true completeness
- it can later be replaced by stronger coverage scoring

## Current Limitations

- dossier state is now durable, but dossier refreshes still overwrite the current compiled record rather than creating dossier revisions
- extraction and synthesis are heuristic-heavy
- operator and management coverage depends on existing source language
- key metrics are compiled from research facts already present in claims and source metadata, not live market feeds
- section coverage is a coarse readiness signal, not a semantic quality score

## Future Direction

Likely next improvements include:

- richer entity and operator extraction
- stronger market and competitor normalization
- explicit linkage between dossier sections and thesis sections
- revision history for dossier refreshes
- filing dossier sections back into canonical wiki pages when appropriate

The product direction is compiled research intelligence, not terminal-style market screens.
