# Strategy Attribution Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emit and record selected verification/review strategies so timeline explains concrete subtype execution decisions.

**Architecture:** Add run event types in engineering runtime, emit them from `EngineeringExecutionPipeline`, record them through existing event/transcript wiring, and render summaries in transcript timeline. No UI or runner behavior changes.

**Tech Stack:** TypeScript, Vitest, existing engineering runtime pipeline/transcript modules.

---

### Task 1: Strategy run event types and pipeline emit

**Files:**
- Modify: `src/ai-runtime/engineering/types.ts`
- Modify: `src/ai-runtime/engineering/execution-pipeline.ts`
- Test: `src/ai-runtime/engineering/execution-pipeline-router.test.ts`

- [ ] Add `verification_strategy_selected` and `review_strategy_selected` to `EngineeringRunEvent`.
- [ ] Emit verification strategy after command selection.
- [ ] Emit review strategy before review execution.
- [ ] Assert emitted events in pipeline router tests.

### Task 2: Transcript and timeline mapping

**Files:**
- Modify: `src/ai-runtime/engineering/transcript-recorder.ts`
- Modify: `src/ai-runtime/engineering/transcript-timeline.ts`
- Test: `src/ai-runtime/engineering/transcript-timeline-router.test.ts`

- [ ] Add transcript event types `verification_strategy` and `review_strategy`.
- [ ] Map strategy payloads to timeline `kind: strategy`.
- [ ] Add concise summaries for verification and review strategy payloads.

### Task 3: Verification

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Check no debug code, no focused tests.
- [ ] Commit implementation with message `feat: record subtype strategy attribution`.
