import type {
  AIEngine,
  AISession,
  AISessionConfig,
  EngineCapabilities,
} from '../../ai-runtime'
import { createCapabilities } from '../../ai-runtime'
import {
  CustomCliSession,
  type CustomCliSessionConfig,
} from './session'
import { probeCustomCliAvailability, tauriCustomCliGateway } from './gateway'

export interface CustomCliEngineConfig {
  customCliPath?: string
  defaultWorkspaceDir?: string
}

export class CustomCliEngine implements AIEngine {
  readonly id = 'custom-cli'
  readonly name = 'Custom CLI'
  readonly capabilities: EngineCapabilities

  private readonly config: CustomCliEngineConfig
  private readonly sessions = new Map<string, CustomCliSession>()
  private sessionCounter = 0
  private available = false

  constructor(config?: CustomCliEngineConfig) {
    this.config = config || {}
    this.capabilities = createCapabilities({
      supportedTaskKinds: ['chat', 'refactor', 'analyze', 'generate'],
      supportsStreaming: true,
      supportsConcurrentSessions: false,
      supportsTaskAbort: true,
      maxConcurrentSessions: 1,
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
    session.onEvent((event) => {
      if (event.type === 'session_end') {
        setTimeout(() => {
          if (session.status === 'idle') {
            this.sessions.delete(sessionId)
          }
        }, 5000)
      }
    })
    this.sessions.set(sessionId, session)
    return session
  }

  async isAvailable(): Promise<boolean> {
    this.available = await probeCustomCliAvailability(tauriCustomCliGateway)
    return this.available
  }

  async initialize(): Promise<boolean> {
    this.available = await this.isAvailable()
    return this.available
  }

  cleanup(): void {
    this.sessions.forEach((session) => session.dispose())
    this.sessions.clear()
  }
}
