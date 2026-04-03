# Ask Mode

## Purpose

Ask mode is a project-scoped research operation over compiled knowledge.

It is not a generic assistant surface and it is not broad RAG. The system must resolve against the canonical wiki first, then claims and evidence, and only fall back to raw sources when the compiled layer is thin.

## Core Retrieval Rule

Current retrieval priority is explicit:

1. relevant wiki pages
2. relevant claims
3. evidence-linked sources
4. raw sources as fallback

The system keeps this order even when the answer mode changes. Answer mode affects synthesis shape, not retrieval precedence.

## Domain Model

Ask sessions currently store:

- `id`
- `projectId`
- `prompt`
- `answer`
- `answerMode`
- `confidence`
- `consultedWikiPageIds`
- `consultedClaimIds`
- `consultedSourceIds`
- `createdAt`
- `updatedAt`
- optional `metadata`

This is currently backed by an in-memory repository with async signatures so database persistence can replace it later without changing the route layer.

## Current Retrieval Heuristics

The first pass uses deterministic ranking rather than hybrid search.

### Wiki pages

Pages are ranked using:

- title token overlap
- summary and markdown overlap
- page-type intent boosts
- active/generated status nudges

This keeps canon at the center of Ask mode.

### Claims

Claims are ranked using:

- claim text overlap
- boost for claims attached to already-relevant wiki pages
- support-status weighting

Supported claims rank higher than weak or unresolved claims, but weak and unresolved claims can still appear when they materially shape the trust posture.

### Sources

Sources are ranked using:

- overlap against source title and body
- fragment text overlap
- boost for evidence-linked sources referenced by consulted claims
- boost for sources linked to consulted pages
- ingestion status weighting

If source selection still comes back thin, the system falls back to a few likely relevant raw sources so Ask mode can still produce a bounded answer.

## Answer Modes

Current answer modes are:

- concise answer
- research memo
- compare viewpoints
- identify contradictions
- follow-up questions

These are deterministic synthesis templates today. They produce structured markdown and always carry:

- consulted object visibility
- confidence
- evidence posture

## Confidence

Confidence is currently heuristic.

It is influenced by:

- supported-claim count
- unresolved-claim count
- whether raw-source fallback was needed
- whether the answer stayed mostly in canon versus dropping lower in the stack

This is not yet a formal scoring model.

## Save As Artifact

An Ask session can be promoted into an artifact.

Current artifact provenance includes:

- `derivedFrom = Ask mode`
- `provenance = ask-mode`
- originating prompt
- answer mode
- ask session id
- answer confidence

This lets Ask become part of durable project memory instead of a disposable response surface.

## Current Limitations

The current implementation is intentionally practical:

- no embedding search
- no lexical index beyond lightweight overlap heuristics
- no LLM synthesis in this path yet
- no inline fragment-level citations inside answer prose
- no persisted ask-session history yet
- no page-scoped requery or follow-up branching

## Future Direction

The next likely evolution is hybrid retrieval while preserving the compiled-wiki-first rule:

- lexical plus semantic ranking over wiki pages
- claim and evidence reranking
- fragment-aware citation insertion
- trust-aware answer policies that react to lint and support posture
- persisted ask sessions and artifact lineage in the database

The key constraint should remain unchanged:

Ask mode is a disciplined interface for operating over compiled project knowledge, not a chat wrapper over arbitrary files.
