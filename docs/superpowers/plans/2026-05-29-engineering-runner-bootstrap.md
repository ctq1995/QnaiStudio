# Engineering Runner Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a reference-aligned explicit bootstrap entry that registers a real EngineeringTaskRunner into TaskManager.

**Architecture:** Keep bootstrap as composition-only. It accepts a real runner or adapter dependencies, creates/registers the runner, and does not fabricate pipeline/tool/model capabilities.

---

## File Structure

- Create `src/core/engineering-runtime-bootstrap.ts`.
- Modify `src/core/engine-bootstrap.ts` to re-export the engineering bootstrap entry.
- Add docs under `docs/superpowers/specs` and `docs/superpowers/plans`.

---

### Task 1: Create Bootstrap Module

**Files:**
- Create: `src/core/engineering-runtime-bootstrap.ts`

- [ ] Define `EngineeringRunnerBootstrapInput`.
- [ ] Define `EngineeringRunnerBootstrapResult`.
- [ ] Implement `registerEngineeringRunner()`.
- [ ] Prefer explicit `runner` over `adapter`.
- [ ] Use `getTaskManager()` when no taskManager is supplied.

---

### Task 2: Export Entry

**Files:**
- Modify: `src/core/engine-bootstrap.ts`

- [ ] Re-export bootstrap types/functions from `engineering-runtime-bootstrap`.

---

### Task 3: Validate and Review

- [ ] Run `npm run build`.
- [ ] Review that TaskManager does not import engineering runtime.
- [ ] Review that bootstrap does not create placeholder runner.
- [ ] Review that missing runner/adapter throws clear configuration error.

---

### Task 4: Commit and Push

- [ ] Stage docs and code.
- [ ] Commit with message `feat: add engineering runner bootstrap`.
- [ ] Push.

---

## Self-Review

- Spec coverage: explicit registration, dependency rules, non-goals, and validation covered.
- Placeholder scan: no placeholders.
- Scope consistency: no UI/Rust bridge/default fake pipeline included.
