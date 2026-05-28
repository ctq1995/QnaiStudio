import type { VerificationCommand, VerificationRisk } from './types'

export type ToolRiskLevel = VerificationRisk | 'dangerous'

export interface ToolRiskAssessment {
  risk: ToolRiskLevel
  allowed: boolean
  reason: string
}

const DANGEROUS_COMMAND_PATTERNS = [
  /\brm\s+-rf\b/i,
  /\bdel\s+\/s\b/i,
  /\brmdir\s+\/s\b/i,
  /git\s+reset\s+--hard/i,
  /git\s+clean\s+-/i,
  /curl\b.*\|\s*(bash|sh|powershell|pwsh)/i,
  /iwr\b.*\|\s*(iex|powershell|pwsh)/i,
  /invoke-webrequest\b.*\|\s*(iex|powershell|pwsh)/i,
]

const SAFE_COMMANDS = new Set([
  'npm run build',
  'npm run typecheck',
  'npm run lint',
  'npm test',
  'cargo check',
  'cargo test',
  'git diff',
  'git status',
])

export function assessCommandRisk(command: string): ToolRiskAssessment {
  const normalized = command.trim().replace(/\s+/g, ' ')

  if (DANGEROUS_COMMAND_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return { risk: 'dangerous', allowed: false, reason: 'Command matches a destructive or pipe-to-shell pattern' }
  }

  if (SAFE_COMMANDS.has(normalized)) {
    return { risk: 'safe', allowed: true, reason: 'Command is in the built-in safe command allowlist' }
  }

  if (/^(npm|pnpm|yarn)\s+(install|add|remove|update)\b/i.test(normalized) || /^cargo\s+update\b/i.test(normalized)) {
    return { risk: 'medium', allowed: false, reason: 'Dependency mutation commands require explicit approval' }
  }

  return { risk: 'medium', allowed: false, reason: 'Command is not in the built-in safe command allowlist' }
}

export function filterAllowedVerificationCommands(commands: VerificationCommand[]): VerificationCommand[] {
  return commands.filter((command) => assessCommandRisk(command.command).allowed)
}
