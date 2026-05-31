# Engineering Runtime Transcript Auto Wiring Plan

## Goal

Connect AIEvent transcript auto wiring into the EngineeringRuntime execution path so lifecycle events and scoped runtime events can appear in the same transcript snapshot.

## Design

1. Add an optional `EngineeringRuntimeTranscriptAutoWiring` slot to `EngineeringRuntime`.
2. Register wiring when `runTurn()` starts, using the active `sessionId`, `turnId`, and `taskId`.
3. Provide a tracked `record()` function so auto-wired transcript writes are included in runtime transcript flushing.
4. Cleanup wiring before transcript snapshot creation.
5. Expose the option through `EngineeringTaskRunnerAdapterInput`.
6. Let `registerEngineeringPipelineRunner()` default to `registerAIEventTranscriptAutoWiring` through a safe wrapper that records event metadata only by default, while allowing callers to override for full/custom payloads.

## Non-goals

- Do not make `ai-runtime` import service-layer wiring directly.
- Do not change transcript storage format.
- Do not automatically record unscoped events.
- Do not remove explicit caller override options.

## Success Criteria

1. `npm run build` passes.
2. Pipeline runner registration auto-wires scoped AIEvent transcript recording by default with metadata-only payloads.
3. Runtime cleanup prevents listener leaks.
4. Transcript snapshot flushes auto-wired writes before being returned.
