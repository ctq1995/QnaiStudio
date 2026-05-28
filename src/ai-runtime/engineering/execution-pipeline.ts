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
