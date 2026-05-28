# Context Budget Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add lightweight context budget, tool result trimming, message projection, and overflow recovery helpers to the engineering runtime.

**Architecture:** Implement four pure TypeScript modules under `src/ai-runtime/engineering` and lightly connect budget diagnostics to `EngineeringContext` and summary output. The implementation uses approximate token estimation and does not change existing chat storage or UI.

**Tech Stack:** TypeScript, QnaiStudio AI runtime engineering package, Vite build validation.

---

## File Structure

- Create `src/ai-runtime/engineering/token-budget.ts`: token estimation and budget calculation.
- Create `src/ai-runtime/engineering/tool-result-budget.ts`: head/tail tool result trimming.
- Create `src/ai-runtime/engineering/message-projector.ts`: priority-based message projection.
- Create `src/ai-runtime/engineering/overflow-recovery.ts`: recovery advice for context overflow.
- Modify `src/ai-runtime/engineering/types.ts`: add `EngineeringContextBudget` and budget field.
- Modify `src/ai-runtime/engineering/context-builder.ts`: calculate context budget.
- Modify `src/ai-runtime/engineering/summary-builder.ts`: include budget diagnostics.
- Modify `src/ai-runtime/engineering/index.ts`: export modules.

---

### Task 1: Token Budget and Tool Result Budget

**Files:**
- Create: `src/ai-runtime/engineering/token-budget.ts`
- Create: `src/ai-runtime/engineering/tool-result-budget.ts`

- [ ] **Step 1: Create token budget module**

Create `src/ai-runtime/engineering/token-budget.ts`:

```ts
export interface EngineeringContextBudget {
  maxTokens: number
  reservedOutputTokens: number
  estimatedTokens: number
  remainingTokens: number
  overflow: boolean
}

export interface EngineeringContextBudgetOptions {
  maxTokens?: number
  reservedOutputTokens?: number
}

const DEFAULT_MAX_TOKENS = 120_000
const DEFAULT_RESERVED_OUTPUT_TOKENS = 8_000
const APPROX_CHARS_PER_TOKEN = 4

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / APPROX_CHARS_PER_TOKEN)
}

export function calculateContextBudget(
  parts: string[],
  options: EngineeringContextBudgetOptions = {}
): EngineeringContextBudget {
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS
  const reservedOutputTokens = options.reservedOutputTokens ?? DEFAULT_RESERVED_OUTPUT_TOKENS
  const estimatedTokens = parts.reduce((sum, part) => sum + estimateTokens(part), 0)
  const usableTokens = Math.max(0, maxTokens - reservedOutputTokens)
  const remainingTokens = usableTokens - estimatedTokens

  return {
    maxTokens,
    reservedOutputTokens,
    estimatedTokens,
    remainingTokens,
    overflow: remainingTokens < 0,
  }
}
```

- [ ] **Step 2: Create tool result budget module**

Create `src/ai-runtime/engineering/tool-result-budget.ts`:

```ts
export interface ToolResultBudgetOptions {
  maxChars?: number
  preserveHead?: number
  preserveTail?: number
}

export interface BudgetedToolResult {
  content: string
  truncated: boolean
  omittedChars: number
}

const DEFAULT_MAX_CHARS = 12_000
const DEFAULT_PRESERVE_HEAD = 8_000
const DEFAULT_PRESERVE_TAIL = 4_000

export function budgetToolResult(content: string, options: ToolResultBudgetOptions = {}): BudgetedToolResult {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS
  const preserveHead = options.preserveHead ?? DEFAULT_PRESERVE_HEAD
  const preserveTail = options.preserveTail ?? DEFAULT_PRESERVE_TAIL

  if (content.length <= maxChars) {
    return { content, truncated: false, omittedChars: 0 }
  }

  const head = content.slice(0, preserveHead)
  const tail = content.slice(Math.max(preserveHead, content.length - preserveTail))
  const omittedChars = content.length - head.length - tail.length

  return {
    content: `${head}\n\n[tool result truncated: ${omittedChars} characters omitted]\n\n${tail}`,
    truncated: true,
    omittedChars,
  }
}
```

- [ ] **Step 3: Validate build**

Run: `npm run build`

Expected: build passes, existing Vite chunk warnings are acceptable.

---

### Task 2: Message Projection and Overflow Recovery

**Files:**
- Create: `src/ai-runtime/engineering/message-projector.ts`
- Create: `src/ai-runtime/engineering/overflow-recovery.ts`

- [ ] **Step 1: Create message projector**

Create `src/ai-runtime/engineering/message-projector.ts`:

