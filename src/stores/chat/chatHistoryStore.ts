/**
 * 历史记录管理 Store
 *
 * 负责会话持久化、历史浏览与恢复。
 * 从 eventChatStore 拆分而来。
 */
import { create } from 'zustand'
import type { ChatMessage, AssistantChatMessage, UserChatMessage, SystemChatMessage } from '../../types'
import type { EngineId } from '../../types'
import { useToolPanelStore } from '../toolPanelStore'
import { useWorkspaceStore } from '../workspaceStore'
import { useConfigStore } from '../configStore'
import { getIFlowHistoryService } from '../../services/iflowHistoryService'
import { getClaudeCodeHistoryService } from '../../services/claudeCodeHistoryService'
import {
  STORAGE_KEY,
  STORAGE_VERSION,
  SESSION_HISTORY_KEY,
  MAX_SESSION_HISTORY,
} from './chatEventUtils'
import { useChatMessageStore } from './chatMessageStore'
import { useChatSessionStore } from './chatSessionStore'

/** 历史会话记录（localStorage 存储） */
interface HistoryEntry {
  id: string
  title: string
  timestamp: string
  messageCount: number
  engineId: 'claude-code' | 'iflow' | 'codex-cli' | 'gemini'
  workspaceId?: string | null
  workspacePath?: string | null
  data: {
    messages: ChatMessage[]
    archivedMessages: ChatMessage[]
  }
}

/** 统一的历史条目（包含 localStorage、IFlow 和 Claude Code 原生的会话） */
export interface UnifiedHistoryItem {
  id: string
  title: string
  timestamp: string
  messageCount: number
  engineId: 'claude-code' | 'iflow' | 'codex-cli' | 'gemini'
  source: 'local' | 'iflow' | 'claude-code-native'
  workspaceId?: string | null
  workspacePath?: string | null
  fileSize?: number
  inputTokens?: number
  outputTokens?: number
}

export interface ChatHistoryState {
  /** 是否正在加载历史 */
  isLoadingHistory: boolean

  // Actions
  saveToStorage: () => void
  restoreFromStorage: () => boolean
  saveToHistory: (title?: string) => void
  getUnifiedHistory: () => Promise<UnifiedHistoryItem[]>
  restoreFromHistory: (sessionId: string, engineId?: 'claude-code' | 'iflow' | 'codex-cli' | 'gemini') => Promise<boolean>
  deleteHistorySession: (sessionId: string, source?: 'local' | 'iflow') => void
  clearHistory: () => void
}

