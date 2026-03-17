/**
 * 消息状态管理 Store
 *
 * 负责消息列表、当前流式消息构建、工具调用块管理。
 * 从 eventChatStore 拆分而来，保持完全相同的渲染行为。
 */
import { create } from 'zustand'
import type { ChatMessage, AssistantChatMessage, ContentBlock, ToolCallBlock, ToolStatus } from '../../types'
import { useToolPanelStore } from '../toolPanelStore'
import {
  generateToolSummary,
  calculateDuration,
} from '../../utils/toolSummary'
import { TokenBuffer } from '../../utils/tokenBuffer'
import { estimateMessageTokens } from '../../utils/tokenEstimator'
import {
  CurrentAssistantMessage,
  MAX_MESSAGES,
  MESSAGE_ARCHIVE_THRESHOLD,
} from './chatEventUtils'

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
  /** 进度消息 */
  progressMessage: string | null

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
  updateCurrentAssistantMessage: (blocks: ContentBlock[]) => void
  finishMessage: () => void
  addErrorMessage: (error: string) => void
  setProgressMessage: (message: string | null) => void
  /** 重置流式构建状态（不清空消息） */
  resetStreamingState: () => void
  /** 增加输入 token 计数 */
  addInputTokens: (count: number) => void
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
  progressMessage: null,

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
      progressMessage: null,
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
      // 首次调用：创建新消息
      const textBlock: ContentBlock = { type: 'text', content }
      const newMessage: CurrentAssistantMessage = {
        id: crypto.randomUUID(),
        blocks: [textBlock],
        isStreaming: true,
      }
      set({ currentMessage: newMessage })

      // 立即添加到消息列表
      get().addMessage({
        id: newMessage.id,
        type: 'assistant',
        blocks: newMessage.blocks,
        timestamp: now,
        isStreaming: true,
      })

      // 创建 TokenBuffer 用于后续的批量处理
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
              ? { ...state.currentMessage, blocks: updatedBlocks }
              : null,
          }))
          get().updateCurrentAssistantMessage(updatedBlocks)
        } else {
          const textBlock: ContentBlock = { type: 'text', content: batchedContent }
          const updatedBlocks: ContentBlock[] = [...msg.blocks, textBlock]
          set((state) => ({
            currentMessage: state.currentMessage
              ? { ...state.currentMessage, blocks: updatedBlocks }
              : null,
          }))
          get().updateCurrentAssistantMessage(updatedBlocks)
        }
      }, { maxDelay: 50, maxSize: 500 })
      set({ tokenBuffer: newBuffer })
    } else if (tokenBuffer) {
      // 有 TokenBuffer，使用批量处理
      tokenBuffer.append(content)
    } else {
      // 降级：直接更新（用于非流式场景）
      const lastBlock = currentMessage.blocks[currentMessage.blocks.length - 1]
      if (lastBlock && lastBlock.type === 'text') {
        const updatedBlocks: ContentBlock[] = [...currentMessage.blocks]
        updatedBlocks[updatedBlocks.length - 1] = {
          type: 'text',
          content: (lastBlock as { type: 'text'; content: string }).content + content,
        }
        set((state) => ({
          currentMessage: state.currentMessage
            ? { ...state.currentMessage, blocks: updatedBlocks }
            : null,
        }))
        get().updateCurrentAssistantMessage(updatedBlocks)
      } else {
        const textBlock: ContentBlock = { type: 'text', content }
        const updatedBlocks: ContentBlock[] = [...currentMessage.blocks, textBlock]
        set((state) => ({
          currentMessage: state.currentMessage
            ? { ...state.currentMessage, blocks: updatedBlocks }
            : null,
        }))
        get().updateCurrentAssistantMessage(updatedBlocks)
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
      }
      set({ currentMessage: newMessage })
      const { messages } = get()
      set({ messages: [...messages, { type: 'assistant', id: newMessage.id, role: 'assistant', blocks: [], timestamp: now, isStreaming: true } as AssistantChatMessage] })
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

    if (!currentMsg) { return }
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
    set({ progressMessage: summary })
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
    set({ progressMessage: summary })
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

  updateCurrentAssistantMessage: (blocks: ContentBlock[]) => {
    const { currentMessage } = get()
    if (!currentMessage) return
    set((state) => ({
      messages: state.messages.map(msg =>
        msg.id === currentMessage!.id
          ? { ...msg, blocks } as AssistantChatMessage
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

      const completedMessage: AssistantChatMessage = {
        id: currentMessage.id,
        type: 'assistant',
        blocks: currentMessage.blocks,
        timestamp: new Date().toISOString(),
        isStreaming: false,
      }

      const messageIndex = messages.findIndex(m => m.id === currentMessage.id)
      if (messageIndex >= 0) {
        set((state) => ({
          messages: state.messages.map((m, i) =>
            i === messageIndex ? completedMessage : m
          ),
          outputTokens: state.outputTokens + assistantTokens,
          currentMessage: null,
          progressMessage: null,
          tokenBuffer: null,
        }))
      } else {
        set((state) => ({
          messages: [...state.messages, completedMessage],
          outputTokens: state.outputTokens + assistantTokens,
          currentMessage: null,
          progressMessage: null,
          tokenBuffer: null,
        }))
      }
    }
  },

  addErrorMessage: (errorText) => {
    const { messages } = get()
    const errorMsg = {
      type: "assistant" as const,
      id: "error-" + Date.now(),
      role: "assistant" as const,
      blocks: [{ type: "text" as const, content: "⚠️ " + errorText }],
      timestamp: new Date().toISOString(),
      isStreaming: false,
      isError: true,
    }
    set({ messages: [...messages, errorMsg as any] })
  },

  setProgressMessage: (message) => {
    set({ progressMessage: message })
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
    })
  },

  addInputTokens: (count) => {
    set((state) => ({ inputTokens: state.inputTokens + count }))
  },
}))
