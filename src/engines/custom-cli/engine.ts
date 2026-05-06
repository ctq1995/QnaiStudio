import type {
  AIEngine,
  AISession,
  AISessionConfig,
  EngineCapabilities,
} from '../../ai-runtime'
import { createCapabilities } from '../../ai-runtime'
import { BaseSession, createEventIterable } from '../../ai-runtime/base'
import type { AIEvent, AITask } from '../../ai-runtime'

export interface CustomCliEngineConfig {
  customCliPath?: string
  defaultWorkspaceDir?: string
}

export interface CustomCliSessionConfig extends AISessionConfig {
  customCliPath?: string
  workspacePath?: string
}

class CustomCliSession extends BaseSession {
  protected config: CustomCliSessionConfig

  constructor(id: string, config?: CustomCliSessionConfig) {
    super({ id, config })
    this.config = {
      workspaceDir: config?.workspacePath,
      verbose: config?.verbose,
      timeout: config?.timeout,
      customCliPath: config?.customCliPath,
      options: config?.options,
    }
  }

  protected async executeTask(_task: AITask): Promise<AsyncIterable<AIEvent>> {
    queueMicrotask(() => {
      this.emit({
        type: 'error',
        error: '[CustomCliSession] custom-cli session parser is not implemented yet',
      })
      this.emit({
        type: 'session_end',
        sessionId: this.id,
      })
    })

    return createEventIterable(this.eventEmitter, (event) => event.type === 'session_end')
  }

  protected abortTask(): void {
    this.emit({
      type: 'session_end',
      sessionId: this.id,
    })
  }

  protected disposeResources(): void {}
}

export class CustomCliEngine implements AIEngine {
  readonly id = 'custom-cli'
  readonly name = 'Custom CLI'
  readonly capabilities: EngineCapabilities

  private readonly config: CustomCliEngineConfig
  private readonly sessions = new Map<string, CustomCliSession>()
  private sessionCounter = 0

  constructor(config?: CustomCliEngineConfig) {
    this.config = config || {}
    this.capabilities = createCapabilities({
      supportedTaskKinds: ['chat', 'refactor', 'analyze', 'generate'],
      supportsStreaming: true,
      supportsConcurrentSessions: true,
      supportsTaskAbort: true,
      maxConcurrentSessions: 0,
      description: 'Custom CLI - 待接入的自定义命令行引擎',
      version: '0.1.0',
    })
  }

  createSession(config?: AISessionConfig): AISession {
    const sessionId = `custom-cli-${Date.now()}-${++this.sessionCounter}`
    const sessionConfig: CustomCliSessionConfig = {
      ...config,
      customCliPath: this.config.customCliPath,
      workspacePath: config?.workspaceDir || this.config.defaultWorkspaceDir,
    }

    const session = new CustomCliSession(sessionId, sessionConfig)
    this.sessions.set(sessionId, session)
    return session
  }

  async isAvailable(): Promise<boolean> {
    return true
  }

  async initialize(): Promise<boolean> {
    return true
  }

  cleanup(): void {
    this.sessions.forEach((session) => session.dispose())
    this.sessions.clear()
  }
}
