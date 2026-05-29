import {
  createEngineeringTaskRunner,
  getTaskManager,
  type EngineeringTaskRunner,
  type EngineeringTaskRunnerAdapterInput,
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

export function registerEngineeringRunner(input: EngineeringRunnerBootstrapInput): EngineeringRunnerBootstrapResult {
  const runner = input.runner || createRunnerFromAdapter(input.adapter)
  const taskManager = input.taskManager || getTaskManager()
  taskManager.setEngineeringRunner(runner)

  return {
    registered: true,
    source: input.runner ? 'runner' : 'adapter',
  }
}

function createRunnerFromAdapter(adapter: EngineeringTaskRunnerAdapterInput | undefined): EngineeringTaskRunner {
  if (!adapter) {
    throw new Error('Engineering runner bootstrap requires either runner or adapter')
  }
  return createEngineeringTaskRunner(adapter)
}
