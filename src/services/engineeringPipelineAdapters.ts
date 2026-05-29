import type {
  EngineeringAuditRecorder,
  EngineeringContextBuilderDeps,
  EngineeringContextRuntime,
  EngineeringExecutionPipelineDeps,
  EngineeringRunEventHandler,
  EngineeringRunInput,
} from '../ai-runtime/engineering'
import { createWorkspaceVersion } from './workspaceVersionService'

export type EngineeringVerificationRunner = EngineeringExecutionPipelineDeps['runVerification']
export type EngineeringReviewRunner = EngineeringExecutionPipelineDeps['runReview']
export type EngineeringAgentTaskRunner = EngineeringExecutionPipelineDeps['executeAgentTask']
export type EngineeringRawDiffProvider = EngineeringExecutionPipelineDeps['getGitDiff']

export interface EngineeringServicePipelineAdapterInput {
  executeAgentTask: EngineeringAgentTaskRunner
  getRawGitDiff: EngineeringRawDiffProvider
  runVerification: EngineeringVerificationRunner
  runReview: EngineeringReviewRunner
  contextBuilder?: EngineeringContextBuilderDeps
  contextRuntime?: EngineeringContextRuntime
  auditRecorder?: EngineeringAuditRecorder
  onEvent?: EngineeringRunEventHandler
  createTaskId?: () => string
}

export function createEngineeringServicePipelineDeps(input: EngineeringServicePipelineAdapterInput): EngineeringExecutionPipelineDeps {
  return {
    createSnapshot: createWorkspaceSnapshot,
    executeAgentTask: input.executeAgentTask,
    getGitDiff: createGitDiffProvider(input.getRawGitDiff),
    runVerification: input.runVerification,
    runReview: input.runReview,
    contextBuilder: input.contextBuilder,
    contextRuntime: input.contextRuntime,
    auditRecorder: input.auditRecorder,
    onEvent: input.onEvent,
    createTaskId: input.createTaskId,
  }
}

function createGitDiffProvider(getRawGitDiff: EngineeringRawDiffProvider): EngineeringRawDiffProvider {
  return async (workspaceDir) => {
    const diff = await getRawGitDiff(workspaceDir)
    if (!diff.trim()) {
      return ''
    }
    if (!diff.includes('diff --git')) {
      throw new Error('Engineering git diff provider must return raw git diff content with diff --git headers')
    }
    return diff
  }
}

async function createWorkspaceSnapshot(label: string, request: EngineeringRunInput): Promise<{ versionId: string }> {
  const version = await createWorkspaceVersion({
    workspacePath: request.workspaceDir,
    kind: 'auto',
    label,
  })
  return { versionId: version.id }
}

