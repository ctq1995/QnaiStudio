/**
 * 工具注册表 - 管理所有可用工具的生命周期
 *
 * 提供工具的注册、发现、执行和权限管理。
 */

import type {
  Tool,
  ToolDefinition,
  ToolExecutionContext,
  ToolResult,
  ToolCallRecord,
  ToolPermissionConfig,
} from './tool'
import { getAgentRoleRegistry } from './agent-role-registry'

/**
 * 工具注册信息
 */
interface ToolRegistration {
  tool: Tool
  registeredAt: number
  enabled: boolean
}

/**
 * 工具注册表事件监听器
 */
export type ToolRegistryEventListener = (event: ToolRegistryEvent) => void

/**
 * 工具注册表事件
 */
export type ToolRegistryEvent =
  | { type: 'tool_registered'; toolId: string }
  | { type: 'tool_unregistered'; toolId: string }
  | { type: 'tool_enabled'; toolId: string }
  | { type: 'tool_disabled'; toolId: string }
  | { type: 'tool_executed'; toolId: string; success: boolean; duration: number }
  | { type: 'tool_error'; toolId: string; error: string }

/**
 * 工具注册表配置
 */
export interface ToolRegistryConfig {
  /** 默认权限配置 */
  defaultPermissions?: ToolPermissionConfig[]
  /** 是否启用确认机制 */
  enableConfirmation?: boolean
  /** 默认超时时间（毫秒） */
  defaultTimeout?: number
  /** 最大并发执行数 */
  maxConcurrentExecutions?: number
  /** 执行历史保留数量 */
  historyRetention?: number
}

/**
 * 工具注册表
 *
 * 单例模式，管理所有工具的生命周期
 */
export class ToolRegistry {
  private tools = new Map<string, ToolRegistration>()
  private permissions = new Map<string, ToolPermissionConfig>()
  private executionHistory: ToolCallRecord[] = []
  private listeners = new Set<ToolRegistryEventListener>()
  private config: ToolRegistryConfig

  private static instance: ToolRegistry | null = null

  private constructor(config: ToolRegistryConfig = {}) {
    this.config = {
      enableConfirmation: true,
      defaultTimeout: 60000,
      maxConcurrentExecutions: 10,
      historyRetention: 1000,
      ...config,
    }
  }

