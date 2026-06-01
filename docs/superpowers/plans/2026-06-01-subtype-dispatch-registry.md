# Subtype Dispatch Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make engineering route subtypes select verification commands and review prompt variants.

**Architecture:** Add focused subtype-aware helpers in the engineering runtime. The pipeline delegates verification command selection and review prompt building to these helpers while preserving existing behavior when no subtype is provided.

**Tech Stack:** TypeScript, Vitest, existing engineering runtime modules.

---

### Task 1: Verification subtype command selection

**Files:**
- Modify: `src/ai-runtime/engineering/verification-policy.ts`
- Test: `src/ai-runtime/engineering/verification-policy.test.ts`

- [ ] Add `selectVerificationCommandsForSubtype(subtype, changedFiles, packageScripts)`.
- [ ] Map `verify.build` to build command only.
- [ ] Map `verify.test` to test command only.
- [ ] Map `verify.lint` to lint command only.
- [ ] Map `verify.typecheck` to typecheck command only.
- [ ] Preserve existing `selectVerificationCommands` behavior when subtype is absent.

### Task 2: Review subtype prompt selection

**Files:**
- Modify: `src/ai-runtime/engineering/review-policy.ts`
- Test: `src/ai-runtime/engineering/review-policy.test.ts`

- [ ] Add `buildEngineeringReviewPromptForSubtype(subtype, diff)`.
- [ ] Use default prompt for `review.diff` or missing subtype.
- [ ] Add security-focused prompt for `review.security`.
- [ ] Add architecture-focused prompt for `review.architecture`.
- [ ] Add performance-focused prompt for `review.performance`.

### Task 3: Pipeline integration

**Files:**
- Modify: `src/ai-runtime/engineering/execution-pipeline.ts`
- Modify: `src/ai-runtime/engineering/execution-pipeline-router.test.ts`

- [ ] Replace verification command selection with subtype-aware selection.
- [ ] Replace review prompt building with subtype-aware prompt building.
- [ ] Add pipeline tests proving `verify.lint` only runs lint and `review.security` uses security prompt.

### Task 4: Verification

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Check for debug code and focused tests.
- [ ] Commit implementation with message `feat: dispatch engineering route subtypes`.
