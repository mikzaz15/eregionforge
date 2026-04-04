# EregionForge

EregionForge is a knowledge compiler for investment research.

It turns raw sources into a canonical research stack: compiled wiki pages, claims, evidence links, contradictions, timeline events, catalysts, thesis views, dossier views, freshness alerts, and durable artifacts.

This is not a generic chat-over-files app. The product center is the compiled knowledge layer, and every higher-order surface is expected to route through canon first.

## Showcase Metadata

- Project category: Knowledge compiler for investment research
- Primary use case: Build, inspect, and maintain a source-grounded investment view for one company or research subject
- Core differentiators:
  - Canon-first research workflow
  - Trust-visible claims and evidence
  - Compiled thesis, dossier, catalysts, chronology, contradictions, and freshness monitoring
  - Durable artifacts instead of one-off answers
- Demo project: `Northstar Semiconductor Diligence`

## Why It Is Different

Most research tools split the workflow across notes, chat, and scattered documents.

EregionForge compiles the workflow into one operating stack:

1. Sources are ingested under a project boundary.
2. Sources compile into canonical wiki pages.
3. Claims and evidence make the canon reviewable.
4. Timeline, contradictions, catalysts, thesis, dossier, and monitoring build on top of that canon.
5. Ask mode reasons over compiled knowledge first.
6. Strong outputs persist as first-class artifacts.

The result is a system that behaves more like research infrastructure than an assistant shell.

## Who It Is For

- Investors and analysts building an evidence-aware thesis
- Research operators who need durable outputs, not ephemeral chats
- Teams that want contradictions, catalysts, chronology, and freshness pressure visible in one place
- Builders interested in knowledge-compilation architecture rather than broad RAG

## Current Capabilities

- Project-scoped source ingestion
- Deterministic wiki compilation
- Claims and evidence-link scaffolding
- Knowledge linting and project health
- Ask mode over compiled knowledge
- First-class artifacts with provenance
- Timeline compilation
- Contradictions map
- Investment thesis tracker
- Thesis revisions and refresh intelligence
- Company dossier pages
- Catalyst tracker
- Source monitoring and stale-thesis alerts
- Seeded end-to-end demo project

## Best Demo Flow

Start on `/projects`.

Recommended order:

1. `/projects`
2. `/projects/project-northstar-semiconductor`
3. `/thesis`
4. `/contradictions`
5. `/catalysts`
6. `/timeline`
7. `/monitoring`
8. `/ask`
9. `/artifacts`
10. `/dossier`

What this proves:

- `/projects` shows the loaded research workspace and product framing
- the project command view shows the whole compiled stack in one place
- thesis proves compiled underwriting
- contradictions prove visible disagreement
- catalysts prove first-class thesis-moving objects
- timeline proves canonical chronology
- monitoring proves freshness intelligence
- ask proves canon-first retrieval
- artifacts prove durable outputs
- dossier proves the same canon can recompile into another serious research surface

For a tighter script, see [docs/product/demo-flow.md](docs/product/demo-flow.md) and [docs/product/demo-script.md](docs/product/demo-script.md).

## Local Run

Prerequisites:

- Node.js 22.x
- npm 10.x

Install and run:

```bash
npm install
npm run dev
```

Recommended dev command:

```bash
npm run dev
```

This repo intentionally uses `next dev --webpack` for local development. On this machine, Webpack has been the safer and more stable dev path than the default dev bundler.

Other useful commands:

```bash
npm run lint
npm run build
```

If you explicitly want to test the newer dev bundler:

```bash
npm run dev:turbopack
```

More detail lives in [docs/setup/local-development.md](docs/setup/local-development.md).

## Architecture At A Glance

Core objects:

- `Project`
- `Source`
- `WikiPage` and `WikiPageRevision`
- `Claim` and `EvidenceLink`
- `Artifact`
- `TimelineEvent`
- `Contradiction`
- `Catalyst`
- `Thesis` and `ThesisRevision`
- `CompanyDossier`
- `SourceMonitoringRecord` and `StaleAlert`

Data flow:

```text
Sources
  -> compiled wiki pages
  -> claims + evidence links
  -> timeline / contradictions / catalysts
  -> thesis / dossier / monitoring
  -> ask sessions
  -> durable artifacts
```

The route layer reads project-scoped view data from services. The current repo runs in a hybrid mode: the first durable path now persists to a local SQLite store, while the remaining showcase-first intelligence objects still use seeded or in-memory adapters behind the same repository seam.

For the concise architecture overview, see [docs/architecture/overview.md](docs/architecture/overview.md). For the current migration path, see [docs/architecture/persistence-plan.md](docs/architecture/persistence-plan.md).

## Docs Map

- [docs/architecture/overview.md](docs/architecture/overview.md)
- [docs/architecture/persistence-plan.md](docs/architecture/persistence-plan.md)
- [docs/setup/local-development.md](docs/setup/local-development.md)
- [docs/product/demo-flow.md](docs/product/demo-flow.md)
- [docs/product/demo-script.md](docs/product/demo-script.md)
- [docs/architecture/](docs/architecture)
- [docs/product/](docs/product)

## Seeded Demo Data

The seeded demo project and its compiled research objects live in:

- [src/lib/domain/seed-data.ts](src/lib/domain/seed-data.ts)

That file contains the Northstar Semiconductor demo workspace, including seeded sources, canon pages, thesis revisions, catalysts, contradictions, artifacts, and freshness state.
