import { type EngineeringAgentRouteCapability, type EngineeringAgentRouteDecision } from './agent-router'
import { type EngineeringAuditRecorder, InMemoryEngineeringAuditRecorder } from './audit-recorder'
import { createEngineeringContextRuntime, type EngineeringContextRuntime } from './context-runtime'
import type { EngineeringContextBuilderDeps } from './context-builder'
import { emitEngineeringEvent } from './events'
import { classifyEngineeringTask } from './task-classifier'
import { decideEngineeringPermission } from './permission-policy'
import { buildEngineeringReviewPromptForSubtype, shouldRunReview } from './review-policy'
import { resolveEngineeringRunMode } from './run-mode-policy'
import { createSnapshotLabel, shouldCreateSnapshot } from './snapshot-policy'
import { buildEngineeringFinalMessage } from './summary-builder'
import { extractChangedFilesFromDiff, selectVerificationCommandsForSubtype } from './verification-policy'
import type {
  EngineeringAgentRequest,
  EngineeringAgentResult,
  EngineeringRunInput,
  EngineeringRunSummary,
  ReviewResult,
  SnapshotResult,
  VerificationCommand,
  VerificationResult,
  EngineeringRunEventHandler,
  EngineeringStage,
} from './types'

export interface EngineeringExecutionPipelineDeps {
  createSnapshot: (label: string, input: EngineeringRunInput) => Promise<{ versionId: string }>
  executeAgentTask: (request: EngineeringAgentRequest) => Promise<EngineeringAgentResult>
  getGitDiff: (workspaceDir: string) => Promise<string>
  runVerification: (commands: VerificationCommand[], workspaceDir: string) => Promise<VerificationResult[]>
  runReview: (prompt: string, diff: string, workspaceDir: string) => Promise<ReviewResult>
  contextBuilder?: EngineeringContextBuilderDeps
  contextRuntime?: EngineeringContextRuntime
  auditRecorder?: EngineeringAuditRecorder
  onEvent?: EngineeringRunEventHandler
  createTaskId?: () => string
}

export interface EngineeringExecutionPipelineRunOptions {
  routeDecision?: EngineeringAgentRouteDecision
  onEvent?: EngineeringRunEventHandler
}

export class EngineeringExecutionPipeline {
  constructor(private readonly deps: EngineeringExecutionPipelineDeps) {}

