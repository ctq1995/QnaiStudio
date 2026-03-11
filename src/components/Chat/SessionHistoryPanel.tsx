import { useCallback, useEffect, useMemo, useState } from 'react';
import { Clock, HardDrive, Loader2, MessageSquare, RefreshCw, RotateCcw, Trash2, X, Zap } from 'lucide-react';
import { useEventChatStore, type UnifiedHistoryItem } from '../../stores/eventChatStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { getCurrentWorkspaceById } from '../../utils/workspaceScope';

interface SessionHistoryPanelProps {
  onClose?: () => void;
}

type HistoryFilter = 'all' | 'claude-code' | 'iflow' | 'codex-cli' | 'gemini';

function formatTime(timestamp: string) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;

  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function formatFileSize(bytes?: number) {
  if (!bytes) return '';

  const units = ['B', 'KB', 'MB', 'GB'];
  const base = 1024;
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(base)), units.length - 1);
  const value = bytes / base ** index;

  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function getEngineInfo(item: UnifiedHistoryItem) {
  if (item.source === 'claude-code-native') {
    return {
      name: 'Claude Code',
      color: 'text-blue-500',
      badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-300',
      icon: HardDrive,
    };
  }

  if (item.engineId === 'iflow') {
    return {
      name: 'IFlow',
      color: 'text-violet-500',
      badge: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
      icon: Zap,
    };
  }

  if (item.engineId === 'codex-cli') {
    return {
      name: 'Codex CLI',
      color: 'text-emerald-500',
      badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
      icon: Zap,
    };
  }

  return {
    name: 'Claude Code',
    color: 'text-blue-500',
    badge: 'bg-blue-500/10 text-blue-600 dark:text-blue-300',
    icon: HardDrive,
  };
}

function FilterButton(props: { active: boolean; label: string; onClick: () => void }) {
  const { active, label, onClick } = props;

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-lg px-3 py-1.5 text-xs transition-colors',
        active ? 'bg-primary text-white' : 'bg-background-surface text-text-secondary hover:text-text-primary',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

export function SessionHistoryPanel({ onClose }: SessionHistoryPanelProps) {
  const [history, setHistory] = useState<UnifiedHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const currentWorkspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const currentWorkspace = useMemo(
    () => getCurrentWorkspaceById(workspaces, currentWorkspaceId),
    [currentWorkspaceId, workspaces],
  );

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const items = await useEventChatStore.getState().getUnifiedHistory();
      setHistory(items);
    } catch (error) {
      console.error('[SessionHistoryPanel] 加载历史失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [currentWorkspace?.path, loadHistory]);

  const handleRestore = async (sessionId: string, engineId: 'claude-code' | 'iflow' | 'codex-cli' | 'gemini') => {
    setRestoring(sessionId);
    try {
      const success = await useEventChatStore.getState().restoreFromHistory(sessionId, engineId);
      if (success) {
        onClose?.();
        return;
      }
      console.error('[SessionHistoryPanel] 恢复会话失败');
    } catch (error) {
      console.error('[SessionHistoryPanel] 恢复会话出错:', error);
    } finally {
      setRestoring(null);
    }
  };

  const handleDelete = (sessionId: string, source: UnifiedHistoryItem['source']) => {
    useEventChatStore.getState().deleteHistorySession(sessionId, source === 'local' ? 'local' : undefined);
    setHistory((current) => current.filter((item) => item.id !== sessionId));
  };

  const filteredHistory = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return history.filter((item) => {
      if (filter !== 'all' && item.engineId !== filter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return item.title.toLowerCase().includes(normalizedQuery);
    });
  }, [filter, history, searchQuery]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background-elevated">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-text-primary">会话历史</h2>
          <p className="mt-1 text-xs text-text-secondary">查看本地记录和 CLI 原生会话，并一键恢复。</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadHistory()}
            className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-background-hover hover:text-text-primary"
            title="刷新历史"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-background-hover hover:text-text-primary"
            title="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border-subtle px-4 py-3">
        <FilterButton active={filter === 'all'} label="全部" onClick={() => setFilter('all')} />
        <FilterButton active={filter === 'claude-code'} label="Claude" onClick={() => setFilter('claude-code')} />
        <FilterButton active={filter === 'codex-cli'} label="Codex" onClick={() => setFilter('codex-cli')} />
        <FilterButton active={filter === 'iflow'} label="IFlow" onClick={() => setFilter('iflow')} />
      </div>

      <div className="shrink-0 border-b border-border-subtle px-4 py-3">
        <input
          type="text"
          placeholder="搜索会话标题..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-full items-center justify-center text-text-secondary">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="ml-2 text-sm">正在加载历史...</span>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center p-8 text-text-tertiary">
            <MessageSquare className="mb-4 h-12 w-12 opacity-50" />
            <p className="text-sm">暂无匹配的会话记录</p>
          </div>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {filteredHistory.map((item) => {
              const engineInfo = getEngineInfo(item);
              const EngineIcon = engineInfo.icon;
              const isRestoring = restoring === item.id;
              const canDelete = item.source === 'local';
              const totalTokens = (item.inputTokens || 0) + (item.outputTokens || 0);

              return (
                <li key={item.id} className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-background-hover/60">
                  <div className={`mt-0.5 ${engineInfo.color}`}>
                    <EngineIcon className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-medium text-text-primary">{item.title}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-xs ${engineInfo.badge}`}>{engineInfo.name}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-tertiary">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {item.messageCount} 条消息
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatTime(item.timestamp)}
                      </span>
                      {item.fileSize ? <span>{formatFileSize(item.fileSize)}</span> : null}
                      {totalTokens > 0 ? <span>{totalTokens.toLocaleString()} Tokens</span> : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleRestore(item.id, item.engineId)}
                      disabled={isRestoring}
                      className={[
                        'rounded-md p-1.5 transition-colors',
                        isRestoring
                          ? 'cursor-not-allowed opacity-50'
                          : 'text-text-secondary hover:bg-background-elevated hover:text-text-primary',
                      ].join(' ')}
                      title="恢复会话"
                    >
                      {isRestoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                    </button>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id, item.source)}
                        className="rounded-md p-1.5 text-text-tertiary transition-colors hover:bg-danger/10 hover:text-danger"
                        title="删除会话"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="shrink-0 border-t border-border-subtle px-4 py-3 text-xs leading-5 text-text-tertiary">
        <p>• 本地会话会在新建对话和关键节点自动写入历史。</p>
        <p>• Claude Code / IFlow 原生历史为只读，本地历史支持删除。</p>
      </div>
    </div>
  );
}
