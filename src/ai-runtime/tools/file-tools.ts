/**
 * 内置工具实现 - 文件操作工具
 *
 * 提供基础的文件读写、搜索等工具。
 */

import type {
  Tool,
  ToolDefinition,
  ToolExecutionContext,
  ToolResult,
} from '../tool'
import { createToolDefinition, createToolResult, BUILTIN_TOOL_IDS } from '../tool'
import { getToolRegistry } from '../tool-registry'

function normalizePathForBoundary(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '').toLowerCase()
}

function hasParentTraversal(path: string): boolean {
  const normalized = normalizePathForBoundary(path)
  return normalized === '..' || normalized.startsWith('../') || normalized.includes('/../') || normalized.endsWith('/..')
}

function resolveWorkspacePath(path: string, workspaceDir: string): string | null {
  if (!workspaceDir.trim() || hasParentTraversal(path)) {
    return null
  }

  const normalizedWorkspace = normalizePathForBoundary(workspaceDir)
  const normalizedPath = normalizePathForBoundary(path)
  const absolutePath = normalizedPath.startsWith(normalizedWorkspace)
    ? normalizedPath
    : normalizePathForBoundary(`${workspaceDir}/${path}`)

  if (hasParentTraversal(absolutePath)) {
    return null
  }

  if (absolutePath === normalizedWorkspace || absolutePath.startsWith(`${normalizedWorkspace}/`)) {
    return path
  }

  return null
}

function validateWorkspacePath(path: string, context: ToolExecutionContext): { valid: boolean; error?: string } {
  if (!context.workspaceDir || typeof context.workspaceDir !== 'string') {
    return { valid: false, error: 'workspaceDir is required for file tools' }
  }

  if (!resolveWorkspacePath(path, context.workspaceDir)) {
    return { valid: false, error: `Path is outside workspace: ${path}` }
  }

  return { valid: true }
}

/**
 * 文件读取工具
 */
const fileReadDefinition: ToolDefinition = createToolDefinition({
  id: BUILTIN_TOOL_IDS.FILE_READ,
  name: 'Read File',
  description: 'Read the contents of a file from the filesystem',
  category: 'file',
  parameters: [
    {
      name: 'path',
      type: 'string',
      required: true,
      description: 'The absolute path to the file to read',
    },
    {
      name: 'start_line',
      type: 'number',
      required: false,
      description: 'Starting line number (optional)',
    },
    {
      name: 'limit',
      type: 'number',
      required: false,
      description: 'Maximum number of lines to read (optional)',
    },
  ],
  requiresConfirmation: false,
  hasSideEffects: false,
  isBuiltin: true,
  dangerLevel: 'safe',
  icon: 'file-text',
  tags: ['file', 'read'],
})

export const fileReadTool: Tool = {
  definition: fileReadDefinition,

  async execute(
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const startTime = Date.now()
    const path = args.path as string
    const startLine = args.start_line as number | undefined
    const limit = args.limit as number | undefined
    const pathValidation = validateWorkspacePath(path, context)

    if (!pathValidation.valid) {
      return createToolResult({
        success: false,
        error: pathValidation.error,
        errorCode: 'PATH_OUTSIDE_WORKSPACE',
        duration: Date.now() - startTime,
      })
    }

    try {
      // 通过 Tauri 命令读取文件
      const { invoke } = await import('@tauri-apps/api/core')
      const content = await invoke<string>('read_file', {
        workspaceDir: context.workspaceDir,
        path,
        startLine: startLine ?? null,
        limit: limit ?? null,
      })

      return createToolResult({
        success: true,
        output: content,
        duration: Date.now() - startTime,
      })
    } catch (error) {
      return createToolResult({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorCode: 'READ_ERROR',
        duration: Date.now() - startTime,
      })
    }
  },

  validateArgs(args: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    const errors: string[] = []

    if (!args.path || typeof args.path !== 'string') {
      errors.push('path is required and must be a string')
    }

    if (args.start_line !== undefined && typeof args.start_line !== 'number') {
      errors.push('start_line must be a number')
    }

    if (args.limit !== undefined && typeof args.limit !== 'number') {
      errors.push('limit must be a number')
    }

    return { valid: errors.length === 0, errors }
  },
}

/**
 * 文件写入工具
 */
const fileWriteDefinition: ToolDefinition = createToolDefinition({
  id: BUILTIN_TOOL_IDS.FILE_WRITE,
  name: 'Write File',
  description: 'Write content to a file, creating or overwriting as needed',
  category: 'file',
  parameters: [
    {
      name: 'path',
      type: 'string',
      required: true,
      description: 'The absolute path to the file to write',
    },
    {
      name: 'content',
      type: 'string',
      required: true,
      description: 'The content to write to the file',
    },
  ],
  requiresConfirmation: true,
  hasSideEffects: true,
  isBuiltin: true,
  dangerLevel: 'medium',
  icon: 'file-plus',
  tags: ['file', 'write'],
})

