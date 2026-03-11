import React from 'react';
import { clsx } from 'clsx';
import { type ToolCall } from '../../types';
import { getToolConfig } from '../../utils/toolConfig';
import {
  IconPending,
  IconRunning,
  IconCompleted,
  IconFailed,
  IconPartial,
  IconChevronRight,
  IconCopy,
} from '../Common/Icons';

interface ToolCallTimelineProps {
  toolCalls: ToolCall[];
}

function getDuration(startedAt: string, completedAt?: string): string {
  if (!completedAt) return '';

  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  const ms = end - start;

  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getStatusIcon(status: ToolCall['status']) {
  switch (status) {
    case 'pending':
      return IconPending;
    case 'running':
      return IconRunning;
    case 'completed':
      return IconCompleted;
    case 'failed':
      return IconFailed;
    case 'partial':
      return IconPartial;
    default:
      return IconPending;
  }
}

function getStatusColor(status: ToolCall['status']): string {
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

async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

interface ToolCallItemProps {
  tool: ToolCall;
}

function ToolCallItem({ tool }: ToolCallItemProps) {
  const StatusIcon = getStatusIcon(tool.status);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const toolConfig = getToolConfig(tool.name);

  return (
    <div className={clsx('group overflow-hidden rounded-lg border border-border-subtle border-l-4 transition-colors hover:border-border-muted', toolConfig.borderColor)}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-background-hover"
      >
        {StatusIcon && <StatusIcon size={14} className={clsx('shrink-0', getStatusColor(tool.status))} />}
        <span className={clsx('rounded-md px-1.5 py-0.5 text-xs font-medium', toolConfig.bgColor, toolConfig.color)}>
          {toolConfig.label}
        </span>
        <span className={clsx('font-mono text-sm', toolConfig.color)}>{tool.name}</span>
        {tool.completedAt && <span className="ml-auto text-xs text-text-subtle">{getDuration(tool.startedAt, tool.completedAt)}</span>}
        <IconChevronRight size={14} className={clsx('shrink-0 text-text-subtle transition-transform', isExpanded && 'rotate-90')} />
      </button>

      {isExpanded && (
        <div className="space-y-2 px-3 pb-3">
          {tool.input && Object.keys(tool.input).length > 0 && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className={clsx('text-xs font-medium', toolConfig.color)}>输入</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(JSON.stringify(tool.input, null, 2))}
                  className="flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-text"
                >
                  <IconCopy size={12} />
                  复制
                </button>
              </div>
              <pre className="overflow-x-auto rounded border border-border-subtle bg-background-secondary p-2 text-xs">
                {JSON.stringify(tool.input, null, 2)}
              </pre>
            </div>
          )}

          {tool.output && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className={clsx('text-xs font-medium', tool.status === 'failed' ? 'text-error' : toolConfig.color)}>输出</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(tool.output || '')}
                  className="flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-text"
                >
                  <IconCopy size={12} />
                  复制
                </button>
              </div>
              <pre
                className={clsx(
                  'max-h-48 overflow-x-auto overflow-y-auto rounded border border-border-subtle p-2 text-xs',
                  tool.status === 'failed' ? 'bg-danger-faint text-text' : 'bg-background-secondary text-text-muted',
                )}
              >
                {tool.output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ToolCallTimeline({ toolCalls }: ToolCallTimelineProps) {
  if (toolCalls.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-2 text-xs text-text-subtle">
        <div className="h-2 w-2 rounded-full bg-border-muted" />
        <span>工具调用</span>
        <span className="rounded bg-background-tertiary px-1.5 py-0.5 text-text-muted">{toolCalls.length}</span>
      </div>

      <div className="space-y-1.5">
        {toolCalls.map((tool, index) => (
          <ToolCallItem key={tool.id || index} tool={tool} />
        ))}
      </div>
    </div>
  );
}
