# Freshness Intelligence v2

## Purpose

Freshness Intelligence v2 improves stale attribution across EregionForge without adding a new surface.

The goal is to make freshness signals more explainable and more investment-native by showing not just that a compiled view may be stale, but which changes likely matter.

## What Improved

### Thesis stale attribution

Thesis freshness now explains staleness using clearer driver categories instead of only a generic fingerprint mismatch.

Current driver language now includes combinations such as:

- supported-claim change
- support-density change
- source-diversity change
- contradiction-posture change
- exact-date timeline change
- theme shifts from newly changed sources

### Dossier stale attribution

Dossier stale alerts now point more clearly to:

- changed source-summary pages
- relevant source changes already linked to dossier support
- updated source themes that are likely to affect the dossier narrative

### Catalyst stale attribution

Catalyst refresh alerts now describe staleness in terms of:

- newly changed source themes
- thesis drift
- chronology drift
- catalyst-set relevance rather than only compile timestamps

### Contradiction stale attribution

Contradiction rerun alerts now describe likely drivers using:

- affected themes from changed sources
- newer canonical inputs
- updated timeline posture
- active contradiction burden

## Surface Impact

These improvements flow into:

- monitoring alerts
- thesis freshness messaging
- dossier freshness messaging
- command-view freshness summaries

No new route was added. The improvement is primarily semantic quality and better attribution on existing surfaces.

## What Remains Heuristic

Freshness Intelligence v2 is still heuristic.

It does not yet perform:

- fragment-level dependency tracking
- exact object lineage for every stale signal
- semantic diffing between prior and current compiled views
- source-fragment weighting at the attribution layer

## Likely Next Improvements

- page-level dependency graphs for canon freshness
- exact lineage between stale alerts and the job or object updates that triggered them
- confidence penalties that directly incorporate freshness burden in more UI surfaces
- richer operator-facing freshness breakdowns beyond a single driver summary string
