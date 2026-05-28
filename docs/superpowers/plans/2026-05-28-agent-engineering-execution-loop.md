# Agent Engineering Execution Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimal engineering execution loop for QnaiStudio's self-hosted Agent runtime.

**Architecture:** Add a focused `src/ai-runtime/engineering` package that classifies engineering tasks, creates optional snapshots, delegates execution through injected dependencies, collects Git diff, selects safe verification commands, runs review, and builds a structured summary. The package is dependency-injected so it can be compiled and tested without binding to React, Tauri, or a concrete Agent engine.

**Tech Stack:** TypeScript, existing QnaiStudio AI runtime, Tauri invoke integration through existing service adapters, npm build validation.

---

## File Structure

- Create `src/ai-runtime/engineering/types.ts`: shared types for classification, snapshot, verification, review, pipeline input/output.
- Create `src/ai-runtime/engineering/task-classifier.ts`: pure rule-based task classifier.
- Create `src/ai-runtime/engineering/snapshot-policy.ts`: snapshot label generation and snapshot decision helpers.
- Create `src/ai-runtime/engineering/verification-policy.ts`: diff parsing, changed-file extraction, safe verification command selection, output truncation.
- Create `src/ai-runtime/engineering/review-policy.ts`: review prompt builder and empty-diff review skip policy.
- Create `src/ai-runtime/engineering/summary-builder.ts`: final human-readable summary builder.
- Create `src/ai-runtime/engineering/execution-pipeline.ts`: dependency-injected orchestration.
- Create `src/ai-runtime/engineering/index.ts`: public exports.
- Modify `src/ai-runtime/index.ts`: export the engineering package.

---

### Task 1: Shared Types and Classifier

**Files:**
- Create: `src/ai-runtime/engineering/types.ts`
- Create: `src/ai-runtime/engineering/task-classifier.ts`
- Create: `src/ai-runtime/engineering/index.ts`
- Modify: `src/ai-runtime/index.ts`

- [ ] **Step 1: Create shared types**

Create `src/ai-runtime/engineering/types.ts` with these exported types:

```ts
export type EngineeringTaskKind = 'feature' | 'bugfix' | 'refactor' | 'review' | 'explain' | 'unknown'

export type EngineeringStage =
  | 'classify'
  | 'snapshot'
  | 'execute'
  | 'diff'
  | 'verify'
  | 'review'
  | 'summarize'

export interface EngineeringTaskClassification {
  kind: EngineeringTaskKind
  mayModifyFiles: boolean
  requiresVerification: boolean
  requiresReview: boolean
  confidence: number
  reason: string
}

export interface EngineeringRunInput {
  taskId?: string
  userRequest: string
  workspaceDir: string
  selectedFiles?: string[]
}

export interface EngineeringAgentRequest {
  taskId: string
  userRequest: string
  workspaceDir: string
  selectedFiles: string[]
  classification: EngineeringTaskClassification
}

export interface EngineeringAgentResult {
  success: boolean
  content?: string
  error?: string
}

export interface SnapshotResult {
  created: boolean
  label?: string
  versionId?: string
  error?: string
}

export type VerificationRisk = 'safe' | 'medium'

export interface VerificationCommand {
  id: string
  label: string
  command: string
  cwd?: string
  risk: VerificationRisk
}

export interface VerificationResult {
  command: VerificationCommand
  success: boolean
  output: string
  error?: string
}

export interface ReviewResult {
  success: boolean
  skipped?: boolean
  content?: string
  error?: string
}

export interface EngineeringRunSummary {
  taskId: string
  classification: EngineeringTaskClassification
  snapshot: SnapshotResult
  agentResult?: EngineeringAgentResult
  diff?: string
  diffError?: string
  verificationResults: VerificationResult[]
  review: ReviewResult
  success: boolean
  failedStage?: EngineeringStage
  finalMessage: string
}
```

- [ ] **Step 2: Implement classifier**

Create `src/ai-runtime/engineering/task-classifier.ts`:

