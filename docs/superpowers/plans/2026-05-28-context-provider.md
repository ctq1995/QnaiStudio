# Engineering Context Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight context provider registry so engineering context sources can evolve without bloating the context builder.

**Architecture:** Create a pure TypeScript provider registry and four built-in providers that summarize already-collected context data. Integrate provider results into `EngineeringContext` and final summaries without changing UI or adding new external data collection.

**Tech Stack:** TypeScript, QnaiStudio AI runtime engineering package, Vite build validation.

---

## File Structure

- Create `src/ai-runtime/engineering/context-provider.ts`: provider types, registry, built-in providers, and collector.
- Modify `src/ai-runtime/engineering/types.ts`: add provider results to `EngineeringContext`.
- Modify `src/ai-runtime/engineering/context-builder.ts`: collect built-in provider results.
- Modify `src/ai-runtime/engineering/summary-builder.ts`: show provider diagnostics.
- Modify `src/ai-runtime/engineering/index.ts`: export context provider module.

---

### Task 1: Context Provider Module

**Files:**
- Create: `src/ai-runtime/engineering/context-provider.ts`

- [ ] **Step 1: Implement provider module**

Create `src/ai-runtime/engineering/context-provider.ts`:

```ts
import { estimateTokens } from './token-budget'
import type { EngineeringInstructions, EngineeringProjectFingerprint, EngineeringRepoMap } from './types'

export type EngineeringContextProviderKind =
  | 'instructions'
  | 'selectedFiles'
  | 'repoMap'
  | 'fingerprint'
  | 'gitDiff'
  | 'diagnostics'
  | 'terminal'
  | 'custom'

export interface EngineeringContextProviderResult {
  id: string
  kind: EngineeringContextProviderKind
  label: string
  priority: number
  summary: string
  itemCount: number
  tokenEstimate: number
}

export interface EngineeringContextProviderInput {
  selectedFiles: string[]
  instructions: EngineeringInstructions
  repoMap?: EngineeringRepoMap
  fingerprint: EngineeringProjectFingerprint
}

export interface EngineeringContextProvider {
  id: string
  kind: EngineeringContextProviderKind
  label: string
  priority: number
  collect(input: EngineeringContextProviderInput): Promise<EngineeringContextProviderResult>
}

export class EngineeringContextProviderRegistry {
  private readonly providers = new Map<string, EngineeringContextProvider>()

  register(provider: EngineeringContextProvider): void {
    this.providers.set(provider.id, provider)
  }

  list(): EngineeringContextProvider[] {
    return Array.from(this.providers.values()).sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
  }

  async collect(input: EngineeringContextProviderInput): Promise<EngineeringContextProviderResult[]> {
    const results = await Promise.all(this.list().map((provider) => provider.collect(input)))
    return results.sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id))
  }
}

export function createDefaultEngineeringContextProviderRegistry(): EngineeringContextProviderRegistry {
  const registry = new EngineeringContextProviderRegistry()
  registry.register(createSelectedFilesProvider())
  registry.register(createInstructionsProvider())
  registry.register(createRepoMapProvider())
  registry.register(createFingerprintProvider())
  return registry
}

export function createSelectedFilesProvider(): EngineeringContextProvider {
  return {
    id: 'selected-files',
    kind: 'selectedFiles',
    label: 'Selected Files',
    priority: 90,
    async collect(input) {
      const summary = input.selectedFiles.slice(0, 20).join('\n')
      return providerResult('selected-files', 'selectedFiles', 'Selected Files', 90, summary, input.selectedFiles.length)
    },
  }
}

export function createInstructionsProvider(): EngineeringContextProvider {
  return {
    id: 'instructions',
    kind: 'instructions',
    label: 'Project Instructions',
    priority: 100,
    async collect(input) {
      return providerResult('instructions', 'instructions', 'Project Instructions', 100, input.instructions.merged, input.instructions.files.length)
    },
  }
}

export function createRepoMapProvider(): EngineeringContextProvider {
  return {
    id: 'repo-map',
    kind: 'repoMap',
    label: 'Repo Map',
    priority: 80,
    async collect(input) {
      const summary = input.repoMap?.summary || ''
      return providerResult('repo-map', 'repoMap', 'Repo Map', 80, summary, input.repoMap?.files.length || 0)
    },
  }
}

export function createFingerprintProvider(): EngineeringContextProvider {
  return {
    id: 'fingerprint',
    kind: 'fingerprint',
    label: 'Project Fingerprint',
    priority: 85,
    async collect(input) {
      return providerResult('fingerprint', 'fingerprint', 'Project Fingerprint', 85, input.fingerprint.summary, input.fingerprint.languages.length + input.fingerprint.buildSystems.length)
    },
  }
}

function providerResult(
  id: string,
  kind: EngineeringContextProviderKind,
  label: string,
  priority: number,
  summary: string,
  itemCount: number
): EngineeringContextProviderResult {
  return {
    id,
    kind,
    label,
    priority,
    summary,
    itemCount,
    tokenEstimate: estimateTokens(summary),
  }
}
```

- [ ] **Step 2: Validate build**

Run: `npm run build`

Expected: build passes, existing Vite chunk warnings are acceptable.

---

### Task 2: Context Integration

**Files:**
- Modify: `src/ai-runtime/engineering/types.ts`
- Modify: `src/ai-runtime/engineering/context-builder.ts`
- Modify: `src/ai-runtime/engineering/index.ts`

- [ ] **Step 1: Add providers to context type**

In `types.ts`, import `EngineeringContextProviderResult` from `context-provider` and add `providers: EngineeringContextProviderResult[]` to `EngineeringContext`.

- [ ] **Step 2: Collect providers in context builder**

In `context-builder.ts`, import `createDefaultEngineeringContextProviderRegistry`, create registry after fingerprint/repoMap/instructions are available, collect provider results, and add them to context.

- [ ] **Step 3: Export provider module**

In `index.ts`, add:

```ts
export * from './context-provider'
```

- [ ] **Step 4: Validate build**

Run: `npm run build`

Expected: build passes, existing Vite chunk warnings are acceptable.

---

### Task 3: Summary and Commit

**Files:**
- Modify: `src/ai-runtime/engineering/summary-builder.ts`
- Validate: `docs/superpowers/plans/2026-05-28-context-provider.md`

- [ ] **Step 1: Add provider summary output**

In `summary-builder.ts`, inside `if (summary.context)`, add:

```ts
lines.push(`- 上下文来源：${summary.context.providers.length} 个`)
for (const provider of summary.context.providers.slice(0, 4)) {
  lines.push(`  - ${provider.label}: ${provider.itemCount} items, ~${provider.tokenEstimate} tokens`)
}
```

- [ ] **Step 2: Final build**

Run: `npm run build`

Expected: build passes, existing Vite chunk warnings are acceptable.

- [ ] **Step 3: Commit**

Run:

```bash
git add src/ai-runtime/engineering docs/superpowers/plans/2026-05-28-context-provider.md
git commit -m "feat: add engineering context providers"
```

Expected: commit succeeds.

---

## Self-Review

- Spec coverage: provider types, registry, default providers, context integration, summary output, and export are covered.
- Placeholder scan: No placeholders are present.
- Type consistency: provider result is imported by context type after module creation.
