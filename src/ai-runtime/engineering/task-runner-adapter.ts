import type { AITask } from '../task'
import type { EngineeringTaskRunner, EngineeringTaskRunnerResult } from '../task-manager'
import { createEngineeringRuntime, type EngineeringRuntimeTurnResult } from './engineering-runtime'
import type { EngineeringExecutionPipelineDeps } from './execution-pipeline'
import type { EngineeringLifecycleRuntime } from './lifecycle-runtime'
import type { EngineeringPermissionMode } from './permission-policy'
import type { EngineeringRunMode } from './run-mode-policy'
import type { EngineeringTranscriptRecorder } from './transcript-recorder'
import { createEngineeringTurnRunnerDepsFromPipelineDeps, type EngineeringTurnInput, type EngineeringTurnRunnerDeps } from './turn-runner'

export type EngineeringTaskInputMapper = (task: AITask) => Omit<EngineeringTurnInput, 'sessionId'>

export interface EngineeringTaskRunnerAdapterInput {
  sessionId?: string | ((task: AITask) => string)
  lifecycleRuntime?: EngineeringLifecycleRuntime
  transcriptRecorder?: EngineeringTranscriptRecorder
  pipelineDeps?: EngineeringExecutionPipelineDeps
  turnRunnerDeps?: EngineeringTurnRunnerDeps
  mapTaskToRunInput?: EngineeringTaskInputMapper
}

export interface EngineeringTaskRunnerOutput {
  runtime: EngineeringRuntimeTurnResult
}

export function createEngineeringTaskRunner(input: EngineeringTaskRunnerAdapterInput): EngineeringTaskRunner {
  const mapTaskToRunInput = input.mapTaskToRunInput || mapTaskToEngineeringRunInput
  const turnRunnerDeps = resolveTurnRunnerDeps(input)

  return async (task, signal): Promise<EngineeringTaskRunnerResult> => {
    if (signal.aborted) {
      return { success: false, error: 'Engineering task aborted before start' }
    }

    try {
      const sessionId = resolveSessionId(input.sessionId, task)
      const runtime = createEngineeringRuntime({
        sessionId,
        turnRunnerDeps,
        lifecycleRuntime: input.lifecycleRuntime,
        transcriptRecorder: input.transcriptRecorder,
      })
      const result = await runtime.runTurn({
        ...mapTaskToRunInput(task),
        taskId: task.id,
      })

      if (signal.aborted) {
        return { success: false, error: 'Engineering task aborted' }
      }

      return {
        success: result.turn.status === 'idle',
        output: { runtime: result } satisfies EngineeringTaskRunnerOutput,
        error: result.turn.error,
      }
    } catch (error) {
      return { success: false, error: stringifyError(error) }
    }
  }
}

export function mapTaskToEngineeringRunInput(task: AITask): Omit<EngineeringTurnInput, 'sessionId'> {
  const extra = task.input.extra || {}
  return {
    taskId: task.id,
    userRequest: task.input.prompt,
    workspaceDir: readWorkspaceDir(extra),
    selectedFiles: task.input.files || [],
    runMode: readRunMode(extra),
    permissionMode: readPermissionMode(extra),
  }
}

function resolveTurnRunnerDeps(input: EngineeringTaskRunnerAdapterInput): EngineeringTurnRunnerDeps {
  if (input.turnRunnerDeps) return input.turnRunnerDeps
  if (input.pipelineDeps) return createEngineeringTurnRunnerDepsFromPipelineDeps(input.pipelineDeps)
  throw new Error('Engineering task runner requires either turnRunnerDeps or pipelineDeps')
}

function resolveSessionId(sessionId: EngineeringTaskRunnerAdapterInput['sessionId'], task: AITask): string {
  if (typeof sessionId === 'function') return sessionId(task)
  return sessionId || `engineering-session-${task.id}`
}

function readWorkspaceDir(extra: Record<string, unknown>): string {
  const workspaceDir = extra.workspaceDir
  if (typeof workspaceDir === 'string' && workspaceDir.trim()) return workspaceDir.trim()

  const currentWorkspace = extra.currentWorkspace
  if (isWorkspaceLike(currentWorkspace) && currentWorkspace.path.trim()) return currentWorkspace.path.trim()

  throw new Error('Engineering task requires input.extra.workspaceDir or input.extra.currentWorkspace.path')
}

function readRunMode(extra: Record<string, unknown>): EngineeringRunMode | undefined {
  return extra.runMode === 'plan' || extra.runMode === 'act' ? extra.runMode : undefined
}

function readPermissionMode(extra: Record<string, unknown>): EngineeringPermissionMode | undefined {
  return extra.permissionMode === 'plan' || extra.permissionMode === 'default' || extra.permissionMode === 'acceptEdits' || extra.permissionMode === 'bypassPermissions'
    ? extra.permissionMode
    : undefined
}

function isWorkspaceLike(value: unknown): value is { path: string } {
  return !!value && typeof value === 'object' && 'path' in value && typeof (value as { path: unknown }).path === 'string'
}

function stringifyError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