export const useChatHistoryStore = create<ChatHistoryState>((set, get) => ({
  isLoadingHistory: false,

  saveToStorage: () => {
    try {
      const msgState = useChatMessageStore.getState()
      const sessionState = useChatSessionStore.getState()
      const data = {
        version: STORAGE_VERSION,
        timestamp: new Date().toISOString(),
        messages: msgState.messages,
        archivedMessages: msgState.archivedMessages,
        conversationId: sessionState.conversationId,
      }
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
      console.error('[ChatHistoryStore] 保存状态失败:', e)
    }
  },

  restoreFromStorage: () => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      if (!stored) return false
      const data = JSON.parse(stored)
      if (data.version !== STORAGE_VERSION) {
        console.warn('[ChatHistoryStore] 存储版本不匹配，忽略')
        return false
      }
      const storedTime = new Date(data.timestamp).getTime()
      const now = Date.now()
      if (now - storedTime > 60 * 60 * 1000) {
        sessionStorage.removeItem(STORAGE_KEY)
        return false
      }
      useChatMessageStore.setState({
        messages: data.messages || [],
        archivedMessages: data.archivedMessages || [],
        currentMessage: null,
        toolBlockMap: new Map(),
      })
      useChatSessionStore.setState({
        conversationId: data.conversationId || null,
        isStreaming: false,
        isInitialized: true,
      })
      sessionStorage.removeItem(STORAGE_KEY)
      return true
    } catch (e) {
      console.error('[ChatHistoryStore] 恢复状态失败:', e)
      return false
    }
  },

  saveToHistory: (title?: string) => {
    try {
      const msgState = useChatMessageStore.getState()
      const sessionState = useChatSessionStore.getState()
      if (msgState.messages.length === 0) return

      const conversationId = sessionState.conversationId || `local-${crypto.randomUUID()}`
      if (!sessionState.conversationId) {
        useChatSessionStore.setState({ conversationId })
      }

      const config = useConfigStore.getState().config
      const engineId: EngineId = config?.defaultEngine || 'claude-code'
      const workspaceStore = useWorkspaceStore.getState()
      const currentWorkspace = workspaceStore.getCurrentWorkspace()

      const historyJson = localStorage.getItem(SESSION_HISTORY_KEY)
      const history = historyJson ? JSON.parse(historyJson) : []

      const firstUserMessage = msgState.messages.find(m => m.type === 'user')
      let sessionTitle = title || '新对话'
      if (!title && firstUserMessage && 'content' in firstUserMessage) {
        sessionTitle = (firstUserMessage.content as string).slice(0, 50) + '...'
      }

      const historyEntry: HistoryEntry = {
        id: conversationId,
        title: sessionTitle,
        timestamp: new Date().toISOString(),
        messageCount: msgState.messages.length,
        engineId,
        workspaceId: currentWorkspace?.id ?? null,
        workspacePath: currentWorkspace?.path ?? null,
        data: {
          messages: msgState.messages,
          archivedMessages: msgState.archivedMessages,
        }
      }

      const filteredHistory = history.filter((h: HistoryEntry) => h.id !== conversationId)
      filteredHistory.unshift(historyEntry)
      const limitedHistory = filteredHistory.slice(0, MAX_SESSION_HISTORY)
      localStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(limitedHistory))
      console.log('[ChatHistoryStore] 会话已保存到历史:', sessionTitle, '引擎:', engineId)
    } catch (e) {
      console.error('[ChatHistoryStore] 保存历史失败:', e)
    }
  },

  getUnifiedHistory: async () => {
    const items: UnifiedHistoryItem[] = []
    const iflowService = getIFlowHistoryService()
    const claudeCodeService = getClaudeCodeHistoryService()
    const workspaceStore = useWorkspaceStore.getState()
    const currentWorkspace = workspaceStore.getCurrentWorkspace()

    try {
      // 1. 获取 localStorage 中的会话历史
      const historyJson = localStorage.getItem(SESSION_HISTORY_KEY)
      const localHistory: HistoryEntry[] = historyJson ? JSON.parse(historyJson) : []
      for (const h of localHistory) {
        if (currentWorkspace?.path && h.workspacePath && h.workspacePath !== currentWorkspace.path) {
          continue
        }

        items.push({
          id: h.id,
          title: h.title,
          timestamp: h.timestamp,
          messageCount: h.messageCount,
          engineId: h.engineId || 'claude-code',
          source: 'local',
          workspaceId: h.workspaceId ?? null,
          workspacePath: h.workspacePath ?? null,
        })
      }

      // 2. 获取 Claude Code 原生会话列表
      try {
        const claudeCodeSessions = await claudeCodeService.listSessions(
          currentWorkspace?.path
        )
        for (const session of claudeCodeSessions) {
          if (!items.find(item => item.id === session.sessionId)) {
            items.push({
              id: session.sessionId,
              title: session.firstPrompt,
              timestamp: session.modified,
              messageCount: session.messageCount,
              engineId: 'claude-code',
              source: 'claude-code-native',
              fileSize: session.fileSize,
            })
          }
        }
      } catch (e) {
        console.warn('[ChatHistoryStore] 获取 Claude Code 原生会话失败:', e)
      }

      // 3. 获取 IFlow 会话列表
      try {
        const iflowSessions = await iflowService.listSessions()
        for (const session of iflowSessions) {
          if (!items.find(item => item.id === session.sessionId)) {
            items.push({
              id: session.sessionId,
              title: session.title,
              timestamp: session.updatedAt,
              messageCount: session.messageCount,
              engineId: 'iflow',
              source: 'iflow',
              fileSize: session.fileSize,
              inputTokens: session.inputTokens,
              outputTokens: session.outputTokens,
            })
          }
        }
      } catch (e) {
        console.warn('[ChatHistoryStore] 获取 IFlow 会话失败:', e)
      }

      // 4. 按时间戳排序
      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      return items
    } catch (e) {
      console.error('[ChatHistoryStore] 获取统一历史失败:', e)
      return []
    }
  },

  restoreFromHistory: async (sessionId: string, engineId?: 'claude-code' | 'iflow' | 'codex-cli' | 'gemini') => {
    try {
      set({ isLoadingHistory: true })

      // 1. 先尝试从 localStorage 恢复
      const historyJson = localStorage.getItem(SESSION_HISTORY_KEY)
      const localHistory = historyJson ? JSON.parse(historyJson) : []
      const workspaceStore = useWorkspaceStore.getState()
      const currentWorkspace = workspaceStore.getCurrentWorkspace()
      const localSession = localHistory.find((h: HistoryEntry) => h.id === sessionId)

      if (localSession) {
        if (currentWorkspace?.path && localSession.workspacePath && localSession.workspacePath !== currentWorkspace.path) {
          console.warn('[ChatHistoryStore] 历史会话不属于当前工作区，拒绝恢复:', sessionId)
          return false
        }
        useChatMessageStore.setState({
          messages: localSession.data.messages || [],
          archivedMessages: localSession.data.archivedMessages || [],
        })
        useChatSessionStore.setState({
          conversationId: localSession.id,
          isStreaming: false,
          error: null,
        })
        get().saveToStorage()
        console.log('[ChatHistoryStore] 已从本地历史恢复会话:', localSession.title)
        return true
      }

      // 2. 尝试从 Claude Code 原生历史恢复
      if (!engineId || engineId === 'claude-code') {
        const claudeCodeService = getClaudeCodeHistoryService()
        const workspaceStore = useWorkspaceStore.getState()
        const currentWorkspace = workspaceStore.getCurrentWorkspace()
        const messages = await claudeCodeService.getSessionHistory(
          sessionId,
          currentWorkspace?.path
        )
        if (messages.length > 0) {
          const chatMessages = claudeCodeService.convertToChatMessages(messages)
          const toolCalls = claudeCodeService.extractToolCalls(messages)

          useToolPanelStore.getState().clearTools()
          for (const tool of toolCalls) {
            useToolPanelStore.getState().addTool(tool)
          }

          useChatMessageStore.setState({
            messages: chatMessages,
            archivedMessages: [],
          })
          useChatSessionStore.setState({
            conversationId: sessionId,
            isStreaming: false,
            error: null,
          })
          console.log('[ChatHistoryStore] 已从 Claude Code 原生历史恢复会话:', sessionId)
          return true
        }
      }

      // 3. 尝试从 IFlow 恢复
      if (!engineId || engineId === 'iflow') {
        const iflowService = getIFlowHistoryService()
        const messages = await iflowService.getSessionHistory(sessionId)
        if (messages.length > 0) {
          const convertedMessages = iflowService.convertMessagesToFormat(messages)
          const toolCalls = iflowService.extractToolCalls(messages)

          useToolPanelStore.getState().clearTools()
          for (const tool of toolCalls) {
            useToolPanelStore.getState().addTool(tool)
          }

          const chatMessages: ChatMessage[] = convertedMessages.map((msg): ChatMessage => {
            if (msg.role === 'user') {
              return {
                id: msg.id,
                type: 'user',
                content: msg.content,
                timestamp: msg.timestamp,
              } as UserChatMessage
            } else if (msg.role === 'assistant') {
              return {
                id: msg.id,
                type: 'assistant',
                blocks: [
                  { type: 'text', content: msg.content }
                ],
                timestamp: msg.timestamp,
                content: msg.content,
                toolSummary: msg.toolSummary,
              } as AssistantChatMessage
            } else {
              return {
                id: msg.id,
                type: 'system',
                content: msg.content,
                timestamp: msg.timestamp,
              } as SystemChatMessage
            }
          })

          useChatMessageStore.setState({
            messages: chatMessages,
            archivedMessages: [],
          })
          useChatSessionStore.setState({
            conversationId: sessionId,
            isStreaming: false,
            error: null,
          })
          console.log('[ChatHistoryStore] 已从 IFlow 恢复会话:', sessionId)
          return true
        }
      }

      return false
    } catch (e) {
      console.error('[ChatHistoryStore] 从历史恢复失败:', e)
      return false
    } finally {
      set({ isLoadingHistory: false })
    }
  },

  deleteHistorySession: (sessionId: string, source?: 'local' | 'iflow') => {
    try {
      if (source === 'iflow' || (!source && sessionId.startsWith('session-'))) {
        console.log('[ChatHistoryStore] IFlow 会话无法删除，仅作忽略:', sessionId)
        return
      }
      const historyJson = localStorage.getItem(SESSION_HISTORY_KEY)
      const history = historyJson ? JSON.parse(historyJson) : []
      const filteredHistory = history.filter((h: HistoryEntry) => h.id !== sessionId)
      localStorage.setItem(SESSION_HISTORY_KEY, JSON.stringify(filteredHistory))
    } catch (e) {
      console.error('[ChatHistoryStore] 删除历史会话失败:', e)
    }
  },

  clearHistory: () => {
    try {
      localStorage.removeItem(SESSION_HISTORY_KEY)
      console.log('[ChatHistoryStore] 历史已清空')
    } catch (e) {
      console.error('[ChatHistoryStore] 清空历史失败:', e)
    }
  },
}))
