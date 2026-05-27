/**
 * 工具/技能系统 - 核心类型定义
 *
 * 定义了工具的标准接口和技能注册机制。
 * 工具是 Agent 可以调用的原子能力，技能是工具的有序组合。
 */

/**
 * 工具类别
 */
export type ToolCategory =
  | 'file'          // 文件操作
  | 'shell'         // Shell 命令
  | 'git'           // Git 操作
  | 'search'        // 搜索
  | 'browser'       // 浏览器控制
  | 'desktop'       // 桌面控制
  | 'memory'        // 记忆系统
  | 'network'       // 网络请求
  | 'code'          // 代码执行
  | 'mcp'           // MCP 工具
  | 'builtin'       // 内置工具
  | 'custom'        // 自定义工具

/**
 * 工具参数定义
 */
export interface ToolParameterSchema {
  /** 参数名 */
  name: string
  /** 参数类型 */
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  /** 是否必需 */
  required: boolean
  /** 描述 */
  description?: string
  /** 默认值 */
  default?: unknown
  /** 枚举值 */
  enum?: unknown[]
  /** 嵌套属性（type 为 object 时） */
  properties?: Record<string, ToolParameterSchema>
  /** 数组元素类型（type 为 array 时） */
  items?: ToolParameterSchema
}

/**
 * 工具执行上下文
 */
export interface ToolExecutionContext {
  /** 工作区目录 */
  workspaceDir: string
  /** 当前文件路径（可选） */
  currentFile?: string
  /** 会话 ID */
  sessionId: string
  /** 任务 ID */
  taskId: string
  /** 角色 ID */
  roleId: string
  /** 权限级别 */
  permissionLevel: 'read' | 'write' | 'execute' | 'admin'
  /** 环境变量 */
  env?: Record<string, string>
  /** 超时时间（毫秒） */
  timeout?: number
}

/**
 * 工具执行结果
 */
export interface ToolResult {
  /** 是否成功 */
  success: boolean
  /** 输出内容 */
  output?: unknown
  /** 错误信息 */
  error?: string
  /** 错误码 */
  errorCode?: string
  /** 执行时间（毫秒） */
  duration: number
  /** 是否需要用户确认 */
  requiresConfirmation?: boolean
  /** 确认消息 */
  confirmationMessage?: string
  /** 副作用描述 */
  sideEffects?: string[]
  /** 生成的文件路径 */
  createdFiles?: string[]
  /** 修改的文件路径 */
  modifiedFiles?: string[]
  /** 删除的文件路径 */
  deletedFiles?: string[]
}

/**
 * 工具定义
 */
export interface ToolDefinition {
  /** 工具唯一标识 */
  id: string
  /** 工具名称 */
  name: string
  /** 工具描述 */
  description: string
  /** 工具类别 */
  category: ToolCategory
  /** 参数定义 */
  parameters: ToolParameterSchema[]
  /** 是否需要确认 */
  requiresConfirmation: boolean
  /** 是否有副作用 */
  hasSideEffects: boolean
  /** 是否为内置工具 */
  isBuiltin: boolean
  /** 危险级别 */
  dangerLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical'
  /** 标签 */
  tags?: string[]
  /** 图标 */
  icon?: string
  /** 示例用法 */
  examples?: {
    description: string
    args: Record<string, unknown>
  }[]
  /** 元数据 */
  metadata?: Record<string, unknown>
}

/**
 * 工具接口
 */
export interface Tool {
  /** 工具定义 */
  readonly definition: ToolDefinition
  /**
   * 执行工具
   * @param args 参数
   * @param context 执行上下文
   * @returns 执行结果
   */
  execute(args: Record<string, unknown>, context: ToolExecutionContext): Promise<ToolResult>
  /**
   * 验证参数
   * @param args 参数
   * @returns 验证结果
   */
  validateArgs(args: Record<string, unknown>): { valid: boolean; errors?: string[] }
  /**
   * 检查是否可用
   * @param context 执行上下文
   * @returns 是否可用
   */
  isAvailable?(context: ToolExecutionContext): Promise<boolean>
  /**
   * 获取确认消息
   * @param args 参数
   * @param context 执行上下文
   * @returns 确认消息
   */
  getConfirmationMessage?(args: Record<string, unknown>, context: ToolExecutionContext): string
}

/**
 * 工具调用记录
 */
export interface ToolCallRecord {
  /** 调用 ID */
  id: string
  /** 工具 ID */
  toolId: string
  /** 工具名称 */
  toolName: string
  /** 参数 */
  args: Record<string, unknown>
  /** 执行上下文 */
  context: ToolExecutionContext
  /** 开始时间 */
  startTime: number
  /** 结束时间 */
  endTime?: number
  /** 状态 */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'aborted' | 'waiting_confirmation'
  /** 结果 */
  result?: ToolResult
  /** 用户确认响应 */
  confirmationResponse?: 'approved' | 'denied'
}

/**
 * 技能定义
 *
 * 技能是一组工具的有序组合，代表一个完整的任务流程
 */