  async run(input: EngineeringRunInput, options: EngineeringExecutionPipelineRunOptions = {}): Promise<EngineeringRunSummary> {
    const taskId = input.taskId || this.deps.createTaskId?.() || createDefaultTaskId()
    const auditRecorder = this.deps.auditRecorder || new InMemoryEngineeringAuditRecorder()
    const permissionMode = options.routeDecision?.permissionMode || input.permissionMode || 'default'
    emitPipelineEvent(this.deps.onEvent, options.onEvent, { type: 'stage_started', taskId, stage: 'classify' })
    const classification = options.routeDecision?.classification || classifyEngineeringTask(input.userRequest)
    emitPipelineEvent(this.deps.onEvent, options.onEvent, { type: 'stage_completed', taskId, stage: 'classify' })

    emitPipelineEvent(this.deps.onEvent, options.onEvent, { type: 'stage_started', taskId, stage: 'context' })
    const contextRuntime = this.deps.contextRuntime || createEngineeringContextRuntime(this.deps.contextBuilder)
    const contextPrepareResult = await contextRuntime.prepare(input)
    const context = contextPrepareResult.context
    emitPipelineEvent(this.deps.onEvent, options.onEvent, { type: 'context_built', taskId, candidateFileCount: context.candidateFiles.length })
    emitPipelineEvent(this.deps.onEvent, options.onEvent, { type: 'stage_completed', taskId, stage: 'context' })

    const runModeDecision = options.routeDecision?.runModeDecision || resolveEngineeringRunMode({ requestedMode: input.runMode, classification })
    emitRouteSkippedStages(this.deps.onEvent, taskId, options.routeDecision)
    const shouldExecuteAgent = requiresCapability(options.routeDecision, 'agent_execution')

    if (!runModeDecision.allowExecution && shouldExecuteAgent) {
      return finalize({
        taskId,
        classification,
        context,
        runModeDecision,
        snapshot: { created: false },
        agentResult: { success: true, content: 'Plan mode completed without executing agent task.' },
        verificationResults: [],
        review: { success: false, skipped: true },
        audit: auditRecorder.getSummary(),
        success: true,
      })
    }

    let snapshot: SnapshotResult = { created: false }

    if (requiresCapability(options.routeDecision, 'snapshot') && shouldCreateSnapshot(classification)) {
      emitPipelineEvent(this.deps.onEvent, options.onEvent, { type: 'stage_started', taskId, stage: 'snapshot' })
      const label = createSnapshotLabel(classification.kind)
      try {
        const version = await this.deps.createSnapshot(label, input)
        snapshot = { created: true, label, versionId: version.versionId }
        emitPipelineEvent(this.deps.onEvent, options.onEvent, { type: 'snapshot_created', taskId, versionId: version.versionId, label })
        emitPipelineEvent(this.deps.onEvent, options.onEvent, { type: 'stage_completed', taskId, stage: 'snapshot' })
      } catch (error) {
        const message = stringifyError(error)
        snapshot = { created: false, label, error: message }
        emitPipelineEvent(this.deps.onEvent, options.onEvent, { type: 'stage_failed', taskId, stage: 'snapshot', error: message })
      }
    }

    const agentRequest: EngineeringAgentRequest = {
      taskId,
      userRequest: input.userRequest,
      workspaceDir: input.workspaceDir,
      selectedFiles: input.selectedFiles || [],
      classification,
      context,
    }

    let agentResult: EngineeringAgentResult = { success: true, content: 'Agent execution skipped by route decision.' }
    if (shouldExecuteAgent) {
      emitPipelineEvent(this.deps.onEvent, options.onEvent, { type: 'stage_started', taskId, stage: 'execute' })
      try {
        agentResult = await this.deps.executeAgentTask(agentRequest)
      } catch (error) {
        agentResult = { success: false, error: stringifyError(error) }
      }

      if (!agentResult.success) {
        emitPipelineEvent(this.deps.onEvent, options.onEvent, { type: 'stage_failed', taskId, stage: 'execute', error: agentResult.error || 'Agent execution failed' })
        return finalize({
          taskId,
          classification,
          context,
          runModeDecision,
          snapshot,
          agentResult,
          verificationResults: [],
          review: { success: false, skipped: true, error: 'Agent execution failed' },
          audit: auditRecorder.getSummary(),
          success: false,
          failedStage: 'execute',
        })
      }
      emitPipelineEvent(this.deps.onEvent, options.onEvent, { type: 'stage_completed', taskId, stage: 'execute' })
    }

    let diff = ''
    let diffError: string | undefined
    if (requiresCapability(options.routeDecision, 'git_diff')) {
      emitPipelineEvent(this.deps.onEvent, options.onEvent, { type: 'stage_started', taskId, stage: 'diff' })
      try {
        diff = await this.deps.getGitDiff(input.workspaceDir)
        emitPipelineEvent(this.deps.onEvent, options.onEvent, { type: 'stage_completed', taskId, stage: 'diff' })
      } catch (error) {
        diffError = stringifyError(error)
        emitPipelineEvent(this.deps.onEvent, options.onEvent, { type: 'stage_failed', taskId, stage: 'diff', error: diffError })
      }
    }

    const changedFiles = diff ? extractChangedFilesFromDiff(diff) : []
    const shouldRunVerification = requiresCapability(options.routeDecision, 'verification')
    const selectedCommands = shouldRunVerification && (classification.requiresVerification || Boolean(options.routeDecision))
      ? selectVerificationCommandsForSubtype(options.routeDecision?.subtype, changedFiles, context.projectSignals.scripts)
      : []
    if (shouldRunVerification) {
      emitPipelineEvent(this.deps.onEvent, options.onEvent, {
        type: 'verification_strategy_selected',
        taskId,
        subtype: options.routeDecision?.subtype,
        commandIds: selectedCommands.map((command) => command.id),
        commandLabels: selectedCommands.map((command) => command.label),
        reason: options.routeDecision?.subtype ? `Selected by subtype=${options.routeDecision.subtype}` : 'Selected by default verification policy',
      })
    }
    const commands: VerificationCommand[] = []
    let verificationResults: VerificationResult[] = []

    for (const command of selectedCommands) {
      const decision = decideEngineeringPermission({ mode: permissionMode, toolKind: 'shell', command: command.command })
      auditRecorder.recordPermission({
        type: 'permission',
        taskId,
        toolCallId: command.id,
        toolName: command.label,
        mode: permissionMode,
        decision: decision.type,
        reason: decision.reason,
        createdAt: new Date().toISOString(),
      })

      if (decision.type === 'allow') {
        commands.push(command)
      } else {
        verificationResults.push({
          command,
          success: false,
          output: '',
          error: decision.type === 'ask' ? `Approval required: ${decision.reason}` : `Permission denied: ${decision.reason}`,
        })
        auditRecorder.recordTool(createToolAuditRecord(taskId, command.id, command.label, 'skipped', new Date(), undefined, decision.reason))
      }
    }

    try {
      if (commands.length > 0) {
        emitPipelineEvent(this.deps.onEvent, options.onEvent, { type: 'stage_started', taskId, stage: 'verify' })
        for (const command of commands) {
          emitPipelineEvent(this.deps.onEvent, options.onEvent, { type: 'verification_started', taskId, command })
        }
        const startedAt = new Date()
        const executedResults = await this.deps.runVerification(commands, input.workspaceDir)
        verificationResults = [...verificationResults, ...executedResults]
        for (const result of executedResults) {
          auditRecorder.recordTool(createToolAuditRecord(taskId, result.command.id, result.command.label, result.success ? 'success' : 'error', startedAt, undefined, result.error))
          emitPipelineEvent(this.deps.onEvent, options.onEvent, { type: 'verification_completed', taskId, command: result.command, success: result.success })
        }
        emitPipelineEvent(this.deps.onEvent, options.onEvent, { type: 'stage_completed', taskId, stage: 'verify' })
      }
    } catch (error) {
      const message = stringifyError(error)
      emitPipelineEvent(this.deps.onEvent, options.onEvent, { type: 'stage_failed', taskId, stage: 'verify', error: message })
      const startedAt = new Date()
      verificationResults = [...verificationResults, ...commands.map((command) => {
        auditRecorder.recordTool(createToolAuditRecord(taskId, command.id, command.label, 'error', startedAt, undefined, message))
        return {
          command,
          success: false,
          output: '',
          error: message,
        }
      })]
    }

    const verificationFailed = verificationResults.some((result) => !result.success)
    let review: ReviewResult = { success: false, skipped: true }
    const shouldRunReviewStage = requiresCapability(options.routeDecision, 'review') && (classification.requiresReview || Boolean(options.routeDecision))

    if (requiresCapability(options.routeDecision, 'review')) {
      emitPipelineEvent(this.deps.onEvent, options.onEvent, {
        type: 'review_strategy_selected',
        taskId,
        subtype: options.routeDecision?.subtype,
        focus: reviewFocusFromSubtype(options.routeDecision?.subtype),
        reason: options.routeDecision?.subtype ? `Selected by subtype=${options.routeDecision.subtype}` : 'Selected by default review policy',
      })
    }

    if (!diffError && shouldRunReviewStage && shouldRunReview(diff)) {
      emitPipelineEvent(this.deps.onEvent, options.onEvent, { type: 'stage_started', taskId, stage: 'review' })
      try {
        review = await this.deps.runReview(buildEngineeringReviewPromptForSubtype(options.routeDecision?.subtype, diff), diff, input.workspaceDir)
        emitPipelineEvent(this.deps.onEvent, options.onEvent, { type: 'review_completed', taskId, success: review.success, skipped: review.skipped })
        emitPipelineEvent(this.deps.onEvent, options.onEvent, { type: 'stage_completed', taskId, stage: 'review' })
      } catch (error) {
        const message = stringifyError(error)
        review = { success: false, error: message }
        emitPipelineEvent(this.deps.onEvent, options.onEvent, { type: 'stage_failed', taskId, stage: 'review', error: message })
      }
    } else if (requiresCapability(options.routeDecision, 'review')) {
      const skippedReason = diffError ? 'diff_error' : 'empty_diff'
      emitPipelineEvent(this.deps.onEvent, options.onEvent, { type: 'review_completed', taskId, success: false, skipped: true, skippedReason })
    }

    return finalize({
      taskId,
      classification,
      context,
      runModeDecision,
      snapshot,
      agentResult,
      diff,
      diffError,
      verificationResults,
      review,
      audit: auditRecorder.getSummary(),
      success: !diffError && !verificationFailed && (review.skipped || review.success),
      failedStage: diffError ? 'diff' : verificationFailed ? 'verify' : review.success === false && !review.skipped ? 'review' : undefined,
    })
  }
}

