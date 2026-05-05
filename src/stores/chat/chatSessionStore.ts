/**
 * 会话与通信管理 Store
 *
 * 负责会话生命周期、流式状态、事件监听、消息发送/中断。
 */

import { create } from 'zustand';

let chatEventListenerCleanup: (() => void) | null = null;
let chatEventListenerInitializing: Promise<(() => void) | void> | null = null;
import type { QueuedMessageStatus, UserChatMessage } from '../../types';
import { getEventBus } from '../../ai-runtime';
import { continueChat as tauriContinueChat, interruptChat as tauriInterruptChat, listenEvent } from '../../services/tauri';
import { estimateMessageTokens } from '../../utils/tokenEstimator';
import { useToolPanelStore } from '../toolPanelStore';
import { useVersioningStore } from '../versioningStore';
import { useWorkspaceStore } from '../workspaceStore';
import { useErrorCenterStore } from '../errorCenterStore';
import { useConfigStore } from '../configStore';
import {
  convertStreamEventToAIEvents,
  extractErrorMessage,
  parseStreamEventPayload,
} from './chatEventUtils';
import { useChatMessageStore } from './chatMessageStore';
import { buildAutoCheckpointLabel, scheduleAutoCheckpoint } from './chatSessionAutoCheckpoint';
import { handleAIEvent } from './chatSessionEventHandler';
import { buildNormalizedChatPayload, createUserMessage, dispatchChatRequest } from './chatSessionSendHelpers';

interface QueueMessageItem {
  id: string;
  content: string;
  workspaceDir?: string;
  status: QueuedMessageStatus;
  createdAt: string;
  messageId?: string;
}

export interface ChatSessionState {
  /** 当前会话 ID */
  conversationId: string | null;
  /** 是否正在流式传输 */
  isStreaming: boolean;
  /** 错误 */
  error: string | null;
  /** 是否已初始化 */
  isInitialized: boolean;
  /** 是否已在前端本地完成中断收尾 */
  interruptedLocally: boolean;
  /** 待处理队列（仅 queued） */
  pendingQueue: QueueMessageItem[];
  /** 当前执行中的队列项 */
  activeQueueItem: QueueMessageItem | null;

  // Actions
  setConversationId: (id: string | null) => void;
  setStreaming: (streaming: boolean) => void;
  setError: (error: string | null) => void;
  initializeEventListeners: () => () => void;
  sendMessage: (content: string, workspaceDir?: string) => Promise<void>;
  enqueueMessage: (content: string, workspaceDir?: string) => Promise<void>;
  editQueuedMessage: (queueItemId: string, content: string) => void;
  removeQueuedMessage: (queueItemId: string) => void;
  processNextQueuedMessage: () => Promise<void>;
  completeActiveQueueItem: () => void;
  clearPendingQueue: () => void;
  continueChat: (prompt?: string) => Promise<void>;
  interruptChat: () => Promise<void>;
  regenerateMessage: (id: string) => Promise<void>;
}

function pushChatError(title: string, message: string, source?: string) {
  useErrorCenterStore.getState().pushError({
    scope: 'chat',
    level: 'error',
    title,
    message,
    source,
  });
}

function resolveActiveModelLabel(): string | null {
  const config = useConfigStore.getState().config;
  if (!config) return null;

  switch (config.defaultEngine) {
    case 'iflow':
      return config.iflow.model?.trim() || null;
    case 'codex-cli':
      return config.codexCli.model?.trim() || null;
    case 'gemini':
      return config.gemini.model?.trim() || null;
    case 'claude-code':
    default:
      return config.claudeCode.model?.trim() || null;
  }
}

function ensureWorkspacePath(workspaceDir: string | undefined): string | null {
  const workspaceStore = useWorkspaceStore.getState();
  const currentWorkspace = workspaceStore.getCurrentWorkspace();

  if (!currentWorkspace) {
    pushChatError('工作区不可用', '请先创建或选择一个工作区', 'chatSessionStore.ensureWorkspacePath');
    return null;
  }

  return workspaceDir ?? currentWorkspace.path;
}

function scheduleAutoCheckpointIfNeeded(options: {
  conversationId: string | null;
  workDir: string;
  content: string;
}) {
  if (options.conversationId) {
    return;
  }

  if (!useVersioningStore.getState().autoCheckpointEnabled) {
    return;
  }

  scheduleAutoCheckpoint({
    workspacePath: options.workDir,
    label: buildAutoCheckpointLabel(options.content),
  });
}

