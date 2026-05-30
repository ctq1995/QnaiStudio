import type { AIEvent, SessionEndEvent } from '../ai-runtime/event'
import { getEventBus, type EventBus } from '../ai-runtime/event-bus'
import type { EngineeringExecutionPipelineDeps } from '../ai-runtime/engineering'
import { AIRuntimeService, type AIRuntimeConfig } from './aiRuntimeService'

export interface WaitableBuiltInAgentRunnerInput {
  aiRuntime?: AIRuntimeService
  aiRuntimeConfig?: AIRuntimeConfig
  eventBus?: EventBus
  timeoutMs?: number
  collectOutput?: (event: AIEvent) => string | undefined
}

export function createWaitableBuiltInAgentRunner(input: WaitableBuiltInAgentRunnerInput): EngineeringExecutionPipelineDeps['executeAgentTask'] {
  return async (request) => {
    const eventBus = input.eventBus || getEventBus()
    const outputs: string[] = []
    let cleanupOutput: (() => void) | undefined

    try {
      const runtime = input.aiRuntime || createRuntimeFromConfig(input.aiRuntimeConfig, request.workspaceDir)
      const sessionId = await runtime.sendMessage(buildAgentPrompt(request))
      const collectSessionOutput = (event: AIEvent) => {
        if (event.sessionId !== sessionId) return
        const output = input.collectOutput ? input.collectOutput(event) : collectDefaultOutput(event)
        if (output) outputs.push(output)
      }
      eventBus.getHistory().forEach(collectSessionOutput)
      cleanupOutput = eventBus.onAny(collectSessionOutput)
      const result = await waitForSessionEnd(eventBus, sessionId, input.timeoutMs)

      if (result.error) {
        return { success: false, error: result.error }
      }

      return {
        success: true,
        content: outputs.join('\n').trim() || `AI runtime session completed: ${sessionId}`,
      }
    } catch (error) {
      return { success: false, error: stringifyError(error) }
    } finally {
      cleanupOutput?.()
    }
  }
}

function createRuntimeFromConfig(config: AIRuntimeConfig | undefined, workspaceDir: string): AIRuntimeService {
  if (!config) {
    throw new Error('Waitable built-in agent runner requires aiRuntime or aiRuntimeConfig')
  }
  return new AIRuntimeService({ ...config, workspaceDir })
}

async function waitForSessionEnd(eventBus: EventBus, sessionId: string, timeoutMs = 300000): Promise<{ error?: string }> {
  const historical = eventBus.getHistory().filter(isSessionEndEvent).find((event) => event.sessionId === sessionId)
  if (historical?.reason === 'error') return { error: 'AI runtime session ended with error' }
  if (historical) return {}

  return new Promise((resolve) => {
    let settled = false
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    const cleanup = eventBus.on('session_end', (event: AIEvent) => {
      if (!isSessionEndEvent(event) || event.sessionId !== sessionId || settled) return
      settled = true
      if (timeoutId) clearTimeout(timeoutId)
      cleanup()
      resolve(event.reason === 'error' ? { error: 'AI runtime session ended with error' } : {})
    })

    timeoutId = setTimeout(() => {
      if (settled) return
      settled = true
      cleanup()
      resolve({ error: `Timed out waiting for AI runtime session ${sessionId}` })
    }, timeoutMs)
  })
}

function buildAgentPrompt(request: Parameters<EngineeringExecutionPipelineDeps['executeAgentTask']>[0]): string {
  const sections = [
    `Task ID: ${request.taskId}`,
    `Workspace: ${request.workspaceDir}`,
    `Task kind: ${request.classification.kind}`,
    `May modify files: ${request.classification.mayModifyFiles ? 'yes' : 'no'}`,
    `Requires verification: ${request.classification.requiresVerification ? 'yes' : 'no'}`,
    `Requires review: ${request.classification.requiresReview ? 'yes' : 'no'}`,
    '',
    'User request:',
    request.userRequest,
  ]

  if (request.selectedFiles.length > 0) {
    sections.push('', 'Selected files:', ...request.selectedFiles.map((file) => `- ${file}`))
  }

  if (request.context?.summary) {
    sections.push('', 'Engineering context:', request.context.summary)
  }

  return sections.join('\n')
}

function collectDefaultOutput(event: AIEvent): string | undefined {
  switch (event.type) {
    case 'assistant_message':
      return event.content
    case 'token':
      return event.value
    case 'tool_call_output':
      return event.output
    case 'result':
      return typeof event.output === 'string' ? event.output : JSON.stringify(event.output)
    default:
      return undefined
  }
}

function isSessionEndEvent(event: AIEvent): event is SessionEndEvent {
  return event.type === 'session_end'
}

function stringifyError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