```ts
import type { EngineeringTaskClassification, EngineeringTaskKind } from './types'

const RULES: Array<{ kind: EngineeringTaskKind; keywords: string[]; confidence: number }> = [
  { kind: 'bugfix', keywords: ['修复', '报错', '失败', 'bug', 'error', '构建错误', '异常', '不工作'], confidence: 0.85 },
  { kind: 'feature', keywords: ['实现', '增加', '添加', '新功能', '新增', '支持', '接入'], confidence: 0.82 },
  { kind: 'refactor', keywords: ['重构', '优化结构', '整理', '抽象', '拆分'], confidence: 0.78 },
  { kind: 'review', keywords: ['review', '审查', '检查', '评审'], confidence: 0.8 },
  { kind: 'explain', keywords: ['解释', '说明', '为什么', '讲解', '分析一下'], confidence: 0.75 },
]

const MODIFYING_KINDS = new Set<EngineeringTaskKind>(['feature', 'bugfix', 'refactor'])

export function classifyEngineeringTask(userRequest: string): EngineeringTaskClassification {
  const normalized = userRequest.trim().toLowerCase()

  for (const rule of RULES) {
    const matched = rule.keywords.find((keyword) => normalized.includes(keyword.toLowerCase()))
    if (matched) {
      const mayModifyFiles = MODIFYING_KINDS.has(rule.kind)
      return {
        kind: rule.kind,
        mayModifyFiles,
        requiresVerification: mayModifyFiles,
        requiresReview: mayModifyFiles,
        confidence: rule.confidence,
        reason: `Matched keyword: ${matched}`,
      }
    }
  }

  return {
    kind: 'unknown',
    mayModifyFiles: false,
    requiresVerification: false,
    requiresReview: false,
    confidence: 0.3,
    reason: 'No engineering task keyword matched',
  }
}
```

- [ ] **Step 3: Export package**

Create `src/ai-runtime/engineering/index.ts`:

```ts
export * from './types'
export * from './task-classifier'
```

Append to `src/ai-runtime/index.ts`:

```ts
export * from './engineering'
```

- [ ] **Step 4: Validate TypeScript**

Run: `npm run build`

Expected: TypeScript compilation passes or only existing Vite chunk warnings remain.

---

### Task 2: Snapshot and Verification Policies

**Files:**
- Create: `src/ai-runtime/engineering/snapshot-policy.ts`
- Create: `src/ai-runtime/engineering/verification-policy.ts`
- Modify: `src/ai-runtime/engineering/index.ts`

- [ ] **Step 1: Implement snapshot policy**

Create `src/ai-runtime/engineering/snapshot-policy.ts`:

```ts
import type { EngineeringTaskClassification } from './types'

export function shouldCreateSnapshot(classification: EngineeringTaskClassification): boolean {
  return classification.mayModifyFiles
}

export function createSnapshotLabel(kind: EngineeringTaskClassification['kind'], now = new Date()): string {
  const timestamp = now.toISOString().replace(/[:.]/g, '-')
  return `agent-before-${kind}-${timestamp}`
}
```

- [ ] **Step 2: Implement verification policy**

Create `src/ai-runtime/engineering/verification-policy.ts`:

