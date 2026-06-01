# Router-driven Pipeline Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `EngineeringExecutionPipeline` consume an optional router decision and skip unneeded stages while preserving default behavior.

**Architecture:** Add a small `EngineeringExecutionPipelineRunOptions` type and stage capability checks inside the existing pipeline. Tests use stubbed deps to verify which stages execute for each route.

**Tech Stack:** TypeScript, Vitest, existing engineering runtime modules.

---

### Task 1: Add Pipeline Run Options

**Files:**
- Modify: `src/ai-runtime/engineering/execution-pipeline.ts`

- [ ] Add `EngineeringExecutionPipelineRunOptions` with optional `routeDecision`.
- [ ] Change `run(input)` to `run(input, options = {})`.
- [ ] Add helpers for `requiresCapability()` and `shouldRunStage()`.

### Task 2: Apply Route Decision to Stages

**Files:**
- Modify: `src/ai-runtime/engineering/execution-pipeline.ts`

- [ ] Preserve context stage as always-on.
- [ ] Gate snapshot by `snapshot` capability.
- [ ] Gate execute by `agent_execution` capability and run-mode decision.
- [ ] Gate diff by `git_diff` capability.
- [ ] Gate verify by `verification` capability.
- [ ] Gate review by `review` capability.

### Task 3: Add Tests

**Files:**
- Create: `src/ai-runtime/engineering/execution-pipeline-router.test.ts`

- [ ] Test context-only route skips snapshot/execute/diff/verify/review.
- [ ] Test review route skips execute and verification but runs diff/review.
- [ ] Test verify route skips execute/review but runs diff/verification.
- [ ] Test execute route runs full path.

### Task 4: Verify and Commit

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Check diff for debug code.
- [ ] Commit with message `feat: let pipeline consume agent routes`.
