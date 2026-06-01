import { registerAIEventTranscriptAutoWiring } from '../services/aiEventTranscriptAutoWiring'
import { syncEngineeringTaskStateFromRuntime } from '../services/engineeringTaskStateRuntimeBridge'
import {
  createEngineeringTaskRunner,
  getTaskManager,
  type EngineeringAuditRecorder,
  type EngineeringContextBuilderDeps,
  type EngineeringContextRuntime,
  type EngineeringExecutionPipelineDeps,
  type EngineeringLifecycleRuntime,
  type EngineeringRunEventHandler,
  type EngineeringTaskInputMapper,
  type EngineeringTaskRunner,
  type EngineeringTaskRunnerAdapterInput,
  type EngineeringTaskStateTracker,
  type EngineeringTranscriptRecorder,
  type EngineeringRuntimeTranscriptAutoWiring,
  type EngineeringRuntimeTranscriptAutoWiringInput,
  type EngineeringRuntimeTurnHook,
  type TaskManager,
} from '../ai-runtime'

export interface EngineeringRunnerBootstrapInput {
  taskManager?: TaskManager
  runner?: EngineeringTaskRunner
  adapter?: EngineeringTaskRunnerAdapterInput
}

export interface EngineeringRunnerBootstrapResult {
  registered: boolean
  source: 'runner' | 'adapter'
}

export interface EngineeringPipelineContainerInput {
  createSnapshot: EngineeringExecutionPipelineDeps['createSnapshot']
  executeAgentTask: EngineeringExecutionPipelineDeps['executeAgentTask']
  getGitDiff: EngineeringExecutionPipelineDeps['getGitDiff']
  runVerification: EngineeringExecutionPipelineDeps['runVerification']
  runReview: EngineeringExecutionPipelineDeps['runReview']
  contextBuilder?: EngineeringContextBuilderDeps
  contextRuntime?: EngineeringContextRuntime
  auditRecorder?: EngineeringAuditRecorder
  onEvent?: EngineeringRunEventHandler
  createTaskId?: () => string
}

export interface EngineeringPipelineRunnerRegistrationInput extends EngineeringPipelineContainerInput {
  taskManager?: TaskManager
  sessionId?: EngineeringTaskRunnerAdapterInput['sessionId']
  lifecycleRuntime?: EngineeringLifecycleRuntime
  transcriptRecorder?: EngineeringTranscriptRecorder
  transcriptAutoWiring?: EngineeringRuntimeTranscriptAutoWiring
  taskStateTracker?: EngineeringTaskStateTracker
  afterRuntimeTurn?: EngineeringRuntimeTurnHook
  mapTaskToRunInput?: EngineeringTaskInputMapper
}

export function createEngineeringPipelineDeps(input: EngineeringPipelineContainerInput): EngineeringExecutionPipelineDeps {
  return {
    createSnapshot: input.createSnapshot,
    executeAgentTask: input.executeAgentTask,
    getGitDiff: input.getGitDiff,
    runVerification: input.runVerification,
    runReview: input.runReview,
    contextBuilder: input.contextBuilder,
    contextRuntime: input.contextRuntime,
    auditRecorder: input.auditRecorder,
    onEvent: input.onEvent,
    createTaskId: input.createTaskId,
  }
}

export function registerEngineeringPipelineRunner(input: EngineeringPipelineRunnerRegistrationInput): EngineeringRunnerBootstrapResult {
  const pipelineDeps = createEngineeringPipelineDeps(input)
  return registerEngineeringRunner({
    taskManager: input.taskManager,
    adapter: {
      sessionId: input.sessionId,
      lifecycleRuntime: input.lifecycleRuntime,
      transcriptRecorder: input.transcriptRecorder,
      transcriptAutoWiring: input.transcriptAutoWiring || registerDefaultAIEventTranscriptAutoWiring,
      taskStateTracker: input.taskStateTracker,
      afterRuntimeTurn: input.afterRuntimeTurn || syncEngineeringTaskStateFromRuntime,
      mapTaskToRunInput: input.mapTaskToRunInput,
      pipelineDeps,
    },
  })
}

export function registerEngineeringRunner(input: EngineeringRunnerBootstrapInput): EngineeringRunnerBootstrapResult {
  const runner = input.runner || createRunnerFromAdapter(input.adapter)
  const taskManager = input.taskManager || getTaskManager()
  taskManager.setEngineeringRunner(runner)

  return {
    registered: true,
    source: input.runner ? 'runner' : 'adapter',
  }
}

function registerDefaultAIEventTranscriptAutoWiring(input: EngineeringRuntimeTranscriptAutoWiringInput): ReturnType<EngineeringRuntimeTranscriptAutoWiring> {
  return registerAIEventTranscriptAutoWiring({
    ...input,
    mapPayload: (event) => ({
      type: event.type,
      sessionId: event.sessionId,
      turnId: event.turnId,
      taskId: event.taskId,
    }),
  })
}

function createRunnerFromAdapter(adapter: EngineeringTaskRunnerAdapterInput | undefined): EngineeringTaskRunner {
  if (!adapter) {
    throw new Error('Engineering runner bootstrap requires either runner or adapter')
  }
  return createEngineeringTaskRunner(adapter)
}