```ts
import type { VerificationCommand } from './types'

export const FRONTEND_BUILD_COMMAND: VerificationCommand = {
  id: 'npm-build',
  label: 'Frontend build',
  command: 'npm run build',
  risk: 'safe',
}

export const TAURI_CHECK_COMMAND: VerificationCommand = {
  id: 'cargo-check',
  label: 'Tauri cargo check',
  command: 'cargo check',
  cwd: 'src-tauri',
  risk: 'safe',
}

const DIFF_FILE_PATTERNS = [/^diff --git a\/(.*?) b\/(.*?)$/gm]

export function extractChangedFilesFromDiff(diff: string): string[] {
  const files = new Set<string>()

  for (const pattern of DIFF_FILE_PATTERNS) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(diff)) !== null) {
      const filePath = match[2] || match[1]
      if (filePath) files.add(filePath)
    }
  }

  return Array.from(files).sort()
}

export function selectVerificationCommands(changedFiles: string[]): VerificationCommand[] {
  const commands: VerificationCommand[] = []
  const touchesFrontend = changedFiles.some((file) =>
    file.startsWith('src/') ||
    file === 'package.json' ||
    file === 'package-lock.json' ||
    file === 'vite.config.ts' ||
    file === 'tsconfig.json' ||
    file === 'tsconfig.node.json'
  )
  const touchesTauri = changedFiles.some((file) =>
    file.startsWith('src-tauri/') && (file.endsWith('.rs') || file.endsWith('Cargo.toml') || file.endsWith('Cargo.lock'))
  )

  if (touchesFrontend) commands.push(FRONTEND_BUILD_COMMAND)
  if (touchesTauri) commands.push(TAURI_CHECK_COMMAND)

  return commands
}

export function truncateVerificationOutput(output: string, maxLength = 12000): string {
  if (output.length <= maxLength) return output
  return `${output.slice(0, maxLength)}\n\n[output truncated: ${output.length - maxLength} characters omitted]`
}
```

- [ ] **Step 3: Export policies**

Modify `src/ai-runtime/engineering/index.ts`:

```ts
export * from './types'
export * from './task-classifier'
export * from './snapshot-policy'
export * from './verification-policy'
```

- [ ] **Step 4: Validate TypeScript**

Run: `npm run build`

Expected: TypeScript compilation passes or only existing Vite chunk warnings remain.

---

### Task 3: Review and Summary Policies

**Files:**
- Create: `src/ai-runtime/engineering/review-policy.ts`
- Create: `src/ai-runtime/engineering/summary-builder.ts`
- Modify: `src/ai-runtime/engineering/index.ts`

- [ ] **Step 1: Implement review prompt policy**

Create `src/ai-runtime/engineering/review-policy.ts`:

```ts
export function shouldRunReview(diff: string): boolean {
  return diff.trim().length > 0
}

export function buildEngineeringReviewPrompt(diff: string): string {
  return [
    'Review this engineering task diff for correctness and safety.',
    '',
    'Focus on:',
    '- Obvious bugs or broken workflow behavior.',
    '- Workspace boundary violations or unsafe file operations.',
    '- Secret, token, API key, or credential exposure.',
    '- Unnecessary large-scope changes unrelated to the task.',
    '- Missing verification signals.',
    '',
    'Return concise findings. If there are no findings, say so explicitly.',
    '',
    'Diff:',
    '```diff',
    diff,
    '```',
  ].join('\n')
}
```

- [ ] **Step 2: Implement summary builder**

Create `src/ai-runtime/engineering/summary-builder.ts`:

```ts
import type { EngineeringRunSummary } from './types'
import { extractChangedFilesFromDiff } from './verification-policy'

export function buildEngineeringFinalMessage(summary: Omit<EngineeringRunSummary, 'finalMessage'>): string {
  const lines: string[] = []
  const changedFiles = summary.diff ? extractChangedFilesFromDiff(summary.diff) : []

  lines.push('## 工程执行总结')
  lines.push('')
  lines.push(`- 任务类型：${summary.classification.kind}`)
  lines.push(`- 分类依据：${summary.classification.reason}`)
  lines.push(`- 快照：${formatSnapshot(summary.snapshot)}`)

  if (changedFiles.length > 0) {
    lines.push(`- 修改文件：${changedFiles.length} 个`)
    for (const file of changedFiles.slice(0, 20)) {
      lines.push(`  - ${file}`)
    }
    if (changedFiles.length > 20) {
      lines.push(`  - 其余 ${changedFiles.length - 20} 个文件已省略`)
    }
  } else {
    lines.push('- 修改文件：未检测到 Git diff')
  }

  if (summary.verificationResults.length > 0) {
    lines.push('- 验证：')
    for (const result of summary.verificationResults) {
      lines.push(`  - ${result.command.label}：${result.success ? '通过' : '失败'}`)
    }
  } else {
    lines.push('- 验证：未运行')
  }

  if (summary.review.skipped) {
    lines.push('- Review：已跳过')
  } else {
    lines.push(`- Review：${summary.review.success ? '完成' : '失败'}`)
  }

  lines.push(`- 结果：${summary.success ? '成功' : '失败'}`)
  if (summary.failedStage) lines.push(`- 失败阶段：${summary.failedStage}`)
  if (summary.agentResult?.error) lines.push(`- Agent 错误：${summary.agentResult.error}`)
  if (summary.diffError) lines.push(`- Diff 错误：${summary.diffError}`)
  if (summary.review.error) lines.push(`- Review 错误：${summary.review.error}`)

  return lines.join('\n')
}

