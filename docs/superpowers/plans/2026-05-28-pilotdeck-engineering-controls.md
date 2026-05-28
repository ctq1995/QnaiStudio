# PilotDeck Engineering Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PilotDeck-inspired permission policy, tool scheduling, and audit recording to QnaiStudio's engineering execution loop.

**Architecture:** Implement three focused modules inside `src/ai-runtime/engineering`: permission decisions, ordered concurrent-safe tool scheduling, and in-memory audit records. Lightly integrate permission/audit into the existing verification stage without changing UI or existing tool execution contracts.

**Tech Stack:** TypeScript, existing QnaiStudio AI runtime engineering package, Vite build validation.

---

## File Structure

- Create `src/ai-runtime/engineering/permission-policy.ts`: permission modes, tool kinds, allow/ask/deny decisions.
- Create `src/ai-runtime/engineering/tool-scheduler.ts`: PilotDeck-inspired concurrency-safe scheduler.
- Create `src/ai-runtime/engineering/audit-recorder.ts`: permission/tool audit record types and in-memory recorder.
- Modify `src/ai-runtime/engineering/types.ts`: add permission mode and audit summary to run input/summary.
- Modify `src/ai-runtime/engineering/execution-pipeline.ts`: gate verification commands and record audits.
- Modify `src/ai-runtime/engineering/summary-builder.ts`: include audit summary.
- Modify `src/ai-runtime/engineering/index.ts`: export new modules.

---

### Task 1: Permission Policy

**Files:**
- Create: `src/ai-runtime/engineering/permission-policy.ts`
- Modify: `src/ai-runtime/engineering/index.ts`

- [ ] **Step 1: Create permission policy module**

Create `src/ai-runtime/engineering/permission-policy.ts`:

```ts
import { assessCommandRisk } from './tool-risk-policy'

export type EngineeringPermissionMode = 'plan' | 'default' | 'acceptEdits' | 'bypassPermissions'
export type EngineeringToolKind = 'read' | 'write' | 'shell' | 'network' | 'review' | 'unknown'

export type EngineeringPermissionDecision =
  | { type: 'allow'; reason: string }
  | { type: 'ask'; reason: string }
  | { type: 'deny'; reason: string }

export interface EngineeringPermissionRequest {
  mode?: EngineeringPermissionMode
  toolKind: EngineeringToolKind
  command?: string
}

export function decideEngineeringPermission(request: EngineeringPermissionRequest): EngineeringPermissionDecision {
  const mode = request.mode || 'default'
  const commandRisk = request.command ? assessCommandRisk(request.command) : undefined

  if (commandRisk?.risk === 'dangerous') {
    return { type: 'deny', reason: commandRisk.reason }
  }

  if (mode === 'bypassPermissions') {
    return { type: 'allow', reason: 'bypassPermissions allows non-dangerous operations' }
  }

  if (mode === 'plan') {
    return request.toolKind === 'read' || request.toolKind === 'review'
      ? { type: 'allow', reason: 'plan mode allows read-only operations' }
      : { type: 'deny', reason: 'plan mode denies side-effect operations' }
  }

  if (mode === 'acceptEdits') {
    if (request.toolKind === 'read' || request.toolKind === 'write' || request.toolKind === 'review') {
      return { type: 'allow', reason: 'acceptEdits allows read, write, and review operations' }
    }
    return { type: 'ask', reason: 'acceptEdits requires approval for shell or network operations' }
  }

  if (request.toolKind === 'read' || request.toolKind === 'review') {
    return { type: 'allow', reason: 'default mode allows read-only and review operations' }
  }

  if (commandRisk?.allowed) {
    return { type: 'allow', reason: commandRisk.reason }
  }

  return { type: 'ask', reason: commandRisk?.reason || 'default mode requires approval for side-effect operations' }
}
```

- [ ] **Step 2: Export permission module**

Modify `src/ai-runtime/engineering/index.ts` and add:

