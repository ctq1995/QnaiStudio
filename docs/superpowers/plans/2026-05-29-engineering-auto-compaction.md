# Engineering Auto Compaction Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic Auto Compaction Policy for engineering messages and expose it through Engineering Context Runtime.

**Architecture:** Implement a focused TypeScript policy module with micro and snip compaction. Micro compaction truncates large tool messages via the existing tool-result budget helper; snip compaction preserves system messages and recent messages while replacing removed middle history with a marker message. Context Runtime delegates to this policy without changing existing pipeline behavior.

**Tech Stack:** TypeScript, QnaiStudio AI runtime engineering package, Vite build validation.

---

## File Structure

- Create `src/ai-runtime/engineering/auto-compaction-policy.ts`: compaction types, policy implementation, factory helper.
- Modify `src/ai-runtime/engineering/context-runtime.ts`: expose `compactMessages()` and capability snapshot.
- Modify `src/ai-runtime/engineering/index.ts`: export auto compaction policy.

---

### Task 1: Auto Compaction Policy Module

**Files:**
- Create: `src/ai-runtime/engineering/auto-compaction-policy.ts`

- [ ] **Step 1: Implement deterministic compaction policy**

Create a module that supports `micro` and `snip` compaction over `EngineeringMessage[]`, returns compacted messages, action list, and before/after budgets.

- [ ] **Step 2: Run build**

Run: `npm run build`

Expected: build passes; existing Vite chunk warnings are acceptable.

---

### Task 2: Context Runtime Integration

**Files:**
- Modify: `src/ai-runtime/engineering/context-runtime.ts`
- Modify: `src/ai-runtime/engineering/index.ts`

- [ ] **Step 1: Add `compactMessages()` to Context Runtime**

Expose the policy through `EngineeringContextRuntime.compactMessages(messages, options)`.

- [ ] **Step 2: Export auto compaction module**

Add:

```ts
export * from './auto-compaction-policy'
```

- [ ] **Step 3: Run final build**

Run: `npm run build`

Expected: build passes; existing Vite chunk warnings are acceptable.

---

### Task 3: Review, Commit, and Push

**Files:**
- Review all changed files.

- [ ] **Step 1: Run targeted review**

Review for:

```text
original messages are not mutated
system messages preserve original relative order
recent messages are preserved by snip
tool result truncation action source index reporting is correct
context runtime remains non-invasive and inherits projection budget defaults
```

- [ ] **Step 2: Commit and push**

Run:

```bash
git add src/ai-runtime/engineering/auto-compaction-policy.ts src/ai-runtime/engineering/context-runtime.ts src/ai-runtime/engineering/index.ts docs/superpowers/plans/2026-05-29-engineering-auto-compaction.md
git commit -m "feat: add engineering auto compaction"
git push
```

Expected: commit and push succeed.

---

## Self-Review

- Spec coverage: micro compaction, snip compaction, before/after budget, action list, context runtime exposure, export, and build validation are covered.
- Placeholder scan: No placeholders are present.
- Scope consistency: model-based full compaction, persistent cache, transcript writes, and pipeline replacement are intentionally out of scope.
