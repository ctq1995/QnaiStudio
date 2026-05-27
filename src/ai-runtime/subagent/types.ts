/**
 * Subagent Types - Subagent类型定义
 *
 * 定义所有可用的Subagent类型及其能力。
 * 参考BitFun的subagent架构实现。
 */

/**
 * Subagent类型枚举
 *
 * 每种类型对应一个专用的subagent实现，具有特定的工具集和职责。
 */
export type SubagentType =
  | 'FileFinder'
  | 'Explore'
  | 'ReviewFixer'
  | 'ReviewFrontend'
  | 'ReviewSecurity'
  | 'ReviewArchitecture'
  | 'ReviewPerformance'
  | 'ReviewBusinessLogic'
  | 'ReviewJudge'
  | 'ComputerUse'

/**
 * 工具名称类型
 */
export type ToolName =
  | 'Read'
  | 'Grep'
  | 'Glob'
  | 'LS'
  | 'GetFileDiff'
  | 'Edit'
  | 'Write'
  | 'Delete'
  | 'Bash'
  | 'TodoWrite'
  | 'Git'
  | 'AskUserQuestion'
  | 'Skill'
  | 'TerminalControl'
  | 'ControlHub'
  | 'ComputerUse'

/**
 * 工具集定义 - 每种Subagent可访问的工具
 */
export const SUBAGENT_TOOLS: Record<SubagentType, ToolName[]> = {
  FileFinder: ['LS', 'Read', 'Grep', 'Glob'],

  Explore: ['Grep', 'Glob', 'Read', 'LS'],

  ReviewFixer: ['Read', 'Grep', 'Glob', 'LS', 'GetFileDiff', 'Edit', 'Write', 'Bash', 'TodoWrite', 'Git'],

  ReviewFrontend: ['Read', 'Grep', 'Glob', 'LS', 'GetFileDiff', 'Git'],

  ReviewSecurity: ['Read', 'Grep', 'Glob', 'LS', 'GetFileDiff', 'Git'],

  ReviewArchitecture: ['Read', 'Grep', 'Glob', 'LS', 'GetFileDiff', 'Git'],

  ReviewPerformance: ['Read', 'Grep', 'Glob', 'LS', 'GetFileDiff', 'Git'],

  ReviewBusinessLogic: ['Read', 'Grep', 'Glob', 'LS', 'GetFileDiff', 'Git'],

  ReviewJudge: ['Read', 'Grep', 'Glob', 'LS', 'GetFileDiff', 'Git'],

  ComputerUse: ['AskUserQuestion', 'TodoWrite', 'Skill', 'Bash', 'TerminalControl', 'ControlHub', 'ComputerUse'],
}

/**
 * Subagent描述信息
 */
export const SUBAGENT_DESCRIPTIONS: Record<SubagentType, string> = {
  FileFinder:
    'Agent specialized for semantically searching and locating relevant files and directories. Output: File paths, line ranges (optional), and brief descriptions.',

  Explore:
    'Read-only subagent for **wide** codebase exploration. Prefer search-first workflows: use Grep and Glob to narrow the space, then Read the small set of relevant files.',

  ReviewFixer:
    'Bounded implementation subagent for deep-review remediation. Use it only after validated review findings exist and you want a minimal safe fix plus a concise verification summary before the next incremental review pass.',

  ReviewFrontend:
    'Independent read-only reviewer focused on frontend-specific issues such as i18n key synchronization, frontend performance patterns (e.g., memoization, virtualization, effect/reactivity dependencies), accessibility, state management, frontend-backend API contract alignment, and platform boundary compliance in the review target.',

  ReviewSecurity:
    'Independent read-only reviewer focused on security risks such as injection, auth gaps, data exposure, unsafe command/file handling, privilege escalation, and trust-boundary mistakes in the review target.',

  ReviewArchitecture:
    'Independent read-only reviewer focused on structural and architectural issues such as module boundary violations, API contract design, abstraction integrity, dependency direction, and cross-cutting concern impact in the review target.',

  ReviewPerformance:
    'Independent read-only reviewer focused on latency, hot-path efficiency, unnecessary allocations, N+1 patterns, blocking calls, over-fetching, and scale-sensitive regressions introduced by the review target.',

  ReviewBusinessLogic:
    'Independent read-only reviewer focused on workflow correctness, business rules, state transitions, data integrity, and edge-case handling in the review target. Use this when you need a fresh perspective on whether the change still does the right thing for real users.',

  ReviewJudge:
    'Independent third-party arbiter that validates reviewer reports for logical consistency and evidence quality. It spot-checks specific code locations only when a claim needs verification, rather than re-reviewing the codebase from scratch.',

  ComputerUse:
    'Dedicated desktop automation agent for perceiving the local environment and operating apps, browsers, and OS UI',
}

