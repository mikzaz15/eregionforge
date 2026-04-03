# System Architecture

## Application layers

### 1. Interface layer
- Next.js app
- project workspace UI
- source library UI
- wiki reader
- ask mode
- artifacts viewer
- health dashboard

### 2. Application services
- source ingestion service
- source parsing service
- extraction service
- wiki compiler service
- ask orchestration service
- artifact generation service
- linting service

### 3. Data layer
- Postgres / Supabase for metadata and structured knowledge
- object storage for raw files and generated outputs
- markdown rendering pipeline

### 4. Agent layer
- orchestrator
- ingestion agent
- compiler agent
- researcher agent
- linter agent
- artifact writer agent

## Guiding architecture rule
The system should compile knowledge into durable objects, not just produce ephemeral answers.
