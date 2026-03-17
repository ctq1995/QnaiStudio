/**
 * 事件驱动的 Chat Store — 向后兼容门面
 *
 * 将 chatMessageStore、chatSessionStore、chatHistoryStore 组合为
 * 与原 eventChatStore 完全相同的公共 API，所有现有消费者无需修改。
 *
 * 架构说明：
 * 1. Tauri 'chat-event' → convertStreamEventToAIEvents() → EventBus.emit()
 * 2. EventBus → DeveloperPanel（调试面板）
 * 3. 本地处理逻辑 → UI 更新
 */
import { useChatMessageStore } from './chat/chatMessageStore'
import { useChatSessionStore } from './chat/chatSessionStore'
import { useChatHistoryStore, type UnifiedHistoryItem } from './chat/chatHistoryStore'

export type { UnifiedHistoryItem }

/**
 * 组合 hook — 返回与原 useEventChatStore 完全相同的接口
 *
 * 使用方式不变：
 *   const { messages, isStreaming, sendMessage, ... } = useEventChatStore()
 *
 * 性能提升：组件现在可以按需只订阅需要的子 store，
 * 例如只关心消息列表的组件不会因为 isStreaming 变化而重渲染。
 */
export function useEventChatStore(): EventChatFacade
export function useEventChatStore<T>(selector: (state: EventChatFacade) => T): T
export function useEventChatStore<T>(selector?: (state: EventChatFacade) => T) {
  const msgState = useChatMessageStore()
  const sessionState = useChatSessionStore()
  const historyState = useChatHistoryStore()

  const facade: EventChatFacade = {
    // === chatMessageStore state ===
    messages: msgState.messages,
    archivedMessages: msgState.archivedMessages,
    isArchiveExpanded: msgState.isArchiveExpanded,
    maxMessages: msgState.maxMessages,
    currentMessage: msgState.currentMessage,
    toolBlockMap: msgState.toolBlockMap,
    tokenBuffer: msgState.tokenBuffer,
    outputTokens: msgState.outputTokens,
    inputTokens: msgState.inputTokens,
    progressMessage: msgState.progressMessage,

    // === chatSessionStore state ===
    conversationId: sessionState.conversationId,
    isStreaming: sessionState.isStreaming,
    error: sessionState.error,
    isInitialized: sessionState.isInitialized,

    // === chatHistoryStore state ===
    isLoadingHistory: historyState.isLoadingHistory,

    // === chatMessageStore actions ===
    addMessage: (message) => {
      useChatMessageStore.getState().addMessage(message)
      useChatHistoryStore.getState().saveToStorage()
      useChatHistoryStore.getState().saveToHistory()
    },
    clearMessages: () => {
      useChatHistoryStore.getState().saveToHistory()
      useChatMessageStore.getState().clearMessages()
      useChatSessionStore.setState({ conversationId: null })
    },
    deleteMessage: msgState.deleteMessage,
    setMaxMessages: msgState.setMaxMessages,
    toggleArchive: msgState.toggleArchive,
    loadArchivedMessages: msgState.loadArchivedMessages,
    appendTextBlock: msgState.appendTextBlock,
    appendToolCallBlock: msgState.appendToolCallBlock,
    updateToolCallBlock: msgState.updateToolCallBlock,
    appendToolCallOutput: msgState.appendToolCallOutput,
    updateCurrentAssistantMessage: msgState.updateCurrentAssistantMessage,
    finishMessage: () => {
      useChatMessageStore.getState().finishMessage()
      useChatSessionStore.setState({ isStreaming: false })
      useChatHistoryStore.getState().saveToStorage()
      useChatHistoryStore.getState().saveToHistory()
    },
    addErrorMessage: msgState.addErrorMessage,
    setProgressMessage: msgState.setProgressMessage,

    // === chatSessionStore actions ===
    setConversationId: sessionState.setConversationId,
    setStreaming: sessionState.setStreaming,
    setError: sessionState.setError,
    initializeEventListeners: sessionState.initializeEventListeners,
    sendMessage: async (content, workspaceDir) => {
      await useChatSessionStore.getState().sendMessage(content, workspaceDir)
      useChatHistoryStore.getState().saveToStorage()
      useChatHistoryStore.getState().saveToHistory()
    },
    continueChat: sessionState.continueChat,
    interruptChat: sessionState.interruptChat,
    regenerateMessage: sessionState.regenerateMessage,

    // === chatHistoryStore actions ===
    saveToStorage: historyState.saveToStorage,
    restoreFromStorage: historyState.restoreFromStorage,
    saveToHistory: historyState.saveToHistory,
    getUnifiedHistory: historyState.getUnifiedHistory,
    restoreFromHistory: historyState.restoreFromHistory,
    deleteHistorySession: historyState.deleteHistorySession,
    clearHistory: historyState.clearHistory,
  }

  if (selector) {
    return selector(facade)
  }
  return facade
}

