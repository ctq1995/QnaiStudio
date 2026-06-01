# TurnRunner Router Integration Plan

## Goal

Make `EngineeringTurnRunner` automatically route each turn through `routeEngineeringAgentTask(input)` and record the route decision in transcript-compatible turn events.

## Scope

- Keep the existing pipeline unchanged unless a route decision is provided.
- Add a new turn event for route decisions.
- Ensure `EngineeringRuntime` auto-records the new turn event into transcript and timeline.

## Files

- Modify: `src/ai-runtime/engineering/turn-runner.ts`
- Modify: `src/ai-runtime/engineering/transcript-recorder.ts`
- Modify: `src/ai-runtime/engineering/transcript-timeline.ts`
- Modify: `src/ai-runtime/engineering/execution-pipeline.ts` (if needed for routeDecision propagation details)
- Test: `src/ai-runtime/engineering/turn-runner-router.test.ts`
- Test: `src/ai-runtime/engineering/transcript-timeline-router.test.ts`

## Steps

### Task 1: Add route decision turn event

Add a new `EngineeringTurnEvent` variant:

```ts
| { type: 'route_decided'; sessionId: string; turnId: string; route: EngineeringAgentRoute; riskLevel: EngineeringAgentRouteRiskLevel; permissionMode: EngineeringPermissionMode; requiredCapabilities: EngineeringAgentRouteCapability[]; skippedStages: string[]; reason: string }
```

Map it to transcript type `note` or a new `route_decision` transcript type if the type list is extended.

### Task 2: Make TurnRunner route by default

Inside `EngineeringTurnRunner.run()`:

```ts
const routeDecision = input.routeDecision || routeEngineeringAgentTask(input)
this.emit({ type: 'route_decided', ... })
const summary = await this.deps.pipeline.run({ ...input, taskId: input.taskId || turnId }, { routeDecision })
```

Keep compatibility for callers that explicitly pass a route decision later.

### Task 3: Record route decisions in timeline

Update `transcript-timeline.ts` so route decision events produce a readable timeline item:

```ts
kind: 'policy'
title: 'Route decided'
summary: 'route=review risk=low ...'
```

### Task 4: Add tests

Test that:

- `TurnRunner.run()` emits a route decision event
- default routing uses `routeEngineeringAgentTask(input)`
- explicit routeDecision override is respected
- transcript/timeline includes route decision summary

### Task 5: Verify

Run:

```bash
npm test
npm run build
```

## Success Criteria

1. `TurnRunner` automatically routes turns.
2. Route decisions are observable in transcript/timeline.
3. Existing pipeline compatibility remains intact.
4. Tests pass.
