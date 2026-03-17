/**
 * Chat 事件转换工具
 *
 * 将 Tauri StreamEvent 转换为标准 AIEvent，
 * 以及 AIEvent 到本地状态的统一处理。
 */
import type { StreamEvent } from '../../types/chat'
import type { AIEvent } from '../../ai-runtime'
import type { ContentBlock } from '../../types'
import { extractToolEventInfo } from '../../utils/streamEvent'

// ============================================================================
// 辅助函数：解析 IFlow/Claude Code 的消息内容格式
// ============================================================================

/** 从消息内容中提取纯文本 */
export function extractTextFromContent(content: unknown): string {
  if (typeof content === 'string') {
    return content
  }
  if (Array.isArray(content)) {
    const texts: string[] = []
    for (const item of content) {
      if (item && typeof item === 'object') {
        if ('type' in item && item.type === 'text' && 'text' in item) {
          texts.push(String(item.text))
        }
      }
    }
    return texts.join('')
  }
  return ''
}

/** 工具调用信息 */
interface ToolUse {
  id: string
  name: string
  input: unknown
}

/** 从消息内容中提取工具调用 */
export function extractToolUsesFromContent(content: unknown): ToolUse[] {
  const toolUses: ToolUse[] = []
  if (Array.isArray(content)) {
    for (const item of content) {
      if (item && typeof item === 'object') {
        if ('type' in item && item.type === 'tool_use') {
          toolUses.push({
            id: String(item.id || crypto.randomUUID()),
            name: String(item.name || 'unknown'),
            input: item.input,
          })
        }
      }
    }
  }
  return toolUses
}

/** 工具结果信息 */
interface ToolResult {
  tool_use_id: string
  content: string
  is_error?: boolean
}

/** 从 user 消息中提取工具结果 */
export function extractToolResultsFromContent(content: unknown): ToolResult[] {
  const results: ToolResult[] = []
  if (Array.isArray(content)) {
    for (const item of content) {
      if (item && typeof item === 'object') {
        if ('type' in item && item.type === 'tool_result' && 'tool_use_id' in item) {
          results.push({
            tool_use_id: String(item.tool_use_id),
            content: String(item.content || ''),
            is_error: item.is_error === true,
          })
        }
      }
    }
  }
  return results
}

/** 解析 StreamEvent payload */
export function parseStreamEventPayload(payload: unknown): StreamEvent | null {
  if (!payload) return null
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload) as StreamEvent
    } catch (error) {
      console.error('[ChatEventUtils] 解析 chat-event 失败:', error)
      return null
    }
  }
  if (typeof payload === 'object') {
    return payload as StreamEvent
  }
  return null
}

// ============================================================================
// 统一事件转换层：StreamEvent → AIEvent
// ============================================================================

/**
 * 将 Tauri 的 StreamEvent 转换为标准的 AIEvent 数组
 */
export function convertStreamEventToAIEvents(streamEvent: StreamEvent, sessionId: string | null): AIEvent[] {
  const events: AIEvent[] = []
  switch (streamEvent.type) {
    case 'system': {
      const systemEvent = streamEvent as { type: 'system'; subtype?: string; session_id?: string; extra?: { message?: string } }
      if (systemEvent.session_id) {
        events.push({ type: 'session_start', sessionId: systemEvent.session_id })
      }
      if (systemEvent.subtype === 'progress' || systemEvent.extra?.message) {
        events.push({
          type: 'progress',
          message: systemEvent.extra?.message || systemEvent.subtype,
        })
      }
      break
    }
    case 'session_start': {
      if (streamEvent.sessionId) {
        events.push({ type: 'session_start', sessionId: streamEvent.sessionId })
      }
      break
    }
    case 'session_end':
    case 'result': {
      events.push({
        type: 'session_end',
        sessionId: sessionId || 'unknown',
        reason: 'completed',
      })
      break
    }
    case 'text_delta': {
      events.push({ type: 'token', value: streamEvent.text || '' })
      break
    }
    case 'assistant': {
      if (streamEvent.message?.content) {
        const content = extractTextFromContent(streamEvent.message.content)
        if (content) {
          events.push({
            type: 'assistant_message',
            content,
            isDelta: false,
          })
        }
        const toolUses = extractToolUsesFromContent(streamEvent.message.content)
        for (const toolUse of toolUses) {
          events.push({
            type: 'tool_call_start',
            callId: toolUse.id,
            tool: toolUse.name,
            args: toolUse.input as Record<string, unknown>,
          })
        }
      }
      break
    }
    case 'user': {
      if (streamEvent.message?.content) {
        const toolResults = extractToolResultsFromContent(streamEvent.message.content)
        for (const result of toolResults) {
          events.push({
            type: 'tool_call_end',
            callId: result.tool_use_id,
            tool: result.tool_use_id,
            result: result.content,
            success: !result.is_error,
          })
        }
      }
      break
    }
    case 'tool_start':
    case 'tool_use': {
      const toolInfo = extractToolEventInfo(streamEvent)
      const callId = toolInfo.toolId || crypto.randomUUID()
      events.push({
        type: 'tool_call_start',
        callId,
        tool: toolInfo.toolName,
        args: toolInfo.input,
      })
      events.push({
        type: 'progress',
        message: `调用工具: ${toolInfo.toolName}`,
      })
      break
    }
    case 'tool_end':
    case 'tool_result': {
      const toolInfo = extractToolEventInfo(streamEvent)
      events.push({
        type: 'tool_call_end',
        callId: toolInfo.toolId,
        tool: toolInfo.toolName,
        result: toolInfo.output,
        success: toolInfo.success ?? toolInfo.output !== undefined,
      })
      events.push({
        type: 'progress',
        message: `工具完成: ${toolInfo.toolName}`,
      })
      break
    }
    case 'tool_output': {
      const toolInfo = extractToolEventInfo(streamEvent)
      const output = toolInfo.output ?? ''
      if (!output) {
        break
      }
      events.push({
        type: 'tool_call_output',
        callId: toolInfo.toolId,
        tool: toolInfo.toolName,
        output,
      })
      break
    }
    case 'progress': {
      events.push({
        type: 'progress',
        message: streamEvent.message,
      })
      break
    }
    case 'error': {
      events.push({
        type: 'error',
        error: streamEvent.error || '未知错误',
      })
      break
    }
    case 'permission_request': {
      events.push({
        type: 'progress',
        message: '等待权限确认...',
      })
      break
    }
    default: {
      const unknownEvent = streamEvent as { type: string }
      console.log('[ChatEventUtils] 未转换的事件类型:', unknownEvent.type)
      break
    }
  }
  return events
}

/** 提取错误信息 */
export function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  if (error && typeof error === 'object') {
    try {
      return JSON.stringify(error)
    } catch {
      return fallback
    }
  }
  return fallback
}

/** 当前正在构建的 Assistant 消息 */
export interface CurrentAssistantMessage {
  id: string
  blocks: ContentBlock[]
  isStreaming: true
}

/** 常量 */
export const MAX_MESSAGES = 500
export const MESSAGE_ARCHIVE_THRESHOLD = 550
export const STORAGE_KEY = 'event_chat_state_backup'
export const STORAGE_VERSION = '5'
export const SESSION_HISTORY_KEY = 'event_chat_session_history'
export const MAX_SESSION_HISTORY = 50
