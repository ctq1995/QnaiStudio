# Engineering Terminal Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a terminal output context provider so engineering Agent runs can receive recent command output as structured context.

**Architecture:** Define a generic terminal output model in a focused module, format recent outputs with bounded stdout/stderr, register the provider in the existing context provider registry, and pass optional terminal outputs through `EngineeringRunInput`. The provider does not execute commands or read terminal sessions.

**Tech Stack:** TypeScript, QnaiStudio AI runtime engineering package, Vite build validation.

---

## File Structure

- Create `src/ai-runtime/engineering/terminal-provider.ts`: terminal output types, formatter, provider factory.
- Modify `src/ai-runtime/engineering/types.ts`: add optional terminal outputs to `EngineeringRunInput`.
- Modify `src/ai-runtime/engineering/context-provider.ts`: include terminal outputs in provider input and default registry.
- Modify `src/ai-runtime/engineering/context-builder.ts`: forward terminal outputs into provider collection.
- Modify `src/ai-runtime/engineering/index.ts`: export terminal provider.

---

### Task 1: Terminal Provider Module

**Files:**
- Create: `src/ai-runtime/engineering/terminal-provider.ts`

- [ ] **Step 1: Create terminal provider module**

Create `src/ai-runtime/engineering/terminal-provider.ts`:

```ts
import type { EngineeringContextProvider } from './context-provider'
import { estimateTokens } from './token-budget'
import { budgetToolResult } from './tool-result-budget'

export interface EngineeringTerminalOutput {
  command: string
  cwd?: string
  exitCode?: number
  stdout?: string
  stderr?: string
  startedAt?: string
  finishedAt?: string
}

export function createTerminalProvider(): EngineeringContextProvider {
  return {
    id: 'terminal',
    kind: 'terminal',
    label: 'Terminal Output',
    priority: 92,
    async collect(input) {
      const outputs = input.terminalOutputs || []
      const summary = formatEngineeringTerminalOutputs(outputs)
      return {
        id: 'terminal',
        kind: 'terminal',
        label: 'Terminal Output',
        priority: 92,
        summary,
        itemCount: outputs.length,
        tokenEstimate: estimateTokens(summary),
      }
    },
  }
}

export function formatEngineeringTerminalOutputs(outputs: EngineeringTerminalOutput[]): string {
  if (outputs.length === 0) return 'Terminal: none'

  const recent = outputs.slice(-5)
  const failed = outputs.filter((output) => output.exitCode !== undefined && output.exitCode !== 0).length
  const lines = [`Terminal: ${failed} failed, ${outputs.length} total`]

  for (const output of recent) {
    lines.push(formatTerminalOutput(output))
  }

  if (outputs.length > recent.length) {
    lines.push(`[terminal outputs truncated: ${outputs.length - recent.length} older items omitted]`)
  }

  return lines.join('\n')
}

function formatTerminalOutput(output: EngineeringTerminalOutput): string {
  const status = output.exitCode === undefined ? 'unknown' : output.exitCode === 0 ? 'ok' : 'failed'
  const lines = [`[${status}] ${output.command}`]

  if (output.cwd) lines.push(`cwd: ${output.cwd}`)
  if (output.exitCode !== undefined) lines.push(`exitCode: ${output.exitCode}`)
  if (output.stderr) lines.push(`stderr:\n${budgetTerminalText(output.stderr)}`)
  if (output.stdout) lines.push(`stdout:\n${budgetTerminalText(output.stdout)}`)

  return lines.join('\n')
}

function budgetTerminalText(content: string): string {
  return budgetToolResult(content, {
    maxChars: 4_000,
    preserveHead: 2_500,
    preserveTail: 1_500,
  }).content
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

In `types.ts`, import `EngineeringTerminalOutput` from `terminal-provider` and add to `EngineeringRunInput`:

```ts
terminalOutputs?: EngineeringTerminalOutput[]
```

- [ ] **Step 2: Extend provider input and default registry**

In `context-provider.ts`, import `createTerminalProvider` and `EngineeringTerminalOutput`, add `terminalOutputs?: EngineeringTerminalOutput[]` to `EngineeringContextProviderInput`, and register `createTerminalProvider()` in `createDefaultEngineeringContextProviderRegistry()`.

- [ ] **Step 3: Forward terminal outputs from context builder**

In `context-builder.ts`, add `terminalOutputs: input.terminalOutputs || []` to `providerRegistry.collect(...)`.

- [ ] **Step 4: Export terminal provider**

In `index.ts`, add:

```ts
export * from './terminal-provider'
```

- [ ] **Step 5: Validate build**

Run: `npm run build`

Expected: build passes, existing Vite chunk warnings are acceptable.

---

### Task 3: Final Validation and Commit

**Files:**
- Validate all changed files under `src/ai-runtime/engineering/`
- Validate `docs/superpowers/plans/2026-05-28-terminal-provider.md`

- [ ] **Step 1: Run final build**

Run: `npm run build`

Expected: build passes, existing Vite chunk warnings are acceptable.

- [ ] **Step 2: Commit and push**

Run:

```bash
git add src/ai-runtime/engineering docs/superpowers/plans/2026-05-28-terminal-provider.md
git commit -m "feat: add terminal context provider"
git push
```

Expected: commit and push succeed.

---

## Self-Review

- Spec coverage: terminal output type, formatting, bounded stdout/stderr, provider, run input, registry, builder forwarding, and export are covered.
- Placeholder scan: No placeholders are present.
- Type consistency: terminal provider imports provider type only and does not execute commands.