```ts
import { calculateContextBudget, estimateTokens, type EngineeringContextBudgetOptions } from './token-budget'
import { budgetToolResult } from './tool-result-budget'

export interface EngineeringMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  priority?: number
}

export interface ProjectedEngineeringMessages {
  messages: EngineeringMessage[]
  droppedMessages: number
  truncatedToolResults: number
  budget: ReturnType<typeof calculateContextBudget>
}

export function projectEngineeringMessages(
  messages: EngineeringMessage[],
  options: EngineeringContextBudgetOptions = {}
): ProjectedEngineeringMessages {
  const normalized = messages.map((message) => {
    if (message.role !== 'tool') return message
    const budgeted = budgetToolResult(message.content)
    return { ...message, content: budgeted.content, priority: message.priority ?? rolePriority(message.role) }
  })

  const ordered = normalized
    .map((message, index) => ({ message, index, score: message.priority ?? rolePriority(message.role) }))
    .sort((a, b) => b.score - a.score || b.index - a.index)

  const selected: Array<{ message: EngineeringMessage; index: number }> = []
  let usedTokens = 0
  const maxTokens = options.maxTokens ?? 120_000
  const reservedOutputTokens = options.reservedOutputTokens ?? 8_000
  const usableTokens = Math.max(0, maxTokens - reservedOutputTokens)

  for (const item of ordered) {
    const tokens = estimateTokens(item.message.content)
    if (usedTokens + tokens > usableTokens) continue
    selected.push({ message: item.message, index: item.index })
    usedTokens += tokens
  }

  const projected = selected.sort((a, b) => a.index - b.index).map((item) => item.message)

  return {
    messages: projected,
    droppedMessages: messages.length - projected.length,
    truncatedToolResults: normalized.filter((message, index) => message.role === 'tool' && message.content !== messages[index].content).length,
    budget: calculateContextBudget(projected.map((message) => message.content), options),
  }
}

function rolePriority(role: EngineeringMessage['role']): number {
  if (role === 'system') return 100
  if (role === 'user') return 80
  if (role === 'assistant') return 60
  return 30
}
```

- [ ] **Step 2: Create overflow recovery helper**

Create `src/ai-runtime/engineering/overflow-recovery.ts`:

```ts
import type { EngineeringContextBudget } from './token-budget'

export function buildOverflowRecoveryAdvice(budget: EngineeringContextBudget): string[] {
  if (!budget.overflow) return []

  return [
    '减少候选文件数量，只保留与当前任务直接相关的文件。',
    '裁剪大型工具结果，保留开头和结尾。',
    '压缩历史 assistant 消息和旧工具调用结果。',
    '仅保留最近几轮对话。',
    '降低项目指令文件读取上限。',
  ]
}
```

- [ ] **Step 3: Validate build**

Run: `npm run build`

Expected: build passes, existing Vite chunk warnings are acceptable.

---

### Task 3: Context and Summary Integration

**Files:**
- Modify: `src/ai-runtime/engineering/types.ts`
- Modify: `src/ai-runtime/engineering/context-builder.ts`
- Modify: `src/ai-runtime/engineering/summary-builder.ts`
- Modify: `src/ai-runtime/engineering/index.ts`

- [ ] **Step 1: Extend EngineeringContext type**

Modify `src/ai-runtime/engineering/types.ts`:

```ts
import type { EngineeringContextBudget } from './token-budget'
```

Add `budget: EngineeringContextBudget` to `EngineeringContext`.

- [ ] **Step 2: Calculate context budget**

Modify `src/ai-runtime/engineering/context-builder.ts`:

```ts
import { calculateContextBudget } from './token-budget'
```

When building context, calculate budget from:

```ts
const budget = calculateContextBudget([
  input.userRequest,
  ...selectedFiles,
  ...Array.from(candidateFiles),
  instructions.merged,
])
```

Add `budget` to the returned context.

- [ ] **Step 3: Add budget summary output**

Modify `src/ai-runtime/engineering/summary-builder.ts` inside `if (summary.context)` block:

```ts
lines.push(`- 上下文预算：估算 ${summary.context.budget.estimatedTokens} tokens，剩余 ${summary.context.budget.remainingTokens} tokens`)
if (summary.context.budget.overflow) lines.push('- 上下文预算：已超出')
```

- [ ] **Step 4: Export modules**

Modify `src/ai-runtime/engineering/index.ts` and add:

```ts
export * from './token-budget'
export * from './tool-result-budget'
export * from './message-projector'
export * from './overflow-recovery'
```

- [ ] **Step 5: Validate build**

Run: `npm run build`

Expected: build passes, existing Vite chunk warnings are acceptable.

---

### Task 4: Final Validation and Commit

**Files:**
- Validate all changed files under `src/ai-runtime/engineering/`
- Validate `docs/superpowers/plans/2026-05-28-context-budget-controls.md`

- [ ] **Step 1: Run final build**

Run: `npm run build`

Expected: build passes, existing Vite chunk warnings are acceptable.

- [ ] **Step 2: Inspect diff**

Run: `git diff -- src/ai-runtime/engineering docs/superpowers/plans/2026-05-28-context-budget-controls.md`

Expected: changes are limited to context budget controls and this implementation plan.

- [ ] **Step 3: Commit**

Run:

```bash
git add src/ai-runtime/engineering docs/superpowers/plans/2026-05-28-context-budget-controls.md
git commit -m "feat: add context budget controls"
```

Expected: commit succeeds.

---

## Self-Review

- Spec coverage: token estimation, tool result trimming, message projection, overflow recovery, context integration, summary output, and exports are covered.
- Placeholder scan: No placeholders are present.
- Type consistency: `EngineeringContextBudget` is defined in `token-budget.ts` and imported by `types.ts`.
