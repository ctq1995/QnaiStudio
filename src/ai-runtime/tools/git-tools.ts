/**
 * Git 工具集 - 提供给 Agent 使用的版本控制工具
 *
 * 包含：
 * - gitStatusTool - 获取工作区状态
 * - gitDiffTool - 获取差异
 * - gitLogTool - 获取提交历史
 */

import type {
  Tool,
  ToolDefinition,
  ToolExecutionContext,
  ToolResult,
} from '../tool'
import { createToolDefinition, createToolResult, BUILTIN_TOOL_IDS } from '../tool'
import { getToolRegistry } from '../tool-registry'

export const gitStatusDefinition: ToolDefinition = createToolDefinition({
  id: BUILTIN_TOOL_IDS.GIT_STATUS,
  name: 'git_status',
  description: '获取当前工作区的 Git 状态，包括已修改文件、暂存区文件和未跟踪文件',
  category: 'git',
  parameters: [],
  requiresConfirmation: false,
  hasSideEffects: false,
  isBuiltin: true,
  dangerLevel: 'safe',
})

export const gitDiffDefinition: ToolDefinition = createToolDefinition({
  id: BUILTIN_TOOL_IDS.GIT_DIFF,
  name: 'git_diff',
  description: '获取文件的 Git 差异，可以对比工作区、暂存区或提交之间',
  category: 'git',
  parameters: [],
  requiresConfirmation: false,
  hasSideEffects: false,
  isBuiltin: true,
  dangerLevel: 'safe',
})

export const gitLogDefinition: ToolDefinition = createToolDefinition({
  id: BUILTIN_TOOL_IDS.GIT_LOG,
  name: 'git_log',
  description: '获取 Git 提交历史',
  category: 'git',
  parameters: [],
  requiresConfirmation: false,
  hasSideEffects: false,
  isBuiltin: true,
  dangerLevel: 'safe',
})

export const gitStatusTool: Tool = {
  definition: gitStatusDefinition,

  async execute(
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const startTime = Date.now()
    const repoPath = (args.path as string | undefined) || context.workspaceDir

    if (!context.workspaceDir) {
      return createToolResult({
        success: false,
        error: 'workspaceDir is required for git tools',
        errorCode: 'MISSING_WORKSPACE',
        duration: Date.now() - startTime,
      })
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const result = await invoke<string>('git_status', {
        workspaceDir: context.workspaceDir,
        repoPath,
      })

      return createToolResult({
        success: true,
        output: result,
        duration: Date.now() - startTime,
      })
    } catch (error) {
      return createToolResult({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorCode: 'GIT_ERROR',
        duration: Date.now() - startTime,
      })
    }
  },

  validateArgs(args: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    const errors: string[] = []
    if (args.path !== undefined && typeof args.path !== 'string') {
      errors.push('path must be a string if provided')
    }
    return { valid: errors.length === 0, errors }
  },
}

export const gitDiffTool: Tool = {
  definition: gitDiffDefinition,

  async execute(
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const startTime = Date.now()

    if (!context.workspaceDir) {
      return createToolResult({
        success: false,
        error: 'workspaceDir is required for git tools',
        errorCode: 'MISSING_WORKSPACE',
        duration: Date.now() - startTime,
      })
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const result = await invoke<string>('git_diff', {
        workspaceDir: context.workspaceDir,
        path: args.path ?? null,
        staged: args.staged ?? false,
        commitA: args.commitA ?? null,
        commitB: args.commitB ?? null,
      })

      return createToolResult({
        success: true,
        output: result,
        duration: Date.now() - startTime,
      })
    } catch (error) {
      return createToolResult({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorCode: 'GIT_ERROR',
        duration: Date.now() - startTime,
      })
    }
  },

  validateArgs(args: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    const errors: string[] = []

    if (args.path !== undefined && typeof args.path !== 'string') {
      errors.push('path must be a string if provided')
    }
    if (args.staged !== undefined && typeof args.staged !== 'boolean') {
      errors.push('staged must be a boolean if provided')
    }
    if (args.commitA !== undefined && typeof args.commitA !== 'string') {
      errors.push('commitA must be a string if provided')
    }
    if (args.commitB !== undefined && typeof args.commitB !== 'string') {
      errors.push('commitB must be a string if provided')
    }

    return { valid: errors.length === 0, errors }
  },
}

export const gitLogTool: Tool = {
  definition: gitLogDefinition,

  async execute(
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const startTime = Date.now()

    if (!context.workspaceDir) {
      return createToolResult({
        success: false,
        error: 'workspaceDir is required for git tools',
        errorCode: 'MISSING_WORKSPACE',
        duration: Date.now() - startTime,
      })
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const result = await invoke<string>('git_log', {
        workspaceDir: context.workspaceDir,
        path: args.path ?? null,
        maxCount: args.maxCount ?? 20,
        oneline: args.oneline ?? true,
      })

      return createToolResult({
        success: true,
        output: result,
        duration: Date.now() - startTime,
      })
    } catch (error) {
      return createToolResult({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorCode: 'GIT_ERROR',
        duration: Date.now() - startTime,
      })
    }
  },

  validateArgs(args: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    const errors: string[] = []

    if (args.path !== undefined && typeof args.path !== 'string') {
      errors.push('path must be a string if provided')
    }
    if (args.maxCount !== undefined && typeof args.maxCount !== 'number') {
      errors.push('maxCount must be a number if provided')
    }
    if (args.oneline !== undefined && typeof args.oneline !== 'boolean') {
      errors.push('oneline must be a boolean if provided')
    }

    return { valid: errors.length === 0, errors }
  },
}

export const gitTools: Tool[] = [gitStatusTool, gitDiffTool, gitLogTool]

export function registerGitTools(): void {
  const registry = getToolRegistry()
  registry.registerBatch(gitTools)
}
