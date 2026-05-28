# Engineering Diagnostics Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a diagnostics context provider so engineering Agent runs can receive compiler, linter, test, or IDE problem information as structured context.

**Architecture:** Define a generic diagnostics model in a focused module, register a diagnostics provider in the existing context provider registry, and pass optional diagnostics through `EngineeringRunInput` into context building. The provider does not read UI stores or execute tools.

**Tech Stack:** TypeScript, QnaiStudio AI runtime engineering package, Vite build validation.

---

## File Structure

- Create `src/ai-runtime/engineering/diagnostics-provider.ts`: diagnostics types, formatter, provider factory.
- Modify `src/ai-runtime/engineering/types.ts`: add optional diagnostics to `EngineeringRunInput`.
- Modify `src/ai-runtime/engineering/context-provider.ts`: include diagnostics in provider input and default registry.
- Modify `src/ai-runtime/engineering/context-builder.ts`: forward diagnostics into provider collection.
- Modify `src/ai-runtime/engineering/index.ts`: export diagnostics provider.

---

### Task 1: Diagnostics Provider Module

**Files:**
- Create: `src/ai-runtime/engineering/diagnostics-provider.ts`

- [ ] **Step 1: Create diagnostics provider module**

Create `src/ai-runtime/engineering/diagnostics-provider.ts`:

```ts
import { estimateTokens } from './token-budget'
import type { EngineeringContextProvider } from './context-provider'

export type EngineeringDiagnosticSeverity = 'error' | 'warning' | 'info'

export interface EngineeringDiagnostic {
  file?: string
  line?: number
  column?: number
  severity: EngineeringDiagnosticSeverity
  message: string
  source?: string
}

export function createDiagnosticsProvider(): EngineeringContextProvider {
  return {
    id: 'diagnostics',
    kind: 'diagnostics',
    label: 'Diagnostics',
    priority: 95,
    async collect(input) {
      const diagnostics = input.diagnostics || []
      const summary = formatEngineeringDiagnostics(diagnostics)
      return {
        id: 'diagnostics',
        kind: 'diagnostics',
        label: 'Diagnostics',
        priority: 95,
        summary,
        itemCount: diagnostics.length,
        tokenEstimate: estimateTokens(summary),
      }
    },
  }
}

export function formatEngineeringDiagnostics(diagnostics: EngineeringDiagnostic[]): string {
  if (diagnostics.length === 0) return 'Diagnostics: none'

  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === 'error').length
  const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === 'warning').length
  const infos = diagnostics.filter((diagnostic) => diagnostic.severity === 'info').length
  const lines = [`Diagnostics: ${errors} errors, ${warnings} warnings, ${infos} info, ${diagnostics.length} total`]

  for (const diagnostic of diagnostics.slice(0, 20)) {
    lines.push(formatDiagnosticLine(diagnostic))
  }

  if (diagnostics.length > 20) {
    lines.push(`[diagnostics truncated: ${diagnostics.length - 20} additional items omitted]`)
  }

  return lines.join('\n')
}

function formatDiagnosticLine(diagnostic: EngineeringDiagnostic): string {
  const location = [diagnostic.file, diagnostic.line, diagnostic.column]
    .filter((part) => part !== undefined && part !== '')
    .join(':')
  const source = diagnostic.source ? ` ${diagnostic.source}` : ''
  const prefix = location ? `${location} ` : ''
  return `${prefix}${diagnostic.severity}${source} ${diagnostic.message}`
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

In `types.ts`, import `EngineeringDiagnostic` from `diagnostics-provider` and add to `EngineeringRunInput`:

```ts
diagnostics?: EngineeringDiagnostic[]
```

- [ ] **Step 2: Extend provider input and default registry**

In `context-provider.ts`, import `createDiagnosticsProvider` and `EngineeringDiagnostic`, add `diagnostics?: EngineeringDiagnostic[]` to `EngineeringContextProviderInput`, and register `createDiagnosticsProvider()` in `createDefaultEngineeringContextProviderRegistry()`.

- [ ] **Step 3: Forward diagnostics from context builder**

In `context-builder.ts`, add `diagnostics: input.diagnostics || []` to `providerRegistry.collect(...)`.

- [ ] **Step 4: Export diagnostics provider**

In `index.ts`, add:

```ts
export * from './diagnostics-provider'
```

- [ ] **Step 5: Validate build**

Run: `npm run build`

Expected: build passes, existing Vite chunk warnings are acceptable.

---

### Task 3: Final Validation and Commit

**Files:**
- Validate all changed files under `src/ai-runtime/engineering/`
- Validate `docs/superpowers/plans/2026-05-28-diagnostics-provider.md`

- [ ] **Step 1: Run final build**

Run: `npm run build`

Expected: build passes, existing Vite chunk warnings are acceptable.

- [ ] **Step 2: Commit and push**

Run:

```bash
git add src/ai-runtime/engineering docs/superpowers/plans/2026-05-28-diagnostics-provider.md
git commit -m "feat: add diagnostics context provider"
git push
```

Expected: commit and push succeed.

---

## Self-Review

- Spec coverage: diagnostics type, formatting, provider, run input, registry, builder forwarding, and export are covered.
- Placeholder scan: No placeholders are present.
- Type consistency: diagnostics provider imports provider type only, avoiding store coupling.
