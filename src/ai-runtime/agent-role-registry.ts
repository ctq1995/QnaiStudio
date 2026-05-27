/**
 * Agent 角色注册表 - 管理所有 Agent 角色的生命周期
 *
 * 提供角色的注册、发现、工作流管理和协作调度。
 */

import type {
  AgentRole,
  AgentRoleConfig,
  AgentRoleType,
  AgentCapabilities,
  AgentWorkflow,
} from './agent-role'
import type { AITask } from './task'

/**
 * 角色注册信息
 */
interface RoleRegistration {
  role: AgentRole
  registeredAt: number
  enabled: boolean
}

/**
 * 角色注册表事件监听器
 */
export type AgentRoleRegistryEventListener = (event: AgentRoleRegistryEvent) => void

/**
 * 角色注册表事件
 */
export type AgentRoleRegistryEvent =
  | { type: 'role_registered'; roleId: string }
  | { type: 'role_unregistered'; roleId: string }
  | { type: 'role_enabled'; roleId: string }
  | { type: 'role_disabled'; roleId: string }
  | { type: 'role_activated'; roleId: string; sessionId: string }
  | { type: 'role_deactivated'; roleId: string; sessionId: string }
  | { type: 'workflow_started'; workflowId: string; roleId: string }
  | { type: 'workflow_completed'; workflowId: string; roleId: string; success: boolean }

/**
 * Agent 角色注册表
 *
 * 单例模式，管理所有角色的生命周期
 */
export class AgentRoleRegistry {
  private roles = new Map<string, RoleRegistration>()
  private workflows = new Map<string, AgentWorkflow>()
  private activeSessions = new Map<string, string>() // sessionId -> roleId
  private listeners = new Set<AgentRoleRegistryEventListener>()
  private defaultRoleId: string | null = null

