/**
 * Agent 角色系统 - 核心类型定义
 *
 * 定义了 Agent 角色的标准接口和能力模型。
 * 参考 BitFun 的 Agent 分层设计，但适配 QnaiStudio 的 runtime 架构。
 */

import type { AITask, AITaskKind } from './task'
import type { AIEvent } from './event'

/**
 * Agent 角色类型
 *
 * 定义系统内置的 Agent 角色，每种角色有不同的能力和工作流
 */
export type AgentRoleType =
  | 'code'          // 代码 Agent - 编码、重构、修复
  | 'review'        // 审查 Agent - 代码审查、架构分析
  | 'cowork'        // 协作 Agent - 文档、会议、知识管理
  | 'assistant'     // 个人助手 - 通用任务、日程、提醒
  | 'computer'      // 电脑控制 Agent - 桌面自动化、浏览器操作
  | 'custom'        // 自定义 Agent - 用户定义的 Agent

/**
 * Agent 能力标志
 *
 * 描述 Agent 可以执行的操作类型
 */
export interface AgentCapabilities {
  /** 可以读写文件 */
  fileOperations: boolean
  /** 可以执行 shell 命令 */
  shellExecution: boolean
  /** 可以访问网络 */
  networkAccess: boolean
  /** 可以控制桌面/UI */
  desktopControl: boolean
  /** 可以访问 Git */
  gitOperations: boolean
  /** 可以访问项目上下文 */
  projectContext: boolean
  /** 可以访问记忆系统 */
  memoryAccess: boolean
  /** 可以调用其他 Agent */
  agentOrchestration: boolean
  /** 可以执行代码 */
  codeExecution: boolean
  /** 可以访问浏览器 */
  browserControl: boolean
}

/**
 * Agent 角色配置
 *
 * 定义一个 Agent 角色的完整配置
 */
export interface AgentRoleConfig {
  /** 角色唯一标识 */
  id: string
  /** 角色类型 */
  type: AgentRoleType
  /** 显示名称 */
  name: string
  /** 角色描述 */
  description: string
  /** 角色图标（Lucide 图标名） */
  icon?: string
  /** 角色能力 */
  capabilities: AgentCapabilities
  /** 系统提示词模板 */
  systemPrompt: string
  /** 允许的工具列表（工具 ID） */
  allowedTools: string[]
  /** 禁止的工具列表（工具 ID） */
  deniedTools?: string[]
  /** 默认任务类型 */
  defaultTaskKind: AITaskKind
  /** 最大对话轮次（0 表示无限制） */
  maxTurns?: number
  /** 是否支持流式输出 */
  supportsStreaming: boolean
  /** 是否支持中断 */
  supportsAbort: boolean
  /** 优先级（用于多 Agent 协作时的调度） */
  priority: number
  /** 角色元数据 */
  metadata?: Record<string, unknown>
}

/**
 * Agent 角色接口
 *
 * 代表一个具体的 Agent 角色实例
 */
export interface AgentRole {
  /** 角色配置 */
  readonly config: AgentRoleConfig
  /** 检查角色是否可用 */
  isAvailable(): Promise<boolean>
  /** 获取角色能力 */
  getCapabilities(): AgentCapabilities
  /** 获取系统提示词 */
  getSystemPrompt(): string
  /** 验证任务是否适合此角色 */
  validateTask(task: AITask): { valid: boolean; reason?: string }
  /** 预处理任务（注入角色特定的上下文） */
  prepareTask?(task: AITask): Promise<AITask>
  /** 后处理事件（角色特定的事件转换） */
  processEvent?(event: AIEvent): AIEvent
}

/**
 * Agent 会话状态
 */
export type AgentSessionStatus = 'idle' | 'running' | 'waiting' | 'error' | 'completed'

/**
 * Agent 会话信息
 */
