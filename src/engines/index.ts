/**
 * Engines Registry
 */

export * from './claude-code'
export * from './codex-cli'
export * from './custom-cli'
export * from './iflow'
export { GeminiEngine, getGeminiEngine, resetGeminiEngine } from './gemini/engine'
export type { GeminiEngineConfig } from './gemini/engine'
export { GeminiSession } from './gemini/session'
export type { GeminiSessionConfig } from './gemini/session'
export { GeminiEventParser, convertGeminiEventsToAIEvents } from './gemini/event-parser'
export type { GeminiStreamEvent } from './gemini/event-parser'

export function getAvailableEngineIds(): string[] {
  return ['claude-code', 'codex-cli', 'custom-cli', 'iflow', 'gemini']
}

export function getDefaultEngineId(): string {
  return 'claude-code'
}

export interface EngineDescriptor {
  id: string
  name: string
  description: string
  available: boolean
}

export function getEngineDescriptors(): EngineDescriptor[] {
  return [
    {
      id: 'claude-code',
      name: 'Claude Code',
      description: 'Anthropic 官方 Claude CLI',
      available: true,
    },
    {
      id: 'codex-cli',
      name: 'Codex CLI',
      description: 'OpenAI 官方 Codex CLI',
      available: true,
    },
    {
      id: 'custom-cli',
      name: 'Custom CLI',
      description: '预留给自定义命令行引擎的占位注册',
      available: false,
    },
    {
      id: 'iflow',
      name: 'IFlow',
      description: '支持多种 AI 模型的智能编程助手',
      available: true,
    },
    {
      id: 'gemini',
      name: 'Gemini CLI',
      description: 'Google 官方 Gemini CLI',
      available: true,
    },
  ]
}