function emitPipelineEvent(
  primary: EngineeringRunEventHandler | undefined,
  secondary: EngineeringRunEventHandler | undefined,
  event: Parameters<EngineeringRunEventHandler>[0],
): void {
  emitEngineeringEvent(primary, event)
  if (secondary && secondary !== primary) emitEngineeringEvent(secondary, event)
}

function reviewFocusFromSubtype(subtype: EngineeringAgentRouteDecision['subtype']): string {
  if (subtype === 'review.security') return 'security'
  if (subtype === 'review.architecture') return 'architecture'
  if (subtype === 'review.performance') return 'performance'
  return 'diff'
}

function emitRouteSkippedStages(
  onEvent: EngineeringRunEventHandler | undefined,
  taskId: string,
  routeDecision: EngineeringAgentRouteDecision | undefined,
): void {
  if (!routeDecision) return
  for (const stage of routeDecision.skippedStages) {
    if (isEngineeringStage(stage)) {
      emitEngineeringEvent(onEvent, {
        type: 'stage_skipped',
        taskId,
        stage,
        reason: `Skipped by route=${routeDecision.route}: ${routeDecision.reason}`,
      })
    }
  }
}

function isEngineeringStage(stage: string): stage is EngineeringStage {
  return ['classify', 'context', 'snapshot', 'execute', 'diff', 'verify', 'review', 'summarize'].includes(stage)
}

function requiresCapability(routeDecision: EngineeringAgentRouteDecision | undefined, capability: EngineeringAgentRouteCapability): boolean {
  if (!routeDecision) return true
  return routeDecision.requiredCapabilities.includes(capability)
}

function finalize(summary: Omit<EngineeringRunSummary, 'finalMessage'>): EngineeringRunSummary {
  return {
    ...summary,
    finalMessage: buildEngineeringFinalMessage(summary),
  }
}

function createToolAuditRecord(
  taskId: string,
  toolCallId: string,
  toolName: string,
  status: 'success' | 'error' | 'skipped',
  startedAt: Date,
  completedAt = new Date(),
  error?: string
) {
  return {
    type: 'tool' as const,
    taskId,
    toolCallId,
    toolName,
    status,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - startedAt.getTime(),
    error,
  }
}

function createDefaultTaskId(): string {
  return `engineering-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function stringifyError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