/**
 * 静态方法 — 兼容 useEventChatStore.getState() 调用
 */
useEventChatStore.getState = (): EventChatFacade => {
  const msgState = useChatMessageStore.getState()
  const sessionState = useChatSessionStore.getState()
  const historyState = useChatHistoryStore.getState()

  return {
    messages: msgState.messages,
    archivedMessages: msgState.archivedMessages,
    isArchiveExpanded: msgState.isArchiveExpanded,
    maxMessages: msgState.maxMessages,
    currentMessage: msgState.currentMessage,
    toolBlockMap: msgState.toolBlockMap,
    tokenBuffer: msgState.tokenBuffer,
    outputTokens: msgState.outputTokens,
    inputTokens: msgState.inputTokens,
    progressMessage: msgState.progressMessage,

    conversationId: sessionState.conversationId,
    isStreaming: sessionState.isStreaming,
    error: sessionState.error,
    isInitialized: sessionState.isInitialized,

    isLoadingHistory: historyState.isLoadingHistory,

    addMessage: (message) => {
      useChatMessageStore.getState().addMessage(message)
      useChatHistoryStore.getState().saveToStorage()
      useChatHistoryStore.getState().saveToHistory()
    },
    clearMessages: () => {
      useChatHistoryStore.getState().saveToHistory()
      useChatMessageStore.getState().clearMessages()
      useChatSessionStore.setState({ conversationId: null })
    },
    deleteMessage: msgState.deleteMessage,
    setMaxMessages: msgState.setMaxMessages,
    toggleArchive: msgState.toggleArchive,
    loadArchivedMessages: msgState.loadArchivedMessages,
    appendTextBlock: msgState.appendTextBlock,
    appendToolCallBlock: msgState.appendToolCallBlock,
    updateToolCallBlock: msgState.updateToolCallBlock,
    appendToolCallOutput: msgState.appendToolCallOutput,
    updateCurrentAssistantMessage: msgState.updateCurrentAssistantMessage,
    finishMessage: () => {
      useChatMessageStore.getState().finishMessage()
      useChatSessionStore.setState({ isStreaming: false })
      useChatHistoryStore.getState().saveToStorage()
      useChatHistoryStore.getState().saveToHistory()
    },
    addErrorMessage: msgState.addErrorMessage,
    setProgressMessage: msgState.setProgressMessage,

    setConversationId: sessionState.setConversationId,
    setStreaming: sessionState.setStreaming,
    setError: sessionState.setError,
    initializeEventListeners: sessionState.initializeEventListeners,
    sendMessage: async (content, workspaceDir) => {
      await useChatSessionStore.getState().sendMessage(content, workspaceDir)
      useChatHistoryStore.getState().saveToStorage()
      useChatHistoryStore.getState().saveToHistory()
    },
    continueChat: sessionState.continueChat,
    interruptChat: sessionState.interruptChat,
    regenerateMessage: sessionState.regenerateMessage,

    saveToStorage: historyState.saveToStorage,
    restoreFromStorage: historyState.restoreFromStorage,
    saveToHistory: historyState.saveToHistory,
    getUnifiedHistory: historyState.getUnifiedHistory,
    restoreFromHistory: historyState.restoreFromHistory,
    deleteHistorySession: historyState.deleteHistorySession,
    clearHistory: historyState.clearHistory,
  }
}

