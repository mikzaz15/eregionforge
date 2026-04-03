# Codex Master Kickoff

We are building EregionForge, an agentic knowledge compiler.

Core thesis:
This is not a generic chatbot over files.
This is a system that ingests raw sources and compiles them into a canonical, auditable, markdown-native research wiki.

Users:
serious researchers, investors, analysts, founders, legal and policy researchers.

Core objects:
- projects
- sources
- wiki pages
- claims
- evidence links
- entities
- artifacts
- compile jobs
- ask sessions
- lint issues

MVP goals:
1. create projects
2. ingest pasted text and markdown sources
3. store and view sources
4. compile a first-pass wiki
5. render wiki pages with revisions
6. support evidence traceability
7. ask questions over compiled knowledge
8. save answers as artifacts
9. run basic knowledge linting

Technical preferences:
- Next.js
- TypeScript
- Tailwind
- Supabase/Postgres
- markdown-first rendering
- clean service abstractions
- provider-agnostic LLM integration

What I want from you:
1. inspect the repo
2. propose a concise build plan
3. implement the first meaningful phase
4. summarize changes and next test steps