  /**
   * 获取单例实例
   */
  static getInstance(config?: ToolRegistryConfig): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry(config)
    }
    return ToolRegistry.instance
  }

  /**
   * 重置单例（仅用于测试）
   */
  static resetInstance(): void {
    ToolRegistry.instance = null
  }

  /**
   * 注册工具
   */
  register(tool: Tool, enabled = true): void {
    const toolId = tool.definition.id

    if (this.tools.has(toolId)) {
      console.warn(`[ToolRegistry] Tool "${toolId}" already registered, replacing`)
    }

    this.tools.set(toolId, {
      tool,
      registeredAt: Date.now(),
      enabled,
    })

    this.emit({ type: 'tool_registered', toolId })
  }

  /**
   * 批量注册工具
   */
  registerBatch(tools: Tool[]): void {
    for (const tool of tools) {
      this.register(tool)
    }
  }

  /**
   * 注销工具
   */
  unregister(toolId: string): boolean {
    const removed = this.tools.delete(toolId)
    if (removed) {
      this.permissions.delete(toolId)
      this.emit({ type: 'tool_unregistered', toolId })
    }
    return removed
  }

  /**
   * 获取工具
   */
  get(toolId: string): Tool | undefined {
    return this.tools.get(toolId)?.tool
  }

  /**
   * 获取工具定义
   */
  getDefinition(toolId: string): ToolDefinition | undefined {
    return this.get(toolId)?.definition
  }

  /**
   * 获取所有工具
   */
  getAll(): Tool[] {
    return Array.from(this.tools.values()).map(r => r.tool)
  }

  /**
   * 获取所有启用的工具
   */
  getEnabled(): Tool[] {
    return Array.from(this.tools.values())
      .filter(r => r.enabled)
      .map(r => r.tool)
  }

  /**
   * 按类别获取工具
   */
  getByCategory(category: string): Tool[] {
    return this.getAll().filter(t => t.definition.category === category)
  }

  /**
   * 检查工具是否存在
   */
  has(toolId: string): boolean {
    return this.tools.has(toolId)
  }

  /**
   * 启用工具
   */
  enable(toolId: string): boolean {
    const registration = this.tools.get(toolId)
    if (registration) {
      registration.enabled = true
      this.emit({ type: 'tool_enabled', toolId })
      return true
    }
    return false
  }

  /**
   * 禁用工具
   */
  disable(toolId: string): boolean {
    const registration = this.tools.get(toolId)
    if (registration) {
      registration.enabled = false
      this.emit({ type: 'tool_disabled', toolId })
      return true
    }
    return false
  }

  /**
   * 设置工具权限
   */
  setPermission(config: ToolPermissionConfig): void {
    this.permissions.set(config.toolId, config)
  }

  /**
   * 获取工具权限
   */
  getPermission(toolId: string): ToolPermissionConfig | undefined {
    return this.permissions.get(toolId)
  }

  /**
   * 检查工具是否允许执行
   */
  isAllowed(toolId: string, context: ToolExecutionContext): boolean {
    // 首先检查工具是否存在且启用
    const registration = this.tools.get(toolId)
    if (!registration || !registration.enabled) {
      return false
    }

    // 强制执行 Agent 角色工具白名单/黑名单
    const roleRegistry = getAgentRoleRegistry()
    const role = roleRegistry.get(context.roleId)
    if (role) {
      const deniedTools = new Set(role.config.deniedTools || [])
      if (deniedTools.has(toolId)) {
        return false
      }

      const allowedTools = new Set(role.config.allowedTools)
      if (!allowedTools.has(toolId)) {
        return false
      }
    } else {
      return false
    }

    // 检查权限配置
    const permission = this.permissions.get(toolId)
    if (permission) {
      if (!permission.allowed) {
        return false
      }
      // 检查权限级别
      if (permission.permissionLevel) {
        const levels = ['read', 'write', 'execute', 'admin']
        const currentLevel = levels.indexOf(context.permissionLevel)
        const requiredLevel = levels.indexOf(permission.permissionLevel)
        if (currentLevel < requiredLevel) {
          return false
        }
      }
    }

    return true
  }

  /**
   * 执行工具
   */
  async execute(
    toolId: string,
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const tool = this.get(toolId)
    if (!tool) {
      return {
        success: false,
        error: `Tool "${toolId}" not found`,
        errorCode: 'TOOL_NOT_FOUND',
        duration: 0,
      }
    }

    // 检查是否允许执行
    if (!this.isAllowed(toolId, context)) {
      return {
        success: false,
        error: `Tool "${toolId}" is not allowed in current context`,
        errorCode: 'PERMISSION_DENIED',
        duration: 0,
      }
    }

    // 验证参数
    const validation = tool.validateArgs(args)
    if (!validation.valid) {
      return {
        success: false,
        error: `Invalid arguments: ${validation.errors?.join(', ')}`,
        errorCode: 'INVALID_ARGS',
        duration: 0,
      }
    }

    // 创建调用记录
    const record: ToolCallRecord = {
      id: crypto.randomUUID(),
      toolId,
      toolName: tool.definition.name,
      args,
      context,
      startTime: Date.now(),
      status: 'running',
    }

    this.addToHistory(record)

    try {
      // 执行工具
      const result = await tool.execute(args, context)

      // 更新记录
      record.endTime = Date.now()
      record.status = result.success ? 'completed' : 'failed'
      record.result = result

      this.emit({
        type: 'tool_executed',
        toolId,
        success: result.success,
        duration: result.duration,
      })

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      record.endTime = Date.now()
      record.status = 'failed'
      record.result = {
        success: false,
        error: errorMessage,
        duration: record.endTime - record.startTime,
      }

      this.emit({
        type: 'tool_error',
        toolId,
        error: errorMessage,
      })

      return record.result
    }
  }

  /**
   * 获取执行历史
   */
  getHistory(limit?: number): ToolCallRecord[] {
    const history = this.executionHistory
    return limit ? history.slice(-limit) : [...history]
  }

  /**
   * 获取工具的执行历史
   */
  getToolHistory(toolId: string, limit?: number): ToolCallRecord[] {
    const history = this.executionHistory.filter(r => r.toolId === toolId)
    return limit ? history.slice(-limit) : history
  }

  /**
   * 清除历史
   */
  clearHistory(): void {
    this.executionHistory = []
  }

  /**
   * 添加事件监听器
   */
  addListener(listener: ToolRegistryEventListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalTools: number
    enabledTools: number
    totalExecutions: number
    successRate: number
    byCategory: Record<string, number>
  } {
    const tools = this.getAll()
    const enabled = this.getEnabled()
    const history = this.executionHistory
    const successes = history.filter(r => r.status === 'completed').length

    const byCategory: Record<string, number> = {}
    for (const tool of tools) {
      const cat = tool.definition.category
      byCategory[cat] = (byCategory[cat] || 0) + 1
    }

    return {
      totalTools: tools.length,
      enabledTools: enabled.length,
      totalExecutions: history.length,
      successRate: history.length > 0 ? successes / history.length : 0,
      byCategory,
    }
  }

  private emit(event: ToolRegistryEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (err) {
        console.error('[ToolRegistry] Listener error:', err)
      }
    }
  }

  private addToHistory(record: ToolCallRecord): void {
    this.executionHistory.push(record)

    // 限制历史大小
    const retention = this.config.historyRetention ?? 1000
    if (this.executionHistory.length > retention) {
      this.executionHistory = this.executionHistory.slice(-retention)
    }
  }
}

/**
 * 获取全局工具注册表
 */
export function getToolRegistry(config?: ToolRegistryConfig): ToolRegistry {
  return ToolRegistry.getInstance(config)
}
