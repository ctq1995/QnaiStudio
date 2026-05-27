/**
 * 搜索工具集 - 代码和符号搜索
 *
 * 包含：
 * - codeSearchTool - 在代码文件中搜索内容
 * - symbolSearchTool - 搜索符号定义（占位，需要 LSP/tree-sitter 支持）
 */

import type {
  Tool,
  ToolDefinition,
  ToolExecutionContext,
  ToolResult,
} from '../tool'
import { createToolDefinition, createToolResult, BUILTIN_TOOL_IDS } from '../tool'
import { getToolRegistry } from '../tool-registry'

export const codeSearchDefinition: ToolDefinition = createToolDefinition({
  id: BUILTIN_TOOL_IDS.SEARCH_CODE,
  name: 'search_code',
  description: '在工作区代码文件中搜索内容，支持文件扩展名过滤',
  category: 'search',
  parameters: [],
  requiresConfirmation: false,
  hasSideEffects: false,
  isBuiltin: true,
  dangerLevel: 'safe',
})

export const symbolSearchDefinition: ToolDefinition = createToolDefinition({
  id: BUILTIN_TOOL_IDS.SEARCH_SYMBOL,
  name: 'search_symbol',
  description: '搜索符号定义（函数、类、接口等），需要后端支持（当前为占位实现）',
  category: 'search',
  parameters: [],
  requiresConfirmation: false,
  hasSideEffects: false,
  isBuiltin: true,
  dangerLevel: 'safe',
})

export const codeSearchTool: Tool = {
  definition: codeSearchDefinition,

  async execute(
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const startTime = Date.now()
    const query = args.query as string
    const searchPath = (args.path as string | undefined) || context.workspaceDir

    if (!context.workspaceDir) {
      return createToolResult({
        success: false,
        error: 'workspaceDir is required for search tools',
        errorCode: 'MISSING_WORKSPACE',
        duration: Date.now() - startTime,
      })
    }

    if (!query || query.trim().length === 0) {
      return createToolResult({
        success: false,
        error: 'query is required and cannot be empty',
        errorCode: 'INVALID_QUERY',
        duration: Date.now() - startTime,
      })
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const results = await invoke<Array<{ path: string; line: number; preview: string }>>(
        'search_file_contents',
        {
          workspaceDir: context.workspaceDir,
          path: searchPath,
          pattern: query,
        }
      )

      const extensions = args.extensions as string[] | undefined
      const filtered = extensions
        ? results.filter((r) => {
            const ext = r.path.substring(r.path.lastIndexOf('.'))
            return extensions.includes(ext)
          })
        : results

      return createToolResult({
        success: true,
        output: filtered,
        duration: Date.now() - startTime,
      })
    } catch (error) {
      return createToolResult({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorCode: 'SEARCH_ERROR',
        duration: Date.now() - startTime,
      })
    }
  },

  validateArgs(args: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    const errors: string[] = []

    if (typeof args.query !== 'string' || args.query.trim().length === 0) {
      errors.push('query is required and must be a non-empty string')
    }
    if (args.path !== undefined && typeof args.path !== 'string') {
      errors.push('path must be a string if provided')
    }
    if (args.extensions !== undefined && !Array.isArray(args.extensions)) {
      errors.push('extensions must be an array if provided')
    }
    if (args.ignoreCase !== undefined && typeof args.ignoreCase !== 'boolean') {
      errors.push('ignoreCase must be a boolean if provided')
    }

    return { valid: errors.length === 0, errors }
  },
}

export const symbolSearchTool: Tool = {
  definition: symbolSearchDefinition,

  async execute(
    _args: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const startTime = Date.now()

    if (!context.workspaceDir) {
      return createToolResult({
        success: false,
        error: 'workspaceDir is required for search tools',
        errorCode: 'MISSING_WORKSPACE',
        duration: Date.now() - startTime,
      })
    }

    // 占位实现：符号搜索需要 LSP 或 tree-sitter 支持
    // 当前返回提示信息，后续可接入真实符号索引
    return createToolResult({
      success: false,
      error: '符号搜索需要 LSP/tree-sitter 支持，当前为占位实现。请使用 search_code 作为替代。',
      errorCode: 'NOT_IMPLEMENTED',
      duration: Date.now() - startTime,
    })
  },

  validateArgs(_args: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    return { valid: true }
  },
}

export const searchTools: Tool[] = [codeSearchTool, symbolSearchTool]

export function registerSearchTools(): void {
  const registry = getToolRegistry()
  registry.registerBatch(searchTools)
}