export interface AgentSessionInfo {
  /** 会话 ID */
  sessionId: string
  /** 角色 ID */
  roleId: string
  /** 当前状态 */
  status: AgentSessionStatus
  /** 当前任务 ID */
  currentTaskId?: string
  /** 创建时间 */
  createdAt: number
  /** 最后活动时间 */
  lastActivityAt: number
  /** 消息数量 */
  messageCount: number
  /** 工具调用次数 */
  toolCallCount: number
  /** Token 使用量 */
  tokenUsage?: {
    input: number
    output: number
    total: number
  }
}

/**
 * Agent 工作流步骤
 */
export interface AgentWorkflowStep {
  /** 步骤 ID */
  id: string
  /** 步骤名称 */
  name: string
  /** 步骤描述 */
  description?: string
  /** 执行条件 */
  condition?: string
  /** 要执行的任务模板 */
  taskTemplate: Partial<AITask>
  /** 是否可跳过 */
  skippable?: boolean
  /** 超时时间（毫秒） */
  timeout?: number
}

/**
 * Agent 工作流
 */
export interface AgentWorkflow {
  /** 工作流 ID */
  id: string
  /** 工作流名称 */
  name: string
  /** 工作流描述 */
  description?: string
  /** 关联的角色 ID */
  roleId: string
  /** 工作流步骤 */
  steps: AgentWorkflowStep[]
  /** 是否并行执行 */
  parallel?: boolean
}

/**
 * Agent 协作模式
 */
export type AgentCollaborationMode =
  | 'sequential'    // 顺序执行
  | 'parallel'      // 并行执行
  | 'hierarchical'  // 层级调度
  | 'consensus'     // 共识决策

/**
 * Agent 协作配置
 */
export interface AgentCollaborationConfig {
  /** 协作模式 */
  mode: AgentCollaborationMode
  /** 参与的角色 ID 列表 */
  roles: string[]
  /** 协调者角色 ID（层级模式） */
  coordinatorId?: string
  /** 最大并发数 */
  maxConcurrent?: number
  /** 结果合并策略 */
  mergeStrategy?: 'first' | 'best' | 'all' | 'vote'
}

/**
 * 创建 Agent 能力的辅助函数
 */
export function createAgentCapabilities(
  partial: Partial<AgentCapabilities>
): AgentCapabilities {
  return {
    fileOperations: false,
    shellExecution: false,
    networkAccess: false,
    desktopControl: false,
    gitOperations: false,
    projectContext: true,
    memoryAccess: true,
    agentOrchestration: false,
    codeExecution: false,
    browserControl: false,
    ...partial,
  }
}

/**
 * 预定义的角色能力模板
 */
export const ROLE_CAPABILITY_TEMPLATES: Record<AgentRoleType, AgentCapabilities> = {
  code: createAgentCapabilities({
    fileOperations: true,
    shellExecution: true,
    gitOperations: true,
    projectContext: true,
    codeExecution: true,
  }),
  review: createAgentCapabilities({
    fileOperations: true,
    gitOperations: true,
    projectContext: true,
  }),
  cowork: createAgentCapabilities({
    fileOperations: true,
    networkAccess: true,
    projectContext: true,
    memoryAccess: true,
  }),
  assistant: createAgentCapabilities({
    fileOperations: false,
    networkAccess: true,
    memoryAccess: true,
  }),
  computer: createAgentCapabilities({
    fileOperations: true,
    shellExecution: true,
    desktopControl: true,
    browserControl: true,
    codeExecution: true,
  }),
  custom: createAgentCapabilities({}),
}

/**
 * 创建基础 Agent 角色配置的辅助函数
 */
export function createAgentRoleConfig(
  partial: Partial<AgentRoleConfig> & { id: string; type: AgentRoleType; name: string }
): AgentRoleConfig {
  const defaultCapabilities = ROLE_CAPABILITY_TEMPLATES[partial.type] || createAgentCapabilities({})

  return {
    description: '',
    icon: 'bot',
    capabilities: defaultCapabilities,
    systemPrompt: '',
    allowedTools: [],
    defaultTaskKind: 'chat',
    supportsStreaming: true,
    supportsAbort: true,
    priority: 0,
    ...partial,
  }
}
