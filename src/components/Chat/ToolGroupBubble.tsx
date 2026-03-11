import { memo, useMemo, useState } from 'react';
import { type ToolGroupChatMessage, type ToolChatMessage, type ToolStatus } from '../../types';
import { getToolConfig } from '../../utils/toolConfig';
import { calculateToolGroupStatus, formatDuration } from '../../utils/toolSummary';
import {
  IconRunning,
  IconCompleted,
  IconFailed,
  IconPartial,
  IconChevronRight,
  IconChevronDown,
} from '../Common/Icons';

interface ToolGroupBubbleProps {
  message: ToolGroupChatMessage;
  tools: ToolChatMessage[];
}

function getGroupStatusIcon(status: ToolStatus) {
  switch (status) {
    case 'pending':
      return null;
    case 'running':
      return IconRunning;
    case 'completed':
      return IconCompleted;
    case 'failed':
      return IconFailed;
    case 'partial':
      return IconPartial;
    default:
      return null;
  }
}

function getStatusColor(status: ToolStatus): string {
  switch (status) {
    case 'pending':
      return 'text-text-muted';
    case 'running':
      return 'text-warning animate-pulse';
    case 'completed':
      return 'text-success';
    case 'failed':
      return 'text-error';
    case 'partial':
      return 'text-warning';
    default:
      return 'text-text-muted';
  }
}

function clsx(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

const ToolItem = memo(function ToolItem({ tool }: { tool: ToolChatMessage }) {
  const StatusIcon =
    tool.status === 'completed'
      ? IconCompleted
      : tool.status === 'failed'
        ? IconFailed
        : tool.status === 'running'
          ? IconRunning
          : tool.status === 'partial'
            ? IconPartial
            : null;
  const toolConfig = getToolConfig(tool.toolName);

  const duration = tool.duration ||
    (tool.completedAt
      ? formatDuration(new Date(tool.completedAt).getTime() - new Date(tool.startedAt).getTime())
      : undefined);

  return (
    <div className={clsx('flex items-center gap-2 rounded-md border border-border-subtle border-l-4 bg-background-surface px-3 py-2', toolConfig.borderColor)}>
      {StatusIcon && (
        <div className={clsx('shrink-0', getStatusColor(tool.status))}>
          <StatusIcon size={12} />
        </div>
      )}
      <span className={clsx('rounded-md px-1.5 py-0.5 text-[11px] font-medium', toolConfig.bgColor, toolConfig.color)}>
        {toolConfig.label}
      </span>
      <span className="flex-1 truncate text-sm text-text-secondary">{tool.summary}</span>
      {duration && <span className="shrink-0 text-xs text-text-tertiary">{duration}</span>}
    </div>
  );
});

export const ToolGroupBubble = memo(function ToolGroupBubble({ message, tools }: ToolGroupBubbleProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAllTools, setShowAllTools] = useState(false);

  const groupStatus = useMemo(() => calculateToolGroupStatus(tools), [tools]);
  const StatusIcon = getGroupStatusIcon(groupStatus);
  const duration = message.duration ||
    (message.completedAt
      ? formatDuration(new Date(message.completedAt).getTime() - new Date(message.startedAt).getTime())
      : undefined);
  const displayedTools = showAllTools ? tools : tools.slice(0, 3);
  const hasMoreTools = tools.length > 3;

  const stats = useMemo(() => {
    const completed = tools.filter((tool) => tool.status === 'completed').length;
    const failed = tools.filter((tool) => tool.status === 'failed').length;
    const running = tools.filter((tool) => tool.status === 'running').length;
    return { completed, failed, running };
  }, [tools]);

  return (
    <div className="my-2">
      <div
        className={clsx(
          'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 transition-all hover:shadow-medium',
          groupStatus === 'running' && 'bg-warning-faint border-warning/30',
          groupStatus === 'completed' && 'bg-success-faint border-success/30',
          (groupStatus === 'failed' || groupStatus === 'partial') && 'bg-warning-faint border-warning/30',
          groupStatus === 'pending' && 'bg-background-surface border-border',
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {StatusIcon && (
          <div className={clsx('shrink-0', getStatusColor(groupStatus))}>
            <StatusIcon size={14} />
          </div>
        )}

        <div className="flex-1">
          <span className={clsx('text-sm', groupStatus === 'running' ? 'text-text-primary' : 'text-text-secondary')}>
            {message.summary}
          </span>
          {tools.length > 0 && (
            <span className="ml-2 text-xs text-text-tertiary">
              {stats.completed > 0 && `${stats.completed} 完成`}
              {stats.running > 0 && ` ${stats.running} 进行中`}
              {stats.failed > 0 && ` ${stats.failed} 失败`}
            </span>
          )}
        </div>

        {duration && <span className="text-xs text-text-tertiary">{duration}</span>}
        <div className="shrink-0 text-text-subtle">
          {isExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
        </div>
      </div>

      {isExpanded && tools.length > 0 && (
        <div className="mt-2 ml-4 space-y-1.5">
          {displayedTools.map((tool) => (
            <ToolItem key={tool.id} tool={tool} />
          ))}

          {hasMoreTools && !showAllTools && (
            <button
              type="button"
              onClick={() => setShowAllTools(true)}
              className="w-full rounded-md px-3 py-2 text-xs text-primary transition-colors hover:bg-background-hover hover:text-primary-hover"
            >
              查看全部 {tools.length} 个工具
            </button>
          )}
        </div>
      )}
    </div>
  );
});
