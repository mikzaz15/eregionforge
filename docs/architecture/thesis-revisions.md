# Thesis Revisions

## What A Thesis Revision Is

In EregionForge, a thesis is not a single mutable memo. It is a compiled project view with a durable revision log.

Each thesis refresh now produces:

- an updated current thesis pointer for the project
- a persisted thesis revision record
- refresh intelligence describing what changed and what likely drove the change

This keeps the thesis anchored to compiled knowledge instead of letting it drift into a manually edited narrative.

## Current Refresh Flow

The current refresh flow is:

1. load project knowledge inputs across wiki pages, claims, sources, timeline events, contradictions, and artifacts
2. compile a new thesis candidate deterministically from those objects
3. compare the new candidate against the prior active thesis revision
4. create a new thesis revision with change metadata
5. update the project thesis pointer to the newest revision

The thesis remains the latest active compiled view, while prior revisions remain inspectable.

## How Change Summaries Are Generated

Refresh intelligence is heuristic-first for now.

The compiler currently records:

- changed thesis sections
- confidence shift
- contradiction count shift
- catalyst count shift
- likely driver objects

Likely drivers are inferred from knowledge objects that were created or updated after the prior thesis revision timestamp, including:

- wiki pages
- claims
- sources
- timeline events
- contradictions
- artifacts

The generated change summary is intentionally compact and operational. It answers:

- what changed
- how much the posture moved
- which newer knowledge objects likely caused the movement

## Freshness Model

Thesis freshness is currently based on a project knowledge fingerprint.

The fingerprint is built from object ids plus update timestamps across:

- wiki pages and current revisions
- claims
- sources
- artifacts
- timeline events
- contradictions

If the current project fingerprint differs from the stored thesis input signature, or if newer knowledge objects postdate the thesis refresh timestamp, the thesis is flagged as potentially stale.

## Current Limitations

- Revisions now persist to the local durable path rather than resetting on restart.
- Change attribution is heuristic and timestamp-driven, not semantic-causal.
- Section comparison is content-level, not sentence diffing.
- A new thesis revision is created on each refresh, even if the thesis content barely changes.
- Freshness does not yet consider source fragment or evidence-link level drift separately.

## Future Direction

Planned follow-on improvements include:

- persistent revision storage
- richer semantic change detection
- explicit revision-to-object lineage records
- thesis approval and review states
- tighter integration with contradictions, timeline deltas, and artifact filing

The direction is thesis intelligence, not passive version history.
