import type { AIEvent } from '../../ai-runtime';
import { useToolPanelStore } from '../toolPanelStore';
import { useChatMessageStore } from './chatMessageStore';
import type { ChatSessionState } from './chatSessionStore';

type SessionSet = (
  partial:
    | Partial<ChatSessionState>
    | ((state: ChatSessionState) => Partial<ChatSessionState>)
) => void;

function handleSessionStart(event: Extract<AIEvent, { type: 'session_start' }>, sessionSet: SessionSet) {
  sessionSet({ conversationId: event.sessionId, isStreaming: true });
  console.log('[ChatSessionStore] Session started:', event.sessionId);
  useToolPanelStore.getState().clearTools();
}

function handleSessionEnd(event: Extract<AIEvent, { type: 'session_end' }>, sessionSet: SessionSet) {
  const msgStore = useChatMessageStore.getState();

  msgStore.finishMessage();
  sessionSet({ isStreaming: false });
  msgStore.setProgressMessage(null);
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
  useChatMessageStore.getState().setProgressMessage(event.message || null);
}

function handleError(event: Extract<AIEvent, { type: 'error' }>) {
  useChatMessageStore.getState().addErrorMessage(event.error);
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
    case 'error':
      handleError(event);
      return;
    case 'user_message':
      return;
    default:
      console.log('[ChatSessionStore] 未处理的 AIEvent 类型:', (event as { type: string }).type);
  }
}

