import type { AIEvent } from '../../ai-runtime'
import {
  createAssistantMessageEvent,
  createErrorEvent,
  createProgressEvent,
  createSessionEndEvent,
  createToolCallEndEvent,
  createToolCallStartEvent,
} from '../../ai-runtime'
import { BaseEventParser, type BaseStreamEvent } from '../../ai-runtime/base'

export interface CustomCliStreamEvent extends BaseStreamEvent {
  type: string
  [key: string]: unknown
}

export class CustomCliEventParser extends BaseEventParser<CustomCliStreamEvent> {
  parse(event: CustomCliStreamEvent): AIEvent[] {
    const results: AIEvent[] = []

    switch (event.type) {
      case 'text_delta': {
        const text = (event.text as string) || (event.delta as string) || ''
        if (text) {
          results.push(createAssistantMessageEvent(text, true))
        }
        break
      }

      case 'assistant': {
        const text = extractAssistantText(event)
        if (text) {
          results.push(createAssistantMessageEvent(text, false))
        }
        break
      }

      case 'progress': {
        const message = typeof event.message === 'string' ? event.message : undefined
        results.push(createProgressEvent(message))
        break
      }

      case 'system': {
        if (event.subtype === 'progress') {
          const message = typeof event.message === 'string' ? event.message : undefined
          results.push(createProgressEvent(message))
        }
        break
      }

      case 'tool_start': {
        const toolName = getToolName(event)
        const toolId = getToolId(event)
        const input = getToolInput(event)
        if (toolId) {
          this.toolCallManager.startToolCall(toolName, toolId, input)
        }
        results.push(createProgressEvent(`调用工具: ${toolName}`))
        results.push(createToolCallStartEvent(toolName, input, toolId))
        break
      }

      case 'tool_end': {
        const toolName = getToolName(event)
        const toolId = getToolId(event)
        const output = event.output ?? event.result
        const success = event.success !== false
        if (toolId) {
          this.toolCallManager.endToolCall(toolId, output, success)
        }
        results.push(createProgressEvent(`${success ? '工具完成' : '工具失败'}: ${toolName}`))
        results.push(createToolCallEndEvent(toolName, output, success, toolId))
        break
      }

      case 'error': {
        const error = ((event.error as string) || (event.message as string) || '未知错误').trim()
        results.push(createErrorEvent(error))
        break
      }

      case 'session_end': {
        results.push(createSessionEndEvent(this.sessionId))
        break
      }

      default:
        break
    }

    return results
  }
}

function getToolName(event: CustomCliStreamEvent): string {
  return (event.toolName as string) || (event.tool_name as string) || (event.name as string) || 'unknown'
}

function getToolId(event: CustomCliStreamEvent): string | undefined {
  return (event.toolUseId as string) || (event.tool_id as string) || (event.id as string) || undefined
}

function getToolInput(event: CustomCliStreamEvent): Record<string, unknown> {
  const candidate = event.input ?? event.args
  return candidate && typeof candidate === 'object' ? candidate as Record<string, unknown> : {}
}

function extractAssistantText(event: CustomCliStreamEvent): string {
  if (typeof event.text === 'string') {
    return event.text
  }

  if (typeof event.message === 'string') {
    return event.message
  }

  const message = event.message
  if (message && typeof message === 'object' && 'content' in message) {
    const content = (message as { content?: unknown }).content
    if (Array.isArray(content)) {
      return content
        .map((item) => {
          if (!item || typeof item !== 'object') {
            return ''
          }
          const text = (item as { text?: unknown }).text
          return typeof text === 'string' ? text : ''
        })
        .join('')
    }
  }

  return ''
}
