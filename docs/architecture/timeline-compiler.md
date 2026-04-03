# Timeline Compiler

## Why it exists

EregionForge does not treat chronology as a loose search result.
The timeline compiler turns dated project knowledge into a compiled canonical view that can be reviewed, refreshed, and trusted like the wiki itself.

This makes timeline state a durable project asset:

- sources contain raw dated material
- claims expose distilled assertions with support posture
- wiki pages represent current canon
- timeline events compile that dated knowledge into chronology

## What a timeline event is

A timeline event is a normalized chronology record attached to a project.

Current event fields:

- `id`
- `projectId`
- `title`
- `description`
- `eventDate`
- `eventDatePrecision`
- `eventType`
- `confidence`
- `sourceIds`
- `wikiPageIds`
- `claimIds`
- `provenance`
- `createdAt`
- `updatedAt`

Supported date precision values:

- `exact_day`
- `month`
- `year`
- `unknown_estimated`

Current event provenance values:

- `source-extraction`
- `claim-extraction`
- `wiki-extraction`
- `object-timestamp-fallback`

## Current compilation flow

Timeline compilation is rerunnable and project-scoped.
The compiler currently gathers candidates from:

1. sources
2. claims
3. wiki pages and current revisions

The service normalizes those candidates into timeline event drafts, deduplicates them, and replaces the project timeline state in the repository.

## Extraction heuristics

The first pass is deliberately heuristic, but operational.

Current extraction behavior:

- detect explicit dates in source fragments
- detect explicit dates in claim text
- detect explicit dates in wiki revision summaries and markdown
- support month/day/year, month/year, quarter-like references, and bare year references
- infer event type from nearby text using lightweight keyword rules
- assign confidence from date precision and supporting object quality

If explicit dates are not found, the compiler currently uses controlled fallbacks:

- source `createdAt` can become a "source added to project" event
- wiki revision or page update timestamps can become a "canonical page updated" event

Those fallbacks are intentional placeholders so chronology stays durable even when extraction is sparse.

## Deduplication and normalization

The compiler does not keep every raw match as a separate event.

Current normalization approach:

- normalize event dates into ISO-like stored values
- build stable keys from object identity, normalized title context, and date
- merge duplicate drafts when the stable key matches
- union linked source, wiki page, and claim references
- keep the stronger confidence level when duplicates collapse
- prefer the more descriptive event text when merging

This keeps the timeline closer to compiled canon than raw retrieval noise.

## Canonical view

The workspace timeline page is the canonical chronology surface.
Each event shows:

- normalized date
- title
- short description
- confidence
- event type
- provenance
- linked sources
- linked wiki pages
- linked claims

Trust visibility is mandatory.
Timeline events are only useful if operators can inspect where they came from.

## Current limitations

The current compiler is intentionally first-pass.

Known limitations:

- extraction is regex and heuristic based, not model-assisted
- event titles are generated from local context and can still be verbose
- deduplication depends on stable-key heuristics rather than semantic clustering
- relative dates and date ranges are not deeply modeled yet
- claim references route through wiki page anchors because claims do not yet have their own detail route
- fallback timestamp events can mix operational chronology with source-domain chronology

## Future direction

Likely next upgrades:

- stronger event extraction from source structure and revision semantics
- semantic deduplication for overlapping milestones
- explicit support for date ranges and uncertain chronology
- better separation between project-operational events and domain events
- timeline-aware linting for contradictory or impossible date sequences
- wiki filing or artifact generation from timeline slices
