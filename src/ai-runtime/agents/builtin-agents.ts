/**
 * 内置 Agent 角色实现
 *
 * 提供系统内置的 Agent 角色：Code、Review、Cowork、Assistant、Computer
 */

import type {
  AgentRole,
  AgentRoleConfig,
} from '../agent-role'
import {
  createAgentCapabilities,
  createAgentRoleConfig,
  ROLE_CAPABILITY_TEMPLATES,
} from '../agent-role'
import type { AITask } from '../task'
import { BUILTIN_TOOL_IDS } from '../tool'
import { getAgentRoleRegistry } from '../agent-role-registry'

const IMPLEMENTED_FILE_TOOLS = [
  BUILTIN_TOOL_IDS.FILE_READ,
  BUILTIN_TOOL_IDS.FILE_WRITE,
  BUILTIN_TOOL_IDS.FILE_LIST,
  BUILTIN_TOOL_IDS.FILE_SEARCH,
]

const IMPLEMENTED_GIT_TOOLS = [
  BUILTIN_TOOL_IDS.GIT_STATUS,
  BUILTIN_TOOL_IDS.GIT_DIFF,
  BUILTIN_TOOL_IDS.GIT_LOG,
]

const IMPLEMENTED_SEARCH_TOOLS = [
  BUILTIN_TOOL_IDS.SEARCH_CODE,
  BUILTIN_TOOL_IDS.SEARCH_SYMBOL,
]

const CODE_AGENT_TOOLS = [
  ...IMPLEMENTED_FILE_TOOLS,
  ...IMPLEMENTED_GIT_TOOLS,
  ...IMPLEMENTED_SEARCH_TOOLS,
]

const REVIEW_AGENT_TOOLS = [
  BUILTIN_TOOL_IDS.FILE_READ,
  BUILTIN_TOOL_IDS.FILE_LIST,
  BUILTIN_TOOL_IDS.FILE_SEARCH,
  ...IMPLEMENTED_GIT_TOOLS,
  ...IMPLEMENTED_SEARCH_TOOLS,
]

const COWORK_AGENT_TOOLS = [
  ...IMPLEMENTED_FILE_TOOLS,
  ...IMPLEMENTED_SEARCH_TOOLS,
]

const COMPUTER_AGENT_TOOLS = [
  ...IMPLEMENTED_FILE_TOOLS,
]

/**
 * Code Agent - 代码编写、重构、修复
 */
const codeAgentConfig: AgentRoleConfig = createAgentRoleConfig({
  id: 'builtin.code',
  type: 'code',
  name: 'Code Agent',
  description: '专业的代码编写助手，擅长编码、重构、调试和代码优化',
  icon: 'code',
  capabilities: ROLE_CAPABILITY_TEMPLATES.code,
  systemPrompt: `你是一个专业的代码编写助手。你的职责是：

1. 编写高质量、可维护的代码
2. 进行代码重构和优化
3. 修复 bug 和调试问题
4. 添加测试和文档
5. 遵循项目代码规范

工作原则：
- 始终编写清晰、可读的代码
- 考虑边界情况和错误处理
- 遵循项目的编码约定
- 在修改前理解现有代码
- 提供清晰的变更说明`,
  allowedTools: CODE_AGENT_TOOLS,
  defaultTaskKind: 'refactor',
  maxTurns: 50,
  priority: 100,
})

export const codeAgent: AgentRole = {
  config: codeAgentConfig,

  async isAvailable(): Promise<boolean> {
    return true
  },

  getCapabilities() {
    return this.config.capabilities
  },

  getSystemPrompt(): string {
    return this.config.systemPrompt
  },

  validateTask(task: AITask): { valid: boolean; reason?: string } {
    const supportedKinds = ['chat', 'refactor', 'analyze', 'generate']
    if (!supportedKinds.includes(task.kind)) {
      return {
        valid: false,
        reason: `Code Agent 不支持任务类型: ${task.kind}`,
      }
    }
    return { valid: true }
  },

  prepareTask(task: AITask): Promise<AITask> {
    // 注入代码相关的上下文
    return Promise.resolve({
      ...task,
      input: {
        ...task.input,
        extra: {
          ...task.input.extra,
          roleContext: {
            type: 'code',
            focusAreas: ['implementation', 'refactoring', 'debugging'],
          },
        },
      },
    })
  },
}

/**
 * Review Agent - 代码审查、架构分析
 */
const reviewAgentConfig: AgentRoleConfig = createAgentRoleConfig({
  id: 'builtin.review',
  type: 'review',
  name: 'Review Agent',
  description: '专业的代码审查助手，擅长代码审查、架构分析和最佳实践建议',
  icon: 'git-pull-request',
  capabilities: ROLE_CAPABILITY_TEMPLATES.review,
  systemPrompt: `你是一个专业的代码审查助手。你的职责是：

1. 进行全面的代码审查
2. 识别潜在问题和风险
3. 提出架构改进建议
4. 检查代码质量和最佳实践
5. 评估性能和安全性

审查原则：
- 关注代码质量、可维护性、安全性
- 提供具体、可操作的改进建议
- 考虑项目上下文和约束
- 平衡理想方案和实际情况
- 区分必须修复和可选改进`,
  allowedTools: REVIEW_AGENT_TOOLS,
  defaultTaskKind: 'analyze',
  maxTurns: 30,
  priority: 80,
})

