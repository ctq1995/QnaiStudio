/**
 * 会话与通信管理 Store
 *
 * 负责会话生命周期、流式状态、事件监听、消息发送/中断。
 */

import { create } from 'zustand';
import type { UserChatMessage } from '../../types';
import { getEventBus } from '../../ai-runtime';
import { continueChat as tauriContinueChat, interruptChat as tauriInterruptChat, listenEvent } from '../../services/tauri';
import { estimateMessageTokens } from '../../utils/tokenEstimator';
import { useToolPanelStore } from '../toolPanelStore';
import { useVersioningStore } from '../versioningStore';
import { useWorkspaceStore } from '../workspaceStore';
import {
  convertStreamEventToAIEvents,
  extractErrorMessage,
  parseStreamEventPayload,
} from './chatEventUtils';
import { useChatMessageStore } from './chatMessageStore';
import { buildAutoCheckpointLabel, scheduleAutoCheckpoint } from './chatSessionAutoCheckpoint';
import { handleAIEvent } from './chatSessionEventHandler';
import { buildNormalizedChatPayload, createUserMessage, dispatchChatRequest } from './chatSessionSendHelpers';

export interface ChatSessionState {
  /** 当前会话 ID */
  conversationId: string | null;
  /** 是否正在流式传输 */
  isStreaming: boolean;
  /** 错误 */
  error: string | null;
  /** 是否已初始化 */
  isInitialized: boolean;

  // Actions
  setConversationId: (id: string | null) => void;
  setStreaming: (streaming: boolean) => void;
  setError: (error: string | null) => void;
  initializeEventListeners: () => () => void;
  sendMessage: (content: string, workspaceDir?: string) => Promise<void>;
  continueChat: (prompt?: string) => Promise<void>;
  interruptChat: () => Promise<void>;
  regenerateMessage: (id: string) => Promise<void>;
}

function ensureWorkspacePath(workspaceDir: string | undefined): string | null {
  const workspaceStore = useWorkspaceStore.getState();
  const currentWorkspace = workspaceStore.getCurrentWorkspace();

  if (!currentWorkspace) {
    useChatMessageStore.getState().addErrorMessage('请先创建或选择一个工作区');
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

export const useChatSessionStore = create<ChatSessionState>((set, get) => ({
  conversationId: null,
  isStreaming: false,
  error: null,
  isInitialized: false,

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
    const cleanupCallbacks: Array<() => void> = [];
    const eventBus = getEventBus({ debug: false });

    listenEvent<unknown>('chat-event', (payload) => {
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
        cleanupCallbacks.push(unlisten);
      })
      .catch((error) => {
        console.error('[ChatSessionStore] 监听 chat-event 失败:', error);
      });

    return () => {
      cleanupCallbacks.forEach((cleanup) => cleanup());
    };
  },

  sendMessage: async (content, workspaceDir) => {
    const workDir = ensureWorkspacePath(workspaceDir);
    if (!workDir) {
      return;
    }

    const conversationId = get().conversationId;
    const workspaceStore = useWorkspaceStore.getState();
    const msgStore = useChatMessageStore.getState();

    const { normalizedMessage, normalizedSystemPrompt } = buildNormalizedChatPayload({
      content,
      workspaces: workspaceStore.workspaces,
      contextWorkspaces: workspaceStore.getContextWorkspaces(),
      currentWorkspaceId: workspaceStore.currentWorkspaceId,
    });

    msgStore.addMessage(createUserMessage(content));
    msgStore.addInputTokens(estimateMessageTokens(content));

    msgStore.resetStreamingState();
    set({ isStreaming: true, error: null });
    useToolPanelStore.getState().clearTools();

    const dispatchPromise = dispatchChatRequest({
      conversationId,
      normalizedMessage,
      normalizedSystemPrompt,
      workDir,
    });

    scheduleAutoCheckpointIfNeeded({ conversationId, workDir, content });

    try {
      const newSessionId = await dispatchPromise;
      if (newSessionId) {
        set({ conversationId: newSessionId });
      }
    } catch (error) {
      msgStore.addErrorMessage(extractErrorMessage(error, '发送消息失败'));
      set({ isStreaming: false });
    }
  },

  continueChat: async (prompt = '') => {
    const { conversationId } = get();
    const msgStore = useChatMessageStore.getState();

    if (!conversationId) {
      set({ isStreaming: false });
      msgStore.addErrorMessage('没有活动会话');
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
      set({
        error: extractErrorMessage(error, '继续对话失败'),
        isStreaming: false,
      });
    }
  },

  interruptChat: async () => {
    const { conversationId } = get();
    const msgStore = useChatMessageStore.getState();

    if (!conversationId) {
      set({ isStreaming: false });
      msgStore.setProgressMessage(null);
      return;
    }

    const { tokenBuffer } = useChatMessageStore.getState();
    if (tokenBuffer) {
      tokenBuffer.end();
    }

    try {
      await tauriInterruptChat(conversationId);
      set({ isStreaming: false });
      msgStore.finishMessage();
    } catch (error) {
      console.error('[ChatSessionStore] Interrupt failed:', error);
      set({ isStreaming: false });
      msgStore.setProgressMessage(null);
    }
  },

  regenerateMessage: async (id) => {
    const msgStore = useChatMessageStore.getState();
    const { messages } = msgStore;
    const idx = messages.findIndex((m) => m.id === id);
    if (idx < 0) return;

    let userMsg: string | null = null;
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].type === 'user') {
        userMsg = (messages[i] as UserChatMessage).content;
        break;
      }
    }
    if (!userMsg) return;

    useChatMessageStore.setState({ messages: messages.slice(0, idx) });
    await get().sendMessage(userMsg);
  },
}));

