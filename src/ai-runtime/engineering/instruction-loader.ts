import type { EngineeringInstructions } from './types'

export interface EngineeringInstructionLoaderDeps {
  readTextFile?: (path: string, workspaceDir: string) => Promise<string>
  fileExists?: (path: string, workspaceDir: string) => Promise<boolean>
}

export interface LoadEngineeringInstructionsOptions {
  maxFileBytes?: number
}

const INSTRUCTION_FILES = ['AGENTS.md', 'CLAUDE.md', 'SOUL.md', 'USER.md', 'README.md']
const DEFAULT_MAX_FILE_BYTES = 32 * 1024

export async function loadEngineeringInstructions(
  workspaceDir: string,
  deps: EngineeringInstructionLoaderDeps = {},
  options: LoadEngineeringInstructionsOptions = {}
): Promise<EngineeringInstructions> {
  const maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES
  const files: EngineeringInstructions['files'] = []

  if (!deps.readTextFile) {
    return { files, merged: '' }
  }

  for (const path of INSTRUCTION_FILES) {
    if (deps.fileExists && !(await safeExists(path, workspaceDir, deps))) continue

    try {
      const raw = await deps.readTextFile(path, workspaceDir)
      const truncated = raw.length > maxFileBytes
      const content = truncated ? raw.slice(0, maxFileBytes) : raw
      files.push({ path, content, truncated })
    } catch {
      continue
    }
  }

  return {
    files,
    merged: mergeInstructionFiles(files),
  }
}

function mergeInstructionFiles(files: EngineeringInstructions['files']): string {
  return files
    .map((file) => {
      const suffix = file.truncated ? ' [truncated]' : ''
      return `# ${file.path}${suffix}\n\n${file.content.trim()}`
    })
    .filter(Boolean)
    .join('\n\n---\n\n')
}

async function safeExists(path: string, workspaceDir: string, deps: EngineeringInstructionLoaderDeps): Promise<boolean> {
  try {
    return await deps.fileExists!(path, workspaceDir)
  } catch {
    return false
  }
}
