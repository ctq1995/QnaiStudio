# Engineering Agent Router Design

## Goal

Introduce a lightweight router layer that turns an `EngineeringRunInput` into a structured routing decision before the execution pipeline runs.

This aligns QnaiStudio more closely with PilotDeck-style router-driven agent orchestration without replacing the existing engineering execution pipeline.

## Background

The current engineering stack already has several decision layers:

- `classifyEngineeringTask(userRequest)` infers task kind and review/verification requirements.
- `resolveEngineeringRunMode()` decides between plan/act execution modes.
- `decideEngineeringPermission()` evaluates tool permissions and safety constraints.

What is missing is a single explicit router abstraction that combines these signals into a routing decision that can be inspected, tested, and later extended for always-on and multi-agent execution.

## Proposed Architecture

Add a new module:

- `src/ai-runtime/engineering/agent-router.ts`

The router will not execute the task. It will only return a decision object that describes:

- which route should be taken
- what capabilities are required
- what run mode should be used
- what permission mode should be used
- what risk level was inferred
- why the router chose that path

### Inputs

The router accepts the existing run input plus optional hints:

- `EngineeringRunInput`
- optional requested route overrides
- optional explicit permission mode override

### Output

The router returns an `EngineeringAgentRouteDecision` that includes:

- `route`: `plan`, `execute`, `verify`, `review`, `explain`, or `unknown`
- `classification`: existing engineering task classification
- `runModeDecision`: existing run mode decision
- `permissionMode`: the permission mode that should be used downstream
- `requiredCapabilities`: capabilities expected from the downstream pipeline
- `riskLevel`: inferred risk tier
- `reason`: concise explanation of the decision
- `skippedStages`: stages intentionally omitted by the route

## Route Semantics

### `plan`

Used for explanation, scoping, or low-risk tasks where the system should avoid file mutation.

Expected behavior:

- read-only context gathering
- no execution
- no verification or review

### `execute`

Used for modifying tasks such as features, bug fixes, and refactors.

Expected behavior:

- context preparation
- snapshot when appropriate
- agent execution
- diff generation
- verification
- review

### `verify`

Used when the task is explicitly about validation or when a follow-up verification-only path is appropriate.

### `review`

Used when the task is explicitly about review or audit.

### `explain`

Used when the user is asking for explanation, architecture analysis, or guidance rather than code changes.

### `unknown`

Used when the router cannot infer a reliable route and should leave the pipeline conservative.

## Integration Strategy

This design intentionally does **not** refactor the existing pipeline into a router-driven pipeline yet.

Instead, the router will be consumed as a pre-pipeline decision layer:

```text
EngineeringRunInput
  -> EngineeringAgentRouter
  -> EngineeringExecutionPipeline
```

This lets us:

- keep the current pipeline stable
- test routing decisions independently
- prepare for later always-on and multi-agent orchestration

## Required Capabilities

The router should expose capability expectations so callers can reason about what downstream services need:

- `context`
- `snapshot`
- `agent_execution`
- `git_diff`
- `verification`
- `review`

These are metadata only in this iteration.

## Risk Model

The router should infer a simple risk tier:

- `low`
- `medium`
- `high`

The tier is not an enforcement mechanism yet. It is a decision aid for downstream policy and observability.

## Error Handling

If the router cannot confidently infer a route:

- return `route: 'unknown'`
- default to conservative permission and run-mode decisions
- preserve the classification result and reason string

The router should not throw for normal ambiguity.

## Testing Plan

Add tests for:

- feature/bugfix/refactor requests route to `execute`
- explanation/review requests route to non-modifying routes
- unknown or ambiguous inputs return `unknown`
- permission mode and run mode are propagated consistently
- required capabilities reflect the chosen route

## Non-goals

- No pipeline refactor in this iteration
- No always-on runtime yet
- No router UI yet
- No multi-agent dispatch yet
- No persistent routing memory yet

## Success Criteria

1. A new router module exists and is exported from engineering runtime entry points.
2. The router can produce deterministic route decisions from a run input.
3. Tests cover the routing matrix.
4. Existing execution pipeline behavior remains unchanged.
5. The design prepares the codebase for a later router-driven execution model.
