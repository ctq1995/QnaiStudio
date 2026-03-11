/**

 * AI Runtime Service - 事件驱动版本

 *

 * 这是新架构的核心服务层：

 * 1. 使用 EventBus 进行事件分发

 * 2. 使用 CLIParser 解析 CLI 输出

 * 3. 完全基于 AIEvent 进行通信

 */



import type { AISession, AIEvent } from '../ai-runtime'

import type { StreamEvent } from '../types'

import { getEventBus, type EventBus } from '../ai-runtime'

import { createParser, type CLIParser } from '../ai-runtime'

import { getEngineRegistry } from '../ai-runtime'

import { extractToolEventInfo } from '../utils/streamEvent'

import { listen, type UnlistenFn } from '@tauri-apps/api/event'

import { invoke } from '@tauri-apps/api/core'



/**

 * 将 Tauri 的 StreamEvent 转换为通用的 AIEvent

 *

 * 这是适配层，将 Claude 特定的事件格式转换为通用格式。

 */

function streamEventToAIEvent(streamEvent: StreamEvent, sessionId: string): AIEvent[] {

  const events: AIEvent[] = []



  switch (streamEvent.type) {

    case 'system':

      // 尝试从多个位置提取 session_id

      const extractedSessionId =

        streamEvent.session_id ||

        (streamEvent.extra && typeof streamEvent.extra === 'object' && 'session_id' in streamEvent.extra

          ? String(streamEvent.extra.session_id)

          : undefined)



      if (extractedSessionId) {

        events.push({ type: 'session_start', sessionId: extractedSessionId })

      }



      if (streamEvent.subtype || streamEvent.extra) {

        const extraMessage =

          streamEvent.extra && typeof streamEvent.extra === 'object' && 'message' in streamEvent.extra

            ? String(streamEvent.extra.message)

            : undefined

        events.push({ type: 'progress', message: extraMessage || streamEvent.subtype })

      }

      break



    case 'session_start':

      events.push({ type: 'session_start', sessionId: streamEvent.sessionId })

      break



    case 'session_end':

    case 'result':

      events.push({ type: 'session_end', sessionId, reason: 'completed' })

      break



    case 'assistant': {

      const content = streamEvent.message.content

      const textParts = content.filter((item) => item.type === 'text')

      const text = textParts.map((item) => item.text || '').join('')



      const toolUseParts = content.filter((item) => item.type === 'tool_use')

      const toolCalls = toolUseParts.map((tool) => ({

        id: tool.id || crypto.randomUUID(),

        name: tool.name || 'unknown',

        args: tool.input || {},

        status: 'pending' as const,

      }))



      if (text) {

        events.push({

          type: 'assistant_message',

          content: text,

          isDelta: false,

          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,

        })

      }



      for (const tool of toolCalls) {

        events.push({ type: 'tool_call_start', tool: tool.name, args: tool.args })

      }

      break

    }



    case 'user': {

      const toolResults = streamEvent.message.content.filter((item) => item.type === 'tool_result')

      for (const result of toolResults) {

        if (result.tool_use_id) {

          events.push({

            type: 'tool_call_end',

            tool: result.tool_use_id,

            result: result.content || '',

            success: !result.is_error,

          })

        }

      }

      break

    }



    case 'text_delta':

      events.push({ type: 'token', value: streamEvent.text })

      break



    case 'tool_start':

    case 'tool_use': {

      const toolInfo = extractToolEventInfo(streamEvent)

      events.push({

        type: 'tool_call_start',

        callId: toolInfo.toolId,

        tool: toolInfo.toolName,

        args: toolInfo.input,

      })

      events.push({ type: 'progress', message: `????: ${toolInfo.toolName}` })

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

      events.push({ type: 'progress', message: `????: ${toolInfo.toolName}` })

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

case 'progress':

      events.push({ type: 'progress', message: streamEvent.message })

      break



    case 'error':

      events.push({ type: 'error', error: streamEvent.error })

      break



    case 'permission_request':

      events.push({ type: 'progress', message: '等待权限确认...' })

      break

  }



  return events

}



/**

 * AI Runtime 配置

 */

export interface AIRuntimeConfig {

  /** 工作区目录 */

  workspaceDir?: string

  /** 是否启用详细日志 */

  verbose?: boolean

  /** 是否启用 EventBus 调试 */

  debug?: boolean

  /** 使用的引擎 ID */

  engineId?: 'claude-code' | 'iflow' | 'codex-cli' | 'gemini'

}



/**

 * AI Runtime 服务类（事件驱动版本）

 *

 * 核心特性：

 * 1. 使用 EventBus 进行全局事件分发

 * 2. 使用 CLIParser 解析 CLI 输出

 * 3. 完全基于 AIEvent 进行通信

 */

export class AIRuntimeService {

  private eventBus: EventBus

  private parser: CLIParser

  private currentSession: AISession | null = null

  private unlistenFn: UnlistenFn | null = null

  private config: AIRuntimeConfig

  private currentEngineId: 'claude-code' | 'iflow' | 'codex-cli' | 'gemini' = 'claude-code'



  constructor(config?: AIRuntimeConfig) {

    this.config = config || {}

    this.currentEngineId = this.config.engineId || 'claude-code'

    this.eventBus = getEventBus({ debug: this.config.debug })

    this.parser = createParser()

  }



  /**

   * 初始化 Runtime

   */

  async initialize(): Promise<void> {

    // 设置 Tauri 事件监听

    await this.setupEventListeners()



    // 检查 Engine 可用性

    const registry = getEngineRegistry()

    if (registry.has(this.currentEngineId)) {

      const engine = registry.get(this.currentEngineId)

      if (engine?.initialize) {

        await engine.initialize()

      }

    }

  }



  /**

   * 设置 Tauri 事件监听器

   *

   * 监听 Tauri 的 chat-event，解析后通过 EventBus 分发

   */

  private async setupEventListeners(): Promise<void> {

    if (this.unlistenFn) {

      return

    }



    this.unlistenFn = await listen<unknown>('chat-event', (event) => {

      try {

        const streamEvent = parseChatEventPayload(event.payload)

        if (!streamEvent) {

          return

        }



        const payloadSessionId = getPayloadSessionId(streamEvent)

        const sessionId =

          payloadSessionId || this.currentSession?.id || this.parser.getSessionId() || UNKNOWN_SESSION_ID



        // ?????AIEvent

        const aiEvents = streamEventToAIEvent(streamEvent, sessionId)



        // ??? EventBus ??????????

        for (const aiEvent of aiEvents) {

          this.eventBus.emit(aiEvent)

        }

      } catch (e) {

        console.error('[AIRuntimeService] Failed to parse event:', e)

      }

    })

  }



  /**

   * 获取 EventBus 实例

   */

  getEventBus(): EventBus {

    return this.eventBus

  }



  /**

   * 获取 Parser 实例

   */

  getParser(): CLIParser {

    return this.parser

  }



  /**

   * 规范化消息内容

   * - 统一换行符为 \\n 字符串（避免 iFlow CLI 参数解析问题）

   * - 移除首尾空白

   * - 验证消息不为空

   */

  private normalizeMessage(message: string): string {

    // 将换行符替换为 \\n 字符串，避免 iFlow CLI 参数解析问题

    // iFlow CLI 的参数解析器可能无法正确处理包含实际换行符的参数值

    const normalized = message

      .replace(/\r\n/g, '\\n')

      .replace(/\r/g, '\\n')

      .replace(/\n/g, '\\n');

    // 移除首尾空白

    return normalized.trim();

  }



  /**

   * 验证消息内容

   * - 检查消息是否为空

   * - 检查是否包含可能导致问题的特殊字符（仅警告）

   */

  private validateMessage(message: string): void {

    if (message.length === 0) {

      throw new Error('消息不能为空');

    }



    // 检查是否包含可能导致问题的特殊字符

    const problematicChars = /[\[\]{}(){new_string}|;*?!<>]/;

    if (problematicChars.test(message)) {

      console.warn('[AIRuntimeService] 消息包含可能导致问题的特殊字符:', message);

    }

  }



  /**

   * 发送消息

   */

  async sendMessage(message: string, sessionId?: string): Promise<string> {

    // 规范化消息

    const normalized = this.normalizeMessage(message);

    // 验证消息

    this.validateMessage(normalized);



    const workDir = this.config.workspaceDir;

    const engineId = this.currentEngineId;



    if (sessionId) {

      await invoke('continue_chat', { payload: { sessionId, message: normalized, workDir, engineId } });

      return sessionId;

    } else {

      const newSessionId = await invoke<string>('start_chat', {

        payload: {

          message: normalized,

          workDir,

          engineId,

        },

      });

      return newSessionId;

    }

  }



  /**

   * 中断会话

   */

  async interrupt(sessionId: string): Promise<void> {

    await invoke('interrupt_chat', { payload: { sessionId } })



    // 发送中断事件

    this.eventBus.emit({

      type: 'session_end',

      sessionId,

      reason: 'aborted',

    })

  }



  /**

   * 获取当前会话

   */

  getCurrentSession(): AISession | null {

    return this.currentSession

  }



  /**

   * 设置当前会话

   */

  setCurrentSession(session: AISession | null): void {

    this.currentSession = session

  }



  /**

   * 清理资源

   */

  async cleanup(): Promise<void> {

    if (this.unlistenFn) {

      this.unlistenFn()

      this.unlistenFn = null

    }



    this.parser.reset()

    this.eventBus.clear()



    if (this.currentSession) {

      this.currentSession.dispose()

      this.currentSession = null

    }



    const registry = getEngineRegistry()

    const engine = registry.get(this.currentEngineId)

    if (engine?.cleanup) {

      await engine.cleanup()

    }

  }



  /**

   * 更新配置

   */

  updateConfig(config: Partial<AIRuntimeConfig>): void {

    this.config = { ...this.config, ...config }

    if (config.engineId) {

      this.currentEngineId = config.engineId

    }

  }



  /**

   * 获取当前引擎 ID

   */

  getEngineId(): 'claude-code' | 'iflow' | 'codex-cli' | 'gemini' {

    return this.currentEngineId

  }



  /**

   * 设置引擎 ID

   */

  setEngineId(engineId: 'claude-code' | 'iflow' | 'codex-cli' | 'gemini'): void {

    this.currentEngineId = engineId

    this.config.engineId = engineId

  }

}



/**

 * 全局单例

 */

let globalService: AIRuntimeService | null = null



/**

 * 获取 AI Runtime 服务单例

 *

 * 每次调用时更新配置（特别是 engineId），确保使用最新的引擎设置

 */

export function getAIRuntime(config?: AIRuntimeConfig): AIRuntimeService {

  if (!globalService) {

    globalService = new AIRuntimeService(config)

  } else if (config) {

    globalService.updateConfig(config)

  }

  return globalService

}



/**

 * 重置服务（主要用于测试）

 */

export function resetAIRuntime(): void {

  if (globalService) {

    globalService.cleanup()

    globalService = null

  }

}



const UNKNOWN_SESSION_ID = 'unknown'



function parseChatEventPayload(payload: unknown): StreamEvent | null {

  if (typeof payload === 'string') {

    try {

      return JSON.parse(payload) as StreamEvent

    } catch (error) {

      console.error('[AIRuntimeService] Failed to parse payload string:', error)

      return null

    }

  }



  if (payload && typeof payload === 'object') {

    return payload as StreamEvent

  }



  return null

}



function getPayloadSessionId(streamEvent: StreamEvent): string | null {

  const candidate = (streamEvent as { session_id?: unknown; sessionId?: unknown }).session_id ??

    (streamEvent as { session_id?: unknown; sessionId?: unknown }).sessionId

  return typeof candidate === 'string' && candidate.length > 0 ? candidate : null

}

