# Engineering Real Pipeline Adapters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Provide real service adapters for the five pipeline dependencies needed by EngineeringExecutionPipeline without faking completion or raw diff data.

**Architecture:** Add a service-layer adapter module that reuses workspace version service and requires explicit injection for agent execution, raw git diff, verification, and review.

---

## File Structure

- Create `src/services/engineeringPipelineAdapters.ts`.
- Add docs under `docs/superpowers/specs` and `docs/superpowers/plans`.

---

### Task 1: Wire executeAgentTask

- [ ] Require explicit `executeAgentTask` function.
- [ ] Do not wrap `AIRuntimeService.sendMessage()` as completion because it only starts a session.

---

### Task 2: Wire getGitDiff

- [ ] Require explicit `getRawGitDiff` function.
- [ ] Validate non-empty diff contains `diff --git` headers.
- [ ] Return empty string for no changes.

---

### Task 3: Implement createSnapshot Adapter

- [ ] Use `createWorkspaceVersion()` with `kind: 'auto'`.
- [ ] Return `{ versionId }` according to pipeline contract.

---

### Task 4: Wire Verification and Review

- [ ] Require explicit `runVerification` function.
- [ ] Require explicit `runReview` function.
- [ ] Pass both directly into pipeline deps.

---

### Task 5: Validate, Review, Commit

- [ ] Run `npm run build`.
- [ ] Review that there are no fake defaults.
- [ ] Review that no unknown commands are executed.
- [ ] Review that agent completion and raw diff contracts are not violated.
- [ ] Commit and push.

---

## Self-Review

- Spec coverage: all five requested dependency points are covered.
- Placeholder scan: no placeholders.
- Scope consistency: no Rust command additions, no shell auto-runner, no fake review implementation, and no fake agent completion.
