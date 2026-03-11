/**
 * 增强版聊天消息列表组件 - 支持内容块架构
 *
 * 核心特性：
 * - Assistant 消息包含 blocks 数组
 * - 工具调用穿插在文本中间显示
 * - 支持流式更新内容块
 * - TodoWrite 专用渲染
 * - Grep 关键词高亮
 * - Bash ANSI 码清理
 * - Edit 工具优化显示
 */

import { useMemo, memo, useState, useCallback, useRef, useDeferredValue } from 'react';
import React from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { clsx } from 'clsx';
import type { ChatMessage, UserChatMessage, AssistantChatMessage, ContentBlock, TextBlock, ToolCallBlock } from '../../types';
import { useConfigStore, useEventChatStore } from '../../stores';
import { getToolConfig, extractToolKeyInfo } from '../../utils/toolConfig';
import { markdownCache } from '../../utils/cache';
import { useThrottle } from '../../hooks/useThrottle';
import {
  formatDuration,
  calculateDuration,
  generateOutputSummary,
  parseGrepMatches,
  stripAnsiCodes,
  escapeRegExp,
  type GrepMatch,
  type GrepOutputData
} from '../../utils/toolSummary';
import { Check, XCircle, Loader2, AlertTriangle, Play, ChevronDown, ChevronRight, Circle, FileSearch, FolderOpen, Code, FileDiff, UserRound } from 'lucide-react';
import { ChatNavigator } from './ChatNavigator';
import { groupConversationRounds } from '../../utils/conversationRounds';
import { splitMarkdownWithMermaid } from '../../utils/markdown';
import { MermaidDiagram } from './MermaidDiagram';
import { extractCodeBlocks, replaceCodeBlocksWithPlaceholders, codeBlockToReact } from '../../utils/markdown-enhanced';
import { DiffViewer } from '../Diff/DiffViewer';
import { BRAND_SHORT_NAME, BRAND_TAGLINE } from '../../constants/brand';
import { isEditTool, extractEditDiff } from '../../utils/diffExtractor';
import { getEngineLabel } from '../../utils/engineLabels';

/** Markdown 渲染器（使用缓存优化） */
function formatContent(content: string): string {
  return markdownCache.render(content);
}

/** 用户消息组件 */
const UserBubble = memo(function UserBubble({ message }: { message: UserChatMessage }) {
  return (
    <div className="flex justify-end my-2 gap-2 items-end">
      <div className="max-w-[85%] px-4 py-3 rounded-2xl
                  bg-gradient-to-br from-primary to-primary-600
                  text-white shadow-glow">
        <div className="text-sm leading-relaxed whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
      <div className="w-8 h-8 rounded-full bg-background-surface border border-border flex items-center justify-center text-text-tertiary shadow-soft shrink-0">
        <UserRound className="w-4 h-4" />
      </div>
    </div>
  );
});

/** 文本内容块组件（支持 Mermaid 渲染 + 代码高亮 + 双语翻译）
 * 
 * 性能优化策略：
 * 1. 流式输出时使用节流（而非防抖），确保固定间隔渲染，提供更好的实时性
 * 2. 流式阶段显示简化版内容（纯文本），避免复杂 markdown 渲染
 * 3. 使用 useDeferredValue 降低渲染优先级，保持 UI 响应
 * 4. 流式结束后显示完整渲染结果
 */
const TextBlockRenderer = memo(function TextBlockRenderer({
  block,
  isStreaming = false
}: {
  block: TextBlock;
  isStreaming?: boolean;
}) {
  const throttledContent = useThrottle(block.content, isStreaming ? 200 : 0);
  const deferredContent = useDeferredValue(throttledContent);
  const parts = useMemo(() => splitMarkdownWithMermaid(block.content), [block.content]);

  if (isStreaming) {
    return (
      <div className="prose prose-invert prose-sm max-w-none">
        <StreamingTextContent content={deferredContent} />
      </div>
    );
  }

  return (
    <div className="prose prose-invert prose-sm max-w-none">
      {parts.map((part, partIndex) => {
        if (part.type === 'text') {
          return <TextPartRenderer key={`text-${partIndex}`} content={part.content} />;
        } else {
          return (
            <MermaidDiagram
              key={`mermaid-${partIndex}`}
              code={part.content}
              id={part.id || `mermaid-${partIndex}`}
            />
          );
        }
      })}
    </div>
  );
});

/**
 * 流式文本内容渲染器 - 极简版，最大化性能
 * 
 * 优化策略：
 * 1. 单节点渲染：不按行分割，直接渲染整个文本
 * 2. 使用 CSS white-space: pre-wrap 保持换行格式
 * 3. 仅做最小化的代码块标识符高亮
 * 4. 避免所有不必要的 useMemo/map 操作
 * 
 * 性能关键（2026-03-09 更新）：
 * - 不使用正则表达式（正则在长文本上性能差）
 * - 使用 lastIndexOf 从末尾搜索代码块标记（O(n) 但从末尾开始，流式场景更高效）
 * - 限制处理范围：只处理最后 2000 字符中的代码块标记
 * - 避免对整个长文本进行多次遍历
 */
