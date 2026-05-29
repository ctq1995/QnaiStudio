# Engineering Task Runner Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide a standard adapter that converts TaskManager engineering tasks into EngineeringRuntime turns.

**Architecture:** Add a focused `task-runner-adapter.ts` module under engineering runtime. The adapter maps generic `AITask` input into `EngineeringTurnInput`, creates or uses `EngineeringTurnRunnerDeps`, invokes `EngineeringRuntime.runTurn()`, and returns `EngineeringTaskRunnerResult` for TaskManager.

**Tech Stack:** TypeScript, QnaiStudio AI Runtime, EngineeringRuntime, TaskManager, Vite build validation.

---

## File Structure

- Create `src/ai-runtime/engineering/task-runner-adapter.ts`: adapter types, mapper, factory function.
- Modify `src/ai-runtime/engineering/index.ts`: export adapter.
- Add docs under `docs/superpowers/specs` and `docs/superpowers/plans`.

---

### Task 1: Adapter Module

**Files:**
- Create: `src/ai-runtime/engineering/task-runner-adapter.ts`

- [ ] **Step 1: Define adapter input and mapper types**

Define `EngineeringTaskRunnerAdapterInput` and `EngineeringTaskInputMapper`.

- [ ] **Step 2: Implement default task mapper**

Map `AITask.input.prompt`, `files`, and `extra` into `EngineeringTurnInput` fields.

- [ ] **Step 3: Implement `createEngineeringTaskRunner()`**

Create EngineeringRuntime from either `turnRunnerDeps` or `pipelineDeps` and return a TaskManager-compatible runner.

---

### Task 2: Export and Validate

**Files:**
- Modify: `src/ai-runtime/engineering/index.ts`

- [ ] **Step 1: Export adapter**

Add:

```ts
export * from './task-runner-adapter'
```

- [ ] **Step 2: Run build**

Run: `npm run build`

Expected: build passes.

---

### Task 3: Review, Commit, Push

**Files:**
- Review all changed files.

- [ ] **Step 1: Review behavior**

Check:

```text
TaskManager does not import engineering adapter
adapter handles missing deps explicitly
AbortSignal prevents runtime start
custom mapper can override default mapping
pipelineDeps path uses TurnRunner boundary helper
```

- [ ] **Step 2: Commit and push**

Run:

```bash
git add docs/superpowers/specs/2026-05-29-engineering-task-runner-adapter-design.md docs/superpowers/plans/2026-05-29-engineering-task-runner-adapter.md src/ai-runtime/engineering/task-runner-adapter.ts src/ai-runtime/engineering/index.ts
git commit -m "feat: add engineering task runner adapter"
git push
```

Expected: commit and push succeed.

---

## Self-Review

- Spec coverage: adapter API, task mapping, dependency rules, abort checks, export, and build validation are covered.
- Placeholder scan: No placeholders are present.
- Scope consistency: UI wiring, Rust/Tauri events, and concrete pipeline behavior are intentionally out of scope.
