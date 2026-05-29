import type { EngineeringMessage } from './message-projector'
import { budgetToolResult, type ToolResultBudgetOptions } from './tool-result-budget'
import { calculateContextBudget, type EngineeringContextBudget, type EngineeringContextBudgetOptions } from './token-budget'

export type EngineeringCompactionMode = 'micro' | 'snip'

export interface EngineeringAutoCompactionOptions {
  budgetOptions?: EngineeringContextBudgetOptions
  toolResultBudgetOptions?: ToolResultBudgetOptions
  recentMessageCount?: number
  mode?: EngineeringCompactionMode
}

export interface EngineeringCompactionAction {
  mode: EngineeringCompactionMode
  sourceMessageIndex?: number
  omittedChars?: number
  droppedMessages?: number
  reason: string
}

export interface EngineeringCompactionResult {
  messages: EngineeringMessage[]
  actions: EngineeringCompactionAction[]
  beforeBudget: EngineeringContextBudget
  afterBudget: EngineeringContextBudget
}

export class EngineeringAutoCompactionPolicy {
  compact(messages: EngineeringMessage[], options: EngineeringAutoCompactionOptions = {}): EngineeringCompactionResult {
    const beforeBudget = calculateMessageBudget(messages, options.budgetOptions)
    const micro = compactToolMessages(messages, options)
    const shouldSnip = (options.mode === 'snip' || micro.afterBudget.overflow) && options.mode !== 'micro'

    if (!shouldSnip) {
      return {
        messages: micro.messages,
        actions: micro.actions,
        beforeBudget,
        afterBudget: micro.afterBudget,
      }
    }

    const snip = snipMessages(micro.messages, options)
    const afterBudget = calculateMessageBudget(snip.messages, options.budgetOptions)
    return {
      messages: snip.messages,
      actions: [...micro.actions, ...snip.actions],
      beforeBudget,
      afterBudget,
    }
  }
}

export function createEngineeringAutoCompactionPolicy(): EngineeringAutoCompactionPolicy {
  return new EngineeringAutoCompactionPolicy()
}

function compactToolMessages(messages: EngineeringMessage[], options: EngineeringAutoCompactionOptions): EngineeringCompactionResult {
  const compactedMessages: EngineeringMessage[] = []
  const actions: EngineeringCompactionAction[] = []

  messages.forEach((message, index) => {
    const cloned = cloneMessage(message)
    if (message.role !== 'tool') {
      compactedMessages.push(cloned)
      return
    }

    const budgeted = budgetToolResult(message.content, options.toolResultBudgetOptions)
    if (!budgeted.truncated) {
      compactedMessages.push(cloned)
      return
    }

    compactedMessages.push({
      ...cloned,
      content: budgeted.content,
    })
    actions.push({
      mode: 'micro',
      sourceMessageIndex: index,
      omittedChars: budgeted.omittedChars,
      reason: 'Truncated oversized tool result content',
    })
  })

  return {
    messages: compactedMessages,
    actions,
    beforeBudget: calculateMessageBudget(messages, options.budgetOptions),
    afterBudget: calculateMessageBudget(compactedMessages, options.budgetOptions),
  }
}

function snipMessages(messages: EngineeringMessage[], options: EngineeringAutoCompactionOptions): Pick<EngineeringCompactionResult, 'messages' | 'actions'> {
  const recentMessageCount = Math.max(1, options.recentMessageCount ?? 6)
  const nonSystemIndexes = messages.flatMap((message, index) => (message.role === 'system' ? [] : [index]))

  if (nonSystemIndexes.length <= recentMessageCount) {
    return { messages: messages.map(cloneMessage), actions: [] }
  }

  const recentNonSystemIndexes = new Set(nonSystemIndexes.slice(-recentMessageCount))
  const droppedMessages = nonSystemIndexes.length - recentNonSystemIndexes.size
  const firstRecentIndex = Math.min(...recentNonSystemIndexes)
  const compacted: EngineeringMessage[] = []
  let markerInserted = false

  messages.forEach((message, index) => {
    if (message.role === 'system') {
      compacted.push(cloneMessage(message))
      return
    }

    if (recentNonSystemIndexes.has(index)) {
      if (!markerInserted && droppedMessages > 0) {
        compacted.push(createSnipMarker(droppedMessages))
        markerInserted = true
      }
      compacted.push(cloneMessage(message))
      return
    }

    if (!markerInserted && index > firstRecentIndex) {
      compacted.push(createSnipMarker(droppedMessages))
      markerInserted = true
    }
  })

  if (!markerInserted && droppedMessages > 0) {
    compacted.push(createSnipMarker(droppedMessages))
  }

  return {
    messages: compacted,
    actions: [
      {
        mode: 'snip',
        droppedMessages,
        reason: 'Replaced older non-system messages with a compaction marker while preserving system-message order',
      },
    ],
  }
}

function createSnipMarker(droppedMessages: number): EngineeringMessage {
  return {
    role: 'assistant',
    content: `[context snipped: ${droppedMessages} earlier non-system messages omitted by auto compaction]`,
    priority: 10,
  }
}

function calculateMessageBudget(messages: EngineeringMessage[], options: EngineeringContextBudgetOptions = {}): EngineeringContextBudget {
  return calculateContextBudget(messages.map((message) => message.content), options)
}

function cloneMessage(message: EngineeringMessage): EngineeringMessage {
  return { ...message }
}
