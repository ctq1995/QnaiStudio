/**
 * Gemini CLI Engine
 *
 * 实现 AIEngine 接口，作为 Google Gemini CLI 的适配器。
 */

import type { AIEngine, AISession, AISessionConfig, EngineCapabilities } from '../../ai-runtime'
import { createCapabilities } from '../../ai-runtime'
import { GeminiSession, type GeminiSessionConfig } from './session'

export interface GeminiEngineConfig {
  geminiPath?: string
  defaultWorkspaceDir?: string
}

export class GeminiEngine implements AIEngine {
  readonly id = 'gemini'
  readonly name = 'Gemini CLI'
  readonly capabilities: EngineCapabilities

  private readonly config: GeminiEngineConfig
  private readonly sessions = new Map<string, GeminiSession>()
  private sessionCounter = 0

  constructor(config?: GeminiEngineConfig) {
    this.config = config || {}
    this.capabilities = createCapabilities({
      supportedTaskKinds: ['chat', 'refactor', 'analyze', 'generate'],
      supportsStreaming: true,
      supportsConcurrentSessions: true,
      supportsTaskAbort: true,
      maxConcurrentSessions: 0,
      description: 'Gemini CLI - Google 官方 AI CLI 工具',
      version: '1.0.0',
    })
  }

  createSession(config?: AISessionConfig): AISession {
    const sessionId = `gemini-${Date.now()}-${++this.sessionCounter}`
    const sessionConfig: GeminiSessionConfig = {
      ...config,
      geminiPath: this.config.geminiPath,
      workspacePath: config?.workspaceDir || this.config.defaultWorkspaceDir,
    }

    const session = new GeminiSession(sessionId, sessionConfig)
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

let engineInstance: GeminiEngine | null = null

export function getGeminiEngine(config?: GeminiEngineConfig): GeminiEngine {
  if (!engineInstance) {
    engineInstance = new GeminiEngine(config)
  }
  return engineInstance
}

export function resetGeminiEngine(): void {
  if (engineInstance) {
    engineInstance.cleanup()
    engineInstance = null
  }
}