```ts
export * from './permission-policy'
```

- [ ] **Step 3: Validate build**

Run: `npm run build`

Expected: build passes, existing Vite chunk warnings are acceptable.

---

### Task 2: Tool Scheduler and Audit Recorder

**Files:**
- Create: `src/ai-runtime/engineering/tool-scheduler.ts`
- Create: `src/ai-runtime/engineering/audit-recorder.ts`
- Modify: `src/ai-runtime/engineering/index.ts`

- [ ] **Step 1: Create tool scheduler**

Create `src/ai-runtime/engineering/tool-scheduler.ts`:

```ts
import type { EngineeringToolKind } from './permission-policy'

export interface EngineeringToolCall<TInput = unknown, TResult = unknown> {
  id: string
  name: string
  kind: EngineeringToolKind
  input: TInput
  isConcurrencySafe: boolean
  run: () => Promise<TResult>
}

export interface EngineeringToolCallResult<TResult = unknown> {
  id: string
  name: string
  success: boolean
  result?: TResult
  error?: string
}

export async function executeEngineeringToolCalls(
  calls: EngineeringToolCall[]
): Promise<EngineeringToolCallResult[]> {
  const resultSlots = new Array<EngineeringToolCallResult | undefined>(calls.length)
  const concurrentIndices: number[] = []
  const sequentialIndices: number[] = []

  calls.forEach((call, index) => {
    if (call.isConcurrencySafe) concurrentIndices.push(index)
    else sequentialIndices.push(index)
  })

  await Promise.all(concurrentIndices.map(async (index) => {
    resultSlots[index] = await executeOne(calls[index])
  }))

  for (const index of sequentialIndices) {
    resultSlots[index] = await executeOne(calls[index])
  }

  return resultSlots as EngineeringToolCallResult[]
}

async function executeOne(call: EngineeringToolCall): Promise<EngineeringToolCallResult> {
  try {
    return {
      id: call.id,
      name: call.name,
      success: true,
      result: await call.run(),
    }
  } catch (error) {
    return {
      id: call.id,
      name: call.name,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
```

- [ ] **Step 2: Create audit recorder**

Create `src/ai-runtime/engineering/audit-recorder.ts`:

```ts
import type { EngineeringPermissionDecision, EngineeringPermissionMode } from './permission-policy'

export interface EngineeringPermissionAuditRecord {
  type: 'permission'
  taskId: string
  toolCallId: string
  toolName: string
  mode: EngineeringPermissionMode
  decision: EngineeringPermissionDecision['type']
  reason: string
  createdAt: string
}

export interface EngineeringToolAuditRecord {
  type: 'tool'
  taskId: string
  toolCallId: string
  toolName: string
  status: 'success' | 'error' | 'skipped'
  startedAt: string
  completedAt: string
  durationMs: number
  error?: string
}

export interface EngineeringAuditSummary {
  permissionRecords: number
  toolRecords: number
  deniedPermissions: number
  approvalsRequired: number
  toolErrors: number
}

export interface EngineeringAuditRecorder {
  recordPermission(record: EngineeringPermissionAuditRecord): void
  recordTool(record: EngineeringToolAuditRecord): void
  getSummary(): EngineeringAuditSummary
}

export class InMemoryEngineeringAuditRecorder implements EngineeringAuditRecorder {
  readonly permissionRecords: EngineeringPermissionAuditRecord[] = []
  readonly toolRecords: EngineeringToolAuditRecord[] = []

  recordPermission(record: EngineeringPermissionAuditRecord): void {
    this.permissionRecords.push(record)
  }

  recordTool(record: EngineeringToolAuditRecord): void {
    this.toolRecords.push(record)
  }

  getSummary(): EngineeringAuditSummary {
    return {
      permissionRecords: this.permissionRecords.length,
      toolRecords: this.toolRecords.length,
      deniedPermissions: this.permissionRecords.filter((record) => record.decision === 'deny').length,
      approvalsRequired: this.permissionRecords.filter((record) => record.decision === 'ask').length,
      toolErrors: this.toolRecords.filter((record) => record.status === 'error').length,
    }
  }
}
```

