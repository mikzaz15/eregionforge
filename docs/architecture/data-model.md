# Data Model Overview

## Core objects
- users
- projects
- sources
- source_fragments
- entities
- concepts
- claims
- evidence_links
- wiki_pages
- wiki_page_revisions
- artifacts
- compile_jobs
- operational_audit_events
- ask_sessions
- lint_issues

## Layered data model
- raw: sources, files, urls, text
- extracted: fragments, entities, concepts, claims
- canonical: wiki pages, revisions
- evidential: evidence links, confidence
- operational: compile jobs, operational audit events, lint issues, ask sessions
- output: artifacts
