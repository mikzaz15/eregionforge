# Thesis Quality v2

## What Improved

Thesis Quality v2 makes the thesis read more like a current investment posture and less like a generic compiled overview.

The main upgrades are:

- richer synthesis from canon, entities, catalysts, contradictions, timeline state, freshness burden, and operator-reviewed posture
- more distinct bull, bear, variant, risk, unknown, and catalyst sections
- stronger refresh deltas with change materiality instead of a flat "something changed" summary
- clearer trust signaling through posture, major tension, freshness burden, and confidence context
- better project command-view thesis summaries driven by thesis metadata instead of only raw counts

## Synthesis Changes

The thesis compiler now treats the thesis as a current underwriting view.

It still starts from compiled canon, but it now pulls in:

- entity intelligence for subject clarity and better section specificity
- active and reviewed contradiction posture for tension framing
- catalyst posture for swing-factor and watchpoint language
- timeline precision for dated thesis relevance
- freshness burden and stale posture for recency caveats
- operator review posture for additional trust context where human review already happened

The top-line thesis summary now aims to answer:

- what the current stance is
- what is driving the posture
- what the main tension is
- how much freshness burden remains

## Revision Quality Changes

Thesis refreshes still create durable revisions, but revisions now distinguish between:

- `material`
- `meaningful`
- `maintenance`

Materiality is currently heuristic. It looks at:

- stance changes
- whether core sections changed
- confidence shifts
- contradiction count shifts
- catalyst count shifts

Change summaries now emphasize:

- whether the update was material or maintenance
- which sections changed
- whether stance moved
- whether contradiction or catalyst posture changed
- what likely drove the update

## Trust and Freshness

The thesis now stores compact trust metadata that can be reused by both the thesis page and the project command view.

Important metadata now includes:

- posture summary
- major tension summary
- freshness summary
- best next action
- operator posture summary
- current revision materiality

Confidence remains heuristic, but it is now framed alongside the actual thesis posture and tension instead of acting as an isolated badge.

## Current Limits

This is still a deterministic synthesis layer.

What remains heuristic:

- stance derivation is still based on weighted constructive vs negative signals
- major tension selection is still top-signal based rather than semantic narrative planning
- revision materiality is rules-based, not semantic diffing
- operator review influences trust posture indirectly rather than changing thesis sections through explicit resolution workflows

## Next Likely Upgrades

- stronger section-level thesis planning instead of top-bullet assembly
- semantic revision diffing instead of normalized section comparison
- explicit thesis lineage to the exact catalysts, contradictions, and canon deltas that changed posture
- stronger integration between operator review state and thesis confidence / stance updates