async function dispatchMessageWithoutCreatingUser(options: {
  content: string;
  workspaceDir?: string;
  conversationId: string | null;
}) {
  const workDir = ensureWorkspacePath(options.workspaceDir);
  if (!workDir) {
    return null;
  }

  const workspaceStore = useWorkspaceStore.getState();
  const { normalizedMessage, normalizedSystemPrompt } = buildNormalizedChatPayload({
    content: options.content,
    workspaces: workspaceStore.workspaces,
    contextWorkspaces: workspaceStore.getContextWorkspaces(),
    currentWorkspaceId: workspaceStore.currentWorkspaceId,
  });

  useChatMessageStore.getState().resetStreamingState();
  useChatMessageStore.getState().setActiveModelLabel(resolveActiveModelLabel());
  useToolPanelStore.getState().clearTools();

  const dispatchPromise = dispatchChatRequest({
    conversationId: options.conversationId,
    normalizedMessage,
    normalizedSystemPrompt,
    workDir,
  });

  scheduleAutoCheckpointIfNeeded({
    conversationId: options.conversationId,
    workDir,
    content: options.content,
  });

  return {
    dispatchPromise,
    workDir,
  };
}

async function startQueuedMessage(queueItem: QueueMessageItem, conversationId: string | null) {
  const msgStore = useChatMessageStore.getState();
  const queuedMessage = [...msgStore.archivedMessages, ...msgStore.messages]
    .find((message) => message.type === 'user' && message.queueItemId === queueItem.id);

  if (!queuedMessage) {
    return null;
  }

  msgStore.updateMessageQueueState(queuedMessage.id, 'running');

  const dispatchResult = await dispatchMessageWithoutCreatingUser({
    content: queueItem.content,
    workspaceDir: queueItem.workspaceDir,
    conversationId,
  });

  if (!dispatchResult) {
    msgStore.deleteMessage(queuedMessage.id);
    return null;
  }

  return {
    dispatchPromise: dispatchResult.dispatchPromise,
    messageId: queuedMessage.id,
  };
}

