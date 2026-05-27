/**
 * Base Subagent - Subagent基类
 *
 * 所有Subagent的抽象基类，提供：
 * - 工具访问控制
 * - 生命周期管理
 * - 事件发射
 * - 结果收集
 */

import type {
  SubagentType,
  SubagentConfig,
  SubagentResult,
  SubagentEvent,
  ToolName,
  ToolCallRecord,
} from './types'
import { SUBAGENT_TOOLS, SUBAGENT_DESCRIPTIONS } from './types'

/**
 * 工具执行器接口
 *
 * Subagent通过此接口调用工具，具体实现由外部注入。
 */
export interface ToolExecutor {
  /** 执行工具调用 */
  execute(tool: ToolName, args: Record<string, unknown>): Promise<unknown>
  /** 检查工具是否可用 */
  isAvailable(tool: ToolName): boolean
}

/**
 * Subagent执行上下文
 */
export interface SubagentContext {
  /** 工作区路径 */
  workspacePath: string
  /** 工具执行器 */
  toolExecutor: ToolExecutor
  /** 发送事件回调 */
  emitEvent: (event: SubagentEvent) => void
  /** 检查是否应该中断 */
  shouldAbort: () => boolean
  /** 获取当前迭代次数 */
  getIteration: () => number
  /** 增加迭代计数 */
  incrementIteration: () => void
}

/**
 * Subagent抽象基类
 *
 * 所有Subagent实现必须继承此类。
 */
export abstract class BaseSubagent {
  /** Subagent类型 */
  readonly type: SubagentType
  /** 配置 */
  protected config: SubagentConfig
  /** 可用工具 */
  readonly tools: ToolName[]
  /** 描述 */
  readonly description: string
  /** 执行上下文 */
  protected context: SubagentContext | null = null
  /** 工具调用记录 */
  protected toolCallRecords: ToolCallRecord[] = []
  /** 事件记录 */
  protected events: SubagentEvent[] = []
  /** 开始时间 */
  protected startTime: number = 0

  constructor(type: SubagentType, config?: Partial<SubagentConfig>) {
    this.type = type
    this.tools = SUBAGENT_TOOLS[type]
    this.description = SUBAGENT_DESCRIPTIONS[type]
    this.config = {
      type,
      tools: this.tools,
      maxIterations: config?.maxIterations ?? 50,
      timeoutMs: config?.timeoutMs ?? 120000, // 默认2分钟
      workspacePath: config?.workspacePath,
      modelId: config?.modelId,
      ...config,
    }
  }

  /**
   * 执行任务 - 主入口
   */
  async execute(prompt: string, context: SubagentContext): Promise<SubagentResult> {
    this.context = context
    this.toolCallRecords = []
    this.events = []
    this.startTime = Date.now()

    // 发送开始事件
    this.emitEvent({
      type: 'progress',
      data: { message: `Starting ${this.type} subagent` },
      timestamp: Date.now(),
    })

    try {
      // 调用子类实现的具体执行逻辑
      const content = await this.run(prompt)

      const duration = Date.now() - this.startTime

      return {
        success: true,
        content,
        events: this.events,
        duration,
        toolCalls: this.toolCallRecords,
      }
    } catch (error) {
      const duration = Date.now() - this.startTime

      this.emitEvent({
        type: 'error',
        data: { error: error instanceof Error ? error.message : String(error) },
        timestamp: Date.now(),
      })

      return {
        success: false,
        content: '',
        events: this.events,
        error: error instanceof Error ? error.message : String(error),
        duration,
        toolCalls: this.toolCallRecords,
      }
    }
  }

  /**
   * 子类实现的执行逻辑
   *
   * @param prompt 任务提示
   * @returns 执行结果内容
   */
  protected abstract run(prompt: string): Promise<string>

  /**
   * 调用工具
   */
  protected async callTool<T = unknown>(tool: ToolName, args: Record<string, unknown>): Promise<T> {
    if (!this.context) {
      throw new Error('Subagent context not initialized')
    }

    // 检查工具是否允许
    if (!this.tools.includes(tool)) {
      throw new Error(`Tool ${tool} is not available for ${this.type} subagent`)
    }

    // 检查是否应该中断
    if (this.context.shouldAbort()) {
      throw new Error('Subagent execution aborted')
    }

    const timestamp = Date.now()

    this.emitEvent({
      type: 'tool_call',
      data: { tool, args },
      timestamp,
    })

    try {
      const result = await this.context.toolExecutor.execute(tool, args) as T

      // 记录成功的工具调用
      this.toolCallRecords.push({
        tool,
        args,
        result,
        success: true,
        timestamp,
      })

      return result
    } catch (error) {
      // 记录失败的工具调用
      this.toolCallRecords.push({
        tool,
        args,
        result: null,
        success: false,
        timestamp,
      })

      throw error
    }
  }

  /**
   * 发送事件
   */
  protected emitEvent(event: SubagentEvent): void {
    this.events.push(event)
    this.context?.emitEvent(event)
  }

  /**
   * 发送进度消息
   */
  protected reportProgress(message: string): void {
    this.emitEvent({
      type: 'progress',
      data: { message },
      timestamp: Date.now(),
    })
  }

  /**
   * 检查迭代限制
   */
  protected checkIterationLimit(): boolean {
    if (!this.context) return false
    const iteration = this.context.getIteration()
    return iteration >= (this.config.maxIterations ?? 50)
  }

  /**
   * 增加迭代计数
   */
  protected nextIteration(): void {
    this.context?.incrementIteration()
  }

  /**
   * 获取工作区路径
   */
  protected getWorkspacePath(): string {
    // 优先使用上下文或配置中的路径
    const path = this.context?.workspacePath ?? this.config.workspacePath
    if (path) return path

    // 浏览器环境默认返回根路径标识
    return '/'
  }

  /**
   * 检查是否只读
   */
  isReadonly(): boolean {
    // 如果工具列表中包含修改类工具，则不是只读
    const writeTools: ToolName[] = ['Edit', 'Write', 'Delete', 'Bash']
    return !this.tools.some((t) => writeTools.includes(t))
  }

  /**
   * 获取配置
   */
  getConfig(): SubagentConfig {
    return { ...this.config }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<SubagentConfig>): void {
    this.config = { ...this.config, ...config }
  }
}

/**
 * 创建Subagent上下文的工厂函数
 */
export function createSubagentContext(
  workspacePath: string,
  toolExecutor: ToolExecutor,
  emitEvent: (event: SubagentEvent) => void,
  shouldAbort: () => boolean
): SubagentContext {
  let iteration = 0

  return {
    workspacePath,
    toolExecutor,
    emitEvent,
    shouldAbort,
    getIteration: () => iteration,
    incrementIteration: () => {
      iteration++
    },
  }
}
