/**
 * Task Tool - Subagent调度核心
 *
 * 这是主Agent调用Subagent的核心工具。
 * 提供Task工具的实现，支持：
 * - Subagent类型选择
 * - 超时控制
 * - 并行调度
 * - 结果收集
 */

import type {
  TaskToolParams,
  TaskToolResult,
  ParallelTaskParams,
  ParallelTaskResult,
  SubagentEvent,
  SubagentConfig,
} from './types'
import { createSubagentContext, ToolExecutor } from './base-subagent'
import { createSubagent } from './subagent-registry'

// Re-export types for convenience
export type { TaskToolResult, ParallelTaskParams, ParallelTaskResult }

/**
 * Task调度器配置
 */
export interface TaskSchedulerConfig {
  /** 默认超时（毫秒） */
  defaultTimeoutMs: number
  /** 最大并行数 */
  maxParallelism: number
  /** 工具执行器 */
  toolExecutor: ToolExecutor
  /** 工作区路径 */
  workspacePath: string
  /** 事件回调 */
  onEvent?: (sessionId: string, event: SubagentEvent) => void
  /** 中断检查 */
  shouldAbort?: (sessionId: string) => boolean
}

/**
 * Task调度器
 *
 * 管理Subagent的创建、执行和结果收集。
 */
export class TaskScheduler {
  private config: TaskSchedulerConfig
  private activeSessions: Map<string, { abort: boolean; startTime: number }> = new Map()

  constructor(config: TaskSchedulerConfig) {
    // 应用默认值，config中的值优先
    this.config = {
      defaultTimeoutMs: config.defaultTimeoutMs ?? 120000,
      maxParallelism: config.maxParallelism ?? 5,
      toolExecutor: config.toolExecutor,
      workspacePath: config.workspacePath,
      onEvent: config.onEvent,
      shouldAbort: config.shouldAbort,
    }
  }

  /**
   * 执行单个Task
   */
  async executeTask(params: TaskToolParams): Promise<TaskToolResult> {
    const sessionId = crypto.randomUUID()
    const { subagent_type, description, prompt, workspace_path, timeout_seconds, model_id } = params

    // 注册会话
    this.activeSessions.set(sessionId, { abort: false, startTime: Date.now() })

    try {
      // 创建Subagent配置
      const subagentConfig: Partial<SubagentConfig> = {
        workspacePath: workspace_path ?? this.config.workspacePath,
        timeoutMs: timeout_seconds ? timeout_seconds * 1000 : this.config.defaultTimeoutMs,
        modelId: model_id,
      }

      // 创建Subagent实例
      const subagent = createSubagent(subagent_type, subagentConfig)

      // 创建执行上下文
      const context = createSubagentContext(
        subagentConfig.workspacePath ?? this.config.workspacePath,
        this.config.toolExecutor,
        (event) => {
          this.config.onEvent?.(sessionId, event)
        },
        () => {
          const session = this.activeSessions.get(sessionId)
          return session?.abort ?? false
        }
      )

      // 设置超时
      const timeoutMs = subagentConfig.timeoutMs ?? this.config.defaultTimeoutMs
      const timeoutPromise = timeoutMs > 0
        ? new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error(`Task timeout after ${timeoutMs}ms`)), timeoutMs)
          })
        : null

      // 执行任务
      const executePromise = subagent.execute(prompt, context)

      const result = timeoutPromise
        ? await Promise.race([executePromise, timeoutPromise])
        : await executePromise

      return {
        subagent_type,
        description,
        result,
        session_id: sessionId,
      }
    } catch (error) {
      return {
        subagent_type,
        description,
        result: {
          success: false,
          content: '',
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - (this.activeSessions.get(sessionId)?.startTime ?? Date.now()),
        },
        session_id: sessionId,
      }
    } finally {
      this.activeSessions.delete(sessionId)
    }
  }

  /**
   * 并行执行多个Task
   */
  async executeParallel(params: ParallelTaskParams): Promise<ParallelTaskResult> {
    const startTime = Date.now()
    const { tasks, failFast = false } = params

    if (tasks.length === 0) {
      return {
        results: [],
        successCount: 0,
        failureCount: 0,
        duration: Date.now() - startTime,
      }
    }

    // 限制并行数
    const batchSize = Math.min(tasks.length, this.config.maxParallelism)
    const results: TaskToolResult[] = []

    if (failFast) {
      // 失败时停止模式
      for (let i = 0; i < tasks.length; i += batchSize) {
        const batch = tasks.slice(i, i + batchSize)
        const batchResults = await Promise.all(batch.map((t) => this.executeTask(t)))
        results.push(...batchResults)

        // 检查是否有失败
        if (batchResults.some((r) => !r.result.success)) {
          break
        }
      }
    } else {
      // 全部执行模式
      for (let i = 0; i < tasks.length; i += batchSize) {
        const batch = tasks.slice(i, i + batchSize)
        const batchResults = await Promise.all(batch.map((t) => this.executeTask(t)))
        results.push(...batchResults)
      }
    }

    return {
      results,
      successCount: results.filter((r) => r.result.success).length,
      failureCount: results.filter((r) => !r.result.success).length,
      duration: Date.now() - startTime,
    }
  }

  /**
   * 中断指定会话
   */
  abortSession(sessionId: string): void {
    const session = this.activeSessions.get(sessionId)
    if (session) {
      session.abort = true
    }
  }

  /**
   * 中断所有会话
   */
  abortAll(): void {
    for (const session of this.activeSessions.values()) {
      session.abort = true
    }
  }

  /**
   * 获取活跃会话数
   */
  getActiveSessionCount(): number {
    return this.activeSessions.size
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<TaskSchedulerConfig>): void {
    this.config = { ...this.config, ...config }
  }
}

