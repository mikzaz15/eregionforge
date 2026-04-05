# Operator Notes v1

## What Operator Notes Are

Operator notes are lightweight, durable rationale records attached to reviewed workflow objects.

They are intentionally compact:

- one note body
- one target object
- one note type
- durable timestamps
- optional authored-by placeholder

They are not a broad annotation system or threaded discussion layer.

## Supported Objects

Operator notes currently attach to:

- stale / monitoring alerts
- contradictions
- catalysts

These are the same high-value workflow objects that already support operator review state.

## How Notes Interact With Review Controls

Review controls now support optional rationale entry during:

- alert acknowledgement
- alert dismissal
- contradiction review
- contradiction resolution
- catalyst review
- catalyst resolution
- catalyst invalidation

The latest note is still reflected on the underlying object as a compact preview, while the full durable note history is stored separately in `operator_notes_store`.

## Durability And Audit History

Operator notes persist through the same SQLite-backed repository layer as the rest of the workflow state.

When a note is added, EregionForge also records an operational audit event:

- `alert_note_added`
- `contradiction_note_added`
- `catalyst_note_added`

This means recent workflow history can now reflect not only that a review action happened, but that human reasoning was attached to it.

## UI Behavior

The current product surfaces stay compact:

- cards show note count and latest note preview
- command view summaries now reflect how many important reviewed objects carry operator rationale
- no separate note-management surface is introduced in v1

## Intentional Limits

This remains intentionally lightweight:

- no rich editing workflow
- no threaded discussions
- no permissions system
- no standalone notes dashboard

Future work can add richer note editing, history inspection, or confidence effects, but v1 is focused on preserving operator reasoning inside the existing review loop.
