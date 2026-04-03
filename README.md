# EregionForge

EregionForge is an agentic knowledge compiler.

It ingests raw sources and compiles them into a canonical, auditable, markdown-native research wiki with evidence links, revisions, artifacts, and knowledge health checks.

## Core thesis
This is **not** a generic chatbot over files.
The core product is the **compiled knowledge layer**:

raw sources -> extracted knowledge -> canonical wiki -> persistent artifacts -> continuous knowledge improvement

## Project folders
- `docs/product/` product vision, positioning, MVP scope
- `docs/architecture/` system design, data model, workflows
- `docs/sprints/` build plan broken into executable sprints
- `docs/agents/` agent roles and operating model
- `workspace/agents/` working agent system prompts
- `workspace/prompts/` Codex prompts to start implementation
- `supabase/` initial schema blueprint

## First move
Open `workspace/prompts/codex-master-kickoff.md` and use it with Codex in a fresh repo named `eregionforge`.

## Local development

Use:

```bash
npm run dev
```

This repo now pins local development to `next dev --webpack` instead of the default dev bundler. On this machine, Webpack is the safer choice for iterative local work, while `npm run build` and `npm run start` remain production-oriented.

If you explicitly want to test the newer dev bundler, use:

```bash
npm run dev:turbopack
```