export const useChatSessionStore = create<ChatSessionState>((set, get) => ({
  conversationId: null,
  isStreaming: false,
  error: null,
  isInitialized: false,
  interruptedLocally: false,
  pendingQueue: [],
  activeQueueItem: null,

  setConversationId: (id) => {
    set({ conversationId: id });
  },

  setStreaming: (streaming) => {
    set({ isStreaming: streaming });
  },

  setError: (error) => {
    set({ error });
  },

  initializeEventListeners: () => {
    if (chatEventListenerCleanup) {
      return () => {
        if (chatEventListenerCleanup) {
          chatEventListenerCleanup();
          chatEventListenerCleanup = null;
        }
      };
    }

    if (!chatEventListenerInitializing) {
      const eventBus = getEventBus({ debug: false });
      chatEventListenerInitializing = listenEvent<unknown>('chat-event', (payload) => {
        try {
          const streamEvent = parseStreamEventPayload(payload);
          if (!streamEvent) return;
          const state = get();
          console.log('[ChatSessionStore] 收到 chat-event:', streamEvent.type);

          const aiEvents = convertStreamEventToAIEvents(streamEvent, state.conversationId);

          for (const aiEvent of aiEvents) {
            eventBus.emit(aiEvent);
            handleAIEvent(aiEvent, set);
          }
        } catch (error) {
          console.error('[ChatSessionStore] 解析 chat-event 失败:', error);
        }
      })
        .then((unlisten) => {
          chatEventListenerCleanup = unlisten;
          chatEventListenerInitializing = null;
          return unlisten;
        })
        .catch((error) => {
          chatEventListenerInitializing = null;
          console.error('[ChatSessionStore] 监听 chat-event 失败:', error);
        });
    }

    return () => {
      if (chatEventListenerCleanup) {
        chatEventListenerCleanup();
        chatEventListenerCleanup = null;
      }
    };
  },

  sendMessage: async (content, workspaceDir) => {
    await get().enqueueMessage(content, workspaceDir);
  },

  enqueueMessage: async (content, workspaceDir) => {
    const workDir = ensureWorkspacePath(workspaceDir);
    if (!workDir) {
      return;
    }

    const msgStore = useChatMessageStore.getState();
    const queueItemId = crypto.randomUUID();
    const queueItem: QueueMessageItem = {
      id: queueItemId,
      content,
      workspaceDir: workDir,
      status: 'queued',
      createdAt: new Date().toISOString(),
    };

    msgStore.addInputTokens(estimateMessageTokens(content));

    set((state) => ({
      pendingQueue: [...state.pendingQueue, queueItem],
      error: null,
    }));

    const queuedMessage = createUserMessage(content);
    queuedMessage.queueItemId = queueItemId;
    queuedMessage.queueStatus = 'queued';
    msgStore.addMessage(queuedMessage);

    if (!get().isStreaming) {
      await get().processNextQueuedMessage();
    }
  },

  editQueuedMessage: (queueItemId, content) => {
    const target = get().pendingQueue.find((item) => item.id === queueItemId);
    if (!target || target.status !== 'queued') {
      return;
    }

    set((state) => ({
      pendingQueue: state.pendingQueue.map((item) => (
        item.id === queueItemId
          ? { ...item, content }
          : item
      )),
    }));

    useChatMessageStore.getState().setQueuedMessageContent(queueItemId, content);
  },

  removeQueuedMessage: (queueItemId) => {
    const target = get().pendingQueue.find((item) => item.id === queueItemId);
    if (!target || target.status !== 'queued') {
      return;
    }

    set((state) => ({
      pendingQueue: state.pendingQueue.filter((item) => item.id !== queueItemId),
    }));

    if (target.messageId) {
      const messageStore = useChatMessageStore.getState();
      messageStore.updateMessageQueueState(target.messageId, undefined);
      messageStore.setQueuedMessageId(target.messageId, undefined);
      messageStore.deleteMessage(target.messageId);
    }
  },

  processNextQueuedMessage: async () => {
    const state = get();
    if (state.isStreaming) {
      return;
    }

    const nextItem = state.pendingQueue.find((item) => item.status === 'queued');
    if (!nextItem) {
      return;
    }

    if (nextItem.messageId) {
      const messageStore = useChatMessageStore.getState();
      messageStore.updateMessageQueueState(nextItem.messageId, 'running');
      messageStore.setQueuedMessageId(nextItem.messageId, nextItem.id);
    }

    set((current) => ({
      isStreaming: true,
      error: null,
      interruptedLocally: false,
      activeQueueItem: { ...nextItem, status: 'running' },
      pendingQueue: current.pendingQueue.filter((item) => item.id !== nextItem.id),
    }));

    try {
      const startResult = await startQueuedMessage(nextItem, get().conversationId);
      if (startResult) {
        if (startResult.messageId) {
          const messageStore = useChatMessageStore.getState();
          messageStore.setQueuedMessageId(startResult.messageId, nextItem.id);
          messageStore.updateMessageQueueState(startResult.messageId, 'running');
          set((current) => ({
            activeQueueItem: current.activeQueueItem?.id === nextItem.id
              ? { ...current.activeQueueItem, messageId: startResult.messageId }
              : current.activeQueueItem,
          }));
        }

        if (startResult.dispatchPromise) {
          const newSessionId = await startResult.dispatchPromise;
          if (newSessionId) {
            set({ conversationId: newSessionId });
          }
        }
      }
    } catch (error) {
      const msgStore = useChatMessageStore.getState();
      const errorMessage = extractErrorMessage(error, '发送消息失败');
      pushChatError('发送消息失败', errorMessage, 'chatSessionStore.processNextQueuedMessage');
      if (nextItem.messageId) {
        msgStore.deleteMessage(nextItem.messageId);
      }
      set({
        error: errorMessage,
        isStreaming: false,
        activeQueueItem: null,
      });
      queueMicrotask(() => {
        void get().processNextQueuedMessage();
      });
    }
  },

  completeActiveQueueItem: () => {
    const { activeQueueItem } = get();
    if (!activeQueueItem) {
      return;
    }

    if (activeQueueItem.messageId) {
      const messageStore = useChatMessageStore.getState();
      messageStore.updateMessageQueueState(activeQueueItem.messageId, undefined);
      messageStore.setQueuedMessageId(activeQueueItem.messageId, undefined);
    }

    set({ activeQueueItem: null });
  },

  clearPendingQueue: () => {
    const { pendingQueue, activeQueueItem } = get();
    const messageStore = useChatMessageStore.getState();

    for (const item of pendingQueue) {
      if (item.messageId) {
        messageStore.updateMessageQueueState(item.messageId, undefined);
        messageStore.setQueuedMessageId(item.messageId, undefined);
        if (item.status === 'queued') {
          messageStore.deleteMessage(item.messageId);
        }
      }
    }

    if (activeQueueItem?.messageId) {
      messageStore.updateMessageQueueState(activeQueueItem.messageId, undefined);
      messageStore.setQueuedMessageId(activeQueueItem.messageId, undefined);
    }

    set({ pendingQueue: [], activeQueueItem: null });
  },

  continueChat: async (prompt = '') => {
    const { conversationId } = get();

    if (!conversationId) {
      set({ isStreaming: false, error: '没有活动会话' });
      pushChatError('继续对话失败', '没有活动会话', 'chatSessionStore.continueChat');
      return;
    }

    const workDir = useWorkspaceStore.getState().getCurrentWorkspace()?.path;
    const normalizedPrompt = prompt
      .replace(/\r\n/g, '\\n')
      .replace(/\r/g, '\\n')
      .replace(/\n/g, '\\n')
      .trim();

    set({ isStreaming: true, error: null });

    try {
      await tauriContinueChat({
        sessionId: conversationId,
        message: normalizedPrompt,
        workDir,
      });
    } catch (error) {
      const errorMessage = extractErrorMessage(error, '继续对话失败');
      pushChatError('继续对话失败', errorMessage, 'chatSessionStore.continueChat');
      set({
        error: errorMessage,
        isStreaming: false,
      });
    }
  },

  interruptChat: async () => {
    const { conversationId, activeQueueItem, pendingQueue } = get();
    const msgStore = useChatMessageStore.getState();

    if (!conversationId) {
      set({ isStreaming: false, interruptedLocally: false });
      msgStore.setRunStatus(null);
      return;
    }

    const { tokenBuffer } = useChatMessageStore.getState();
    if (tokenBuffer) {
      tokenBuffer.end();
    }

    const hasQueuedItems = pendingQueue.length > 0;

    try {
      await tauriInterruptChat(conversationId);
    } catch (error) {
      const errorMessage = extractErrorMessage(error, '中断会话失败');
      console.error('[ChatSessionStore] Interrupt failed:', error);
      pushChatError('中断会话失败', errorMessage, 'chatSessionStore.interruptChat');
      set({ error: errorMessage });
    } finally {
      msgStore.finishMessage();
      msgStore.setRunStatus(null);
      if (activeQueueItem?.messageId) {
        msgStore.updateMessageQueueState(activeQueueItem.messageId, undefined);
      }
      set({
        isStreaming: false,
        interruptedLocally: true,
        activeQueueItem: null,
      });
      if (hasQueuedItems) {
        queueMicrotask(() => {
          void get().processNextQueuedMessage();
        });
      }
    }
  },

  regenerateMessage: async (id) => {
    const msgStore = useChatMessageStore.getState();
    const allMessages = [...msgStore.archivedMessages, ...msgStore.messages];
    const idx = allMessages.findIndex((m) => m.id === id);
    if (idx < 0) return;

    let userMessage: UserChatMessage | null = null;
    for (let i = idx - 1; i >= 0; i--) {
      if (allMessages[i].type === 'user') {
        userMessage = allMessages[i] as UserChatMessage;
        break;
      }
    }
    if (!userMessage) return;

    msgStore.truncateConversationBefore(id);
    set({ isStreaming: true, error: null, interruptedLocally: false });

    try {
      const dispatchResult = await dispatchMessageWithoutCreatingUser({
        content: userMessage.content,
        conversationId: get().conversationId,
      });

      if (!dispatchResult) {
        set({ isStreaming: false });
        return;
      }

      const newSessionId = await dispatchResult.dispatchPromise;
      if (newSessionId) {
        set({ conversationId: newSessionId });
      }
    } catch (error) {
      const errorMessage = extractErrorMessage(error, '重新生成失败');
      pushChatError('重新生成失败', errorMessage, 'chatSessionStore.regenerateMessage');
      set({
        error: errorMessage,
        isStreaming: false,
      });
    }
  },
}));
