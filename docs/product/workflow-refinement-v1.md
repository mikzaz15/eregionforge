# Workflow Refinement v1

## What improved

This sprint tightened how EregionForge is operated rather than adding new research surfaces.

Main improvements:

- the project command view now highlights a next best action instead of acting like a route directory
- stale alerts now connect more directly to the affected research surface and refresh action
- recent meaningful changes are surfaced in the command view
- refresh vocabulary is more consistent across thesis, dossier, catalysts, contradictions, timeline, and monitoring

## Command view guidance

The project command view now tries to answer four operational questions immediately:

- what is stale
- what should be refreshed next
- what changed recently
- where the operator should go after reviewing the current posture

The command card keeps the current stack summary.
The adjacent workflow cards now show:

- `Next best action`
- `Recent changes`

This is meant to make the project page feel like a research operating surface rather than a navigation hub.

## Stale-to-refresh loop

Monitoring alerts now support a clearer loop:

1. inspect the alert
2. jump to the affected surface
3. run the appropriate refresh action
4. re-check the updated state

The monitoring surface now includes direct actions for:

- `Refresh Thesis`
- `Refresh Dossier`
- `Refresh Catalysts`
- `Re-run Contradictions`
- `Review Sources`

The command view also routes the operator toward `Review Alerts` when stale pressure is the highest-priority issue.

## Recent change awareness

EregionForge still does not have a full audit log, but the command view now surfaces recent meaningful changes such as:

- thesis revision updates
- dossier refreshes
- catalyst refreshes
- contradiction reruns
- timeline rebuilds
- entity layer refreshes
- alert queue refreshes

This keeps the operator oriented without introducing a heavyweight history product.

## Action language

Action labels were tightened around a small consistent vocabulary:

- `Refresh Thesis`
- `Refresh Dossier`
- `Refresh Catalysts`
- `Re-run Contradictions`
- `Rebuild Timeline`
- `Refresh Alerts`
- `Review Alerts`
- `Open Command View`

The goal is to keep the app feeling operational, serious, and predictable.

## Remaining workflow gaps

Current limitations:

- most refreshes still rely on redirect-based flows rather than explicit post-refresh success summaries
- non-active portfolio projects still rely on the active workspace for some top-level surfaces
- stale alerts are not yet operator-resolvable with durable workflow state like dismissed or acknowledged
- recent changes are inferred from current object timestamps, not from a dedicated workflow history model

The next workflow upgrade would likely be a lightweight durable operations log or refresh-result summaries, not a broad new surface area.
