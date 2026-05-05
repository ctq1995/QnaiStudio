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
import type { ChatRunStatus, CurrentAssistantMessage } from './chat/chatEventUtils'

export type { UnifiedHistoryItem }

/**
 * 组合 hook — 返回与原 useEventChatStore 基本兼容的接口。
 *
 * 使用方式不变：
 *   const { messages, isStreaming, sendMessage, ... } = useEventChatStore()
 *
 * 注意：这里是兼容门面，不是细粒度订阅层。
 * 当前实现会先订阅 message/session/history 三个子 store，再拼装 facade；
 * 因此即使传入 selector，也不能保证 Zustand 原生 selector 那样的最小重渲染语义。
 *
 * 结论：
 * - 适合保留旧 API、渐进迁移现有调用方；
 * - 不应把它当成性能优化入口；
 * - 对重渲染敏感的新组件应直接订阅对应子 store。
 */
export function useEventChatStore(): EventChatFacade
export function useEventChatStore<T>(selector: (state: EventChatFacade) => T): T
export function useEventChatStore<T>(selector?: (state: EventChatFacade) => T) {
  // 兼容门面：这里故意保留“整块订阅后再组合”的实现，
  // 以避免在尚未完成迁移前引入隐藏行为差异。
  // 对性能敏感的场景请直接使用子 store，而不是依赖这里的 selector。
  const msgState = useChatMessageStore()
  const sessionState = useChatSessionStore()
  const historyState = useChatHistoryStore()

  const facade: EventChatFacade = {
    messages: msgState.messages,
    archivedMessages: msgState.archivedMessages,
    isArchiveExpanded: msgState.isArchiveExpanded,
    maxMessages: msgState.maxMessages,
    currentMessage: msgState.currentMessage,
    toolBlockMap: msgState.toolBlockMap,
    tokenBuffer: msgState.tokenBuffer,
    outputTokens: msgState.outputTokens,
    inputTokens: msgState.inputTokens,
    runStatus: msgState.runStatus,

    conversationId: sessionState.conversationId,
    isStreaming: sessionState.isStreaming,
    error: sessionState.error,
    isInitialized: sessionState.isInitialized,
    pendingQueue: sessionState.pendingQueue,
    activeQueueItem: sessionState.activeQueueItem,

    isLoadingHistory: historyState.isLoadingHistory,

    addMessage: (message) => {
      useChatMessageStore.getState().addMessage(message)
      useChatHistoryStore.getState().saveToStorage()
      useChatHistoryStore.getState().saveToHistory()
    },
    clearMessages: () => {
      useChatHistoryStore.getState().saveToHistory()
      useChatMessageStore.getState().clearMessages()
      useChatSessionStore.setState({ conversationId: null, pendingQueue: [], activeQueueItem: null })
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

    setConversationId: sessionState.setConversationId,
    setStreaming: sessionState.setStreaming,
    setError: sessionState.setError,
    initializeEventListeners: sessionState.initializeEventListeners,
    sendMessage: async (content, workspaceDir) => {
      await useChatSessionStore.getState().sendMessage(content, workspaceDir)
      useChatHistoryStore.getState().saveToStorage()
      useChatHistoryStore.getState().saveToHistory()
    },
    enqueueMessage: async (content, workspaceDir) => {
      await useChatSessionStore.getState().enqueueMessage(content, workspaceDir)
      useChatHistoryStore.getState().saveToStorage()
      useChatHistoryStore.getState().saveToHistory()
    },
    editQueuedMessage: (queueItemId, content) => {
      useChatSessionStore.getState().editQueuedMessage(queueItemId, content)
      useChatHistoryStore.getState().saveToStorage()
      useChatHistoryStore.getState().saveToHistory()
    },
    removeQueuedMessage: (queueItemId) => {
      useChatSessionStore.getState().removeQueuedMessage(queueItemId)
      useChatHistoryStore.getState().saveToStorage()
      useChatHistoryStore.getState().saveToHistory()
    },
    clearPendingQueue: () => {
      useChatSessionStore.getState().clearPendingQueue()
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

  if (selector) {
    return selector(facade)
  }
  return facade
}

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
    runStatus: msgState.runStatus,

    conversationId: sessionState.conversationId,
    isStreaming: sessionState.isStreaming,
    error: sessionState.error,
    isInitialized: sessionState.isInitialized,
    pendingQueue: sessionState.pendingQueue,
    activeQueueItem: sessionState.activeQueueItem,

    isLoadingHistory: historyState.isLoadingHistory,

    addMessage: (message) => {
      useChatMessageStore.getState().addMessage(message)
      useChatHistoryStore.getState().saveToStorage()
      useChatHistoryStore.getState().saveToHistory()
    },
    clearMessages: () => {
      useChatHistoryStore.getState().saveToHistory()
      useChatMessageStore.getState().clearMessages()
      useChatSessionStore.setState({ conversationId: null, pendingQueue: [], activeQueueItem: null })
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

    setConversationId: sessionState.setConversationId,
    setStreaming: sessionState.setStreaming,
    setError: sessionState.setError,
    initializeEventListeners: sessionState.initializeEventListeners,
    sendMessage: async (content, workspaceDir) => {
      await useChatSessionStore.getState().sendMessage(content, workspaceDir)
      useChatHistoryStore.getState().saveToStorage()
      useChatHistoryStore.getState().saveToHistory()
    },
    enqueueMessage: async (content, workspaceDir) => {
      await useChatSessionStore.getState().enqueueMessage(content, workspaceDir)
      useChatHistoryStore.getState().saveToStorage()
      useChatHistoryStore.getState().saveToHistory()
    },
    editQueuedMessage: (queueItemId, content) => {
      useChatSessionStore.getState().editQueuedMessage(queueItemId, content)
      useChatHistoryStore.getState().saveToStorage()
      useChatHistoryStore.getState().saveToHistory()
    },
    removeQueuedMessage: (queueItemId) => {
      useChatSessionStore.getState().removeQueuedMessage(queueItemId)
      useChatHistoryStore.getState().saveToStorage()
      useChatHistoryStore.getState().saveToHistory()
    },
    clearPendingQueue: () => {
      useChatSessionStore.getState().clearPendingQueue()
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

useEventChatStore.setState = (partial: Partial<EventChatFacade>) => {
  const msgKeys = ['messages', 'archivedMessages', 'isArchiveExpanded', 'maxMessages', 'currentMessage', 'toolBlockMap', 'tokenBuffer', 'outputTokens', 'inputTokens', 'runStatus'] as const
  const sessionKeys = ['conversationId', 'isStreaming', 'error', 'isInitialized', 'pendingQueue', 'activeQueueItem'] as const
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
import type { TokenBuffer } from '../utils/tokenBuffer'

export interface EventChatFacade {
  messages: ChatMessage[]
  archivedMessages: ChatMessage[]
  isArchiveExpanded: boolean
  conversationId: string | null
  isStreaming: boolean
  error: string | null
  maxMessages: number
  isInitialized: boolean
  isLoadingHistory: boolean
  runStatus: ChatRunStatus | null
  inputTokens: number
  outputTokens: number
  currentMessage: CurrentAssistantMessage | null
  toolBlockMap: Map<string, number>
  tokenBuffer: TokenBuffer | null
  pendingQueue: { id: string; content: string; workspaceDir?: string; status: 'queued' | 'running'; createdAt: string; messageId?: string }[]
  activeQueueItem: { id: string; content: string; workspaceDir?: string; status: 'queued' | 'running'; createdAt: string; messageId?: string } | null

  addMessage: (message: ChatMessage) => void
  clearMessages: () => void
  deleteMessage: (id: string) => void
  regenerateMessage: (id: string) => Promise<void>
  setConversationId: (id: string | null) => void
  setStreaming: (streaming: boolean) => void
  finishMessage: () => void
  setError: (error: string | null) => void
  addErrorMessage: (error: string) => void
  appendTextBlock: (content: string) => void
  appendToolCallBlock: (toolId: string, toolName: string, input: Record<string, unknown>) => void
  updateToolCallBlock: (toolId: string, status: ToolStatus, output?: string, error?: string) => void
  appendToolCallOutput: (toolId: string, chunk: string) => void
  updateCurrentAssistantMessage: (blocks: ContentBlock[]) => void
  initializeEventListeners: () => () => void
  sendMessage: (content: string, workspaceDir?: string) => Promise<void>
  enqueueMessage: (content: string, workspaceDir?: string) => Promise<void>
  editQueuedMessage: (queueItemId: string, content: string) => void
  removeQueuedMessage: (queueItemId: string) => void
  clearPendingQueue: () => void
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
