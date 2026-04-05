# Ask Quality v2

## Purpose

Ask Quality v2 upgrades Ask mode from a thin query form over internal objects into a more research-native synthesis layer. The retrieval order remains canon first, but answers now use more of the surrounding system state when building a response.

## What Improved

### 1. Richer Synthesis Context

Ask mode now synthesizes against:

- canonical wiki pages
- claims
- evidence-linked sources
- current thesis posture
- contradiction records
- catalyst objects
- timeline entries
- freshness alerts
- entity intelligence

The answer still begins with canon, but the system now uses adjacent intelligence layers to explain why the answer is trustworthy, what could change it, and where uncertainty remains.

### 2. More Distinct Answer Modes

The answer modes now behave more like purpose-built research outputs:

- `concise-answer`: short answer plus main supporting reasons and caveats
- `research-memo`: thesis posture, evidence, catalysts, tensions, and trust posture
- `compare-viewpoints`: constructive read vs cautious read vs what decides between them
- `identify-contradictions`: contradiction-first review with resolution direction
- `follow-up-questions`: next operator questions generated from unsupported claims, freshness burden, contradictions, and catalysts

### 3. Better Consulted-Object Reasoning

Selection now weights:

- entity overlap with the prompt
- canon confidence and page posture
- claim support status
- evidence-linked sources before raw fallback
- contradiction, catalyst, and timeline linkage around the consulted scope

Ask still stores only the consulted pages, claims, and sources as the primary durable consulted set, but the synthesis now uses richer adjacent context.

### 4. Better Trust Signals

Ask sessions now store lightweight trust metadata:

- confidence summary
- consulted-object summary
- tension summary
- freshness caveat
- entity summary
- suggested artifact title

This keeps Ask explainable without turning it into a large scoring surface.

### 5. Better Artifact Packaging

Saving an Ask response as an artifact now produces a more reusable research deliverable:

- better mode-aware titles
- better provenance metadata
- embedded Ask provenance block in the saved markdown
- stronger trust and freshness carry-forward into the artifact

## What Remains Heuristic

- prompt interpretation is still deterministic and token/entity/theme based
- Ask does not yet run semantic ranking over fragment-level evidence
- adjacent intelligence layers influence synthesis, but the primary durable consulted set is still pages, claims, and sources
- trust posture is still heuristic rather than model-generated reasoning

## Likely Next Upgrades

- explicit fragment-level citations inside answers
- stronger mode-specific artifact packaging
- persistent consulted-object lineage beyond pages/claims/sources
- tighter integration between Ask and operator-reviewed contradiction/catalyst posture
