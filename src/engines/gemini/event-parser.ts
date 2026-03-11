/**
 * Gemini CLI Event Parser
 *
 * 将 Gemini CLI 的事件转换为通用的 AIEvent。
 * Gemini CLI 使用与 Claude Code 兼容的事件格式（text_delta, tool_start, tool_end, session_end）。
 */

import type { AIEvent } from '../../ai-runtime'
import {
  createToolCallStartEvent,
  createToolCallEndEvent,
  createProgressEvent,
  createErrorEvent,
  createSessionEndEvent,
  createAssistantMessageEvent,
} from '../../ai-runtime'
import { BaseEventParser, type BaseStreamEvent } from '../../ai-runtime/base'

/**
 * Gemini Stream Event 类型
 */
export interface GeminiStreamEvent extends BaseStreamEvent {
  type: string
  [key: string]: unknown
}

/**
 * Gemini Event Parser
 *
 * 继承 BaseEventParser，复用与 Claude Code 相同的事件格式解析。
 * Rust 后端已将 Gemini 原生事件规范化为统一格式：
 * - text_delta: 文本增量
 * - tool_start: 工具调用开始
 * - tool_end: 工具调用结束
 * - assistant: 完整助手消息
 * - session_end: 会话结束
 * - error: 错误
 */
export class GeminiEventParser extends BaseEventParser<GeminiStreamEvent> {
  parse(event: GeminiStreamEvent): AIEvent[] {
    const results: AIEvent[] = []

    switch (event.type) {
      case 'text_delta': {
        const text = (event.text as string) || ''
        if (text) {
          results.push(createAssistantMessageEvent(text, true))
        }
        break
      }

      case 'assistant': {
        const message = event.message as { content: Array<{ type: string; text?: string }> } | undefined
        if (message?.content) {
          const textParts = message.content.filter((c) => c.type === 'text')
          const text = textParts.map((c) => c.text || '').join('')
          if (text) {
            results.push(createAssistantMessageEvent(text, false))
          }
        }
        break
      }

      case 'tool_start': {
        const toolName = (event.toolName as string) || (event.tool_name as string) || 'unknown'
        const toolId = (event.toolUseId as string) || (event.tool_id as string) || undefined
        const input = (event.input as Record<string, unknown>) || {}
        results.push(createProgressEvent(`调用工具: ${toolName}`))
        results.push(createToolCallStartEvent(toolName, input, toolId))
        break
      }

      case 'tool_end': {
        const toolName = (event.toolName as string) || (event.tool_name as string) || 'unknown'
        const toolId = (event.toolUseId as string) || (event.tool_id as string) || undefined
        const output = event.output as string | undefined
        const success = event.success !== false
        results.push(createProgressEvent(`工具完成: ${toolName}`))
        results.push(createToolCallEndEvent(toolName, output, success, toolId))
        break
      }

      case 'session_end': {
        results.push(createSessionEndEvent(this.sessionId))
        break
      }

      case 'error': {
        const errorMsg = (event.error as string) || '未知错误'
        results.push(createErrorEvent(errorMsg))
        break
      }

      default:
        break
    }

    return results
  }
}

export function parseStreamEventLine(line: string): GeminiStreamEvent | null {
  return BaseEventParser.parseJSONLine<GeminiStreamEvent>(line)
}

export function convertGeminiEventsToAIEvents(
  events: GeminiStreamEvent[],
  sessionId: string,
): AIEvent[] {
  const parser = new GeminiEventParser(sessionId)
  return events.flatMap((e) => parser.parse(e))
}
