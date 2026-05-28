import type { VerificationCommand } from './types'

export const FRONTEND_BUILD_COMMAND: VerificationCommand = {
  id: 'npm-build',
  label: 'Frontend build',
  command: 'npm run build',
  risk: 'safe',
}

export const TAURI_CHECK_COMMAND: VerificationCommand = {
  id: 'cargo-check',
  label: 'Tauri cargo check',
  command: 'cargo check',
  cwd: 'src-tauri',
  risk: 'safe',
}

const DIFF_FILE_PATTERNS = [/^diff --git a\/(.*?) b\/(.*?)$/gm]

export function extractChangedFilesFromDiff(diff: string): string[] {
  const files = new Set<string>()

  for (const pattern of DIFF_FILE_PATTERNS) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(diff)) !== null) {
      const filePath = match[2] || match[1]
      if (filePath) files.add(filePath)
    }
  }

  return Array.from(files).sort()
}

export function selectVerificationCommands(changedFiles: string[]): VerificationCommand[] {
  const commands: VerificationCommand[] = []
  const touchesFrontend = changedFiles.some((file) =>
    file.startsWith('src/') ||
    file === 'package.json' ||
    file === 'package-lock.json' ||
    file === 'vite.config.ts' ||
    file === 'tsconfig.json' ||
    file === 'tsconfig.node.json'
  )
  const touchesTauri = changedFiles.some((file) =>
    file.startsWith('src-tauri/') && (file.endsWith('.rs') || file.endsWith('Cargo.toml') || file.endsWith('Cargo.lock'))
  )

  if (touchesFrontend) commands.push(FRONTEND_BUILD_COMMAND)
  if (touchesTauri) commands.push(TAURI_CHECK_COMMAND)

  return commands
}

export function truncateVerificationOutput(output: string, maxLength = 12000): string {
  if (output.length <= maxLength) return output
  return `${output.slice(0, maxLength)}\n\n[output truncated: ${output.length - maxLength} characters omitted]`
}