const StreamingTextContent = memo(function StreamingTextContent({ content }: { content: string }) {
  // 如果内容为空，渲染占位符
  if (!content) {
    return <span className="text-text-muted">...</span>;
  }

  // 性能优化：对于长文本，只处理最后 2000 字符
  // 因为流式输出中，代码块标记通常出现在最新内容中
  const SEARCH_WINDOW = 2000;
  const searchStart = Math.max(0, content.length - SEARCH_WINDOW);
  const searchRegion = content.slice(searchStart);
  
  // 快速检测：从末尾搜索代码块标记
  const lastCodeBlockInRegion = searchRegion.lastIndexOf('```');
  
  // 如果搜索区域内没有代码块标记，直接渲染纯文本（最快路径）
  if (lastCodeBlockInRegion === -1) {
    return (
      <span className="whitespace-pre-wrap break-words">
        {content}
      </span>
    );
  }

  // 将区域内的相对位置转换为全局位置
  const firstCodeBlock = searchStart + lastCodeBlockInRegion;

  // 构建渲染结果
  const parts: React.ReactNode[] = [];
  let keyIndex = 0;
  const MAX_PARTS = 10; // 减少最大片段数，避免创建过多节点

  // 添加代码块标记之前的所有文本（作为一个整体）
  if (firstCodeBlock > 0) {
    parts.push(
      <span key={`text-${keyIndex++}`}>
        {content.slice(0, firstCodeBlock)}
      </span>
    );
  }

  // 处理代码块标记
  let remaining = content.slice(firstCodeBlock);
  
  while (remaining.length > 0 && keyIndex < MAX_PARTS) {
    const idx = remaining.indexOf('```');
    
    if (idx === -1) {
      parts.push(
        <span key={`text-${keyIndex++}`}>
          {remaining}
        </span>
      );
      break;
    }

    // 添加代码块标记之前的普通文本
    if (idx > 0) {
      parts.push(
        <span key={`text-${keyIndex++}`}>
          {remaining.slice(0, idx)}
        </span>
      );
    }

    // 找到代码块标记的结束位置（到下一个换行或行尾）
    let endOfMarker = 3;
    const afterMarker = remaining.slice(idx + 3);
    
    // 查找语言标识符结束位置
    for (let i = 0; i < afterMarker.length && i < 30; i++) {
      const char = afterMarker[i];
      if (char === '\n' || char === '\r') {
        endOfMarker = 3 + i + 1;
        break;
      }
      if (!/[a-zA-Z0-9_+-]/.test(char)) {
        endOfMarker = 3 + i;
        break;
      }
      endOfMarker = 3 + i + 1;
    }

    // 添加代码块标记（带样式）
    const marker = remaining.slice(idx, idx + endOfMarker);
    parts.push(
      <span key={`code-${keyIndex++}`} className="text-text-muted font-mono text-xs">
        {marker}
      </span>
    );

    remaining = remaining.slice(idx + endOfMarker);
  }

  // 添加剩余内容
  if (remaining.length > 0) {
    parts.push(
      <span key={`text-remaining`}>
        {remaining}
      </span>
    );
  }

  return <span className="whitespace-pre-wrap break-words">{parts}</span>;
});

/**
 * 文本部分渲染器（支持代码高亮 + 双语翻译）
 */
const TextPartRenderer = memo(function TextPartRenderer({ content }: { content: string }) {
  const formattedHTML = useMemo(() => formatContent(content), [content]);
  const codeBlocks = useMemo(() => extractCodeBlocks(formattedHTML), [formattedHTML]);
  const { processedHTML } = useMemo(() => replaceCodeBlocksWithPlaceholders(formattedHTML, codeBlocks), [formattedHTML, codeBlocks]);

  const segments = useMemo(() => {
    const segs = [];
    let lastIndex = 0;
    const regex = /__CODE_BLOCK_(\d+)__/g;
    let match;
    while ((match = regex.exec(processedHTML)) !== null) {
      const blockIndex = parseInt(match[1], 10);
      const placeholderStart = match.index;
      if (placeholderStart > lastIndex) segs.push({ type: 'html', content: processedHTML.slice(lastIndex, placeholderStart) });
      segs.push({ type: 'code', content: match[0], codeBlockIndex: blockIndex });
      lastIndex = placeholderStart + match[0].length;
    }
    if (lastIndex < processedHTML.length) segs.push({ type: 'html', content: processedHTML.slice(lastIndex) });
    return segs;
  }, [processedHTML]);

  return (
    <>
      {segments.map((segment, index) => {
        if (segment.type === 'html') {
          return <div key={`html-${index}`} dangerouslySetInnerHTML={{ __html: segment.content }} />;
        } else {
          return codeBlockToReact(codeBlocks[segment.codeBlockIndex!], index);
        }
      })}
    </>
  );
});

/**
 * 状态图标配置
 */
