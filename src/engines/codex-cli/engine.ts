import type {
  AIEngine,
  AISession,
  AISessionConfig,
  EngineCapabilities,
} from '../../ai-runtime'
import { createCapabilities } from '../../ai-runtime'
import { CodexCliSession, type CodexSessionConfig } from './session'

export interface CodexCliEngineConfig {
  codexPath?: string
  defaultWorkspaceDir?: string
}

export class CodexCliEngine implements AIEngine {
  readonly id = 'codex-cli'
  readonly name = 'Codex CLI'
  readonly capabilities: EngineCapabilities

  private readonly config: CodexCliEngineConfig
  private readonly sessions = new Map<string, CodexCliSession>()
  private sessionCounter = 0

  constructor(config?: CodexCliEngineConfig) {
    this.config = config || {}
    this.capabilities = createCapabilities({
      supportedTaskKinds: ['chat', 'refactor', 'analyze', 'generate'],
      supportsStreaming: true,
      supportsConcurrentSessions: true,
      supportsTaskAbort: true,
      maxConcurrentSessions: 0,
      description: 'Codex CLI - OpenAI 官方本地代码代理',
      version: '1.0.0',
    })
  }

  createSession(config?: AISessionConfig): AISession {
    const sessionId = `codex-${Date.now()}-${++this.sessionCounter}`
    const sessionConfig: CodexSessionConfig = {
      ...config,
      codexPath: this.config.codexPath,
      workspacePath: config?.workspaceDir || this.config.defaultWorkspaceDir,
    }

    const session = new CodexCliSession(sessionId, sessionConfig)
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
