/**
 * 经典消息列表渲染（单消息文本 + Mermaid 拆分渲染）
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';
import type { AssistantChatMessage, ChatMessage, ContentBlock, Message, ToolCall, ToolCallBlock } from '../../types';
import { useEventChatStore } from '../../stores';
import { MessageBubble } from './MessageBubble';
import { ChatErrorNotice } from './ChatErrorNotice';
import { ChatNavigator } from './ChatNavigator';
import { ToolCallTimeline } from './ToolCallTimeline';
import { groupConversationRounds } from '../../utils/conversationRounds';
import { BrandLogo } from '../Common';
import { BRAND_SHORT_NAME, BRAND_TAGLINE } from '../../constants/brand';

function extractTextFromBlocks(blocks: ContentBlock[]): string {
  return blocks
    .filter((block) => block.type === 'text')
    .map((block) => (block as { content: string }).content)
    .join('');
}

function extractToolSummary(blocks: ContentBlock[]): Message['toolSummary'] | undefined {
  const toolBlocks = blocks.filter((block) => block.type === 'tool_call') as ToolCallBlock[];
  if (toolBlocks.length === 0) {
    return undefined;
  }

  return {
    count: toolBlocks.length,
    names: Array.from(new Set(toolBlocks.map((block) => block.name))),
  };
}

function toLegacyMessage(message: ChatMessage): Message | null {
  switch (message.type) {
    case 'user':
      return {
        id: message.id,
        role: 'user',
        content: message.content,
        timestamp: message.timestamp,
      };
    case 'system':
      return {
        id: message.id,
        role: 'system',
        content: message.content,
        timestamp: message.timestamp,
      };
    case 'assistant': {
      const assistant = message as AssistantChatMessage;
      const content = assistant.content ?? extractTextFromBlocks(assistant.blocks);
      return {
        id: assistant.id,
        role: 'assistant',
        content,
        timestamp: assistant.timestamp,
        toolSummary: extractToolSummary(assistant.blocks),
      };
    }
    default:
      return null;
  }
}

export function LegacyChatMessages() {
  const { messages, archivedMessages, loadArchivedMessages, error, setError } = useEventChatStore();
  const isEmpty = messages.length === 0;
  const hasArchive = archivedMessages.length > 0;
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);

  const conversationRounds = useMemo(() => {
    return groupConversationRounds(messages);
  }, [messages]);

  const handleAtBottomStateChange = useCallback((atBottom: boolean) => {
    setAutoScroll(atBottom);
  }, []);

  const handleRangeChange = useCallback((range: { startIndex: number; endIndex: number }) => {
    const { startIndex, endIndex } = range;
    const centerIndex = Math.floor((startIndex + endIndex) / 2);

    const round = conversationRounds.findIndex(r =>
      r.messageIndices.some(idx => idx >= startIndex && idx <= endIndex) &&
      r.messageIndices.some(idx => idx > centerIndex)
    );

    const fallbackRound = conversationRounds.findIndex(r =>
      r.messageIndices.some(idx => idx >= startIndex && idx <= endIndex)
    );

    const targetRound = round >= 0 ? round : fallbackRound;
    if (targetRound >= 0) {
      setCurrentRoundIndex(targetRound);
    }
  }, [conversationRounds]);

  const scrollToRound = useCallback((roundIndex: number) => {
    const round = conversationRounds[roundIndex];
    if (!round || !virtuosoRef.current) return;

    const targetIndex = round.assistantMessage
      ? round.messageIndices[1]
      : round.messageIndices[0];

    virtuosoRef.current.scrollToIndex({
      index: targetIndex,
      align: 'start',
      behavior: 'smooth',
    });

    setAutoScroll(false);
  }, [conversationRounds]);

  const scrollToBottom = useCallback(() => {
    if (!virtuosoRef.current) return;
    virtuosoRef.current.scrollTo({
      top: Number.MAX_SAFE_INTEGER,
      behavior: 'smooth',
    });
    setAutoScroll(true);
  }, []);

  const itemContent = useCallback((_index: number, item: ChatMessage) => {
    const legacy = toLegacyMessage(item);
    if (!legacy) {
      return null;
    }
    const isStreaming = item.type === 'assistant' && (item as AssistantChatMessage).isStreaming;
    if (item.type !== 'assistant') {
      return <MessageBubble message={legacy} isStreaming={isStreaming} />;
    }

    const assistant = item as AssistantChatMessage;
    const toolCalls = (assistant.blocks || [])
      .filter((block) => block.type === 'tool_call') as ToolCallBlock[];

    return (
      <div className="flex flex-col">
        <MessageBubble message={legacy} isStreaming={isStreaming} />
        {toolCalls.length > 0 && (
          <div className="ml-11">
            <ToolCallTimeline toolCalls={toolCalls as ToolCall[]} />
          </div>
        )}
      </div>
    );
  }, []);

  const footer = useMemo(() => {
    if (!error) {
      return () => <div style={{ height: '120px' }} />;
    }
    return () => (
      <>
        <ChatErrorNotice error={error} onClose={() => setError(null)} />
        <div style={{ height: '120px' }} />
      </>
    );
  }, [error, setError]);

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {hasArchive && (
        <div className="flex justify-center py-3 bg-background-surface border-b border-border">
          <button
            onClick={loadArchivedMessages}
            className="text-xs text-primary hover:text-primary-hover transition-colors flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
            </svg>
            加载 {archivedMessages.length} 条历史消息
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 relative">
        <div className="h-full">
          {isEmpty ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <div className="mb-6 rounded-[28px] border border-border bg-background-elevated/90 px-5 py-4 shadow-soft backdrop-blur-sm">
                <BrandLogo
                  size={64}
                  showName={false}
                  iconClassName="rounded-[20px] ring-1 ring-white/10 shadow-glow"
                />
              </div>

              <h1 className="mb-2 text-2xl font-semibold text-text-primary">{BRAND_SHORT_NAME}</h1>
              <p className="mb-8 max-w-lg text-sm leading-7 text-text-secondary">{BRAND_TAGLINE}</p>

              <p className="text-sm text-text-tertiary">输入消息开始新一轮协作。</p>
            </div>
          ) : (
            <Virtuoso
              ref={virtuosoRef}
              style={{ height: '100%' }}
              data={messages}
              itemContent={itemContent}
              components={{
                EmptyPlaceholder: () => null,
                Footer: footer,
              }}
              followOutput={autoScroll ? 'smooth' : false}
              atBottomStateChange={handleAtBottomStateChange}
              atBottomThreshold={150}
              rangeChanged={handleRangeChange}
              increaseViewportBy={{ top: 100, bottom: 300 }}
              initialTopMostItemIndex={messages.length - 1}
            />
          )}
        </div>

        {!isEmpty && (
          <ChatNavigator
            rounds={conversationRounds}
            currentRoundIndex={currentRoundIndex}
            onScrollToBottom={scrollToBottom}
            onScrollToRound={scrollToRound}
          />
        )}
      </div>
    </div>
  );
}