const STATUS_CONFIG = {
  pending: { icon: Loader2, className: 'animate-spin text-yellow-500', label: '等待中' },
  running: { icon: Play, className: 'text-blue-500 animate-pulse', label: '运行中' },
  completed: { icon: Check, className: 'text-green-500', label: '已完成' },
  failed: { icon: XCircle, className: 'text-red-500', label: '失败' },
  partial: { icon: AlertTriangle, className: 'text-orange-500', label: '部分完成' },
} as const;

// ========================================
// Grep 输出渲染器
// ========================================

/**
 * 高亮文本组件 - 用于 Grep 结果
 */
function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;

  try {
    const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
    const parts = text.split(regex);

    return (
      <>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <mark key={i} className="bg-yellow-500/30 text-text-primary px-0.5 rounded font-medium">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </>
    );
  } catch {
    return <>{text}</>;
  }
}

/**
 * Grep 匹配项组件
 */
const GrepMatchItem = memo(function GrepMatchItem({
  match,
  query
}: {
  match: GrepMatch;
  query: string;
}) {
  return (
    <div className="flex items-start gap-2 py-1.5 px-2 rounded bg-background-surface hover:bg-background-hover transition-colors">
      {/* 文件名 */}
      {match.file && (
        <div className="text-xs text-primary font-mono shrink-0">
          {match.file.split('/').pop() || match.file}
        </div>
      )}
      {/* 行号 */}
      {match.line > 0 && (
        <div className="text-xs text-text-muted font-mono shrink-0 w-8">
          :{match.line}
        </div>
      )}
      {/* 内容 */}
      <div className="flex-1 text-xs text-text-secondary font-mono break-all">
        <HighlightedText text={match.content} query={query} />
      </div>
    </div>
  );
});

/**
 * Grep 输出渲染器
 */
const GrepOutputRenderer = memo(function GrepOutputRenderer({
  data
}: {
  data: GrepOutputData;
}) {
  
  return (
    <div className="space-y-2">
      {/* 匹配项列表 */}
      <div className="space-y-0.5">
        {data.matches.slice(0, 20).map((match, idx) => (
          <GrepMatchItem key={idx} match={match} query={data.query} />
        ))}
      </div>
      {/* 超过20个提示 */}
      {data.total > 20 && (
        <div className="text-xs text-text-tertiary text-center py-1">
          {`...还有 ${data.total - 20} 个匹配项`}
        </div>
      )}
    </div>
  );
});

// ========================================
// TodoWrite 渲染器
// ========================================

/**
 * TodoWrite 相关类型定义
 */
interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm?: string;
}

interface TodoInputData {
  todos: TodoItem[];
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
}

/**
 * 判断是否为 TodoWrite 工具
 */
function isTodoWriteTool(block: ToolCallBlock): boolean {
  return block.name.toLowerCase() === 'todowrite';
}

/**
 * 判断是否为 Grep 工具
 */
function isGrepTool(block: ToolCallBlock): boolean {
  return block.name.toLowerCase().includes('grep');
}

/**
 * 解析 TodoWrite 输入数据
 */
function parseTodoInput(input: Record<string, unknown> | undefined): TodoInputData | null {
  if (!input) return null;
  const todos = input.todos as TodoItem[];
  if (!Array.isArray(todos)) return null;

  return {
    todos,
    total: todos.length,
    completed: todos.filter(t => t.status === 'completed').length,
    inProgress: todos.filter(t => t.status === 'in_progress').length,
    pending: todos.filter(t => t.status === 'pending').length,
  };
}

/**
 * TodoWrite 任务状态配置
 */
const TODO_STATUS_CONFIG = {
  completed: { icon: Check, color: 'text-green-500', bg: 'bg-green-500/10', label: '已完成' },
  in_progress: { icon: Loader2, color: 'text-violet-500', bg: 'bg-violet-500/10', label: '进行中' },
  pending: { icon: Circle, color: 'text-gray-400', bg: 'bg-gray-500/10', label: '待处理' },
} as const;

/**
 * TodoWrite 任务项组件
 */
const TodoItem = memo(function TodoItem({
  todo,
  index
}: {
  todo: TodoItem;
  index: number;
}) {
  const statusConfig = TODO_STATUS_CONFIG[todo.status] || TODO_STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;

  return (
    <div className="flex items-start gap-2 p-2 rounded bg-background-surface hover:bg-background-hover transition-colors">
      <div className={clsx('p-1 rounded', statusConfig.bg)}>
        <StatusIcon className={clsx('w-3.5 h-3.5', statusConfig.color,
          todo.status === 'in_progress' && 'animate-spin'
        )} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-text-primary">{todo.content}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={clsx('text-xs', statusConfig.color)}>{statusConfig.label}</span>
          <span className="text-xs text-text-muted">#{index + 1}</span>
        </div>
      </div>
    </div>
  );
});

/**
 * TodoWrite 输入渲染器 - 展开状态
 */