// ==================== 工具函数接口 ====================

/**
 * 创建Task工具的执行函数
 *
 * 这是一个工厂函数，用于创建符合工具调用规范的执行器。
 */
export function createTaskToolExecutor(scheduler: TaskScheduler) {
  return async (params: TaskToolParams): Promise<TaskToolResult> => {
    return scheduler.executeTask(params)
  }
}

/**
 * Task工具定义
 *
 * 符合AI工具调用规范的工具定义。
 */
export const TaskToolDefinition = {
  name: 'Task',
  description: `Launch a new agent to handle complex, multi-step tasks autonomously.

The Task tool launches specialized agents (subprocesses) that autonomously handle complex tasks. Each agent type has specific capabilities and tools available to it.

Available agents and their tools:
- FileFinder: LS, Read, Grep, Glob - For semantic file search
- Explore: Grep, Glob, Read, LS - For wide codebase exploration
- ReviewFixer: Read, Grep, Glob, LS, GetFileDiff, Edit, Write, Bash, TodoWrite, Git - For code review fixes
- ReviewFrontend: Read, Grep, Glob, LS, GetFileDiff, Git - For frontend-specific reviews
- ReviewSecurity: Read, Grep, Glob, LS, GetFileDiff, Git - For security reviews
- ReviewArchitecture: Read, Grep, Glob, LS, GetFileDiff, Git - For architecture reviews
- ReviewPerformance: Read, Grep, Glob, LS, GetFileDiff, Git - For performance reviews
- ReviewBusinessLogic: Read, Grep, Glob, LS, GetFileDiff, Git - For business logic reviews
- ReviewJudge: Read, Grep, Glob, LS, GetFileDiff, Git - For validating review reports
- ComputerUse: AskUserQuestion, TodoWrite, Skill, Bash, TerminalControl, ControlHub, ComputerUse - For desktop automation`,

  parameters: {
    type: 'object',
    properties: {
      subagent_type: {
        type: 'string',
        enum: [
          'FileFinder',
          'Explore',
          'ReviewFixer',
          'ReviewFrontend',
          'ReviewSecurity',
          'ReviewArchitecture',
          'ReviewPerformance',
          'ReviewBusinessLogic',
          'ReviewJudge',
          'ComputerUse',
        ],
        description: 'The type of specialized agent to use',
      },
      description: {
        type: 'string',
        description: 'A short (3-5 word) description of what the agent will do',
      },
      prompt: {
        type: 'string',
        description: 'The detailed task prompt for the agent to perform',
      },
      workspace_path: {
        type: 'string',
        description: 'The absolute path of the workspace for this task (optional)',
      },
      model_id: {
        type: 'string',
        description: 'Optional model ID or model slot alias for this subagent task',
      },
      timeout_seconds: {
        type: 'number',
        description: 'Optional timeout in seconds (0 to disable, default 120)',
      },
    },
    required: ['subagent_type', 'description', 'prompt'],
  },
}

// ==================== 便捷函数 ====================

let globalScheduler: TaskScheduler | null = null

/**
 * 初始化全局Task调度器
 */
export function initializeTaskScheduler(config: TaskSchedulerConfig): TaskScheduler {
  globalScheduler = new TaskScheduler(config)
  return globalScheduler
}

/**
 * 获取全局Task调度器
 */
export function getTaskScheduler(): TaskScheduler | null {
  return globalScheduler
}

/**
 * 执行Task（便捷函数）
 */
export async function executeTask(params: TaskToolParams): Promise<TaskToolResult> {
  if (!globalScheduler) {
    throw new Error('TaskScheduler not initialized. Call initializeTaskScheduler first.')
  }
  return globalScheduler.executeTask(params)
}

/**
 * 并行执行Tasks（便捷函数）
 */
export async function executeTasksParallel(params: ParallelTaskParams): Promise<ParallelTaskResult> {
  if (!globalScheduler) {
    throw new Error('TaskScheduler not initialized. Call initializeTaskScheduler first.')
  }
  return globalScheduler.executeParallel(params)
}
