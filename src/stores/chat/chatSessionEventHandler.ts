import type { AIEvent } from '../../ai-runtime';
import { useToolPanelStore } from '../toolPanelStore';
import { useChatMessageStore } from './chatMessageStore';
import { useErrorCenterStore } from '../errorCenterStore';
import { useChatSessionStore, type ChatSessionState } from './chatSessionStore';

type SessionSet = (
  partial:
    | Partial<ChatSessionState>
    | ((state: ChatSessionState) => Partial<ChatSessionState>)
) => void;

function handleSessionStart(event: Extract<AIEvent, { type: 'session_start' }>, sessionSet: SessionSet) {
  sessionSet({ conversationId: event.sessionId, isStreaming: true, interruptedLocally: false });
  console.log('[ChatSessionStore] Session started:', event.sessionId);
  useToolPanelStore.getState().clearTools();
}

function handleSessionEnd(event: Extract<AIEvent, { type: 'session_end' }>, sessionSet: SessionSet) {
  const msgStore = useChatMessageStore.getState();
  const sessionStore = useChatSessionStore.getState();
  const reason = event.reason || 'completed';
  const now = new Date().toISOString();
  const reasonMeta = (() => {
    switch (reason) {
      case 'completed':
        return { summary: '运行完成', detail: 'completed', kind: 'completed' as const };
      case 'aborted':
        return { summary: '运行已中止', detail: 'aborted', kind: 'aborted' as const };
      case 'permission_denied':
        return { summary: '已拒绝权限请求，运行结束', detail: 'permission_denied', kind: 'error' as const };
      case 'max_rounds':
        return { summary: '达到最大轮次限制，运行结束', detail: 'max_rounds', kind: 'error' as const };
      case 'error':
        return { summary: '运行因错误结束', detail: 'error', kind: 'error' as const };
      default:
        return { summary: `运行结束: ${reason}`, detail: reason, kind: 'error' as const };
    }
  })();

  if (sessionStore.interruptedLocally) {
    sessionSet({ isStreaming: false, interruptedLocally: false });
    msgStore.setRunStatus(null);
    console.log('[ChatSessionStore] Session ended after local interrupt:', event.reason);
    return;
  }

  msgStore.setRunStatus({
    kind: reasonMeta.kind,
    summary: reasonMeta.summary,
    detail: reasonMeta.detail,
    toolName: null,
    reason,
    updatedAt: now,
    scope: 'session',
  });

  if (reasonMeta.kind !== 'completed' && (msgStore.currentMessage || [...msgStore.messages].reverse().some((message) => message.type === 'assistant'))) {
    msgStore.setInlineStatus({
      kind: reasonMeta.kind === 'aborted' ? 'aborted' : 'error',
      summary: reasonMeta.summary,
      detail: reasonMeta.detail,
    });
  }

  msgStore.finishMessage();
  sessionStore.completeActiveQueueItem();
  sessionSet({ isStreaming: false, interruptedLocally: false });
  queueMicrotask(() => {
    void useChatSessionStore.getState().processNextQueuedMessage();
  });
  console.log('[ChatSessionStore] Session ended:', event.reason);
}

function handleToken(event: Extract<AIEvent, { type: 'token' }>) {
  useChatMessageStore.getState().appendTextBlock(event.value);
}

function handleAssistantMessage(event: Extract<AIEvent, { type: 'assistant_message' }>) {
  useChatMessageStore.getState().appendTextBlock(event.content);
}

function handleToolCallStart(event: Extract<AIEvent, { type: 'tool_call_start' }>) {
  useChatMessageStore.getState().appendToolCallBlock(
    event.callId || crypto.randomUUID(),
    event.tool,
    event.args,
  );
}

function handleToolCallEnd(event: Extract<AIEvent, { type: 'tool_call_end' }>) {
  const msgStore = useChatMessageStore.getState();
  if (!event.callId) {
    console.warn('[ChatSessionStore] tool_call_end 事件缺少 callId', event.tool);
    return;
  }

  msgStore.updateToolCallBlock(
    event.callId,
    event.success ? 'completed' : 'failed',
    String(event.result || ''),
  );
}

