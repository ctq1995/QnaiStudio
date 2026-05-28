import { buildEngineeringContext, type EngineeringContextBuilderDeps } from './context-builder'
import { emitEngineeringEvent } from './events'
import { classifyEngineeringTask } from './task-classifier'
import { buildEngineeringReviewPrompt, shouldRunReview } from './review-policy'
import { createSnapshotLabel, shouldCreateSnapshot } from './snapshot-policy'
import { buildEngineeringFinalMessage } from './summary-builder'
import { filterAllowedVerificationCommands } from './tool-risk-policy'
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
  EngineeringRunEventHandler,
} from './types'

export interface EngineeringExecutionPipelineDeps {
  createSnapshot: (label: string, input: EngineeringRunInput) => Promise<{ versionId: string }>
  executeAgentTask: (request: EngineeringAgentRequest) => Promise<EngineeringAgentResult>
  getGitDiff: (workspaceDir: string) => Promise<string>
  runVerification: (commands: VerificationCommand[], workspaceDir: string) => Promise<VerificationResult[]>
  runReview: (prompt: string, diff: string, workspaceDir: string) => Promise<ReviewResult>
  contextBuilder?: EngineeringContextBuilderDeps
  onEvent?: EngineeringRunEventHandler
  createTaskId?: () => string
}

export class EngineeringExecutionPipeline {
  constructor(private readonly deps: EngineeringExecutionPipelineDeps) {}

  async run(input: EngineeringRunInput): Promise<EngineeringRunSummary> {
    const taskId = input.taskId || this.deps.createTaskId?.() || createDefaultTaskId()
    emitEngineeringEvent(this.deps.onEvent, { type: 'stage_started', taskId, stage: 'classify' })
    const classification = classifyEngineeringTask(input.userRequest)
    emitEngineeringEvent(this.deps.onEvent, { type: 'stage_completed', taskId, stage: 'classify' })

    emitEngineeringEvent(this.deps.onEvent, { type: 'stage_started', taskId, stage: 'context' })
    const context = await buildEngineeringContext(input, this.deps.contextBuilder)
    emitEngineeringEvent(this.deps.onEvent, { type: 'context_built', taskId, candidateFileCount: context.candidateFiles.length })
    emitEngineeringEvent(this.deps.onEvent, { type: 'stage_completed', taskId, stage: 'context' })

    let snapshot: SnapshotResult = { created: false }

    if (shouldCreateSnapshot(classification)) {
      emitEngineeringEvent(this.deps.onEvent, { type: 'stage_started', taskId, stage: 'snapshot' })
      const label = createSnapshotLabel(classification.kind)
      try {
        const version = await this.deps.createSnapshot(label, input)
        snapshot = { created: true, label, versionId: version.versionId }
        emitEngineeringEvent(this.deps.onEvent, { type: 'snapshot_created', taskId, versionId: version.versionId, label })
        emitEngineeringEvent(this.deps.onEvent, { type: 'stage_completed', taskId, stage: 'snapshot' })
      } catch (error) {
        const message = stringifyError(error)
        snapshot = { created: false, label, error: message }
        emitEngineeringEvent(this.deps.onEvent, { type: 'stage_failed', taskId, stage: 'snapshot', error: message })
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

    let agentResult: EngineeringAgentResult
    emitEngineeringEvent(this.deps.onEvent, { type: 'stage_started', taskId, stage: 'execute' })
    try {
      agentResult = await this.deps.executeAgentTask(agentRequest)
    } catch (error) {
      agentResult = { success: false, error: stringifyError(error) }
    }

    if (!agentResult.success) {
      emitEngineeringEvent(this.deps.onEvent, { type: 'stage_failed', taskId, stage: 'execute', error: agentResult.error || 'Agent execution failed' })
      return finalize({
        taskId,
        classification,
        context,
        snapshot,
        agentResult,
        verificationResults: [],
        review: { success: false, skipped: true, error: 'Agent execution failed' },
        success: false,
        failedStage: 'execute',
      })
    }
    emitEngineeringEvent(this.deps.onEvent, { type: 'stage_completed', taskId, stage: 'execute' })

    let diff = ''
    let diffError: string | undefined
    emitEngineeringEvent(this.deps.onEvent, { type: 'stage_started', taskId, stage: 'diff' })
    try {
      diff = await this.deps.getGitDiff(input.workspaceDir)
      emitEngineeringEvent(this.deps.onEvent, { type: 'stage_completed', taskId, stage: 'diff' })
    } catch (error) {
      diffError = stringifyError(error)
      emitEngineeringEvent(this.deps.onEvent, { type: 'stage_failed', taskId, stage: 'diff', error: diffError })
    }

    const changedFiles = diff ? extractChangedFilesFromDiff(diff) : []
    const selectedCommands = classification.requiresVerification ? selectVerificationCommands(changedFiles, context.projectSignals.scripts) : []
    const commands = filterAllowedVerificationCommands(selectedCommands)
    let verificationResults: VerificationResult[] = []

    try {
      if (commands.length > 0) {
        emitEngineeringEvent(this.deps.onEvent, { type: 'stage_started', taskId, stage: 'verify' })
        for (const command of commands) {
          emitEngineeringEvent(this.deps.onEvent, { type: 'verification_started', taskId, command })
        }
        verificationResults = await this.deps.runVerification(commands, input.workspaceDir)
        for (const result of verificationResults) {
          emitEngineeringEvent(this.deps.onEvent, { type: 'verification_completed', taskId, command: result.command, success: result.success })
        }
        emitEngineeringEvent(this.deps.onEvent, { type: 'stage_completed', taskId, stage: 'verify' })
      }
    } catch (error) {
      const message = stringifyError(error)
      emitEngineeringEvent(this.deps.onEvent, { type: 'stage_failed', taskId, stage: 'verify', error: message })
      verificationResults = commands.map((command) => ({
        command,
        success: false,
        output: '',
        error: message,
      }))
    }

    const verificationFailed = verificationResults.some((result) => !result.success)
    let review: ReviewResult = { success: false, skipped: true }

    if (!diffError && classification.requiresReview && shouldRunReview(diff)) {
      emitEngineeringEvent(this.deps.onEvent, { type: 'stage_started', taskId, stage: 'review' })
      try {
        review = await this.deps.runReview(buildEngineeringReviewPrompt(diff), diff, input.workspaceDir)
        emitEngineeringEvent(this.deps.onEvent, { type: 'review_completed', taskId, success: review.success, skipped: review.skipped })
        emitEngineeringEvent(this.deps.onEvent, { type: 'stage_completed', taskId, stage: 'review' })
      } catch (error) {
        const message = stringifyError(error)
        review = { success: false, error: message }
        emitEngineeringEvent(this.deps.onEvent, { type: 'stage_failed', taskId, stage: 'review', error: message })
      }
    } else {
      emitEngineeringEvent(this.deps.onEvent, { type: 'review_completed', taskId, success: false, skipped: true })
    }

    return finalize({
      taskId,
      classification,
      context,
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