  private static instance: AgentRoleRegistry | null = null

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): AgentRoleRegistry {
    if (!AgentRoleRegistry.instance) {
      AgentRoleRegistry.instance = new AgentRoleRegistry()
    }
    return AgentRoleRegistry.instance
  }

  /**
   * 重置单例（仅用于测试）
   */
  static resetInstance(): void {
    AgentRoleRegistry.instance = null
  }

  /**
   * 注册角色
   */
  register(role: AgentRole, enabled = true): void {
    const roleId = role.config.id

    if (this.roles.has(roleId)) {
      console.warn(`[AgentRoleRegistry] Role "${roleId}" already registered, replacing`)
    }

    this.roles.set(roleId, {
      role,
      registeredAt: Date.now(),
      enabled,
    })

    if (!this.defaultRoleId) {
      this.defaultRoleId = roleId
    }

    this.emit({ type: 'role_registered', roleId })
  }

  /**
   * 批量注册角色
   */
  registerBatch(roles: AgentRole[]): void {
    for (const role of roles) {
      this.register(role)
    }
  }

  /**
   * 注销角色
   */
  unregister(roleId: string): boolean {
    const removed = this.roles.delete(roleId)
    if (removed) {
      this.emit({ type: 'role_unregistered', roleId })
      if (this.defaultRoleId === roleId) {
        this.defaultRoleId = this.roles.keys().next().value ?? null
      }
    }
    return removed
  }

  /**
   * 获取角色
   */
  get(roleId: string): AgentRole | undefined {
    return this.roles.get(roleId)?.role
  }

  /**
   * 获取角色配置
   */
  getConfig(roleId: string): AgentRoleConfig | undefined {
    return this.get(roleId)?.config
  }

  /**
   * 获取所有角色
   */
  getAll(): AgentRole[] {
    return Array.from(this.roles.values()).map(r => r.role)
  }

  /**
   * 获取所有启用的角色
   */
  getEnabled(): AgentRole[] {
    return Array.from(this.roles.values())
      .filter(r => r.enabled)
      .map(r => r.role)
  }

  /**
   * 按类型获取角色
   */
  getByType(type: AgentRoleType): AgentRole[] {
    return this.getAll().filter(r => r.config.type === type)
  }

  /**
   * 检查角色是否存在
   */
  has(roleId: string): boolean {
    return this.roles.has(roleId)
  }

  /**
   * 启用角色
   */
  enable(roleId: string): boolean {
    const registration = this.roles.get(roleId)
    if (registration) {
      registration.enabled = true
      this.emit({ type: 'role_enabled', roleId })
      return true
    }
    return false
  }

  /**
   * 禁用角色
   */
  disable(roleId: string): boolean {
    const registration = this.roles.get(roleId)
    if (registration) {
      registration.enabled = false
      this.emit({ type: 'role_disabled', roleId })
      return true
    }
    return false
  }

  /**
   * 设置默认角色
   */
  setDefault(roleId: string): boolean {
    if (this.roles.has(roleId)) {
      this.defaultRoleId = roleId
      return true
    }
    return false
  }

  /**
   * 获取默认角色
   */
  getDefault(): AgentRole | undefined {
    return this.defaultRoleId ? this.get(this.defaultRoleId) : undefined
  }

  /**
   * 注册工作流
   */
  registerWorkflow(workflow: AgentWorkflow): void {
    this.workflows.set(workflow.id, workflow)
  }

  /**
   * 获取工作流
   */
  getWorkflow(workflowId: string): AgentWorkflow | undefined {
    return this.workflows.get(workflowId)
  }

  /**
   * 获取角色的所有工作流
   */
  getWorkflowsForRole(roleId: string): AgentWorkflow[] {
    return Array.from(this.workflows.values()).filter(w => w.roleId === roleId)
  }

  /**
   * 根据任务选择合适的角色
   */
  selectRoleForTask(task: AITask): AgentRole | undefined {
    // 优先根据任务中的角色 ID 选择
    const taskRoleId = task.input.extra?.roleId as string | undefined
    if (taskRoleId) {
      const role = this.get(taskRoleId)
      if (role && this.roles.get(taskRoleId)?.enabled) {
        return role
      }
    }

    // 根据任务类型匹配角色
    const taskKind = task.kind
    const enabledRoles = this.getEnabled()

    // 查找支持该任务类型的角色
    for (const role of enabledRoles) {
      if (role.config.defaultTaskKind === taskKind) {
        const validation = role.validateTask(task)
        if (validation.valid) {
          return role
        }
      }
    }

    // 返回默认角色
    return this.getDefault()
  }

  /**
   * 激活角色会话
   */
  activateSession(roleId: string, sessionId: string): boolean {
    const role = this.get(roleId)
    if (!role) {
      return false
    }

    this.activeSessions.set(sessionId, roleId)
    this.emit({ type: 'role_activated', roleId, sessionId })
    return true
  }

  /**
   * 停用角色会话
   */
  deactivateSession(sessionId: string): boolean {
    const roleId = this.activeSessions.get(sessionId)
    if (roleId) {
      this.activeSessions.delete(sessionId)
      this.emit({ type: 'role_deactivated', roleId, sessionId })
      return true
    }
    return false
  }

  /**
   * 获取会话的角色
   */
  getSessionRole(sessionId: string): AgentRole | undefined {
    const roleId = this.activeSessions.get(sessionId)
    return roleId ? this.get(roleId) : undefined
  }

  /**
   * 检查角色是否有指定能力
   */
  hasCapability(roleId: string, capability: keyof AgentCapabilities): boolean {
    const role = this.get(roleId)
    return role?.config.capabilities[capability] ?? false
  }

  /**
   * 获取角色的可用工具
   */
  getRoleTools(roleId: string): string[] {
    const role = this.get(roleId)
    if (!role) {
      return []
    }

    const allowed = role.config.allowedTools
    const denied = new Set(role.config.deniedTools || [])

    return allowed.filter(toolId => !denied.has(toolId))
  }

  /**
   * 添加事件监听器
   */
  addListener(listener: AgentRoleRegistryEventListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalRoles: number
    enabledRoles: number
    activeSessions: number
    totalWorkflows: number
    byType: Record<AgentRoleType, number>
  } {
    const roles = this.getAll()
    const enabled = this.getEnabled()

    const byType: Record<AgentRoleType, number> = {
      code: 0,
      review: 0,
      cowork: 0,
      assistant: 0,
      computer: 0,
      custom: 0,
    }

    for (const role of roles) {
      byType[role.config.type]++
    }

    return {
      totalRoles: roles.length,
      enabledRoles: enabled.length,
      activeSessions: this.activeSessions.size,
      totalWorkflows: this.workflows.size,
      byType,
    }
  }

  private emit(event: AgentRoleRegistryEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (err) {
        console.error('[AgentRoleRegistry] Listener error:', err)
      }
    }
  }
}

/**
 * 获取全局角色注册表
 */
export function getAgentRoleRegistry(): AgentRoleRegistry {
  return AgentRoleRegistry.getInstance()
}
