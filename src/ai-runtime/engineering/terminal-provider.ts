import type { EngineeringContextProvider } from './context-provider'
import { estimateTokens } from './token-budget'
import { budgetToolResult } from './tool-result-budget'

export interface EngineeringTerminalOutput {
  command: string
  cwd?: string
  exitCode?: number
  stdout?: string
  stderr?: string
  startedAt?: string
  finishedAt?: string
}

export function createTerminalProvider(): EngineeringContextProvider {
  return {
    id: 'terminal',
    kind: 'terminal',
    label: 'Terminal Output',
    priority: 92,
    async collect(input) {
      const outputs = input.terminalOutputs || []
      const summary = formatEngineeringTerminalOutputs(outputs)
      return {
        id: 'terminal',
        kind: 'terminal',
        label: 'Terminal Output',
        priority: 92,
        summary,
        itemCount: outputs.length,
        tokenEstimate: estimateTokens(summary),
      }
    },
  }
}

export function formatEngineeringTerminalOutputs(outputs: EngineeringTerminalOutput[]): string {
  if (outputs.length === 0) return 'Terminal: none'

  const recent = outputs.slice(-5)
  const failed = outputs.filter((output) => output.exitCode !== undefined && output.exitCode !== 0).length
  const lines = [`Terminal: ${failed} failed, ${outputs.length} total`]

  for (const output of recent) {
    lines.push(formatTerminalOutput(output))
  }

  if (outputs.length > recent.length) {
    lines.push(`[terminal outputs truncated: ${outputs.length - recent.length} older items omitted]`)
  }

  return lines.join('\n')
}

function formatTerminalOutput(output: EngineeringTerminalOutput): string {
  const status = output.exitCode === undefined ? 'unknown' : output.exitCode === 0 ? 'ok' : 'failed'
  const lines = [`[${status}] ${output.command}`]

  if (output.cwd) lines.push(`cwd: ${output.cwd}`)
  if (output.exitCode !== undefined) lines.push(`exitCode: ${output.exitCode}`)
  if (output.stderr) lines.push(`stderr:\n${budgetTerminalText(output.stderr)}`)
  if (output.stdout) lines.push(`stdout:\n${budgetTerminalText(output.stdout)}`)

  return lines.join('\n')
}

function budgetTerminalText(content: string): string {
  return budgetToolResult(content, {
    maxChars: 4_000,
    preserveHead: 2_500,
    preserveTail: 1_500,
  }).content
}
