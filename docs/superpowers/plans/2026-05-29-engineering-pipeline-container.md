# Engineering Pipeline Container Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a lightweight container that converts real engineering dependencies into pipeline deps and registers an EngineeringTaskRunner with TaskManager.

**Architecture:** Keep the container as composition-only. It receives real functions and optional runtime cross-cutting dependencies, builds `EngineeringExecutionPipelineDeps`, and delegates registration to existing bootstrap/adapter functions.

---

## File Structure

- Modify `src/core/engineering-runtime-bootstrap.ts`.
- Add docs under `docs/superpowers/specs` and `docs/superpowers/plans`.

---

### Task 1: Add Pipeline Container Types

**Files:**
- Modify: `src/core/engineering-runtime-bootstrap.ts`

- [ ] Define `EngineeringPipelineContainerInput`.
- [ ] Define `EngineeringPipelineRunnerRegistrationInput`.
- [ ] Reuse existing engineering runtime types through type imports.

---

### Task 2: Implement Container Helpers

**Files:**
- Modify: `src/core/engineering-runtime-bootstrap.ts`

- [ ] Implement `createEngineeringPipelineDeps(input)`.
- [ ] Implement `registerEngineeringPipelineRunner(input)`.
- [ ] Delegate final registration to `registerEngineeringRunner()`.
- [ ] Do not create placeholder implementations.

---

### Task 3: Validate and Review

- [ ] Run `npm run build`.
- [ ] Review that all required capabilities are explicit function dependencies.
- [ ] Review that TaskManager remains decoupled.
- [ ] Review that ordinary task behavior is unchanged.

---

### Task 4: Commit and Push

- [ ] Stage docs and code.
- [ ] Commit with message `feat: add engineering pipeline container`.
- [ ] Push.

---

## Self-Review

- Spec coverage: real dependency input, pipeline deps creation, runner registration, non-goals, and validation covered.
- Placeholder scan: no placeholders.
- Scope consistency: concrete services and Rust bridge are intentionally out of scope.
