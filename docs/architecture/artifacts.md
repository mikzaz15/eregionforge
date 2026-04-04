# Artifacts

## Purpose

Artifacts are first-class project assets in EregionForge.

They exist so strong outputs do not disappear as one-off answers, notes, or transient page states. A project should accumulate durable knowledge products alongside canonical wiki pages.

The compiled wiki remains the center of the system:

- sources feed compiled pages
- pages and claims support Ask mode
- Ask mode and synthesis workflows can emit artifacts
- artifacts remain attached to the same project boundary

## Current Artifact Types

The current first-pass artifact types are:

- `memo`
- `briefing`
- `comparison_report`
- `slide_outline`
- `saved_answer`

These types are intentionally narrow and oriented around reusable research outputs, not generic file management.

## Domain Model

Artifacts currently carry:

- `id`
- `projectId`
- `title`
- `artifactType`
- `markdownContent`
- `previewText`
- `provenance`
- `originatingPrompt`
- `derivedFromAskSessionId`
- `referencedWikiPageIds`
- `referencedSourceIds`
- `referencedClaimIds`
- `eligibleForWikiFiling`
- `status`
- `createdAt`
- `updatedAt`
- optional `metadata`

This gives artifacts enough structure to be rendered cleanly, filtered in a ledger, and traced back to their project context.

## Provenance Model

Artifacts currently support these provenance values:

- `ask-mode`
- `manual`
- `wiki-derived`
- `research-synthesis`

The goal is not abstract metadata completeness. The goal is operational clarity:

- how did this artifact enter the project
- what knowledge objects does it refer back to
- can it be trusted and reused later

## Current Service Boundaries

The artifact service currently handles:

- create artifact
- list project artifacts
- filter project artifacts by type
- get artifact detail with references
- mark wiki-filing eligibility

Artifacts now persist on the local durable path. The repository shape remains the same so a later production adapter can replace the local store cleanly.

## Save From Ask

Ask mode can now save a response as an artifact.

That flow stores:

- a clean artifact title
- Ask-mode provenance
- originating prompt
- derived ask session id
- referenced wiki page ids
- referenced source ids
- referenced claim ids

This lets Ask outputs become durable project assets instead of disappearing after answer delivery.

## Artifact Ledger

The artifacts page is now intended to behave like an asset register, not a placeholder screen.

Current ledger capabilities:

- list artifacts
- filter by artifact type
- show preview text
- show provenance
- show created date
- link to detail view
- mark for future wiki filing

## Artifact Detail

Artifact detail pages render:

- markdown-native body
- provenance
- created date
- originating prompt when present
- linked Ask session when present
- referenced pages, claims, and sources

This keeps artifacts legible and inspectable inside the project workspace.

## Wiki Filing Groundwork

This sprint only lays the first foundation for filing artifacts back into the wiki.

Current groundwork:

- `eligibleForWikiFiling` field on artifacts
- lightweight UI action to mark or unmark that eligibility

This is intentionally not the full filing system yet. It only makes the product direction explicit and keeps the domain model ready for later conversion of artifacts into:

- wiki pages
- wiki revisions
- structured source inputs

## Current Limitations

- artifacts are still persisted in-memory
- no artifact editing flow yet
- no artifact-to-wiki conversion yet
- no artifact version history yet
- no artifact diffing or review workflow yet

## Future Direction

Likely next steps:

- persist artifacts and artifact references in the database
- add artifact editing and revision history
- support filing an artifact into a wiki page or source input
- allow Ask, lint, and future agents to treat artifacts as retrieval targets when appropriate

Artifacts should remain durable knowledge products, not drift into a generic document store.
