# Architecture Overview

## Purpose

EregionForge is a knowledge compiler for investment research.

Its architecture is designed around one rule: compiled canon comes first.

Sources do not feed directly into an assistant shell. They compile into durable knowledge objects, and the higher-order research views sit on top of those objects.

## Core System Objects

### Source layer

- `Project`
- `Source`
- `SourceFragment`

This is the raw research input boundary.

### Canon layer

- `WikiPage`
- `WikiPageRevision`
- `Claim`
- `EvidenceLink`

This is the canonical knowledge layer. The wiki is the operating center of the product, and claims/evidence make the canon auditable.

### Research intelligence layer

- `TimelineEvent`
- `Contradiction`
- `Catalyst`
- `Thesis`
- `ThesisRevision`
- `CompanyDossier`
- `SourceMonitoringRecord`
- `StaleAlert`

These objects compile on top of canon rather than bypassing it.

### Output layer

- `AskSession`
- `Artifact`

Ask mode reasons over compiled knowledge first, and durable outputs remain attached to the project.

## Data Flow

```text
Project
  -> Sources
  -> Source Fragments
  -> Wiki Pages + Revisions
  -> Claims + Evidence Links
  -> Timeline / Contradictions / Catalysts
  -> Thesis / Dossier / Monitoring
  -> Ask Sessions
  -> Artifacts
```

## Trust Model

Trust in EregionForge is explicit, not implied.

It currently appears through:

- claim support status
- evidence links back to sources and fragments
- lint issues for weak or missing canon
- contradiction records with rationale
- catalyst confidence
- thesis and dossier support references
- freshness monitoring and stale alerts

The system is designed so a user can always inspect what a compiled view used and why it should or should not be trusted.

## Service Shape

The app uses a clean service and repository split:

- repositories own storage access
- services compile and aggregate domain objects
- route components render project-scoped view data

Current repositories run in a hybrid mode.

Durable now:

- projects
- sources
- source fragments
- wiki pages
- wiki revisions
- claims
- evidence links
- artifacts
- ask sessions
- thesis records and thesis revisions
- monitoring records and stale alerts
- catalysts and catalyst compile state
- contradictions and contradiction analysis state
- timeline events and timeline compile state
- company dossiers
- lint issues

Still in-memory:

- compile jobs and deeper operational audit history that has not yet been promoted into the durable path

That split is intentional. The compiled canon and main derived intelligence objects are now durable, while operational telemetry can migrate next without changing the route contracts.

## How The Major Views Fit Together

### Wiki

Canonical research base.

### Thesis

Compiled underwriting view built from canon, claims, timeline, contradictions, catalysts, and artifacts.

### Dossier

Structured company intelligence view built from the same knowledge base.

### Catalysts

First-class thesis-moving objects tied to timeframes, confidence, and supporting knowledge.

### Timeline

Canonical chronology compiled from sources, claims, and wiki context.

### Contradictions

Disagreement map across claims, pages, sources, and timeline state.

### Monitoring

Freshness intelligence that flags when compiled views may be stale because new knowledge has arrived.

### Ask

Question workflow that resolves against wiki pages first, then claims/evidence, then raw sources only if needed.

### Artifacts

Durable research outputs created from Ask mode or other synthesis flows.

## Current State

The repository is optimized for:

- one strong seeded demo project
- clear service boundaries
- markdown-native compiled views
- trust and provenance visibility

It is not yet optimized for:

- background source polling
- semantic retrieval or ranking
- persistent revision history across every object type
- multi-user workflow

That is intentional. The architecture currently prioritizes coherence, auditability, and a strong end-to-end research workflow.