- [ ] **Step 3: Export modules**

Modify `src/ai-runtime/engineering/index.ts` and add:

```ts
export * from './tool-scheduler'
export * from './audit-recorder'
```

- [ ] **Step 4: Validate build**

Run: `npm run build`

Expected: build passes, existing Vite chunk warnings are acceptable.

---

### Task 3: Pipeline Integration

**Files:**
- Modify: `src/ai-runtime/engineering/types.ts`
- Modify: `src/ai-runtime/engineering/execution-pipeline.ts`
- Modify: `src/ai-runtime/engineering/summary-builder.ts`

- [ ] **Step 1: Extend run types**

Modify `src/ai-runtime/engineering/types.ts`:

```ts
import type { EngineeringAuditSummary } from './audit-recorder'
import type { EngineeringPermissionMode } from './permission-policy'
```

Add `permissionMode?: EngineeringPermissionMode` to `EngineeringRunInput`.

Add `audit?: EngineeringAuditSummary` to `EngineeringRunSummary`.

- [ ] **Step 2: Gate verification commands**

Modify `src/ai-runtime/engineering/execution-pipeline.ts` to:

- import `InMemoryEngineeringAuditRecorder` and `type EngineeringAuditRecorder`
- import `decideEngineeringPermission`
- add optional dep `auditRecorder?: EngineeringAuditRecorder`
- use `input.permissionMode || 'default'`
- before running verification, record permission decisions for each command
- execute only commands with decision `allow`
- convert `ask` and `deny` commands into failed `VerificationResult`

- [ ] **Step 3: Add audit to summary**

Modify final `finalize` calls so `audit: auditRecorder.getSummary()` is included.

Modify `src/ai-runtime/engineering/summary-builder.ts` to add:

```ts
if (summary.audit) {
  lines.push(`- 审计：权限记录 ${summary.audit.permissionRecords} 条，工具记录 ${summary.audit.toolRecords} 条`)
  if (summary.audit.deniedPermissions > 0) lines.push(`- 拒绝权限：${summary.audit.deniedPermissions} 条`)
  if (summary.audit.approvalsRequired > 0) lines.push(`- 需要确认：${summary.audit.approvalsRequired} 条`)
  if (summary.audit.toolErrors > 0) lines.push(`- 工具错误：${summary.audit.toolErrors} 条`)
}
```

- [ ] **Step 4: Validate build**

Run: `npm run build`

Expected: build passes, existing Vite chunk warnings are acceptable.

---

### Task 4: Final Validation and Commit

**Files:**
- Validate all changed files under `src/ai-runtime/engineering/`
- Validate `docs/superpowers/plans/2026-05-28-pilotdeck-engineering-controls.md`

- [ ] **Step 1: Run final build**

Run: `npm run build`

Expected: build passes, existing Vite chunk warnings are acceptable.

- [ ] **Step 2: Inspect diff**

Run: `git diff -- src/ai-runtime/engineering docs/superpowers/plans/2026-05-28-pilotdeck-engineering-controls.md`

Expected: changes are limited to engineering controls and this implementation plan.

- [ ] **Step 3: Commit**

Run:

```bash
git add src/ai-runtime/engineering docs/superpowers/plans/2026-05-28-pilotdeck-engineering-controls.md
git commit -m "feat: add PilotDeck-inspired engineering controls"
```

Expected: commit succeeds.

---

## Self-Review

- Spec coverage: Permission policy, scheduler, audit recorder, pipeline verification gating, summary audit output are covered.
- Placeholder scan: No placeholders are present.
- Type consistency: Permission and audit types are introduced before pipeline integration uses them.
