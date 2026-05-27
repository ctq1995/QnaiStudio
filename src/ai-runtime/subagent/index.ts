/**
 * Subagent Module - Subagent模块
 *
 * 提供完整的Subagent功能：
 * - 类型定义
 * - 基础类
 * - 注册表
 * - Task工具
 * - 具体Agent实现
 */

// 类型定义
export type {
  SubagentType,
  SubagentConfig,
  SubagentResult,
  SubagentEvent,
  TaskToolParams,
  TaskToolResult,
  ParallelTaskParams,
  ParallelTaskResult,
  ToolName,
  ToolCallRecord,
  SubagentCapability,
} from './types'

export {
  SUBAGENT_TOOLS,
  SUBAGENT_DESCRIPTIONS,
  SUBAGENT_CAPABILITIES,
  isReadonlySubagent,
  getSubagentTools,
} from './types'

// 基础类
export { BaseSubagent, createSubagentContext } from './base-subagent'
export type { ToolExecutor, SubagentContext } from './base-subagent'

// 注册表
export {
  getSubagentRegistry,
  resetSubagentRegistry,
  registerSubagent,
  createSubagent,
  getSubagentCapability,
  listSubagentTypes,
  SubagentRegistry,
} from './subagent-registry'
export type { SubagentFactory } from './subagent-registry'

// Task工具
export {
  TaskScheduler,
  TaskToolDefinition,
  createTaskToolExecutor,
  initializeTaskScheduler,
  getTaskScheduler,
  executeTask,
  executeTasksParallel,
} from './task-tool'
export type { TaskSchedulerConfig } from './task-tool'

// Agent实现
export * from './agents'
