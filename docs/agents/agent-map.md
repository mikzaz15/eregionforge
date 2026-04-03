# Agent Map

## Agent roster
- Orchestrator
- Ingestion
- Compiler
- Researcher
- Linter
- Artifact Writer

## Operating model
Each agent should have:
- clear responsibility
- input contract
- output contract
- no UI coupling
- persistence of important outputs

## Non-negotiable rule
No agent should optimize for chatty text when a durable knowledge object should be created instead.
