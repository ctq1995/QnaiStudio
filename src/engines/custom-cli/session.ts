import type { AISessionConfig, AITask, AIEvent } from '../../ai-runtime'
import { BaseSession, createEventIterable } from '../../ai-runtime/base'
import { CustomCliEventParser, type CustomCliStreamEvent } from './event-parser'
import {
  tauriCustomCliGateway,
  type CustomCliChatEvent,
  type CustomCliGateway,
} from './gateway'

export interface CustomCliSessionConfig extends AISessionConfig {
  customCliPath?: string
  workspacePath?: string
}

function toStreamEvent(event: CustomCliChatEvent): CustomCliStreamEvent {
  const streamEvent: CustomCliStreamEvent = { type: event.type }

  for (const [key, value] of Object.entries(event)) {
    if (key !== 'type') {
      streamEvent[key] = value
    }
  }

  if ('toolName' in event && !('tool_name' in streamEvent)) {
    streamEvent.tool_name = event.toolName
  }
  if ('toolUseId' in event && !('tool_id' in streamEvent)) {
    streamEvent.tool_id = event.toolUseId
  }

  return streamEvent
}

export class CustomCliSession extends BaseSession {
  protected config: CustomCliSessionConfig
  private readonly parser: CustomCliEventParser
  private currentTaskId: string | null = null
  private backendSessionId: string | null = null
  private unlistenChatEvent: (() => void) | null = null
  private readonly gateway: CustomCliGateway

  constructor(id: string, config?: CustomCliSessionConfig, gateway: CustomCliGateway = tauriCustomCliGateway) {
    super({ id, config })
    this.config = {
      workspaceDir: config?.workspacePath,
      verbose: config?.verbose,
      timeout: config?.timeout,
      customCliPath: config?.customCliPath,
      options: config?.options,
    }
    this.gateway = gateway
    this.parser = new CustomCliEventParser(id)
  }

  protected async executeTask(task: AITask): Promise<AsyncIterable<AIEvent>> {
    this.currentTaskId = task.id
    await this.setupEventListeners()
    await this.startCustomCliProcess(task)

    return createEventIterable(
      this.eventEmitter,
      (event) => event.type === 'session_end',
    )
  }

  protected abortTask(taskId?: string): void {
    if (taskId && taskId !== this.currentTaskId) {
      return
    }

    this.gateway.interruptChat(this.backendSessionId ?? this.id)
      .catch((error) => {
        console.error('[CustomCliSession] Failed to abort:', error)
      })
      .finally(() => {
        this.currentTaskId = null
      })
  }

  protected disposeResources(): void {
    if (this.unlistenChatEvent) {
      this.unlistenChatEvent()
      this.unlistenChatEvent = null
    }

    this.parser.reset()
    this.currentTaskId = null
  }

  private async setupEventListeners(): Promise<void> {
    if (this.unlistenChatEvent) {
      return
    }

    this.unlistenChatEvent = await this.gateway.listenChatEvent((payload) => {
      if (!payload) {
        return
      }

      const payloadSessionId = payload.session_id
      if (!payloadSessionId || payloadSessionId === this.backendSessionId) {
        this.handleTauriEvent(payload)
      }
    })
  }

  private async startCustomCliProcess(task: AITask): Promise<void> {
    const backendSessionId = await this.gateway.startChat({
      message: task.input.prompt,
      sessionId: this.backendSessionId ?? this.id,
      workDir: this.config.workspaceDir,
      engineId: 'custom-cli',
    })
    this.backendSessionId = backendSessionId
  }

  private handleTauriEvent(event: CustomCliChatEvent): void {
    const aiEvents = this.parser.parse(toStreamEvent(event))
    for (const aiEvent of aiEvents) {
      this.emit(aiEvent)
    }
  }

  async continue(prompt: string): Promise<void> {
    if (this.isDisposed) {
      throw new Error('[CustomCliSession] Session has been disposed')
    }

    await this.gateway.continueChat({
      sessionId: this.backendSessionId ?? this.id,
      message: prompt,
      engineId: 'custom-cli',
    })
    this._status = 'running'
  }
}
