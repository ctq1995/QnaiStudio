# Engineering Plan Act Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Plan/Act run mode policy so engineering Agent runs can analyze safely without side effects unless execution is allowed.

**Architecture:** Introduce a pure run-mode policy module, add optional run mode to run input and summary, and gate execution-pipeline side-effect stages. Plan mode returns after classification and context construction with a summary; act mode preserves the current full pipeline.

**Tech Stack:** TypeScript, QnaiStudio AI runtime engineering package, Vite build validation.

---

## File Structure

- Create `src/ai-runtime/engineering/run-mode-policy.ts`: mode types and resolver.
- Modify `src/ai-runtime/engineering/types.ts`: add `runMode` to input and `runModeDecision` to summary.
- Modify `src/ai-runtime/engineering/execution-pipeline.ts`: resolve mode and early-return in plan mode.
- Modify `src/ai-runtime/engineering/summary-builder.ts`: output mode and skipped stages.
- Modify `src/ai-runtime/engineering/index.ts`: export run mode policy.

---

### Task 1: Run Mode Policy Module

**Files:**
- Create: `src/ai-runtime/engineering/run-mode-policy.ts`

- [ ] **Step 1: Create run mode policy module**

Create `src/ai-runtime/engineering/run-mode-policy.ts`:

```ts
import type { EngineeringTaskClassification } from './types'

export type EngineeringRunMode = 'plan' | 'act'

export interface EngineeringRunModeDecision {
  mode: EngineeringRunMode
  allowSnapshot: boolean
  allowExecution: boolean
  allowVerification: boolean
  allowReview: boolean
  skippedStages: string[]
}

export interface ResolveEngineeringRunModeInput {
  requestedMode?: EngineeringRunMode
  classification: EngineeringTaskClassification
}

export function resolveEngineeringRunMode(input: ResolveEngineeringRunModeInput): EngineeringRunModeDecision {
  const mode = input.requestedMode || inferRunMode(input.classification)
  if (mode === 'act') {
    return {
      mode,
      allowSnapshot: true,
      allowExecution: true,
      allowVerification: true,
      allowReview: true,
      skippedStages: [],
    }
  }

  return {
    mode,
    allowSnapshot: false,
    allowExecution: false,
    allowVerification: false,
    allowReview: false,
    skippedStages: ['snapshot', 'execute', 'diff', 'verify', 'review'],
  }
}

function inferRunMode(classification: EngineeringTaskClassification): EngineeringRunMode {
  if (classification.taskType === 'feature' || classification.taskType === 'bugfix' || classification.taskType === 'refactor') return 'act'
  return 'plan'
}
```

- [ ] **Step 2: Validate build**

Run: `npm run build`

Expected: build passes, existing Vite chunk warnings are acceptable.

---

### Task 2: Types and Pipeline Integration

**Files:**
- Modify: `src/ai-runtime/engineering/types.ts`
- Modify: `src/ai-runtime/engineering/execution-pipeline.ts`
- Modify: `src/ai-runtime/engineering/index.ts`

- [ ] **Step 1: Extend types**

In `types.ts`, import `EngineeringRunMode` and `EngineeringRunModeDecision` from `run-mode-policy`, add `runMode?: EngineeringRunMode` to `EngineeringRunInput`, and add `runModeDecision?: EngineeringRunModeDecision` to `EngineeringRunSummary`.

- [ ] **Step 2: Resolve run mode in pipeline**

In `execution-pipeline.ts`, import `resolveEngineeringRunMode`, call it after context creation, and if `allowExecution` is false, return a summary without snapshot/execute/diff/verify/review.

- [ ] **Step 3: Export module**

In `index.ts`, add:

```ts
export * from './run-mode-policy'
```

- [ ] **Step 4: Validate build**

Run: `npm run build`

Expected: build passes, existing Vite chunk warnings are acceptable.

---

### Task 3: Summary and Commit

**Files:**
- Modify: `src/ai-runtime/engineering/summary-builder.ts`
- Validate: `docs/superpowers/plans/2026-05-28-plan-act-mode.md`

- [ ] **Step 1: Add summary output**

In `summary-builder.ts`, output run mode and skipped stages when `summary.runModeDecision` exists.

- [ ] **Step 2: Final build**

Run: `npm run build`

Expected: build passes, existing Vite chunk warnings are acceptable.

- [ ] **Step 3: Commit and push**

Run:

```bash
git add src/ai-runtime/engineering docs/superpowers/plans/2026-05-28-plan-act-mode.md
git commit -m "feat: add engineering plan act mode"
git push
```

Expected: commit and push succeed.

---

## Self-Review

- Spec coverage: mode type, resolver, input integration, pipeline gating, summary output, export, build verification, and commit are covered.
- Placeholder scan: No placeholders are present.
- Type consistency: `EngineeringRunModeDecision` is defined before summary references it.
