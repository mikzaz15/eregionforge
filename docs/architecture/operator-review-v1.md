# Operator Review v1

## Purpose

Operator Review v1 adds lightweight human judgment on top of durable system-generated intelligence.

EregionForge now lets the operator explicitly review, acknowledge, dismiss, invalidate, or resolve high-value objects without turning the product into a heavyweight approvals workflow.

## Objects With Review State

### Monitoring alerts

Stale alerts now support durable review status:

- `open`
- `acknowledged`
- `dismissed`

Alerts also persist:

- `reviewedAt`
- `reviewedBy`
- `reviewNote`

Monitoring refreshes preserve alert history instead of treating alerts as disposable transient state. Active alerts remain visible, while dismissed or inactive alerts can still be inspected as historical operator-reviewed records.

### Contradictions

Contradictions keep their existing operator-facing statuses:

- `open`
- `reviewed`
- `resolved`

They now also persist:

- `reviewedAt`
- `reviewedBy`
- `reviewNote`

This means contradiction review survives refreshes and becomes part of the durable project posture rather than a temporary UI toggle.

### Catalysts

Catalysts keep their compiled lifecycle status such as `upcoming` or `active`, but now also carry a separate operator review layer:

- `active`
- `reviewed`
- `invalidated`
- `resolved`

Catalysts also persist:

- `reviewedAt`
- `reviewedBy`
- `reviewNote`

This separation matters because a catalyst can still be time-relevant while already reviewed by the operator.

## Workflow Impact

Operator review now improves three workflow loops:

1. Monitoring to action
   Alerts can be acknowledged or dismissed without losing the underlying stale signal history.

2. Contradiction review
   Contradictions can be explicitly reviewed before they are fully resolved.

3. Catalyst hygiene
   Catalysts can be reviewed, resolved, or invalidated without being silently overwritten on the next compile.

## Operational History Integration

Review actions now create durable audit events, including:

- `alert_acknowledged`
- `alert_dismissed`
- `contradiction_reviewed`
- `contradiction_resolved`
- `catalyst_reviewed`
- `catalyst_invalidated`
- `catalyst_resolved`

This makes operator judgment part of the operational history layer rather than an invisible state mutation.

## Intentionally Lightweight

Operator Review v1 does not add:

- multi-user approvals
- assignment workflows
- escalation chains
- full comment threads
- a separate review console

The goal is operational clarity, not enterprise process overhead.

## Likely Next Improvements

- richer operator notes and rationale capture
- explicit reviewer identity instead of a placeholder actor
- command-view summaries for reviewed vs dismissed alert history over time
- stronger lineage between operator review and later thesis or canon changes
