# Engineering Git Diff Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a git diff context provider so engineering Agent runs can receive current change context as structured input.

**Architecture:** Define a generic git diff context model in a focused module, format changed files and bounded diff text, register the provider in the existing context provider registry, and pass optional git diff through `EngineeringRunInput`. The provider does not execute git commands or parse hunks.

**Tech Stack:** TypeScript, QnaiStudio AI runtime engineering package, Vite build validation.

---

## File Structure

- Create `src/ai-runtime/engineering/git-diff-provider.ts`: git diff context type, formatter, provider factory.
- Modify `src/ai-runtime/engineering/types.ts`: add optional git diff to `EngineeringRunInput`.
- Modify `src/ai-runtime/engineering/context-provider.ts`: include git diff in provider input and default registry.
- Modify `src/ai-runtime/engineering/context-builder.ts`: forward git diff into provider collection.
- Modify `src/ai-runtime/engineering/index.ts`: export git diff provider.

---

### Task 1: Git Diff Provider Module

**Files:**
- Create: `src/ai-runtime/engineering/git-diff-provider.ts`

- [ ] **Step 1: Create git diff provider module**

Create `src/ai-runtime/engineering/git-diff-provider.ts`:

```ts
import type { EngineeringContextProvider } from './context-provider'
import { estimateTokens } from './token-budget'
import { budgetToolResult } from './tool-result-budget'

export interface EngineeringGitDiffContext {
  diff?: string
  changedFiles?: string[]
}

export function createGitDiffProvider(): EngineeringContextProvider {
  return {
    id: 'git-diff',
    kind: 'gitDiff',
    label: 'Git Diff',
    priority: 88,
    async collect(input) {
      const gitDiff = input.gitDiff || {}
      const summary = formatEngineeringGitDiff(gitDiff)
      return {
        id: 'git-diff',
        kind: 'gitDiff',
        label: 'Git Diff',
        priority: 88,
        summary,
        itemCount: gitDiff.changedFiles?.length || 0,
        tokenEstimate: estimateTokens(summary),
      }
    },
  }
}

export function formatEngineeringGitDiff(gitDiff: EngineeringGitDiffContext): string {
  const changedFiles = gitDiff.changedFiles || []
  const diff = gitDiff.diff || ''

  if (changedFiles.length === 0 && diff.length === 0) return 'Git Diff: none'

  const lines = [`Git Diff: ${changedFiles.length} changed files`]

  if (changedFiles.length > 0) {
    lines.push('Changed files:')
    for (const file of changedFiles.slice(0, 50)) lines.push(`- ${file}`)
    if (changedFiles.length > 50) lines.push(`[changed files truncated: ${changedFiles.length - 50} additional files omitted]`)
  }

  if (diff) {
    lines.push('Diff:')
    lines.push(budgetToolResult(diff, {
      maxChars: 16_000,
      preserveHead: 10_000,
      preserveTail: 6_000,
    }).content)
  }

  return lines.join('\n')
}
```

- [ ] **Step 2: Validate build**

Run: `npm run build`

Expected: build passes, existing Vite chunk warnings are acceptable.

---

### Task 2: Registry and Input Integration

**Files:**
- Modify: `src/ai-runtime/engineering/types.ts`
- Modify: `src/ai-runtime/engineering/context-provider.ts`
- Modify: `src/ai-runtime/engineering/context-builder.ts`
- Modify: `src/ai-runtime/engineering/index.ts`

- [ ] **Step 1: Extend run input**

In `types.ts`, import `EngineeringGitDiffContext` from `git-diff-provider` and add to `EngineeringRunInput`:

```ts
gitDiff?: EngineeringGitDiffContext
```

- [ ] **Step 2: Extend provider input and default registry**

In `context-provider.ts`, import `createGitDiffProvider` and `EngineeringGitDiffContext`, add `gitDiff?: EngineeringGitDiffContext` to `EngineeringContextProviderInput`, and register `createGitDiffProvider()` in `createDefaultEngineeringContextProviderRegistry()`.

- [ ] **Step 3: Forward git diff from context builder**

In `context-builder.ts`, add `gitDiff: input.gitDiff` to `providerRegistry.collect(...)`.

- [ ] **Step 4: Export git diff provider**

In `index.ts`, add:

```ts
export * from './git-diff-provider'
```

- [ ] **Step 5: Validate build**

Run: `npm run build`

Expected: build passes, existing Vite chunk warnings are acceptable.

---

### Task 3: Final Validation and Commit

**Files:**
- Validate all changed files under `src/ai-runtime/engineering/`
- Validate `docs/superpowers/plans/2026-05-28-git-diff-provider.md`

- [ ] **Step 1: Run final build**

Run: `npm run build`

Expected: build passes, existing Vite chunk warnings are acceptable.

- [ ] **Step 2: Commit and push**

Run:

```bash
git add src/ai-runtime/engineering docs/superpowers/plans/2026-05-28-git-diff-provider.md
git commit -m "feat: add git diff context provider"
git push
```

Expected: commit and push succeed.

---

## Self-Review

- Spec coverage: git diff type, formatting, changed file limits, bounded diff text, provider, run input, registry, builder forwarding, and export are covered.
- Placeholder scan: No placeholders are present.
- Type consistency: git diff provider imports provider type only and does not call git.