function handleToolCallOutput(event: Extract<AIEvent, { type: 'tool_call_output' }>) {
  if (!event.callId) {
    console.warn('[ChatSessionStore] tool_call_output 缺少 callId', event.tool);
    return;
  }
  useChatMessageStore.getState().appendToolCallOutput(event.callId, event.output);
}

function handleProgress(event: Extract<AIEvent, { type: 'progress' }>) {
  const normalized = event.message?.trim() || null;
  const statusKind = event.statusKind ?? 'running';
  const now = new Date().toISOString();

  useChatMessageStore.getState().setRunStatus(
    normalized
      ? {
          kind: statusKind,
          summary: normalized,
          detail: event.detail ?? event.reason ?? null,
          toolName: event.toolName ?? null,
          reason: event.reason ?? null,
          updatedAt: now,
          scope: 'session',
        }
      : null
  );
}

function handlePermissionRequest(event: Extract<AIEvent, { type: 'permission_request' }>) {
  const msgStore = useChatMessageStore.getState();
  const detail = event.summary || event.responseHint || 'waiting_approval';

  msgStore.setRunStatus({
    kind: 'permission_pending',
    summary: '等待权限批准',
    detail,
    toolName: event.denials[0]?.toolName ?? null,
    reason: 'waiting_approval',
    updatedAt: new Date().toISOString(),
    scope: 'session',
  });

  msgStore.appendPermissionBlock({
    sessionId: event.sessionId,
    engineId: event.engineId,
    summary: event.summary,
    responseHint: event.responseHint,
    denials: event.denials.map((item) => ({
      toolName: item.toolName,
      reason: item.reason,
      details: item.details ?? {},
    })),
    rawDetails: event.denials.map((item) => item.details ?? {}),
  })
}

function handleError(event: Extract<AIEvent, { type: 'error' }>) {
  const normalizedError = event.error.trim();
  const reconnectMatch = normalizedError.match(/^Reconnecting\.\.\.\s*(\d+\/\d+)/i);

  if (reconnectMatch) {
    const summary = `连接中断，正在重连 ${reconnectMatch[1]}`;
    const msgStore = useChatMessageStore.getState();

    msgStore.setRunStatus({
      kind: 'reconnecting',
      summary,
      detail: normalizedError,
      toolName: null,
      updatedAt: new Date().toISOString(),
      scope: 'session',
    });

    if (msgStore.currentMessage || [...msgStore.messages].reverse().some((message) => message.type === 'assistant')) {
      msgStore.setInlineStatus({
        kind: 'reconnecting',
        summary,
        detail: normalizedError,
      });
    }
    return;
  }

  useErrorCenterStore.getState().pushError({
    scope: 'chat',
    level: 'error',
    title: '会话运行错误',
    message: normalizedError,
    source: 'chatSessionEventHandler.handleError',
  });
}

export function handleAIEvent(event: AIEvent, sessionSet: SessionSet): void {
  switch (event.type) {
    case 'session_start':
      handleSessionStart(event, sessionSet);
      return;
    case 'session_end':
      handleSessionEnd(event, sessionSet);
      return;
    case 'token':
      handleToken(event);
      return;
    case 'assistant_message':
      handleAssistantMessage(event);
      return;
    case 'tool_call_start':
      handleToolCallStart(event);
      return;
    case 'tool_call_end':
      handleToolCallEnd(event);
      return;
    case 'tool_call_output':
      handleToolCallOutput(event);
      return;
    case 'progress':
      handleProgress(event);
      return;
    case 'permission_request':
      handlePermissionRequest(event);
      return;
    case 'error':
      handleError(event);
      return;
    case 'user_message':
      return;
    default:
      console.log('[ChatSessionStore] 未处理的 AIEvent 类型:', (event as { type: string }).type);
  }
}
