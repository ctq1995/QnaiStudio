export interface ToolResultBudgetOptions {
  maxChars?: number
  preserveHead?: number
  preserveTail?: number
}

export interface BudgetedToolResult {
  content: string
  truncated: boolean
  omittedChars: number
}

const DEFAULT_MAX_CHARS = 12_000
const DEFAULT_PRESERVE_HEAD = 8_000
const DEFAULT_PRESERVE_TAIL = 4_000

export function budgetToolResult(content: string, options: ToolResultBudgetOptions = {}): BudgetedToolResult {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS
  const preserveHead = options.preserveHead ?? DEFAULT_PRESERVE_HEAD
  const preserveTail = options.preserveTail ?? DEFAULT_PRESERVE_TAIL

  if (content.length <= maxChars) {
    return { content, truncated: false, omittedChars: 0 }
  }

  const head = content.slice(0, preserveHead)
  const tail = content.slice(Math.max(preserveHead, content.length - preserveTail))
  const omittedChars = content.length - head.length - tail.length

  return {
    content: `${head}\n\n[tool result truncated: ${omittedChars} characters omitted]\n\n${tail}`,
    truncated: true,
    omittedChars,
  }
}
