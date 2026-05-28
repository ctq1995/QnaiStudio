export interface EngineeringContextBudget {
  maxTokens: number
  reservedOutputTokens: number
  estimatedTokens: number
  remainingTokens: number
  overflow: boolean
}

export interface EngineeringContextBudgetOptions {
  maxTokens?: number
  reservedOutputTokens?: number
}

const DEFAULT_MAX_TOKENS = 120_000
const DEFAULT_RESERVED_OUTPUT_TOKENS = 8_000
const APPROX_CHARS_PER_TOKEN = 4

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / APPROX_CHARS_PER_TOKEN)
}

export function calculateContextBudget(
  parts: string[],
  options: EngineeringContextBudgetOptions = {}
): EngineeringContextBudget {
  const maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS
  const reservedOutputTokens = options.reservedOutputTokens ?? DEFAULT_RESERVED_OUTPUT_TOKENS
  const estimatedTokens = parts.reduce((sum, part) => sum + estimateTokens(part), 0)
  const usableTokens = Math.max(0, maxTokens - reservedOutputTokens)
  const remainingTokens = usableTokens - estimatedTokens

  return {
    maxTokens,
    reservedOutputTokens,
    estimatedTokens,
    remainingTokens,
    overflow: remainingTokens < 0,
  }
}