function formatSnapshot(snapshot: EngineeringRunSummary['snapshot']): string {
  if (snapshot.created) return snapshot.versionId ? `已创建 ${snapshot.versionId}` : '已创建'
  return snapshot.error ? `未创建（${snapshot.error}）` : '未创建'
}
```

- [ ] **Step 3: Export policies**

Modify `src/ai-runtime/engineering/index.ts`:

```ts
export * from './types'
export * from './task-classifier'
export * from './snapshot-policy'
export * from './verification-policy'
export * from './review-policy'
export * from './summary-builder'
```

- [ ] **Step 4: Validate TypeScript**

Run: `npm run build`

Expected: TypeScript compilation passes or only existing Vite chunk warnings remain.

---

### Task 4: Execution Pipeline

**Files:**
- Create: `src/ai-runtime/engineering/execution-pipeline.ts`
- Modify: `src/ai-runtime/engineering/index.ts`

- [ ] **Step 1: Implement dependency-injected pipeline**

Create `src/ai-runtime/engineering/execution-pipeline.ts`:

```ts
import { classifyEngineeringTask } from './task-classifier'
import { buildEngineeringReviewPrompt, shouldRunReview } from './review-policy'
import { createSnapshotLabel, shouldCreateSnapshot } from './snapshot-policy'
import { buildEngineeringFinalMessage } from './summary-builder'
import { extractChangedFilesFromDiff, selectVerificationCommands } from './verification-policy'
import type {
  EngineeringAgentRequest,
  EngineeringAgentResult,
  EngineeringRunInput,
  EngineeringRunSummary,
  ReviewResult,
  SnapshotResult,
  VerificationCommand,
  VerificationResult,
} from './types'

export interface EngineeringExecutionPipelineDeps {
  createSnapshot: (label: string, input: EngineeringRunInput) => Promise<{ versionId: string }>
  executeAgentTask: (request: EngineeringAgentRequest) => Promise<EngineeringAgentResult>
  getGitDiff: (workspaceDir: string) => Promise<string>
  runVerification: (commands: VerificationCommand[], workspaceDir: string) => Promise<VerificationResult[]>
  runReview: (prompt: string, diff: string, workspaceDir: string) => Promise<ReviewResult>
  createTaskId?: () => string
}

export class EngineeringExecutionPipeline {
  constructor(private readonly deps: EngineeringExecutionPipelineDeps) {}

