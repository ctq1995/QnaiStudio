# Adapter Task State Auto Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically sync task state store after engineering adapter runtime turns complete.

**Architecture:** Add a generic `afterRuntimeTurn` hook to the engineering task runner adapter and wire the app bootstrap default to `syncEngineeringTaskStateFromRuntime`. The ai-runtime layer stays UI-store agnostic.

**Tech Stack:** TypeScript, Vitest, existing EngineeringRuntime and bootstrap services.

---

### Task 1: Adapter hook

**Files:**
- Modify: `src/ai-runtime/engineering/task-runner-adapter.ts`
- Test: `src/ai-runtime/engineering/task-runner-adapter.test.ts`

- [ ] Add `afterRuntimeTurn?: (runtime) => void` to adapter input.
- [ ] Call the hook after `runtime.runTurn()` resolves.
- [ ] Catch hook failures so task results are unchanged.

### Task 2: Bootstrap default sync

**Files:**
- Modify: `src/core/engineering-runtime-bootstrap.ts`

- [ ] Import `syncEngineeringTaskStateFromRuntime`.
- [ ] Add `afterRuntimeTurn` to registration input.
- [ ] Pass `input.afterRuntimeTurn || syncEngineeringTaskStateFromRuntime` to adapter.

### Task 3: Verification

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Check for debug code and focused tests.
- [ ] Commit with message `feat: auto sync task state after adapter run`.
