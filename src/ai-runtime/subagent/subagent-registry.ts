/**
 * Subagent Registry - Subagent注册表
 *
 * 管理所有Subagent类型的注册和创建。
 * 支持动态注册新的Subagent类型。
 */

import type { SubagentType, SubagentConfig, SubagentCapability } from './types'
import { SUBAGENT_CAPABILITIES } from './types'
import type { BaseSubagent } from './base-subagent'

/**
 * Subagent工厂函数类型
 */
export type SubagentFactory = (config?: Partial<SubagentConfig>) => BaseSubagent

/**
 * 注册项
 */
interface RegistryEntry {
  type: SubagentType
  factory: SubagentFactory
  capability: SubagentCapability
}

/**
 * Subagent注册表
 */
class SubagentRegistryImpl {
  private entries: Map<SubagentType, RegistryEntry> = new Map()
  private defaultFactories: Map<SubagentType, SubagentFactory> = new Map()

  /**
   * 注册Subagent工厂
   */
  register(type: SubagentType, factory: SubagentFactory, capability?: SubagentCapability): void {
    const entry: RegistryEntry = {
      type,
      factory,
      capability: capability ?? SUBAGENT_CAPABILITIES[type],
    }
    this.entries.set(type, entry)
  }

  /**
   * 注册默认工厂（用于延迟加载）
   */
  registerDefaultFactory(type: SubagentType, factory: SubagentFactory): void {
    this.defaultFactories.set(type, factory)
  }

  /**
   * 创建Subagent实例
   */
  create(type: SubagentType, config?: Partial<SubagentConfig>): BaseSubagent {
    // 优先使用已注册的工厂
    const entry = this.entries.get(type)
    if (entry) {
      return entry.factory(config)
    }

    // 尝试使用默认工厂
    const defaultFactory = this.defaultFactories.get(type)
    if (defaultFactory) {
      const subagent = defaultFactory(config)
      // 注册到entries以便下次直接使用
      this.entries.set(type, {
        type,
        factory: defaultFactory,
        capability: SUBAGENT_CAPABILITIES[type],
      })
      return subagent
    }

    throw new Error(`Unknown subagent type: ${type}. Available types: ${this.getAvailableTypes().join(', ')}`)
  }

  /**
   * 获取Subagent能力描述
   */
  getCapability(type: SubagentType): SubagentCapability | undefined {
    const entry = this.entries.get(type)
    if (entry) {
      return entry.capability
    }
    return SUBAGENT_CAPABILITIES[type]
  }

  /**
   * 获取所有可用的Subagent类型
   */
  getAvailableTypes(): SubagentType[] {
    const types = new Set<SubagentType>()

    // 添加已注册的类型
    for (const type of this.entries.keys()) {
      types.add(type)
    }

    // 添加有默认工厂的类型
    for (const type of this.defaultFactories.keys()) {
      types.add(type)
    }

    // 添加内置类型
    for (const type of Object.keys(SUBAGENT_CAPABILITIES) as SubagentType[]) {
      types.add(type)
    }

    return Array.from(types)
  }

  /**
   * 检查Subagent类型是否已注册
   */
  has(type: SubagentType): boolean {
    return this.entries.has(type) || this.defaultFactories.has(type) || type in SUBAGENT_CAPABILITIES
  }

  /**
   * 获取所有Subagent能力描述
   */
  getAllCapabilities(): SubagentCapability[] {
    return this.getAvailableTypes().map((type) => this.getCapability(type)!)
  }

  /**
   * 清空注册表（用于测试）
   */
  clear(): void {
    this.entries.clear()
    this.defaultFactories.clear()
  }
}

// 全局单例
let globalRegistry: SubagentRegistryImpl | null = null

/**
 * 获取全局Subagent注册表
 */
export function getSubagentRegistry(): SubagentRegistryImpl {
  if (!globalRegistry) {
    globalRegistry = new SubagentRegistryImpl()
  }
  return globalRegistry
}

/**
 * 重置全局注册表（用于测试）
 */
export function resetSubagentRegistry(): void {
  globalRegistry = null
}

/**
 * 注册Subagent（便捷函数）
 */
export function registerSubagent(
  type: SubagentType,
  factory: SubagentFactory,
  capability?: SubagentCapability
): void {
  getSubagentRegistry().register(type, factory, capability)
}

/**
 * 创建Subagent实例（便捷函数）
 */
export function createSubagent(type: SubagentType, config?: Partial<SubagentConfig>): BaseSubagent {
  return getSubagentRegistry().create(type, config)
}

/**
 * 获取Subagent能力（便捷函数）
 */
export function getSubagentCapability(type: SubagentType): SubagentCapability | undefined {
  return getSubagentRegistry().getCapability(type)
}

/**
 * 列出所有可用的Subagent类型（便捷函数）
 */
export function listSubagentTypes(): SubagentType[] {
  return getSubagentRegistry().getAvailableTypes()
}

// 导出类型
export { SubagentRegistryImpl as SubagentRegistry }
