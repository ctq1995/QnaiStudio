# Engineering Runtime TaskManager Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a low-risk TaskManager entry point for explicitly marked engineering tasks to execute through an injected engineering runner.

**Architecture:** Keep TaskManager generic by accepting an optional `engineeringRunner` adapter instead of constructing engineering pipeline dependencies internally. The adapter runs only when `task.input.extra.engineering === true`; all other tasks retain the existing event-driven behavior.

**Tech Stack:** TypeScript, QnaiStudio AI Runtime, Vite build validation.

---

## File Structure

- Modify `src/ai-runtime/task-manager.ts`: add engineering runner config, matching helper, execution completion helpers.
- Add docs under `docs/superpowers/specs` and `docs/superpowers/plans`.

---

### Task 1: Add Engineering Runner Types and Config

**Files:**
- Modify: `src/ai-runtime/task-manager.ts`

- [ ] **Step 1: Add types**

Add `EngineeringTaskRunnerResult` and `EngineeringTaskRunner` near TaskManager config types.

- [ ] **Step 2: Add optional config field**

Add `engineeringRunner?: EngineeringTaskRunner` to `TaskManagerConfig` and store it in a private field.

- [ ] **Step 3: Run build**

Run: `npm run build`

Expected: build passes.

---

### Task 2: Execute Explicit Engineering Tasks

**Files:**
- Modify: `src/ai-runtime/task-manager.ts`

- [ ] **Step 1: Add matcher**

Add helper `isEngineeringTask(task)` that checks `task.input.extra?.engineering === true`.

- [ ] **Step 2: Start runner after task_started**

In `startTask()`, after emitting `task_started`, call `runEngineeringTask()` only when runner exists and matcher returns true.

- [ ] **Step 3: Add success/failure helpers**

Add helpers to complete/fail a single execution without relying on EventBus session_end/error.

- [ ] **Step 4: Run build**

Run: `npm run build`

Expected: build passes.

---

### Task 3: Review, Commit, Push

**Files:**
- Review changed files.

- [ ] **Step 1: Review behavior**

Check:

```text
ordinary tasks are unchanged
engineering tasks only run when explicitly marked
aborted engineering tasks do not emit completed
execute() resolves with output on success
execute() rejects on failure
```

- [ ] **Step 2: Commit and push**

Run:

```bash
git add docs/superpowers/specs/2026-05-29-engineering-runtime-taskmanager-entry-design.md docs/superpowers/plans/2026-05-29-engineering-runtime-taskmanager-entry.md src/ai-runtime/task-manager.ts
git commit -m "feat: add engineering runtime task entry"
git push
```

Expected: commit and push succeed.

---

## Self-Review

- Spec coverage: explicit engineering task matching, optional runner, success/failure completion, unchanged ordinary tasks, and build validation are covered.
- Placeholder scan: No placeholders are present.
- Scope consistency: UI wiring, Rust/Tauri events, and hardcoded pipeline construction are intentionally out of scope.
