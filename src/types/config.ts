/**
 * 配置相关类型定义
 */

/** AI 引擎 ID */
export type EngineId = 'claude-code' | 'iflow' | 'codex-cli' | 'gemini' | 'custom-cli'

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

/** 模型服务商请求格式 */
export type ProviderKind = 'openai-chat' | 'openai-responses'

/** 模型服务商配置 */
export interface ModelProviderConfig {
  id: string
  name: string
  kind: ProviderKind
  apiKey?: string
  baseUrl?: string
}

/** Claude Code 权限模式 */
export type ClaudePermissionMode = 'bypassPermissions' | 'default' | 'plan'

/** Claude Code 输出格式 */
export type ClaudeOutputFormat = 'stream-json' | 'text' | 'json'

/** Claude Code 高级参数 */
export interface ClaudeAdvancedParams {
  systemPrompt?: string
  appendSystemPrompt?: string
  permissionMode?: ClaudePermissionMode
  maxTurns?: number
  outputFormat?: ClaudeOutputFormat
  verbose?: boolean
}

/** Codex CLI 审批模式 */
export type CodexApprovalMode = 'suggest' | 'auto-edit' | 'full-auto'

/** Codex CLI 高级参数 */
export interface CodexAdvancedParams {
  skipGitRepoCheck?: boolean
  bypassApprovalsAndSandbox?: boolean
  approvalMode?: CodexApprovalMode
}

/** Gemini CLI 审批模式 */
export type GeminiApprovalMode = 'default' | 'auto-edit' | 'yolo' | 'plan'

/** Gemini CLI 高级参数 */
export interface GeminiAdvancedParams {
  yolo?: boolean
  sandbox?: boolean
  approvalMode?: GeminiApprovalMode
}

export interface EngineRuntimeBinding {
  cliPath?: string
  providerId?: string
  model?: string
  /** 旧字段：兼容已有配置，逐步迁移到 providers */
  apiKey?: string
  /** 旧字段：兼容已有配置，逐步迁移到 providers */
  baseUrl?: string
}

/** 应用配置 */
export interface Config {
  defaultEngine: EngineId
  providers: ModelProviderConfig[]
  claudeCode: EngineRuntimeBinding & {
    cliPath: string
    advanced?: ClaudeAdvancedParams
  }
  iflow: EngineRuntimeBinding
  codexCli: EngineRuntimeBinding & {
    cliPath: string
    advanced?: CodexAdvancedParams
  }
  gemini: EngineRuntimeBinding & {
    cliPath: string
    advanced?: GeminiAdvancedParams
  }
  customCli: EngineRuntimeBinding & {
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
  customCliAvailable: boolean
  customCliVersion?: string
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
    case 'custom-cli':
      // 内置 Agent 引擎，始终可用，无需连接外部 CLI
      return true
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
    case 'custom-cli':
      return health.customCliVersion ?? '1.0.0'
    case 'claude-code':
    default:
      return health.claudeVersion ?? 'Claude 未连接'
  }
}
