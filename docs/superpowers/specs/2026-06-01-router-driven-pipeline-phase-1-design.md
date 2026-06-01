# Router-driven Pipeline Phase 1 Design

## Goal

Allow `EngineeringExecutionPipeline` to consume an optional `EngineeringAgentRouteDecision` and skip stages that are not required by the selected route.

## Scope

This phase keeps the existing pipeline API compatible. If no route decision is passed, the current behavior remains unchanged.

## Design

Add optional route decision input to pipeline run:

```ts
interface EngineeringExecutionPipelineRunOptions {
  routeDecision?: EngineeringAgentRouteDecision
}
```

Update:

```ts
pipeline.run(input, options?)
```

The pipeline derives stage capability checks from `routeDecision.requiredCapabilities`.

## Stage Rules

- `context`: always runs.
- `snapshot`: runs only if route requires `snapshot` and snapshot policy says yes.
- `execute`: runs only if route requires `agent_execution` and run mode allows execution.
- `diff`: runs only if route requires `git_diff`.
- `verify`: runs only if route requires `verification`.
- `review`: runs only if route requires `review`.

## Compatibility

When no route decision is provided, default behavior is equivalent to current full pipeline behavior.

## Non-goals

- Do not make `TurnRunner` invoke router automatically in this phase.
- Do not remove existing classifier/run-mode logic from pipeline.
- Do not add UI behavior.

## Success Criteria

1. Existing pipeline behavior is preserved without route decision.
2. `explain` / `unknown` route runs context only.
3. `review` route runs context, diff, review, and skips execute/verify.
4. `verify` route runs context, diff, verification, and skips execute/review.
5. `execute` route keeps full pipeline behavior.
6. Tests cover the above route behavior.