const TodoWriteInputRenderer = memo(function TodoWriteInputRenderer({
  data
}: {
  data: TodoInputData;
}) {
  const percent = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* 进度条 */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-background-base rounded-full h-2 overflow-hidden">
          <div
            className="bg-violet-500 h-full transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="text-xs text-text-tertiary">
          {data.completed}/{data.total} ({percent}%)
        </span>
      </div>

      {/* 任务列表 */}
      <div className="space-y-1">
        {data.todos.map((todo, index) => (
          <TodoItem key={index} todo={todo} index={index} />
        ))}
      </div>
    </div>
  );
});

/**
 * TodoWrite 任务状态图标（用于折叠状态）
 */
function getTodoStatusIcon(status: TodoItem['status']): React.ReactElement {
  const config = TODO_STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <Icon className={clsx('w-3 h-3', config.color,
      status === 'in_progress' && 'animate-spin'
    )} />
  );
}

// ========================================
// 工具调用块渲染器
// ========================================

/** 工具调用块组件 - 优化版本 */
const ToolCallBlockRenderer = memo(function ToolCallBlockRenderer({ block }: { block: ToolCallBlock }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showFullOutput, setShowFullOutput] = useState(false);
  const [showToolDetails, setShowToolDetails] = useState(false);

  // 获取工具配置
  const toolConfig = useMemo(() => getToolConfig(block.name), [block.name]);

  // 状态图标
  const statusConfig = STATUS_CONFIG[block.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;

  // 计算耗时
  const duration = useMemo(() => {
    if (block.duration) return formatDuration(block.duration);
    const calculated = calculateDuration(block.startedAt, block.completedAt);
    return calculated ? formatDuration(calculated) : '';
  }, [block.duration, block.startedAt, block.completedAt]);

  // 提取关键信息
  const keyInfo = useMemo(() => extractToolKeyInfo(block.name, block.input), [block.name, block.input]);

  // 生成输出摘要
  const outputSummary = useMemo(() => {
    if (block.status === 'completed' && block.output) {
      return generateOutputSummary(block.name, block.output, block.status, block.input);
    }
    return null;
  }, [block.name, block.output, block.status, block.input]);

  // Edit 工具的简化输出提示
  const editOutputSummary = useMemo(() => {
    if (!isEditTool(block.name) || block.status !== 'completed') {
      return null;
    }

    if (block.output) {
      const output = block.output.toLowerCase();
      // 成功
      if (output.includes('has been updated') ||
          output.includes('successfully edited') ||
          output.includes('edited successfully')) {
        return {
          type: 'success',
          text: '文件已成功更新'
        };
      }
      // 失败
      if (output.includes('failed') ||
          output.includes('error') ||
          output.includes('could not')) {
        return {
          type: 'error',
          text: '文件更新失败'
        };
      }
    }

    return null;
  }, [block.name, block.status, block.output, block.error]);

  // 解析 TodoWrite 数据
  const todoData = useMemo(() => {
    if (isTodoWriteTool(block)) {
      return parseTodoInput(block.input);
    }
    return null;
  }, [block]);

  // 解析 Grep 数据
  const grepData = useMemo(() => {
    if (isGrepTool(block) && block.output) {
      return parseGrepMatches(block.output, block.input);
    }
    return null;
  }, [block]);

  // 判断输出是否需要展开功能（修复：基于实际长度而非 outputSummary）
  const outputNeedsExpand = (block.output?.length ?? 0) > 1000;

  // 格式化输入参数（非 TodoWrite 工具使用）
  const formatInput = (input: Record<string, unknown>): string => {
    const entries = Object.entries(input);
    if (entries.length === 0) return '';
    return entries.map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n');
  };

  // 工具图标组件
  const ToolIcon = toolConfig.icon;

  // 是否可展开（有输入参数或有输出）
  const hasInput = block.input && Object.keys(block.input).length > 0;
  const hasOutput = block.output && block.output.length > 0;
  const hasError = block.status === 'failed' && block.error;
  const canExpand = hasInput || hasOutput || hasError;

  // 是否显示 Diff 按钮（Edit 工具且有 Diff 数据）
  const diffData = useMemo(() => {
    if (!isEditTool(block.name) || block.status !== 'completed') return null;
    return extractEditDiff(block);
  }, [block.name, block.status, block.input]);

  const showDiffButton = diffData !== null;

  // 是否使用专用输出渲染器
  const useCustomRenderer = grepData !== null;

  // 状态动画类
  const statusAnimationClass = useMemo(() => {
    switch (block.status) {
      case 'pending':
        return 'animate-pulse border-dashed';
      case 'running':
        return 'animate-pulse';
      case 'completed':
        return '';
      case 'failed':
        return 'animate-shake-once';
      case 'partial':
        return '';
      default:
        return '';
    }
  }, [block.status]);

  // Bash 工具需要清理 ANSI 码
  const displayOutput = useMemo(() => {
    if (!block.output) return '';
    const normalizedToolName = block.name.toLowerCase();
    if (
      normalizedToolName.includes('bash') ||
      normalizedToolName.includes('command') ||
      normalizedToolName.includes('execute')
    ) {
      return stripAnsiCodes(block.output);
    }
    return block.output;
  }, [block.name, block.output]);

  return (
    <div
      className={clsx(
        'my-2 rounded-lg overflow-hidden w-full transition-all duration-200',
        'border border-border',
        'bg-background-surface',
        statusAnimationClass
      )}
    >
      {/* 工具调用头部 - 左侧色条 */}
      <div
        className={clsx(
          'flex items-center gap-3 px-3 py-2',
          canExpand ? 'cursor-pointer hover:bg-background-hover' : 'cursor-default',
          'border-l-4',
          toolConfig.borderColor
        )}
        onClick={() => canExpand && setIsExpanded(!isExpanded)}
      >
        {/* 工具类型图标 */}
        <div className={clsx('p-1.5 rounded-md', toolConfig.bgColor)}>
          <ToolIcon className={clsx('w-4 h-4', toolConfig.color)} />
        </div>

        {/* 操作描述 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-secondary">
              {block.status === 'running' ? '正在' : '已'}{toolConfig.label}
            </span>
            {keyInfo && (
              <span className={clsx('font-medium truncate', toolConfig.color)}>
                {keyInfo}
              </span>
            )}
          </div>
          {/* 输出摘要（折叠时显示） */}
          {!isExpanded && outputSummary && (
            <div className="text-xs text-text-tertiary mt-0.5 flex items-center gap-1">
              {isGrepTool(block) && grepData ? (
                <>
                  <FileSearch className="w-3 h-3 shrink-0" />
                  <span>{outputSummary.summary}</span>
                </>
              ) : (
                <span>{outputSummary.summary}</span>
              )}
              {(outputSummary.expandable || outputNeedsExpand) && (
                <ChevronRight className="w-3 h-3 shrink-0" />
              )}
            </div>
          )}
          {/* TodoWrite 任务预览（折叠时显示前2个任务） */}
          {!isExpanded && todoData && todoData.total > 0 && (
            <div className="mt-1.5 space-y-0.5">
              {todoData.todos.slice(0, 2).map((todo, idx) => (
                <div key={idx} className="text-xs text-text-tertiary flex items-center gap-1.5">
                  {getTodoStatusIcon(todo.status)}
                  <span className="truncate">{todo.content}</span>
                </div>
              ))}
              {todoData.total > 2 && (
                <div className="text-xs text-text-muted">
                  {`...还有 ${todoData.total - 2} 个任务`}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 状态与耗时 */}
        <div className="flex items-center gap-2 shrink-0">
          {duration && (
            <span className="text-xs text-text-tertiary">{duration}</span>
          )}
          <StatusIcon className={clsx('w-4 h-4', statusConfig.className)} />
        </div>

        {/* 展开/收起图标 */}
        {canExpand && (
          <ChevronDown
            className={clsx(
              'w-4 h-4 text-text-muted transition-transform shrink-0',
              isExpanded && 'rotate-180'
            )}
          />
        )}
      </div>

      {/* 可展开的详情 */}
      {isExpanded && (
        <div className="px-4 py-3 bg-background-subtle border-t border-border">
          {/* 工具名称和时间 */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-text-muted font-mono">{block.name}</span>
            <div className="text-xs text-text-tertiary flex gap-3">
              <span>{`开始: ${new Date(block.startedAt).toLocaleTimeString('zh-CN')}`}</span>
              {block.completedAt && (
                <span>{`完成: ${new Date(block.completedAt).toLocaleTimeString('zh-CN')}`}</span>
              )}
            </div>
          </div>

          {/* Edit 工具：直接显示 Diff */}
          {showDiffButton && diffData && (
            <div className="mb-3">
              <div className="text-xs text-text-muted mb-2 flex items-center gap-1.5">
                <FileDiff className="w-3 h-3" />
                {'文件差异'}
              </div>
              <DiffViewer
                oldContent={diffData.oldContent}
                newContent={diffData.newContent}
              />
            </div>
          )}

          {/* 非Edit工具或无Diff：显示输入参数 */}
          {!showDiffButton && hasInput && (
            <div className="mb-3">
              <div className="text-xs text-text-muted mb-1.5 flex items-center gap-1.5">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                {todoData ? '任务列表' : '输入参数'}
              </div>
              {todoData ? (
                <TodoWriteInputRenderer data={todoData} />
              ) : (
                <pre className="text-xs text-text-secondary bg-background-surface rounded p-2.5 max-w-full overflow-x-auto font-mono">
                  {formatInput(block.input)}
                </pre>
              )}
            </div>
          )}

          {/* Edit 工具：简化输出提示 */}
          {editOutputSummary && (
            <div className="mb-3">
              <div className={clsx(
                'text-xs flex items-center gap-1.5',
                editOutputSummary.type === 'success' ? 'text-success' : 'text-error'
              )}>
                {editOutputSummary.type === 'success' ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <XCircle className="w-3.5 h-3.5" />
                )}
                {editOutputSummary.text}
              </div>
            </div>
          )}

          {/* 非Edit工具：完整输出结果 */}
          {!isEditTool(block.name) && hasOutput && (
            <div className="mb-3">
              <div className="text-xs text-text-muted mb-1.5 flex items-center gap-1.5">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {'输出结果'}
                {outputNeedsExpand && !useCustomRenderer && (
                  <button
                    onClick={() => setShowFullOutput(!showFullOutput)}
                    className="ml-auto text-primary hover:text-primary-hover text-xs"
                  >
                    {showFullOutput ? '收起' : '展开全部'}
                  </button>
                )}
              </div>
              {useCustomRenderer && grepData ? (
                <GrepOutputRenderer data={grepData} />
              ) : (
                <pre className={clsx(
                  'text-xs text-text-secondary bg-background-surface rounded p-2.5 overflow-x-auto font-mono',
                  showFullOutput ? 'max-h-96 overflow-y-auto' : 'max-h-48 overflow-y-auto'
                )}>
                  {showFullOutput
                    ? displayOutput
                    : (displayOutput.length > 1000
                      ? displayOutput.slice(0, 1000) + '\n... (' + '内容过长，已截断，点击展开全部查看' + ')'
                      : displayOutput)}
                </pre>
              )}
            </div>
          )}

          {/* Edit 工具：工具详情折叠区域 */}
          {isEditTool(block.name) && (hasInput || hasOutput) && (
            <div className="mb-3">
              <div
                onClick={() => setShowToolDetails(!showToolDetails)}
                className="text-xs text-text-tertiary hover:text-text-primary cursor-pointer flex items-center gap-1 select-none"
              >
                <ChevronRight
                  className={clsx(
                    'w-3 h-3 transition-transform',
                    showToolDetails && 'rotate-90'
                  )}
                />
                {'工具详情'}
              </div>
              {showToolDetails && (
                <div className="mt-2 space-y-2">
                  {hasInput && (
                    <div>
                      <div className="text-xs text-text-muted mb-1">{'输入参数'}</div>
                      <pre className="text-xs text-text-secondary bg-background-surface rounded p-2.5 overflow-x-auto font-mono">
                        {formatInput(block.input)}
                      </pre>
                    </div>
                  )}
                  {hasOutput && (
                    <div>
                      <div className="text-xs text-text-muted mb-1">{'输出结果'}</div>
                      <pre className="text-xs text-text-secondary bg-background-surface rounded p-2.5 overflow-x-auto font-mono max-h-48 overflow-y-auto">
                        {displayOutput}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 错误信息 */}
          {hasError && (
            <div className="mb-3">
              <div className="text-xs text-error mb-1.5 flex items-center gap-1.5">
                <XCircle className="w-3 h-3" />
                {'错误信息'}
              </div>
              <pre className="text-xs text-error bg-error-faint rounded p-2.5 overflow-x-auto font-mono">
                {block.error}
              </pre>
            </div>
          )}

          {/* 状态标签 */}
          <div className="flex items-center gap-2">
            <span className={clsx(
              'text-xs px-2 py-0.5 rounded-full',
              toolConfig.bgColor,
              toolConfig.color
            )}>
              {statusConfig.label}
            </span>
            {duration && (
              <span className="text-xs text-text-tertiary">
                {`耗时 ${duration}`}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

/** 内容块渲染器 */
function renderContentBlock(block: ContentBlock, isStreaming?: boolean): React.ReactNode {
  switch (block.type) {
    case 'text':
      return <TextBlockRenderer key={`text-${block.content.slice(0, 20)}`} block={block} isStreaming={isStreaming} />;
    case 'tool_call':
      return <ToolCallBlockRenderer key={block.id} block={block} />;
    default:
      return null;
  }
}

/** 助手消息组件 - 使用内容块架构 */
const AssistantBubble = memo(function AssistantBubble({
  message,
  engineLabel,
}: {
  message: AssistantChatMessage;
  engineLabel: string;
}) {
  const hasBlocks = message.blocks && message.blocks.length > 0;

  return (
    <div className="flex gap-3 my-2">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary-600
                      flex items-center justify-center shadow-glow shrink-0">
        <span className="text-sm font-bold text-white">P</span>
      </div>
      <div className="flex-1 space-y-1 min-w-0 max-w-[75%]">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-text-primary">{engineLabel}</span>
          <span className="text-xs text-text-tertiary">
            {new Date(message.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        {hasBlocks ? (
          <div className="space-y-1">
            {message.blocks.map((block, index) => (
              <div key={index}>
                {renderContentBlock(block, message.isStreaming)}
              </div>
            ))}
          </div>
        ) : message.content ? (
          <div
            className="prose prose-invert prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
          />
        ) : null}
        {message.isStreaming && (
          <span className="inline-flex ml-1">
            <span className="flex gap-0.5 items-end h-4">
              <span className="w-1 h-1 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-1 bg-text-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          </span>
        )}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  const prevBlocks = prevProps.message.blocks;
  const nextBlocks = nextProps.message.blocks;
  if (prevProps.engineLabel !== nextProps.engineLabel) return false;
  if (prevProps.message.id !== nextProps.message.id) return false;
  if (prevProps.message.isStreaming !== nextProps.message.isStreaming) return false;
  if (prevBlocks.length !== nextBlocks.length) return false;
  if (nextProps.message.isStreaming && prevBlocks.length > 0) {
    const lastPrev = prevBlocks[prevBlocks.length - 1];
    const lastNext = nextBlocks[nextBlocks.length - 1];
    if (lastPrev.type === 'text' && lastNext.type === 'text') {
      if (lastPrev.content.length !== lastNext.content.length) return false;
    } else if (lastPrev.type !== lastNext.type) {
      return false;
    }
    for (let i = 0; i < prevBlocks.length; i++) {
      const pb = prevBlocks[i];
      const nb = nextBlocks[i];
      if (pb.type !== nb.type) return false;
      if (pb.type === 'tool_call' && nb.type === 'tool_call') {
        if (pb.status !== nb.status) return false;
        if (pb.output !== nb.output) return false;
      }
    }
  }
  return true;
});

/** 系统消息组件 */
const SystemBubble = memo(function SystemBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-center my-2">
      <p className="text-sm text-text-muted italic">{content}</p>
    </div>
  );
});

/** 消息渲染器 */
function renderChatMessage(message: ChatMessage, engineLabel: string): React.ReactNode {
  switch (message.type) {
    case 'user':
      return <UserBubble key={message.id} message={message} />;
    case 'assistant':
      return <AssistantBubble key={message.id} message={message} engineLabel={engineLabel} />;
    case 'system':
      return <SystemBubble key={message.id} content={(message as any).content} />;
    default:
      return null;
  }
}

/** 空状态组件 */
const EmptyState = memo(function EmptyState() {
  
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      {/* Logo 图标 */}
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary-600 flex items-center justify-center shadow-glow mb-6 hover:shadow-glow-lg transition-all">
        <span className="text-3xl font-bold text-white">P</span>
      </div>

      {/* 标题 */}
      <h1 className="text-2xl font-semibold text-text-primary mb-2">
        {BRAND_SHORT_NAME}
      </h1>

      {/* 描述 */}
      <p className="text-text-secondary mb-8 max-w-md">
        {BRAND_TAGLINE}
      </p>

      {/* 功能列表 */}
      <div className="grid grid-cols-3 gap-4 max-w-lg">
        <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-background-surface border border-border shadow-soft hover:shadow-medium hover:border-border-strong transition-all">
          <div className="w-8 h-8 rounded-lg bg-success-faint flex items-center justify-center">
            <FolderOpen className="w-4 h-4 text-success" />
          </div>
          <span className="text-xs text-text-tertiary">{'文件上下文'}</span>
        </div>
        <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-background-surface border border-border shadow-soft hover:shadow-medium hover:border-border-strong transition-all">
          <div className="w-8 h-8 rounded-lg bg-warning-faint flex items-center justify-center">
            <Code className="w-4 h-4 text-warning" />
          </div>
          <span className="text-xs text-text-tertiary">{'代码协作'}</span>
        </div>
        <div className="flex flex-col items-center gap-2 p-4 rounded-xl bg-background-surface border border-border shadow-soft hover:shadow-medium hover:border-border-strong transition-all">
          <div className="w-8 h-8 rounded-lg bg-primary-faint flex items-center justify-center">
            <FileSearch className="w-4 h-4 text-primary" />
          </div>
          <span className="text-xs text-text-tertiary">{'智能分析'}</span>
        </div>
      </div>

      {/* 提示 */}
      <p className="text-text-tertiary text-sm mt-8">
        {'输入消息开始新一轮协作。'}
      </p>
    </div>
  );
});

/**
 * 增强版聊天消息列表组件
 *
 * 使用内容块架构渲染消息，工具调用穿插在文本中间
 *
 * 性能优化：
 * - 流式阶段直接从 currentMessage 读取内容，不更新 messages 数组
 * - 避免 50ms 一次的整个消息列表重渲染
 */
export function EnhancedChatMessages() {
  const { messages, archivedMessages, loadArchivedMessages, currentMessage, isStreaming } = useEventChatStore();
  const currentEngineId = useConfigStore((state) => state.config?.defaultEngine);
  const currentEngineLabel = useMemo(() => getEngineLabel(currentEngineId), [currentEngineId]);

  // 性能优化：流式阶段合并 currentMessage 到消息列表
  // 这样就不需要频繁更新 messages 数组，避免整个列表重渲染
  // 使用 ref 缓存消息对象，避免每次 currentMessage 变化都创建新引用
  const prevDisplayMessagesRef = useRef<ChatMessage[]>([]);
  // 存储 lastContentRef 用于快速比较内容是否变化
  const lastContentRef = useRef<{ id: string; contentLen: number } | null>(null);
  
  const displayMessages = useMemo(() => {
    if (!currentMessage || !isStreaming) {
      prevDisplayMessagesRef.current = messages;
      lastContentRef.current = null;
      return messages;
    }

    // 快速检查：如果 currentMessage 内容长度与上次相同，直接返回缓存
    const lastBlock = currentMessage.blocks[currentMessage.blocks.length - 1];
    const currentContentLen = lastBlock?.type === 'text' ? (lastBlock as any).content?.length || 0 : 0;
    
    if (
      lastContentRef.current?.id === currentMessage.id &&
      lastContentRef.current?.contentLen === currentContentLen
    ) {
      // 内容长度相同，直接返回缓存（避免创建新数组）
      return prevDisplayMessagesRef.current;
    }

    // 更新缓存标记
    lastContentRef.current = { id: currentMessage.id, contentLen: currentContentLen };

    // 检查 currentMessage 是否已在 messages 中
    const existingIndex = messages.findIndex(m => m.id === currentMessage.id);
    
    if (existingIndex >= 0) {
      // 内容变化，创建新的消息数组，但复用不变的消息对象
      const updated: ChatMessage[] = [
        ...messages.slice(0, existingIndex),
        {
          ...messages[existingIndex],
          blocks: currentMessage.blocks,
          isStreaming: true,
        } as AssistantChatMessage,
        ...messages.slice(existingIndex + 1),
      ];
      prevDisplayMessagesRef.current = updated;
      return updated;
    } else {
      // 添加到末尾
      const newMessages: ChatMessage[] = [...messages, {
        id: currentMessage.id,
        type: 'assistant' as const,
        blocks: currentMessage.blocks,
        timestamp: new Date().toISOString(),
        isStreaming: true,
      }];
      prevDisplayMessagesRef.current = newMessages;
      return newMessages;
    }
  }, [messages, currentMessage, isStreaming]);

  const isEmpty = displayMessages.length === 0;
  const hasArchive = archivedMessages.length > 0;

  // Virtuoso 引用，用于滚动控制
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  // 智能自动滚动：用户在底部附近时自动滚动，离开底部时禁用
  const [autoScroll, setAutoScroll] = useState(true);

  // 当前可见的对话轮次索引
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);

  // 对话轮次分组（使用 displayMessages 包含流式消息）
  const conversationRounds = useMemo(() => {
    return groupConversationRounds(displayMessages);
  }, [displayMessages]);

  // 检测用户是否在底部附近（基于像素距离）
  const handleAtBottomStateChange = useCallback((atBottom: boolean) => {
    setAutoScroll(atBottom);
  }, []);

  // 监听可见范围变化，更新当前轮次索引
  const handleRangeChange = useCallback((range: { startIndex: number; endIndex: number }) => {
    const { startIndex, endIndex } = range;
    // 使用可见区域中心来找到最相关的轮次
    const centerIndex = Math.floor((startIndex + endIndex) / 2);

    // 找到包含中心索引的轮次
    const round = conversationRounds.findIndex(r =>
      r.messageIndices.some(idx => idx >= startIndex && idx <= endIndex) &&
      r.messageIndices.some(idx => idx > centerIndex)
    );

    // 如果没找到更合适的，使用第一个包含范围内消息的轮次
    const fallbackRound = conversationRounds.findIndex(r =>
      r.messageIndices.some(idx => idx >= startIndex && idx <= endIndex)
    );

    const targetRound = round >= 0 ? round : fallbackRound;
    if (targetRound >= 0) {
      setCurrentRoundIndex(targetRound);
    }
  }, [conversationRounds]);

  // 滚动到指定轮次
  const scrollToRound = useCallback((roundIndex: number) => {
    const round = conversationRounds[roundIndex];
    if (!round || !virtuosoRef.current) return;

    // 优先跳转到 AI 回复，如果没有则跳转到用户消息
    const targetIndex = round.assistantMessage
      ? round.messageIndices[1]  // AI 回复索引
      : round.messageIndices[0]; // 用户消息索引

    virtuosoRef.current.scrollToIndex({
      index: targetIndex,
      align: 'start',
      behavior: 'smooth',
    });

    setAutoScroll(false); // 禁用自动滚动
  }, [conversationRounds]);

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    if (!virtuosoRef.current) return;

    // 使用 scrollTo 替代 scrollToIndex，确保滚动到容器的物理底部
    virtuosoRef.current.scrollTo({
      top: Number.MAX_SAFE_INTEGER,
      behavior: 'smooth',
    });

    setAutoScroll(true); // 启用自动滚动
  }, []);

  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {/* 归档消息提示 */}
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

      {/* 消息列表 */}
      <div className="flex-1 min-h-0 relative">
        <div className="h-full">
          {isEmpty ? (
            <EmptyState />
          ) : (
            <Virtuoso
              ref={virtuosoRef}
              style={{ height: '100%' }}
              data={displayMessages}
              itemContent={(_index, item) => renderChatMessage(item, currentEngineLabel)}
              components={{
                EmptyPlaceholder: () => null,
                Footer: () => <div style={{ height: '120px' }} />,
              }}
              followOutput={autoScroll ? (isStreaming ? true : 'smooth') : false}
              atBottomStateChange={handleAtBottomStateChange}
              atBottomThreshold={150}
              rangeChanged={handleRangeChange}
              increaseViewportBy={{ top: 100, bottom: 300 }}
              initialTopMostItemIndex={displayMessages.length - 1}
            />
          )}
        </div>

        {/* 聊天导航器 */}
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
