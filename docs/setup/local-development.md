# Local Development

## Prerequisites

- Node.js `22.x`
- npm `10.x`

Current local environment target:

- Node `v22.22.0`
- npm `10.9.4`

## Install

```bash
npm install
```

## Recommended Dev Command

```bash
npm run dev
```

This repo intentionally maps `npm run dev` to:

```bash
next dev --webpack
```

## Why Webpack Is Used Locally

On this machine, local development was more stable with Webpack than with the default dev bundler.

The production commands remain standard:

- `npm run build`
- `npm run start`

If you explicitly want to test the alternate dev bundler:

```bash
npm run dev:turbopack
```

That is optional and not the recommended path for day-to-day local work here.

## Verification Commands

Lint:

```bash
npm run lint
```

Production build:

```bash
npm run build
```

## Best Local Entry Point

After starting the dev server, open:

```text
http://localhost:3000/projects
```

The root route redirects there, and that is the intended showcase starting point.

## Seeded Demo Data

The seeded demo project and most in-memory domain state live in:

- [src/lib/domain/seed-data.ts](../../src/lib/domain/seed-data.ts)

That file contains:

- the active Northstar Semiconductor demo project
- seeded sources
- wiki pages and revisions
- claims and evidence
- thesis revisions
- dossier, catalysts, contradictions, and timeline objects
- monitoring alerts and freshness state
- demo Ask sessions and artifacts

## Useful Repo Paths

- [README.md](../../README.md)
- [docs/architecture/overview.md](../architecture/overview.md)
- [docs/product/demo-flow.md](../product/demo-flow.md)
- [docs/product/demo-script.md](../product/demo-script.md)

## Notes

- Persistence is currently in-memory by design.
- The current repo is optimized for local exploration and showcase quality, not production deployment.
- If local behavior looks inconsistent after code changes, restart `npm run dev` before debugging deeper because the in-memory state resets with the process.