/**
 * Subagent配置
 */
export interface SubagentConfig {
  /** Subagent类型 */
  type: SubagentType
  /** 可访问的工具列表 */
  tools: ToolName[]
  /** 最大迭代次数（防止无限循环） */
  maxIterations?: number
  /** 超时时间（毫秒） */
  timeoutMs?: number
  /** 工作区路径 */
  workspacePath?: string
  /** 模型ID（可选，使用特定模型） */
  modelId?: string
}

/**
 * Subagent执行结果
 */
export interface SubagentResult {
  /** 是否成功 */
  success: boolean
  /** 结果内容 */
  content: string
  /** 执行过程中的事件 */
  events?: SubagentEvent[]
  /** 错误信息（失败时） */
  error?: string
  /** 执行耗时（毫秒） */
  duration?: number
  /** 使用的工具调用记录 */
  toolCalls?: ToolCallRecord[]
}

/**
 * 工具调用记录
 */
export interface ToolCallRecord {
  /** 工具名称 */
  tool: ToolName
  /** 调用参数 */
  args: Record<string, unknown>
  /** 返回结果 */
  result: unknown
  /** 是否成功 */
  success: boolean
  /** 执行时间 */
  timestamp: number
}

/**
 * Subagent事件
 */
export interface SubagentEvent {
  /** 事件类型 */
  type: 'tool_call' | 'progress' | 'error' | 'complete'
  /** 事件数据 */
  data: unknown
  /** 时间戳 */
  timestamp: number
}

/**
 * Task工具调用参数
 *
 * 这是主Agent调用Task工具时传递的参数格式。
 */
export interface TaskToolParams {
  /** Subagent类型 */
  subagent_type: SubagentType
  /** 简短描述（3-5词） */
  description: string
  /** 详细任务提示 */
  prompt: string
  /** 工作区路径（可选，默认当前工作区） */
  workspace_path?: string
  /** 模型ID（可选） */
  model_id?: string
  /** 超时时间（秒，0表示禁用） */
  timeout_seconds?: number
}

/**
 * Task工具执行结果
 */
export interface TaskToolResult {
  /** Subagent类型 */
  subagent_type: SubagentType
  /** 描述 */
  description: string
  /** 执行结果 */
  result: SubagentResult
  /** 会话ID */
  session_id: string
}

/**
 * 并行Task执行参数
 */
export interface ParallelTaskParams {
  /** Task参数列表 */
  tasks: TaskToolParams[]
  /** 是否在第一个失败时停止 */
  failFast?: boolean
}

/**
 * 并行Task执行结果
 */
export interface ParallelTaskResult {
  /** 各Task的结果 */
  results: TaskToolResult[]
  /** 成功数量 */
  successCount: number
  /** 失败数量 */
  failureCount: number
  /** 总耗时 */
  duration: number
}

/**
 * Subagent能力描述
 */
export interface SubagentCapability {
  /** 类型 */
  type: SubagentType
  /** 描述 */
  description: string
  /** 可用工具 */
  tools: ToolName[]
  /** 是否只读 */
  readonly: boolean
  /** 使用场景 */
  useCases: string[]
}

/**
 * 所有Subagent的能力描述
 */
