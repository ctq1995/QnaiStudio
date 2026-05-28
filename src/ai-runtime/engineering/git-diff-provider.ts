import type { EngineeringContextProvider } from './context-provider'
import { estimateTokens } from './token-budget'
import { budgetToolResult } from './tool-result-budget'

export interface EngineeringGitDiffContext {
  diff?: string
  changedFiles?: string[]
}

export function createGitDiffProvider(): EngineeringContextProvider {
  return {
    id: 'git-diff',
    kind: 'gitDiff',
    label: 'Git Diff',
    priority: 88,
    async collect(input) {
      const gitDiff = input.gitDiff || {}
      const summary = formatEngineeringGitDiff(gitDiff)
      return {
        id: 'git-diff',
        kind: 'gitDiff',
        label: 'Git Diff',
        priority: 88,
        summary,
        itemCount: gitDiff.changedFiles?.length || 0,
        tokenEstimate: estimateTokens(summary),
      }
    },
  }
}

export function formatEngineeringGitDiff(gitDiff: EngineeringGitDiffContext): string {
  const changedFiles = gitDiff.changedFiles || []
  const diff = gitDiff.diff || ''

  if (changedFiles.length === 0 && diff.length === 0) return 'Git Diff: none'

  const lines = [`Git Diff: ${changedFiles.length} changed files`]

  if (changedFiles.length > 0) {
    lines.push('Changed files:')
    for (const file of changedFiles.slice(0, 50)) lines.push(`- ${file}`)
    if (changedFiles.length > 50) lines.push(`[changed files truncated: ${changedFiles.length - 50} additional files omitted]`)
  }

  if (diff) {
    lines.push('Diff:')
    lines.push(budgetToolResult(diff, {
      maxChars: 16_000,
      preserveHead: 10_000,
      preserveTail: 6_000,
    }).content)
  }

  return lines.join('\n')
}
