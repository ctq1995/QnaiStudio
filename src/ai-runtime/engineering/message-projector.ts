import { calculateContextBudget, estimateTokens, type EngineeringContextBudgetOptions } from './token-budget'
import { budgetToolResult } from './tool-result-budget'

export interface EngineeringMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  priority?: number
}

export interface ProjectedEngineeringMessages {
  messages: EngineeringMessage[]
  droppedMessages: number
  truncatedToolResults: number
  budget: ReturnType<typeof calculateContextBudget>
}

export function projectEngineeringMessages(
  messages: EngineeringMessage[],
  options: EngineeringContextBudgetOptions = {}
): ProjectedEngineeringMessages {
  const normalized = messages.map((message) => {
    if (message.role !== 'tool') return message
    const budgeted = budgetToolResult(message.content)
    return { ...message, content: budgeted.content, priority: message.priority ?? rolePriority(message.role) }
  })

  const ordered = normalized
    .map((message, index) => ({ message, index, score: message.priority ?? rolePriority(message.role) }))
    .sort((a, b) => b.score - a.score || b.index - a.index)

  const selected: Array<{ message: EngineeringMessage; index: number }> = []
  let usedTokens = 0
  const maxTokens = options.maxTokens ?? 120_000
  const reservedOutputTokens = options.reservedOutputTokens ?? 8_000
  const usableTokens = Math.max(0, maxTokens - reservedOutputTokens)

  for (const item of ordered) {
    const tokens = estimateTokens(item.message.content)
    if (usedTokens + tokens > usableTokens) continue
    selected.push({ message: item.message, index: item.index })
    usedTokens += tokens
  }

  const projected = selected.sort((a, b) => a.index - b.index).map((item) => item.message)

  return {
    messages: projected,
    droppedMessages: messages.length - projected.length,
    truncatedToolResults: normalized.filter((message, index) => message.role === 'tool' && message.content !== messages[index].content).length,
    budget: calculateContextBudget(projected.map((message) => message.content), options),
  }
}

function rolePriority(role: EngineeringMessage['role']): number {
  if (role === 'system') return 100
  if (role === 'user') return 80
  if (role === 'assistant') return 60
  return 30
}