  async run(input: EngineeringRunInput): Promise<EngineeringRunSummary> {
    const taskId = input.taskId || this.deps.createTaskId?.() || createDefaultTaskId()
    const classification = classifyEngineeringTask(input.userRequest)
    let snapshot: SnapshotResult = { created: false }

    if (shouldCreateSnapshot(classification)) {
      const label = createSnapshotLabel(classification.kind)
      try {
        const version = await this.deps.createSnapshot(label, input)
        snapshot = { created: true, label, versionId: version.versionId }
      } catch (error) {
        snapshot = { created: false, label, error: stringifyError(error) }
      }
    }

    const agentRequest: EngineeringAgentRequest = {
      taskId,
      userRequest: input.userRequest,
      workspaceDir: input.workspaceDir,
      selectedFiles: input.selectedFiles || [],
      classification,
    }

    let agentResult: EngineeringAgentResult
    try {
      agentResult = await this.deps.executeAgentTask(agentRequest)
    } catch (error) {
      agentResult = { success: false, error: stringifyError(error) }
    }

    if (!agentResult.success) {
      return finalize({
        taskId,
        classification,
        snapshot,
        agentResult,
        verificationResults: [],
        review: { success: false, skipped: true, error: 'Agent execution failed' },
        success: false,
        failedStage: 'execute',
      })
    }

    let diff = ''
    let diffError: string | undefined
    try {
      diff = await this.deps.getGitDiff(input.workspaceDir)
    } catch (error) {
      diffError = stringifyError(error)
    }

    const changedFiles = diff ? extractChangedFilesFromDiff(diff) : []
    const commands = classification.requiresVerification ? selectVerificationCommands(changedFiles) : []
    let verificationResults: VerificationResult[] = []

    try {
      verificationResults = commands.length > 0 ? await this.deps.runVerification(commands, input.workspaceDir) : []
    } catch (error) {
      verificationResults = commands.map((command) => ({
        command,
        success: false,
        output: '',
        error: stringifyError(error),
      }))
    }

    const verificationFailed = verificationResults.some((result) => !result.success)
    let review: ReviewResult = { success: false, skipped: true }

    if (!diffError && classification.requiresReview && shouldRunReview(diff)) {
      try {
        review = await this.deps.runReview(buildEngineeringReviewPrompt(diff), diff, input.workspaceDir)
      } catch (error) {
        review = { success: false, error: stringifyError(error) }
      }
    }

    return finalize({
      taskId,
      classification,
      snapshot,
      agentResult,
      diff,
      diffError,
      verificationResults,
      review,
      success: !diffError && !verificationFailed && (review.skipped || review.success),
      failedStage: diffError ? 'diff' : verificationFailed ? 'verify' : review.success === false && !review.skipped ? 'review' : undefined,
    })
  }
}

function finalize(summary: Omit<EngineeringRunSummary, 'finalMessage'>): EngineeringRunSummary {
  return {
    ...summary,
    finalMessage: buildEngineeringFinalMessage(summary),
  }
}

function createDefaultTaskId(): string {
  return `engineering-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function stringifyError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
```

- [ ] **Step 2: Export pipeline**

Modify `src/ai-runtime/engineering/index.ts`:

```ts
export * from './types'
export * from './task-classifier'
export * from './snapshot-policy'
export * from './verification-policy'
export * from './review-policy'
export * from './summary-builder'
export * from './execution-pipeline'
```

- [ ] **Step 3: Validate TypeScript**

Run: `npm run build`

Expected: TypeScript compilation passes or only existing Vite chunk warnings remain.

---

### Task 5: Final Validation and Commit

**Files:**
- Validate all files in `src/ai-runtime/engineering/`
- Validate `src/ai-runtime/index.ts`

- [ ] **Step 1: Run build**

Run: `npm run build`

Expected: TypeScript compilation passes. Existing Vite chunk warnings are acceptable.

- [ ] **Step 2: Inspect Git diff**

Run: `git diff -- src/ai-runtime docs/superpowers/plans/2026-05-28-agent-engineering-execution-loop.md`

Expected: Only the engineering loop package, root runtime export, and this plan are changed.

- [ ] **Step 3: Commit implementation**

Run:

```bash
git add src/ai-runtime/engineering src/ai-runtime/index.ts docs/superpowers/plans/2026-05-28-agent-engineering-execution-loop.md
git commit -m "feat: add agent engineering execution loop"
```

Expected: Commit succeeds.

---

## Self-Review

- Spec coverage: The plan covers task classification, snapshot policy, diff-based verification command selection, review prompt policy, summary builder, and dependency-injected pipeline.
- Placeholder scan: No placeholder tasks are present.
- Type consistency: `EngineeringRunInput`, `EngineeringAgentRequest`, `EngineeringAgentResult`, `VerificationCommand`, `VerificationResult`, `ReviewResult`, and `EngineeringRunSummary` are defined before use and reused consistently.
