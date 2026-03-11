/**
 * 配置相关类型定义
 */

/** AI 引擎 ID */
export type EngineId = 'claude-code' | 'iflow' | 'codex-cli' | 'gemini'

/** AI 引擎配置 */
export interface EngineConfig {
  id: EngineId
  name: string
  cliPath?: string
  available?: boolean
}

/** 悬浮窗模式 */
export type FloatingWindowMode = 'auto' | 'manual'

/** 悬浮窗配置 */
export interface FloatingWindowConfig {
  enabled: boolean
  mode: FloatingWindowMode
  expandOnHover: boolean
  collapseDelay: number
}

/** 应用配置 */
export interface Config {
  defaultEngine: EngineId
  claudeCode: {
    cliPath: string
  }
  iflow: {
    cliPath?: string
  }
  codexCli: {
    cliPath: string
  }
  gemini: {
    cliPath: string
  }
  workDir?: string
  sessionDir?: string
  gitBinPath?: string
  floatingWindow: FloatingWindowConfig
}

/** 健康状态 */
export interface HealthStatus {
  claudeAvailable: boolean
  claudeVersion?: string
  iflowAvailable: boolean
  iflowVersion?: string
  codexAvailable: boolean
  codexVersion?: string
  geminiAvailable: boolean
  geminiVersion?: string
  workDir?: string
  configValid: boolean
}

/** 通用引擎可用性判断 */
export function getEngineAvailability(health: HealthStatus, engineId: EngineId): boolean {
  switch (engineId) {
    case 'iflow':
      return health.iflowAvailable
    case 'codex-cli':
      return health.codexAvailable
    case 'gemini':
      return health.geminiAvailable
    case 'claude-code':
    default:
      return health.claudeAvailable
  }
}

/** 获取引擎版本字符串 */
export function getEngineVersion(health: HealthStatus, engineId: EngineId): string {
  switch (engineId) {
    case 'iflow':
      return health.iflowVersion ?? 'IFlow 未连接'
    case 'codex-cli':
      return health.codexVersion ?? 'Codex CLI 未连接'
    case 'gemini':
      return health.geminiVersion ?? 'Gemini CLI 未连接'
    case 'claude-code':
    default:
      return health.claudeVersion ?? 'Claude 未连接'
  }
}
