/**
 * 消息状态管理 Store
 *
 * 负责消息列表、当前流式消息构建、工具调用块管理。
 * 从 eventChatStore 拆分而来，保持完全相同的渲染行为。
 */
import { create } from 'zustand'
import type { ChatMessage, AssistantChatMessage, ContentBlock, ToolCallBlock, ToolStatus, PermissionBlock, PermissionDenial } from '../../types'
import { useToolPanelStore } from '../toolPanelStore'
import {
  generateToolSummary,
  calculateDuration,
} from '../../utils/toolSummary'
import { TokenBuffer } from '../../utils/tokenBuffer'
import { estimateMessageTokens } from '../../utils/tokenEstimator'
import {
  CurrentAssistantMessage,
  InlineAssistantStatus,
  ChatRunStatus,
  MAX_MESSAGES,
  MESSAGE_ARCHIVE_THRESHOLD,
} from './chatEventUtils'

function normalizeRepeatedErrorSegments(errorText: string): string {
  const normalized = errorText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (normalized.length % 2 === 0) {
    const half = normalized.length / 2
    const firstHalf = normalized.slice(0, half)
    const secondHalf = normalized.slice(half)
    if (firstHalf.every((line, index) => line === secondHalf[index])) {
      return firstHalf.join('\n')
    }
  }

  return normalized.join('\n')
}

export interface ChatMessageState {
  /** 消息列表 */
  messages: ChatMessage[]
  /** 归档的消息列表 */
  archivedMessages: ChatMessage[]
  /** 归档是否展开 */
  isArchiveExpanded: boolean
  /** 最大消息数配置 */
  maxMessages: number
  /** 当前正在构建的 Assistant 消息 */
  currentMessage: CurrentAssistantMessage | null
  /** 工具调用块映射 (toolUseId -> blockIndex) */
  toolBlockMap: Map<string, number>
  /** Token Buffer - 用于批量处理流式 token */
  tokenBuffer: TokenBuffer | null
  /** 当前会话的输出 token 数量 */
  outputTokens: number
  /** 当前会话的输入 token 数量 */
  inputTokens: number
  /** 当前会话的结构化运行状态 */
  runStatus: ChatRunStatus | null
  /** 当前会话实际使用的模型标签 */
  activeModelLabel: string | null
  /** 最近一次工具失败详情，用于和会话级 error 去重 */
  lastToolFailure: { toolId: string; message: string; pendingErrorDedup: boolean } | null

  // Actions
  addMessage: (message: ChatMessage) => void
  clearMessages: () => void
  deleteMessage: (id: string) => void
  setMaxMessages: (max: number) => void
  toggleArchive: () => void
  loadArchivedMessages: () => void
  appendTextBlock: (content: string) => void
  appendToolCallBlock: (toolId: string, toolName: string, input: Record<string, unknown>) => void
  updateToolCallBlock: (toolId: string, status: ToolStatus, output?: string, error?: string) => void
  appendToolCallOutput: (toolId: string, chunk: string) => void
  appendPermissionBlock: (payload: { sessionId: string; denials: PermissionDenial[]; engineId?: string; summary?: string; responseHint?: string; rawDetails?: Record<string, unknown>[] }) => void
  respondPermissionBlock: (sessionId: string, approved: boolean) => void
  updateCurrentAssistantMessage: (blocks: ContentBlock[], inlineStatus?: InlineAssistantStatus | null) => void
  finishMessage: () => void
  addErrorMessage: (error: string) => void
  setInlineStatus: (status: InlineAssistantStatus | null) => boolean
  clearInlineStatus: () => void
  setRunStatus: (status: ChatRunStatus | null) => void
  setActiveModelLabel: (label: string | null) => void
  resetStreamingState: () => void
  addInputTokens: (count: number) => void
  updateMessageContent: (id: string, content: string) => void
  updateMessageQueueState: (id: string, queueStatus?: 'queued' | 'running') => void
  setQueuedMessageId: (id: string, queueItemId?: string) => void
  setQueuedMessageContent: (queueItemId: string, content: string) => void
  truncateConversationBefore: (messageId: string) => void
}

