/**
 * AI Runtime - 统一 AI 执行运行时
 *
 * 提供统一的 AI 引擎抽象、会话管理、任务调度、事件系统、Agent 角色和工具系统。
 */

// Engine and Session
export * from './engine'
export * from './session'
export * from './engine-registry'

// Task and Event
export * from './task'
export * from './task-template'
export * from './task-manager'
export * from './task-queue'
export * from './session-pool'
export * from './event'
export * from './event-bus'

// Agent Role System (新增)
export * from './agent-role'
export * from './agent-role-registry'
export * from './agents/builtin-agents'

// Tool and Skill System (新增)
export * from './tool'
export * from './tool-registry'
export * from './tools/file-tools'
export * from './tools/git-tools'
export * from './tools/search-tools'

// Memory System (新增)
export type {
  MemoryType,
  MemoryEntry,
  MemoryMetadata,
  MemoryQuery,
  MemorySearchResult,
  MemoryStorageConfig,
  ProjectMemoryContext,
  ProjectKnowledge,
  ArchitecturalDecision,
  CodePattern,
  CommonSolution,
  ProjectConvention,
  DependencyInfo as MemoryDependencyInfo,
  MemoryStore,
  MemoryStats,
  SessionMemory,
  ConversationTurn,
} from './memory'
export {
  createMemoryEntry,
  createSessionMemory,
  DEFAULT_MEMORY_CONFIG,
} from './memory'
export {
  InMemoryMemoryStore,
  getInMemoryMemoryStore,
} from './memory-store'

// Project Context
export * from './project-context'

// CLI Parser
export * from './cli-parser'

// Base classes
export * from './base/base-session'
export * from './base/base-event-parser'
export * from './base/index'

/**
 * AI Runtime 版本
 */
export const AI_RUNTIME_VERSION = '1.0.0'

/**
 * AI Runtime 构建信息
 */
export const AI_RUNTIME_BUILD = {
  version: AI_RUNTIME_VERSION,
  codename: 'Polaris',
  releaseDate: '2025-01-01',
}