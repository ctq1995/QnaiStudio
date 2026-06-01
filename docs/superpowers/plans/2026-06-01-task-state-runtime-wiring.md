# Task State Runtime Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `EngineeringTaskStateTracker` into the engineering runtime so task states update automatically during turns.

**Architecture:** Add an optional tracker to runtime, adapter, and bootstrap inputs. Runtime wraps turn and run event handlers to update the tracker before forwarding events to transcript/user callbacks, and exposes task states through `snapshot()`.

**Tech Stack:** TypeScript, Vitest, existing engineering runtime classes.

---

### Task 1: Runtime wiring

**Files:**
- Modify: `src/ai-runtime/engineering/engineering-runtime.ts`

- [ ] Add `EngineeringTaskStateTracker` dependency.
- [ ] Create a default tracker when none is supplied.
- [ ] Record turn events before transcript recording.
- [ ] Wrap pipeline `onEvent` so run events update the tracker.
- [ ] Add `taskStates` to `EngineeringRuntimeSnapshot`.

### Task 2: Adapter and bootstrap pass-through

**Files:**
- Modify: `src/ai-runtime/engineering/task-runner-adapter.ts`
- Modify: `src/core/engineering-runtime-bootstrap.ts`

- [ ] Add `taskStateTracker` to adapter input.
- [ ] Pass tracker into `createEngineeringRuntime`.
- [ ] Add `taskStateTracker` to bootstrap registration input.
- [ ] Preserve existing caller `onEvent` callbacks.

### Task 3: Tests

**Files:**
- Create: `src/ai-runtime/engineering/engineering-runtime-task-state.test.ts`

- [ ] Verify turn events update task state through runtime.
- [ ] Verify run events update task state through runtime.
- [ ] Verify `runtime.snapshot().taskStates` includes route/stage/strategy state.
- [ ] Verify caller event handlers still run.
- [ ] Verify tracker errors do not break transcript recording or caller callbacks.

### Task 4: Verification

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Check for debug code and focused tests.
- [ ] Commit with message `feat: wire task state into runtime`.