export const reviewAgent: AgentRole = {
  config: reviewAgentConfig,

  async isAvailable(): Promise<boolean> {
    return true
  },

  getCapabilities() {
    return this.config.capabilities
  },

  getSystemPrompt(): string {
    return this.config.systemPrompt
  },

  validateTask(task: AITask): { valid: boolean; reason?: string } {
    const supportedKinds = ['chat', 'analyze']
    if (!supportedKinds.includes(task.kind)) {
      return {
        valid: false,
        reason: `Review Agent 不支持任务类型: ${task.kind}`,
      }
    }
    return { valid: true }
  },

  prepareTask(task: AITask): Promise<AITask> {
    return Promise.resolve({
      ...task,
      input: {
        ...task.input,
        extra: {
          ...task.input.extra,
          roleContext: {
            type: 'review',
            focusAreas: ['quality', 'security', 'performance', 'maintainability'],
          },
        },
      },
    })
  },
}

/**
 * Cowork Agent - 协作、文档、知识管理
 */
const coworkAgentConfig: AgentRoleConfig = createAgentRoleConfig({
  id: 'builtin.cowork',
  type: 'cowork',
  name: 'Cowork Agent',
  description: '协作助手，擅长文档编写、知识管理和团队协作任务',
  icon: 'users',
  capabilities: ROLE_CAPABILITY_TEMPLATES.cowork,
  systemPrompt: `你是一个协作助手。你的职责是：

1. 编写和维护文档
2. 整理项目知识
3. 协助会议和沟通
4. 管理任务和计划
5. 促进团队协作

工作原则：
- 清晰、准确、有条理
- 考虑受众和场景
- 保持信息更新
- 促进知识共享
- 支持团队效率`,
  allowedTools: COWORK_AGENT_TOOLS,
  defaultTaskKind: 'chat',
  maxTurns: 40,
  priority: 60,
})

export const coworkAgent: AgentRole = {
  config: coworkAgentConfig,

  async isAvailable(): Promise<boolean> {
    return true
  },

  getCapabilities() {
    return this.config.capabilities
  },

  getSystemPrompt(): string {
    return this.config.systemPrompt
  },

  validateTask(_task: AITask): { valid: boolean; reason?: string } {
    return { valid: true } // Cowork Agent 支持所有任务类型
  },
}

/**
 * Assistant Agent - 个人助手
 */
const assistantAgentConfig: AgentRoleConfig = createAgentRoleConfig({
  id: 'builtin.assistant',
  type: 'assistant',
  name: 'Personal Assistant',
  description: '个人助手，处理日常任务、回答问题、提供建议',
  icon: 'bot',
  capabilities: ROLE_CAPABILITY_TEMPLATES.assistant,
  systemPrompt: `你是一个个人助手。你的职责是：

1. 回答问题和提供信息
2. 帮助规划和组织
3. 提供决策建议
4. 记住重要信息
5. 协助日常任务

工作原则：
- 友好、专业、高效
- 理解用户意图
- 提供有价值的帮助
- 主动但不过度
- 尊重用户隐私`,
  allowedTools: [],
  defaultTaskKind: 'chat',
  maxTurns: 100,
  priority: 50,
})

export const assistantAgent: AgentRole = {
  config: assistantAgentConfig,

  async isAvailable(): Promise<boolean> {
    return true
  },

  getCapabilities() {
    return this.config.capabilities
  },

  getSystemPrompt(): string {
    return this.config.systemPrompt
  },

  validateTask(_task: AITask): { valid: boolean; reason?: string } {
    return { valid: true }
  },
}

/**
 * Computer Agent - 电脑控制
 */
const computerAgentConfig: AgentRoleConfig = createAgentRoleConfig({
  id: 'builtin.computer',
  type: 'computer',
  name: 'Computer Control Agent',
  description: '电脑控制助手，可以操作桌面、浏览器和执行系统任务',
  icon: 'monitor',
  capabilities: createAgentCapabilities({
    fileOperations: true,
    projectContext: true,
  }),
  systemPrompt: `你是一个电脑控制助手。你的职责是：

1. 操作桌面应用程序
2. 控制浏览器进行网页操作
3. 执行系统命令
4. 自动化重复任务
5. 与操作系统交互

安全原则：
- 始终确认危险操作
- 不执行恶意代码
- 保护用户隐私
- 遵守系统权限
- 提供操作预览`,
  allowedTools: COMPUTER_AGENT_TOOLS,
  deniedTools: [], // 不额外禁止任何工具
  defaultTaskKind: 'chat',
  maxTurns: 50,
  priority: 70,
})

export const computerAgent: AgentRole = {
  config: computerAgentConfig,

  async isAvailable(): Promise<boolean> {
    // 检查是否有桌面控制能力
    return true
  },

  getCapabilities() {
    return this.config.capabilities
  },

  getSystemPrompt(): string {
    return this.config.systemPrompt
  },

  validateTask(_task: AITask): { valid: boolean; reason?: string } {
    return { valid: true }
  },
}

/**
 * 所有内置 Agent 角色
 */
export const builtinAgents: AgentRole[] = [
  codeAgent,
  reviewAgent,
  coworkAgent,
  assistantAgent,
  computerAgent,
]

/**
 * 注册内置 Agent 角色到注册表
 */
export function registerBuiltinAgents(): void {
  const registry = getAgentRoleRegistry()
  registry.registerBatch(builtinAgents)
}
