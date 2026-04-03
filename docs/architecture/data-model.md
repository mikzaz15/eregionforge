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
- ask_sessions
- lint_issues

## Layered data model
- raw: sources, files, urls, text
- extracted: fragments, entities, concepts, claims
- canonical: wiki pages, revisions
- evidential: evidence links, confidence
- operational: compile jobs, lint issues, ask sessions
- output: artifacts