/**
 * 静态方法 — 兼容 useEventChatStore.setState() 调用
 */
useEventChatStore.setState = (partial: Partial<EventChatFacade>) => {
  // 分发到对应的子 store
  const msgKeys = ['messages', 'archivedMessages', 'isArchiveExpanded', 'maxMessages', 'currentMessage', 'toolBlockMap', 'tokenBuffer', 'outputTokens', 'inputTokens', 'progressMessage'] as const
  const sessionKeys = ['conversationId', 'isStreaming', 'error', 'isInitialized'] as const
  const historyKeys = ['isLoadingHistory'] as const

  const msgPartial: Record<string, unknown> = {}
  const sessionPartial: Record<string, unknown> = {}
  const historyPartial: Record<string, unknown> = {}

  for (const key of msgKeys) {
    if (key in partial) msgPartial[key] = (partial as any)[key]
  }
  for (const key of sessionKeys) {
    if (key in partial) sessionPartial[key] = (partial as any)[key]
  }
  for (const key of historyKeys) {
    if (key in partial) historyPartial[key] = (partial as any)[key]
  }

  if (Object.keys(msgPartial).length > 0) useChatMessageStore.setState(msgPartial as any)
  if (Object.keys(sessionPartial).length > 0) useChatSessionStore.setState(sessionPartial as any)
  if (Object.keys(historyPartial).length > 0) useChatHistoryStore.setState(historyPartial as any)
}

// ============================================================================
// 类型定义 — 与原 EventChatState 完全一致
// ============================================================================
import type { ChatMessage, ContentBlock, ToolStatus } from '../types'
import type { CurrentAssistantMessage } from './chat/chatEventUtils'
import type { TokenBuffer } from '../utils/tokenBuffer'

export interface EventChatFacade {
  // State
  messages: ChatMessage[]
  archivedMessages: ChatMessage[]
  isArchiveExpanded: boolean
  conversationId: string | null
  isStreaming: boolean
  error: string | null
  maxMessages: number
  isInitialized: boolean
  isLoadingHistory: boolean
  progressMessage: string | null
  inputTokens: number
  outputTokens: number
  currentMessage: CurrentAssistantMessage | null
  toolBlockMap: Map<string, number>
  tokenBuffer: TokenBuffer | null

  // Actions
  addMessage: (message: ChatMessage) => void
  clearMessages: () => void
  deleteMessage: (id: string) => void
  regenerateMessage: (id: string) => Promise<void>
  setConversationId: (id: string | null) => void
  setStreaming: (streaming: boolean) => void
  finishMessage: () => void
  setError: (error: string | null) => void
  addErrorMessage: (error: string) => void
  setProgressMessage: (message: string | null) => void
  appendTextBlock: (content: string) => void
  appendToolCallBlock: (toolId: string, toolName: string, input: Record<string, unknown>) => void
  updateToolCallBlock: (toolId: string, status: ToolStatus, output?: string, error?: string) => void
  appendToolCallOutput: (toolId: string, chunk: string) => void
  updateCurrentAssistantMessage: (blocks: ContentBlock[]) => void
  initializeEventListeners: () => () => void
  sendMessage: (content: string, workspaceDir?: string) => Promise<void>
  continueChat: (prompt?: string) => Promise<void>
  interruptChat: () => Promise<void>
  setMaxMessages: (max: number) => void
  toggleArchive: () => void
  loadArchivedMessages: () => void
  saveToStorage: () => void
  restoreFromStorage: () => boolean
  saveToHistory: (title?: string) => void
  getUnifiedHistory: () => Promise<UnifiedHistoryItem[]>
  restoreFromHistory: (sessionId: string, engineId?: 'claude-code' | 'iflow' | 'codex-cli' | 'gemini') => Promise<boolean>
  deleteHistorySession: (sessionId: string, source?: 'local' | 'iflow') => void
  clearHistory: () => void
}