export const fileWriteTool: Tool = {
  definition: fileWriteDefinition,

  async execute(
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const startTime = Date.now()
    const path = args.path as string
    const content = args.content as string
    const pathValidation = validateWorkspacePath(path, context)

    if (!pathValidation.valid) {
      return createToolResult({
        success: false,
        error: pathValidation.error,
        errorCode: 'PATH_OUTSIDE_WORKSPACE',
        duration: Date.now() - startTime,
      })
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('write_file', {
        workspaceDir: context.workspaceDir,
        path,
        content,
      })

      return createToolResult({
        success: true,
        output: { path, size: content.length },
        duration: Date.now() - startTime,
        modifiedFiles: [path],
        sideEffects: [`Created/modified file: ${path}`],
      })
    } catch (error) {
      return createToolResult({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorCode: 'WRITE_ERROR',
        duration: Date.now() - startTime,
      })
    }
  },

  validateArgs(args: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    const errors: string[] = []

    if (!args.path || typeof args.path !== 'string') {
      errors.push('path is required and must be a string')
    }

    if (args.content === undefined || typeof args.content !== 'string') {
      errors.push('content is required and must be a string')
    }

    return { valid: errors.length === 0, errors }
  },

  getConfirmationMessage(args: Record<string, unknown>): string {
    return `Do you want to write to file "${args.path}"? This will create or overwrite the file.`
  },
}

/**
 * 文件列表工具
 */
const fileListDefinition: ToolDefinition = createToolDefinition({
  id: BUILTIN_TOOL_IDS.FILE_LIST,
  name: 'List Files',
  description: 'List files and directories in a given path',
  category: 'file',
  parameters: [
    {
      name: 'path',
      type: 'string',
      required: true,
      description: 'The directory path to list',
    },
    {
      name: 'pattern',
      type: 'string',
      required: false,
      description: 'Glob pattern to filter files (optional)',
    },
  ],
  requiresConfirmation: false,
  hasSideEffects: false,
  isBuiltin: true,
  dangerLevel: 'safe',
  icon: 'folder-open',
  tags: ['file', 'list'],
})

export const fileListTool: Tool = {
  definition: fileListDefinition,

  async execute(
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const startTime = Date.now()
    const path = args.path as string
    const pattern = args.pattern as string | undefined
    const pathValidation = validateWorkspacePath(path, context)

    if (!pathValidation.valid) {
      return createToolResult({
        success: false,
        error: pathValidation.error,
        errorCode: 'PATH_OUTSIDE_WORKSPACE',
        duration: Date.now() - startTime,
      })
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const entries = await invoke<Array<{ name: string; path: string; isDir: boolean; size?: number }>>(
        'list_directory',
        { workspaceDir: context.workspaceDir, path }
      )

      const filteredEntries = pattern
        ? entries.filter((entry) => entry.name.includes(pattern))
        : entries

      return createToolResult({
        success: true,
        output: filteredEntries,
        duration: Date.now() - startTime,
      })
    } catch (error) {
      return createToolResult({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorCode: 'LIST_ERROR',
        duration: Date.now() - startTime,
      })
    }
  },

  validateArgs(args: Record<string, unknown>): { valid: boolean; errors?: string[] } {
    if (!args.path || typeof args.path !== 'string') {
      return { valid: false, errors: ['path is required and must be a string'] }
    }
    return { valid: true }
  },
}

/**
 * 文件搜索工具
 */
const fileSearchDefinition: ToolDefinition = createToolDefinition({
  id: BUILTIN_TOOL_IDS.FILE_SEARCH,
  name: 'Search Files',
  description: 'Search for files matching a pattern in a directory tree',
  category: 'file',
  parameters: [
    {
      name: 'path',
      type: 'string',
      required: true,
      description: 'The root directory to search in',
    },
    {
      name: 'pattern',
      type: 'string',
      required: true,
      description: 'Glob pattern to match files',
    },
  ],
  requiresConfirmation: false,
  hasSideEffects: false,
  isBuiltin: true,
  dangerLevel: 'safe',
  icon: 'search',
  tags: ['file', 'search'],
})

export const fileSearchTool: Tool = {
  definition: fileSearchDefinition,

  async execute(
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ): Promise<ToolResult> {
    const startTime = Date.now()
    const path = args.path as string
    const pattern = args.pattern as string
    const pathValidation = validateWorkspacePath(path, context)

    if (!pathValidation.valid) {
      return createToolResult({
        success: false,
        error: pathValidation.error,
        errorCode: 'PATH_OUTSIDE_WORKSPACE',
        duration: Date.now() - startTime,
      })
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const results = await invoke<Array<{ path: string; line: number; preview: string }>>(
        'search_file_contents',
        { workspaceDir: context.workspaceDir, path, pattern }
      )

      return createToolResult({
        success: true,
        output: results,
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

    if (!args.path || typeof args.path !== 'string') {
      errors.push('path is required and must be a string')
    }

    if (!args.pattern || typeof args.pattern !== 'string') {
      errors.push('pattern is required and must be a string')
    }

    return { valid: errors.length === 0, errors }
  },
}

/**
 * 所有文件操作工具
 */
export const fileTools: Tool[] = [
  fileReadTool,
  fileWriteTool,
  fileListTool,
  fileSearchTool,
]

/**
 * 注册文件工具到注册表
 */
export function registerFileTools(): void {
  const registry = getToolRegistry()
  registry.registerBatch(fileTools)
}
