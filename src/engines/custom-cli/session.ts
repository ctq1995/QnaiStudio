import type { AISessionConfig, AITask, AIEvent } from '../../ai-runtime'
import { BaseSession, createEventIterable } from '../../ai-runtime/base'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { CustomCliEventParser, type CustomCliStreamEvent } from './event-parser'

export interface CustomCliSessionConfig extends AISessionConfig {
  customCliPath?: string
  workspacePath?: string
}

interface TauriChatEvent {
  type: string
  session_id?: string
  [key: string]: unknown
}

function toStreamEvent(event: TauriChatEvent): CustomCliStreamEvent {
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

  constructor(id: string, config?: CustomCliSessionConfig) {
    super({ id, config })
    this.config = {
      workspaceDir: config?.workspacePath,
      verbose: config?.verbose,
      timeout: config?.timeout,
      customCliPath: config?.customCliPath,
      options: config?.options,
    }
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

    invoke('interrupt_chat', { payload: { sessionId: this.backendSessionId ?? this.id } })
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

    this.unlistenChatEvent = await listen<unknown>('chat-event', (event) => {
      const payload = parseTauriChatEvent(event.payload)
      if (!payload) {
        return
      }

      const payloadSessionId = payload.session_id
      if (payloadSessionId && !this.backendSessionId) {
        this.backendSessionId = payloadSessionId
      }

      if (!payloadSessionId || payloadSessionId === this.id || payloadSessionId === this.backendSessionId) {
        this.handleTauriEvent(payload)
      }
    })
  }

  private async startCustomCliProcess(task: AITask): Promise<void> {
    await invoke('start_chat', {
      payload: {
        message: task.input.prompt,
        sessionId: this.backendSessionId ?? this.id,
        workDir: this.config.workspaceDir,
        engineId: 'custom-cli',
      },
    })
  }

  private handleTauriEvent(event: TauriChatEvent): void {
    const aiEvents = this.parser.parse(toStreamEvent(event))
    for (const aiEvent of aiEvents) {
      this.emit(aiEvent)
    }
  }

  async continue(prompt: string): Promise<void> {
    if (this.isDisposed) {
      throw new Error('[CustomCliSession] Session has been disposed')
    }

    await invoke('continue_chat', {
      payload: {
        sessionId: this.backendSessionId ?? this.id,
        message: prompt,
        engineId: 'custom-cli',
      },
    })
    this._status = 'running'
  }
}

function parseTauriChatEvent(payload: unknown): TauriChatEvent | null {
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload) as TauriChatEvent
    } catch (error) {
      console.error('[CustomCliSession] Failed to parse payload string:', error)
      return null
    }
  }

  if (payload && typeof payload === 'object') {
    return payload as TauriChatEvent
  }

  return null
}
