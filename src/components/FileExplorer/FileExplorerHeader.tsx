import type { Workspace } from '../../types';

interface FileExplorerHeaderProps {
  currentWorkspace: Workspace | null;
  viewingWorkspace: Workspace | null;
  isRefreshing: boolean;
  isDisabled: boolean;
  onRefresh: () => void;
}

export function FileExplorerHeader(props: FileExplorerHeaderProps) {
  const {
    currentWorkspace,
    viewingWorkspace,
    isRefreshing,
    isDisabled,
    onRefresh,
  } = props;
  const activeWorkspace = viewingWorkspace || currentWorkspace;
  const activeWorkspaceName = activeWorkspace?.name || '未选择工作区';

  return (
    <div className="border-b border-border bg-background-surface">
      <div className="px-3 py-2 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[11px] uppercase tracking-wide text-text-tertiary">当前工作区</div>
          <div className="truncate text-sm font-medium text-text-primary" title={`当前浏览: ${activeWorkspaceName}`}>
            {activeWorkspaceName}
          </div>
        </div>

        <button
          onClick={onRefresh}
          disabled={isDisabled}
          className={`shrink-0 p-1.5 rounded-lg transition-all duration-200 ${
            isDisabled
              ? 'text-text-tertiary cursor-not-allowed'
              : 'text-text-secondary hover:text-text-primary hover:bg-background-hover'
          }`}
          title="刷新目录 (F5)"
        >
          <svg className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
    </div>
  );
}