export const SUBAGENT_CAPABILITIES: Record<SubagentType, SubagentCapability> = {
  FileFinder: {
    type: 'FileFinder',
    description: SUBAGENT_DESCRIPTIONS.FileFinder,
    tools: SUBAGENT_TOOLS.FileFinder,
    readonly: true,
    useCases: [
      'Find files that implement authentication',
      'Locate files that define the UI layout of the login page',
      'Search for files related to error handling',
    ],
  },

  Explore: {
    type: 'Explore',
    description: SUBAGENT_DESCRIPTIONS.Explore,
    tools: SUBAGENT_TOOLS.Explore,
    readonly: true,
    useCases: [
      'Give me a high-level map of how authentication flows through this monorepo',
      'How is the data layer organized?',
      'Where are the API endpoints defined?',
    ],
  },

  ReviewFixer: {
    type: 'ReviewFixer',
    description: SUBAGENT_DESCRIPTIONS.ReviewFixer,
    tools: SUBAGENT_TOOLS.ReviewFixer,
    readonly: false,
    useCases: [
      'Fix the security vulnerability identified in the review',
      'Implement the suggested refactoring',
      'Apply the performance optimization',
    ],
  },

  ReviewFrontend: {
    type: 'ReviewFrontend',
    description: SUBAGENT_DESCRIPTIONS.ReviewFrontend,
    tools: SUBAGENT_TOOLS.ReviewFrontend,
    readonly: true,
    useCases: [
      'Review React component for proper memoization',
      'Check i18n key synchronization',
      'Verify accessibility compliance',
    ],
  },

  ReviewSecurity: {
    type: 'ReviewSecurity',
    description: SUBAGENT_DESCRIPTIONS.ReviewSecurity,
    tools: SUBAGENT_TOOLS.ReviewSecurity,
    readonly: true,
    useCases: [
      'Check for SQL injection vulnerabilities',
      'Review authentication flow for security gaps',
      'Analyze data exposure risks',
    ],
  },

  ReviewArchitecture: {
    type: 'ReviewArchitecture',
    description: SUBAGENT_DESCRIPTIONS.ReviewArchitecture,
    tools: SUBAGENT_TOOLS.ReviewArchitecture,
    readonly: true,
    useCases: [
      'Review module boundary violations',
      'Analyze API contract design',
      'Check dependency direction correctness',
    ],
  },

  ReviewPerformance: {
    type: 'ReviewPerformance',
    description: SUBAGENT_DESCRIPTIONS.ReviewPerformance,
    tools: SUBAGENT_TOOLS.ReviewPerformance,
    readonly: true,
    useCases: [
      'Identify N+1 query patterns',
      'Find blocking calls in hot paths',
      'Detect memory leak patterns',
    ],
  },

  ReviewBusinessLogic: {
    type: 'ReviewBusinessLogic',
    description: SUBAGENT_DESCRIPTIONS.ReviewBusinessLogic,
    tools: SUBAGENT_TOOLS.ReviewBusinessLogic,
    readonly: true,
    useCases: [
      'Verify workflow correctness',
      'Check state transition logic',
      'Validate edge-case handling',
    ],
  },

  ReviewJudge: {
    type: 'ReviewJudge',
    description: SUBAGENT_DESCRIPTIONS.ReviewJudge,
    tools: SUBAGENT_TOOLS.ReviewJudge,
    readonly: true,
    useCases: [
      'Validate reviewer report consistency',
      'Verify evidence quality in review findings',
      'Spot-check code locations for claim verification',
    ],
  },

  ComputerUse: {
    type: 'ComputerUse',
    description: SUBAGENT_DESCRIPTIONS.ComputerUse,
    tools: SUBAGENT_TOOLS.ComputerUse,
    readonly: false,
    useCases: [
      'Take a screenshot of the desktop',
      'Open a browser and navigate to a URL',
      'Click on a UI element',
    ],
  },
}

/**
 * 判断Subagent是否只读
 */
export function isReadonlySubagent(type: SubagentType): boolean {
  return SUBAGENT_CAPABILITIES[type].readonly
}

/**
 * 获取Subagent可用工具
 */
export function getSubagentTools(type: SubagentType): ToolName[] {
  return SUBAGENT_TOOLS[type]
}
