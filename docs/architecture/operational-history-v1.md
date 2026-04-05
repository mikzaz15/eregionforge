# Operational History v1

## Purpose

Operational History v1 makes EregionForge operationally durable, not only state-durable.

The system now persists what ran, what it targeted, when it ran, whether it succeeded, and which meaningful project changes were recorded afterward.

## Compile Jobs

Compile jobs are durable records for system work such as:

- wiki compilation
- thesis refresh
- dossier refresh
- catalyst refresh
- contradiction reruns
- timeline rebuilds
- monitoring runs
- entity extraction

Each compile job now persists:

- `id`
- `projectId`
- `jobType`
- `targetObjectType`
- `targetObjectId`
- `status`
- `summary`
- `startedAt`
- `completedAt`
- `createdAt`
- `updatedAt`
- `metadata`

This means refresh history survives restarts and can later support richer workflow and lineage features.

## Operational Audit Events

Operational audit events are compact durable records for meaningful changes in the system.

Examples:

- wiki compiled
- thesis refreshed
- dossier refreshed
- catalysts refreshed
- contradictions re-ran
- timeline rebuilt
- monitoring flagged stale thesis
- entities extracted
- job failed

Each audit event persists:

- `id`
- `projectId`
- `eventType`
- `title`
- `description`
- `relatedObjectType`
- `relatedObjectId`
- `relatedJobId`
- `createdAt`
- optional `metadata`

## What Improved

### Durable operations

Compile jobs are no longer in-memory only. The latest operational runs now survive restarts in local SQLite.

### Durable recent changes

Project command-view recent changes can now use real operational audit events instead of inferring history only from object timestamps.

### Better stale-to-refresh trust

Monitoring and refresh flows now create durable records when the user explicitly runs them, which makes the stale-to-action loop more inspectable.

## What Persists Now

Operational durability now covers:

- compile jobs
- operational audit events
- the previously persisted canon, thesis, dossier, catalysts, contradictions, timeline, monitoring, artifacts, ask sessions, and entities

## What Remains Out Of Scope

- a full admin or operations console
- deep lineage across every object mutation
- persistent refresh diff history for every compiled object
- queue orchestration or background scheduling

## Likely Next Improvements

- object-level refresh lineage that explicitly records which inputs changed
- richer failure and retry history
- revision history for more derived intelligence objects
- workflow surfaces that expose job and audit history beyond the command view
