# Runtime Live Task State Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync task state store while engineering runtime events are processed, not only after task completion.

**Architecture:** Add `onTaskStateChanged` to `EngineeringRuntime` deps and invoke it after tracker updates. Wire bootstrap to store updates while keeping `src/ai-runtime` independent from Zustand.

**Tech Stack:** TypeScript, Vitest, EngineeringRuntime, Zustand task state store.

---

### Task 1: Runtime hook

**Files:**
- Modify: `src/ai-runtime/engineering/engineering-runtime.ts`
- Test: `src/ai-runtime/engineering/engineering-runtime-task-state.test.ts`

- [ ] Add `EngineeringTaskStateChangedHandler` type.
- [ ] Add `onTaskStateChanged?: EngineeringTaskStateChangedHandler` to runtime deps.
- [ ] Invoke handler after `recordTurnEvent` and `recordRunEvent` update task state.
- [ ] Swallow handler failures.

### Task 2: Bootstrap wiring

**Files:**
- Modify: `src/core/engineering-runtime-bootstrap.ts`
- Test: `src/core/engineering-runtime-bootstrap.test.ts`

- [ ] Add `onTaskStateChanged` to bootstrap input.
- [ ] Default it to task state store updates.
- [ ] Respect caller override.

### Task 3: Verification

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Check for debug code and focused tests.
- [ ] Commit with message `feat: live sync engineering task state`.