export interface SkillDefinition {
  /** 技能唯一标识 */
  id: string
  /** 技能名称 */
  name: string
  /** 技能描述 */
  description: string
  /** 技能类别 */
  category: string
  /** 所需工具列表 */
  requiredTools: string[]
  /** 执行步骤 */
  steps: SkillStep[]
  /** 输入参数定义 */
  inputSchema?: ToolParameterSchema[]
  /** 输出定义 */
  outputSchema?: ToolParameterSchema
  /** 适用角色 */
  applicableRoles?: string[]
  /** 标签 */
  tags?: string[]
  /** 图标 */
  icon?: string
  /** 是否启用 */
  enabled: boolean
}

/**
 * 技能步骤
 */
export interface SkillStep {
  /** 步骤 ID */
  id: string
  /** 步骤名称 */
  name: string
  /** 要调用的工具 ID */
  toolId: string
  /** 参数映射（从技能输入或前序步骤输出获取） */
  argsMapping: Record<string, string | ((context: SkillStepContext) => unknown)>
  /** 条件（决定是否执行此步骤） */
  condition?: string | ((context: SkillStepContext) => boolean)
  /** 错误处理策略 */
  onError?: 'continue' | 'abort' | 'retry' | 'skip'
  /** 重试次数 */
  retryCount?: number
  /** 超时时间（毫秒） */
  timeout?: number
}

/**
 * 技能步骤执行上下文
 */
export interface SkillStepContext {
  /** 技能输入 */
  input: Record<string, unknown>
  /** 前序步骤结果 */
  previousResults: Map<string, ToolResult>
  /** 当前步骤索引 */
  currentStepIndex: number
  /** 执行上下文 */
  executionContext: ToolExecutionContext
}

/**
 * 技能执行结果
 */
export interface SkillResult {
  /** 是否成功 */
  success: boolean
  /** 最终输出 */
  output?: unknown
  /** 各步骤结果 */
  stepResults: Map<string, ToolResult>
  /** 错误信息 */
  error?: string
  /** 总执行时间 */
  duration: number
  /** 执行的步骤数 */
  executedSteps: number
}

/**
 * MCP 工具定义
 */
export interface MCPToolDefinition {
  /** MCP 服务器名称 */
  serverName: string
  /** 工具名称（在 MCP 服务器中） */
  toolName: string
  /** 完整工具 ID（serverName/toolName） */
  id: string
  /** 描述 */
  description: string
  /** 参数 Schema（JSON Schema 格式） */
  inputSchema: Record<string, unknown>
}

/**
 * 工具权限配置
 */
export interface ToolPermissionConfig {
  /** 工具 ID */
  toolId: string
  /** 是否允许 */
  allowed: boolean
  /** 权限级别 */
  permissionLevel?: 'read' | 'write' | 'execute' | 'admin'
  /** 需要确认的操作 */
  requireConfirmation?: boolean
  /** 限制条件 */
  constraints?: {
    /** 允许的路径 */
    allowedPaths?: string[]
    /** 禁止的路径 */
    deniedPaths?: string[]
    /** 允许的命令 */
    allowedCommands?: string[]
    /** 禁止的命令 */
    deniedCommands?: string[]
    /** 超时限制 */
    maxTimeout?: number
  }
}

/**
 * 创建工具定义的辅助函数
 */
export function createToolDefinition(
  partial: Partial<ToolDefinition> & { id: string; name: string; category: ToolCategory }
): ToolDefinition {
  return {
    description: '',
    parameters: [],
    requiresConfirmation: false,
    hasSideEffects: false,
    isBuiltin: false,
    dangerLevel: 'safe',
    ...partial,
  }
}

/**
 * 创建工具结果的辅助函数
 */
export function createToolResult(
  partial: Partial<ToolResult> & { success: boolean; duration: number }
): ToolResult {
  return {
    ...partial,
  }
}

/**
 * 内置工具 ID 常量
 */
export const BUILTIN_TOOL_IDS = {
  // 文件操作
  FILE_READ: 'builtin.file.read',
  FILE_WRITE: 'builtin.file.write',
  FILE_DELETE: 'builtin.file.delete',
  FILE_LIST: 'builtin.file.list',
  FILE_SEARCH: 'builtin.file.search',

  // Shell
  SHELL_EXECUTE: 'builtin.shell.execute',

  // Git
  GIT_STATUS: 'builtin.git.status',
  GIT_DIFF: 'builtin.git.diff',
  GIT_COMMIT: 'builtin.git.commit',
  GIT_LOG: 'builtin.git.log',

  // 搜索
  SEARCH_CODE: 'builtin.search.code',
  SEARCH_SYMBOL: 'builtin.search.symbol',

  // 浏览器
  BROWSER_OPEN: 'builtin.browser.open',
  BROWSER_CLICK: 'builtin.browser.click',
  BROWSER_SCREENSHOT: 'builtin.browser.screenshot',

  // 记忆
  MEMORY_STORE: 'builtin.memory.store',
  MEMORY_RETRIEVE: 'builtin.memory.retrieve',
  MEMORY_CLEAR: 'builtin.memory.clear',
} as const
