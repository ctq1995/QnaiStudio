# Strategy Attribution Events Design

## Goal

Record the execution strategy selected from a route subtype so transcript and timeline can explain not only the route decision, but the concrete verification/review strategy used by the pipeline.

## Events

Add engineering run events:

- `verification_strategy_selected`
- `review_strategy_selected`

### Verification strategy event

Fields:

- `taskId`
- `subtype`
- `commandIds`
- `commandLabels`
- `reason`

### Review strategy event

Fields:

- `taskId`
- `subtype`
- `focus`
- `reason`

## Transcript and Timeline

Add transcript event types:

- `verification_strategy`
- `review_strategy`

Add timeline kind:

- `strategy`

Timeline summaries:

- `verification subtype=verify.lint commands=npm-lint`
- `review subtype=review.security focus=security`

## Scope

This phase emits and records strategy attribution. It does not introduce UI components, multi-model workers, Always-on execution, or new permission behavior.

## Success Criteria

1. Pipeline emits verification strategy events after command selection.
2. Pipeline emits review strategy events before review execution/skipping decision.
3. Runtime transcript records these strategy events.
4. Timeline renders concise strategy summaries.
5. Existing behavior remains compatible when no subtype is provided.