export const useChatMessageStore = create<ChatMessageState>((set, get) => ({
  messages: [],
  archivedMessages: [],
  isArchiveExpanded: false,
  maxMessages: MAX_MESSAGES,
  currentMessage: null,
  toolBlockMap: new Map(),
  tokenBuffer: null,
  outputTokens: 0,
  inputTokens: 0,
  runStatus: null,
  activeModelLabel: null,
  lastToolFailure: null,

  addMessage: (message) => {
    set((state) => {
      const newMessages = [...state.messages, message]
      if (newMessages.length > MESSAGE_ARCHIVE_THRESHOLD) {
        const archiveCount = newMessages.length - state.maxMessages
        const toArchive = newMessages.slice(0, archiveCount)
        const remaining = newMessages.slice(archiveCount)
        return {
          messages: remaining,
          archivedMessages: toArchive,
        }
      }
      return { messages: newMessages }
    })
  },

  clearMessages: () => {
    const { tokenBuffer } = get()
    if (tokenBuffer) {
      tokenBuffer.destroy()
    }
    set({
      messages: [],
      archivedMessages: [],
      isArchiveExpanded: false,
      runStatus: null,
      activeModelLabel: null,
      lastToolFailure: null,
      currentMessage: null,
      toolBlockMap: new Map(),
      tokenBuffer: null,
      inputTokens: 0,
      outputTokens: 0,
    })
    useToolPanelStore.getState().clearTools()
  },

  deleteMessage: (id) => {
    set((state) => ({ messages: state.messages.filter((m) => m.id !== id) }))
  },

  setMaxMessages: (max) => {
    set({ maxMessages: Math.max(100, max) })
    const { messages, archivedMessages } = get()
    if (messages.length > max) {
      const archiveCount = messages.length - max
      const toArchive = messages.slice(0, archiveCount)
      const remaining = messages.slice(archiveCount)
      set({
        messages: remaining,
        archivedMessages: [...toArchive, ...archivedMessages] as ChatMessage[],
      })
    }
  },

  toggleArchive: () => {
    set((state) => ({
      isArchiveExpanded: !state.isArchiveExpanded,
    }))
  },

  loadArchivedMessages: () => {
    const { archivedMessages } = get()
    if (archivedMessages.length === 0) return
    set({
      messages: [...archivedMessages, ...get().messages],
      archivedMessages: [],
      isArchiveExpanded: false,
    })
  },

  appendTextBlock: (content) => {
    const { currentMessage, tokenBuffer } = get()
    const now = new Date().toISOString()

    if (!currentMessage) {
      const textBlock: ContentBlock = { type: 'text', content }
      const newMessage: CurrentAssistantMessage = {
        id: crypto.randomUUID(),
        blocks: [textBlock],
        isStreaming: true,
        inlineStatus: null,
      }
      set({ currentMessage: newMessage })

      get().addMessage({
        id: newMessage.id,
        type: 'assistant',
        blocks: newMessage.blocks,
        timestamp: now,
        isStreaming: true,
        inlineStatus: null,
      } as AssistantChatMessage)

      const newBuffer = new TokenBuffer((batchedContent) => {
        const state = get()
        const msg = state.currentMessage
        if (!msg) return
        const lastBlock = msg.blocks[msg.blocks.length - 1]
        if (lastBlock && lastBlock.type === 'text') {
          const updatedBlocks: ContentBlock[] = [...msg.blocks]
          updatedBlocks[updatedBlocks.length - 1] = {
            type: 'text',
            content: (lastBlock as { type: 'text'; content: string }).content + batchedContent,
          }
          set((state) => ({
            currentMessage: state.currentMessage
              ? { ...state.currentMessage, blocks: updatedBlocks, inlineStatus: null }
              : null,
          }))
          get().updateCurrentAssistantMessage(updatedBlocks, null)
        } else {
          const textBlock: ContentBlock = { type: 'text', content: batchedContent }
          const updatedBlocks: ContentBlock[] = [...msg.blocks, textBlock]
          set((state) => ({
            currentMessage: state.currentMessage
              ? { ...state.currentMessage, blocks: updatedBlocks, inlineStatus: null }
              : null,
          }))
          get().updateCurrentAssistantMessage(updatedBlocks, null)
        }
      }, { maxDelay: 50, maxSize: 500 })
      set({ tokenBuffer: newBuffer })
    } else if (tokenBuffer) {
      tokenBuffer.append(content)
    } else {
      const lastBlock = currentMessage.blocks[currentMessage.blocks.length - 1]
      if (lastBlock && lastBlock.type === 'text') {
        const updatedBlocks: ContentBlock[] = [...currentMessage.blocks]
        updatedBlocks[updatedBlocks.length - 1] = {
          type: 'text',
          content: (lastBlock as { type: 'text'; content: string }).content + content,
        }
        set((state) => ({
          currentMessage: state.currentMessage
            ? { ...state.currentMessage, blocks: updatedBlocks, inlineStatus: null }
            : null,
        }))
        get().updateCurrentAssistantMessage(updatedBlocks, null)
      } else {
        const textBlock: ContentBlock = { type: 'text', content }
        const updatedBlocks: ContentBlock[] = [...currentMessage.blocks, textBlock]
        set((state) => ({
          currentMessage: state.currentMessage
            ? { ...state.currentMessage, blocks: updatedBlocks, inlineStatus: null }
            : null,
        }))
        get().updateCurrentAssistantMessage(updatedBlocks, null)
      }
    }
  },

  appendToolCallBlock: (toolId, toolName, input) => {
    const { currentMessage } = get()
    const toolPanelStore = useToolPanelStore.getState()
    const now = new Date().toISOString()

    if (!currentMessage) {
      const newMessage: CurrentAssistantMessage = {
        id: crypto.randomUUID(),
        blocks: [],
        isStreaming: true,
        inlineStatus: null,
      }
      set({ currentMessage: newMessage })
      const { messages } = get()
      set({ messages: [...messages, { type: 'assistant', id: newMessage.id, role: 'assistant', blocks: [], timestamp: now, isStreaming: true, inlineStatus: null } as AssistantChatMessage] })
    }

    const currentMsg = get().currentMessage
    const toolBlock: ToolCallBlock = {
      type: 'tool_call',
      id: toolId,
      name: toolName,
      input,
      status: 'pending',
      startedAt: now,
    }

    if (!currentMsg) return
    const updatedBlocks: ContentBlock[] = [...currentMsg.blocks, toolBlock]
    const blockIndex = updatedBlocks.length - 1

    const newToolBlockMap = new Map(get().toolBlockMap)
    newToolBlockMap.set(toolId, blockIndex)

    set((state) => ({
      currentMessage: state.currentMessage
        ? { ...state.currentMessage, blocks: updatedBlocks }
        : null,
      toolBlockMap: newToolBlockMap,
    }))

    get().updateCurrentAssistantMessage(updatedBlocks)

    toolPanelStore.addTool({
      id: toolId,
      name: toolName,
      status: 'pending',
      input,
      startedAt: now,
    })

    const summary = generateToolSummary(toolName, input, 'pending')
    set({
      runStatus: { kind: 'tool', summary, detail: null, toolName, updatedAt: new Date().toISOString(), scope: 'session' },
      lastToolFailure: null,
    })
  },

  updateToolCallBlock: (toolId, status, output, error) => {
    const { currentMessage, toolBlockMap } = get()
    const toolPanelStore = useToolPanelStore.getState()
    const blockIndex = toolBlockMap.get(toolId)

    if (!currentMessage || blockIndex === undefined) {
      console.warn('[ChatMessageStore] Tool block not found:', toolId)
      return
    }

    const block = currentMessage.blocks[blockIndex]
    if (!block || block.type !== 'tool_call') {
      console.warn('[ChatMessageStore] Invalid tool block at index:', blockIndex)
      return
    }

    const now = new Date().toISOString()
    const duration = calculateDuration(block.startedAt, now)
    const finalOutput = output && output.length > 0 ? output : block.output

    const updatedBlock: ToolCallBlock = {
      ...block,
      status,
      output: finalOutput,
      error,
      completedAt: now,
      duration,
    }
    const updatedBlocks = [...currentMessage.blocks]
    updatedBlocks[blockIndex] = updatedBlock

    set((state) => ({
      currentMessage: state.currentMessage
        ? { ...state.currentMessage, blocks: updatedBlocks }
        : null,
    }))

    get().updateCurrentAssistantMessage(updatedBlocks)

    toolPanelStore.updateTool(toolId, {
      status,
      output: output ? String(output) : undefined,
      completedAt: now,
    })

    const summary = generateToolSummary(block.name, block.input, status)
    set({
      runStatus: status === 'failed'
        ? null
        : { kind: 'tool', summary, detail: null, toolName: block.name, updatedAt: new Date().toISOString(), scope: 'session' },
      lastToolFailure: status === 'failed'
        ? { toolId, message: (error ?? finalOutput ?? summary ?? '').trim(), pendingErrorDedup: true }
        : null,
    })
  },

  appendToolCallOutput: (toolId, chunk) => {
    const { currentMessage, toolBlockMap } = get()
    const toolPanelStore = useToolPanelStore.getState()
    const blockIndex = toolBlockMap.get(toolId)

    if (!currentMessage || blockIndex === undefined) {
      console.warn('[ChatMessageStore] Tool block not found:', toolId)
      return
    }

    const block = currentMessage.blocks[blockIndex]
    if (!block || block.type !== 'tool_call') {
      console.warn('[ChatMessageStore] Invalid tool block at index:', blockIndex)
      return
    }

    const output = `${block.output || ''}${chunk}`
    const updatedBlock: ToolCallBlock = {
      ...block,
      status: 'running',
      output,
    }
    const updatedBlocks = [...currentMessage.blocks]
    updatedBlocks[blockIndex] = updatedBlock

    set((state) => ({
      currentMessage: state.currentMessage
        ? { ...state.currentMessage, blocks: updatedBlocks }
        : null,
    }))
    get().updateCurrentAssistantMessage(updatedBlocks)

    toolPanelStore.updateTool(toolId, {
      status: 'running',
      output,
    })
  },

  appendPermissionBlock: ({ sessionId, denials, engineId, summary, responseHint, rawDetails }) => {
    const { currentMessage } = get()
    const now = new Date().toISOString()

    if (!currentMessage) {
      const newMessage: CurrentAssistantMessage = {
        id: crypto.randomUUID(),
        blocks: [],
        isStreaming: true,
        inlineStatus: null,
      }
      set({ currentMessage: newMessage })
      const { messages } = get()
      set({ messages: [...messages, { type: 'assistant', id: newMessage.id, role: 'assistant', blocks: [], timestamp: now, isStreaming: true, inlineStatus: null } as AssistantChatMessage] })
    }

    const currentMsg = get().currentMessage
    if (!currentMsg) return

    const existingCount = currentMsg.blocks.filter((block) => block.type === 'permission_request' && block.sessionId === sessionId).length
    const permissionBlock: PermissionBlock = {
      type: 'permission_request',
      id: crypto.randomUUID(),
      sessionId,
      engineId,
      summary,
      denials,
      rawDetails,
      responseHint,
      requestCount: existingCount + 1,
      status: 'pending',
    }

    const updatedBlocks: ContentBlock[] = [...currentMsg.blocks, permissionBlock]
    set((state) => ({
      currentMessage: state.currentMessage ? { ...state.currentMessage, blocks: updatedBlocks } : null,
      runStatus: { kind: 'running', summary: '等待权限确认...', detail: null, updatedAt: now, scope: 'session' },
    }))
    get().updateCurrentAssistantMessage(updatedBlocks)
  },

  respondPermissionBlock: (sessionId, approved) => {
    const { currentMessage } = get()
    if (!currentMessage) return
    const now = new Date().toISOString()
    const updatedBlocks = currentMessage.blocks.map((block) => {
      if (block.type === 'permission_request' && block.sessionId === sessionId && block.status === 'pending') {
        return {
          ...block,
          status: (approved ? 'approved' : 'denied') as 'approved' | 'denied',
          respondedAt: now,
        }
      }
      return block
    })
    set((state) => ({
      currentMessage: state.currentMessage ? { ...state.currentMessage, blocks: updatedBlocks } : null,
      runStatus: { kind: 'running', summary: approved ? '已批准，继续执行...' : '已拒绝，等待 CLI 处理...', detail: null, updatedAt: now, scope: 'session' },
    }))
    get().updateCurrentAssistantMessage(updatedBlocks)
  },

  updateCurrentAssistantMessage: (blocks, inlineStatus) => {
    const { currentMessage } = get()
    if (!currentMessage) return
    set((state) => ({
      messages: state.messages.map(msg =>
        msg.id === currentMessage.id
          ? ({
              ...msg,
              blocks,
              inlineStatus: inlineStatus === undefined
                ? state.currentMessage?.inlineStatus ?? null
                : inlineStatus,
            } as unknown as AssistantChatMessage)
          : msg
      ),
    }))
  },

  finishMessage: () => {
    const { currentMessage, messages, tokenBuffer } = get()
    if (tokenBuffer) {
      tokenBuffer.end()
    }
    if (currentMessage) {
      const textContent = currentMessage.blocks
        .filter((b: ContentBlock) => b.type === 'text')
        .map((b: any) => b.content)
        .join('')
      const assistantTokens = estimateMessageTokens(textContent)

      const completedMessage = {
        id: currentMessage.id,
        type: 'assistant',
        blocks: currentMessage.blocks,
        timestamp: new Date().toISOString(),
        isStreaming: false,
        inlineStatus: currentMessage.inlineStatus ?? null,
      } as unknown as AssistantChatMessage

      const messageIndex = messages.findIndex(m => m.id === currentMessage.id)
      if (messageIndex >= 0) {
        set((state) => ({
          messages: state.messages.map((m, i) =>
            i === messageIndex ? completedMessage : m
          ),
          outputTokens: state.outputTokens + assistantTokens,
          currentMessage: null,
          runStatus: null,
          lastToolFailure: null,
          tokenBuffer: null,
        }))
      } else {
        set((state) => ({
          messages: [...state.messages, completedMessage],
          outputTokens: state.outputTokens + assistantTokens,
          currentMessage: null,
          runStatus: null,
          lastToolFailure: null,
          tokenBuffer: null,
        }))
      }
    }
  },

  addErrorMessage: (errorText) => {
    const normalizedError = normalizeRepeatedErrorSegments(errorText)
    const reconnectMatch = normalizedError.match(/^Reconnecting\.\.\.\s*(\d+\/\d+)/i)
    const recentToolFailure = get().lastToolFailure
    const normalizedToolFailure = recentToolFailure?.message.trim()
    const matchesRecentToolFailure =
      !!recentToolFailure?.pendingErrorDedup &&
      !!normalizedToolFailure &&
      !!normalizedError &&
      (normalizedError === normalizedToolFailure ||
        normalizedError.includes(normalizedToolFailure) ||
        normalizedToolFailure.includes(normalizedError))

    if (matchesRecentToolFailure) {
      get().setRunStatus(null)
      set({
        lastToolFailure: recentToolFailure
          ? { ...recentToolFailure, pendingErrorDedup: false }
          : null,
      })
      return
    }

    const inlineStatus: InlineAssistantStatus = reconnectMatch
      ? {
          kind: 'reconnecting',
          summary: `连接中断，正在重连 ${reconnectMatch[1]}`,
          detail: normalizedError,
        }
      : {
          kind: 'error',
          summary: normalizedError.split('\n')[0] || '执行出错',
          detail: normalizedError,
        }

    get().setRunStatus(null)
    set({ lastToolFailure: null })

    if (get().currentMessage || [...get().messages].reverse().some((message) => message.type === 'assistant')) {
      get().setInlineStatus(inlineStatus)
      return
    }

    const formattedError = '⚠️ ' + normalizedError
    const errorMsg: AssistantChatMessage = {
      type: 'assistant',
      id: 'error-' + Date.now(),
      blocks: [{ type: 'text', content: formattedError }],
      timestamp: new Date().toISOString(),
      isStreaming: false,
      inlineStatus,
    } as unknown as AssistantChatMessage

    set((state) => {
      const lastMessage = state.messages[state.messages.length - 1]
      if (
        lastMessage?.type === 'assistant' &&
        (lastMessage as any).inlineStatus?.detail === inlineStatus.detail &&
        (lastMessage as any).inlineStatus?.kind === inlineStatus.kind
      ) {
        return state
      }

      return { messages: [...state.messages, errorMsg] }
    })
  },

  setInlineStatus: (status) => {
    const { currentMessage, messages } = get()
    const fallbackAssistant = [...messages].reverse().find((message) => message.type === 'assistant') as AssistantChatMessage | undefined
    const targetId = currentMessage?.id ?? fallbackAssistant?.id

    if (!targetId) {
      return false
    }

    set((state) => ({
      currentMessage: state.currentMessage && state.currentMessage.id === targetId
        ? { ...state.currentMessage, inlineStatus: status }
        : state.currentMessage,
      messages: state.messages.map((message) => (
        message.id === targetId && message.type === 'assistant'
          ? { ...message, inlineStatus: status } as AssistantChatMessage
          : message
      )),
    }))

    return true
  },

  clearInlineStatus: () => {
    get().setInlineStatus(null)
  },

  setRunStatus: (status) => {
    set({ runStatus: status })
  },

  setActiveModelLabel: (label) => {
    set({ activeModelLabel: label })
  },

  resetStreamingState: () => {
    const { tokenBuffer } = get()
    if (tokenBuffer) {
      tokenBuffer.destroy()
    }
    set({
      currentMessage: null,
      toolBlockMap: new Map(),
      tokenBuffer: null,
      runStatus: null,
      activeModelLabel: null,
      lastToolFailure: null,
    })
  },

  truncateConversationBefore: (messageId) => {
    const { tokenBuffer, archivedMessages, messages, maxMessages } = get()
    if (tokenBuffer) {
      tokenBuffer.destroy()
    }

    const combinedMessages = [...archivedMessages, ...messages]
    const targetIndex = combinedMessages.findIndex((message) => message.id === messageId)
    if (targetIndex < 0) {
      set({
        currentMessage: null,
        toolBlockMap: new Map(),
        tokenBuffer: null,
        runStatus: null,
        activeModelLabel: null,
        lastToolFailure: null,
      })
      return
    }

    const nextCombinedMessages = combinedMessages.slice(0, targetIndex)
    const overflowCount = Math.max(0, nextCombinedMessages.length - maxMessages)

    set({
      archivedMessages: overflowCount > 0 ? nextCombinedMessages.slice(0, overflowCount) : [],
      messages: overflowCount > 0 ? nextCombinedMessages.slice(overflowCount) : nextCombinedMessages,
      isArchiveExpanded: false,
      currentMessage: null,
      toolBlockMap: new Map(),
      tokenBuffer: null,
      runStatus: null,
      activeModelLabel: null,
      lastToolFailure: null,
    })
  },

  addInputTokens: (count) => {
    set((state) => ({ inputTokens: state.inputTokens + count }))
  },

  updateMessageContent: (id, content) => {
    set((state) => ({
      messages: state.messages.map((message) => (
        message.id === id && message.type === 'user'
          ? { ...message, content }
          : message
      )),
    }))
  },

  updateMessageQueueState: (id, queueStatus) => {
    set((state) => ({
      messages: state.messages.map((message) => (
        message.id === id && message.type === 'user'
          ? { ...message, queueStatus }
          : message
      )),
    }))
  },

  setQueuedMessageId: (id, queueItemId) => {
    set((state) => ({
      messages: state.messages.map((message) => (
        message.id === id && message.type === 'user'
          ? { ...message, queueItemId }
          : message
      )),
    }))
  },

  setQueuedMessageContent: (queueItemId, content) => {
    set((state) => ({
      messages: state.messages.map((message) => (
        message.type === 'user' && message.queueItemId === queueItemId
          ? { ...message, content }
          : message
      )),
    }))
  },
}))
