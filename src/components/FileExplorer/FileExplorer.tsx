import { useCallback, useRef, useState } from 'react';
import { useCommandStore, useFileExplorerStore, useWorkspaceStore } from '../../stores';
import { FileTree } from './FileTree';
import { SearchBar } from './SearchBar';
import { useInitialWorkspaceLoad, useRefreshHotkey, useWorkspaceChangeSync } from './useFileExplorerLifecycle';
import { WorkspaceMenuContent } from '../TopMenuBar/WorkspaceMenuContent';
import { WorkspaceVersionsModal } from '../Versioning/WorkspaceVersionsModal';

interface WorkspaceSelectorProps {
  workspaceName: string;
  onCreateWorkspace: () => void;
  onRefresh: () => void;
  onOpenVersions: () => void;
  isRefreshing: boolean;
  isDisabled: boolean;
}

function WorkspaceSelector({
  workspaceName,
  onCreateWorkspace,
  onRefresh,
  onOpenVersions,
  isRefreshing,
  isDisabled,
}: WorkspaceSelectorProps) {
  const [showMenu, setShowMenu] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="shrink-0 border-b border-border px-2 py-2 flex items-center gap-1">
      {/* 工作区下拉按钮 */}
      <div className="relative flex-1 min-w-0">
        <button
          ref={buttonRef}
          onClick={() => setShowMenu((v) => !v)}
          className="w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-background-surface border border-border text-sm text-text-secondary hover:border-border-strong hover:text-text-primary transition-colors text-left"
        >
          <svg className="w-3.5 h-3.5 shrink-0 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
          </svg>
          <span className="truncate flex-1 text-xs">{workspaceName}</span>
          <svg className={`w-3 h-3 shrink-0 text-text-tertiary transition-transform ${showMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showMenu && (
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setShowMenu(false)} />
            <div
              className="fixed z-[9999] w-64 overflow-hidden rounded-xl border border-border bg-background-surface shadow-xl"
              style={(() => {
                if (!buttonRef.current) return {};
                const rect = buttonRef.current.getBoundingClientRect();
                return { top: rect.bottom + 4, left: rect.left };
              })()}
            >
              <WorkspaceMenuContent onCreateWorkspace={() => { setShowMenu(false); onCreateWorkspace(); }} />
            </div>
          </>
        )}
      </div>

      {/* 刷新按钮 */}
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
        <svg className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>

      {/* 版本管理 */}
      <button
        onClick={onOpenVersions}
        disabled={isDisabled}
        className={`shrink-0 p-1.5 rounded-lg transition-all duration-200 ${
          isDisabled
            ? 'text-text-tertiary cursor-not-allowed'
            : 'text-text-secondary hover:text-text-primary hover:bg-background-hover'
        }`}
        title="版本管理"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>
    </div>
  );
}

interface FileExplorerProps {
  onCreateWorkspace?: () => void;
}

export function FileExplorer({ onCreateWorkspace }: FileExplorerProps) {
  const { current_path, loading, is_refreshing, error, load_directory, refresh_directory, clear_error } = useFileExplorerStore();
  const { getCurrentWorkspace, getViewingWorkspace } = useWorkspaceStore();
  const { loadCustomCommands } = useCommandStore();
  const [showVersions, setShowVersions] = useState(false);

  useWorkspaceChangeSync({ getCurrentWorkspace, getViewingWorkspace, load_directory, loadCustomCommands });
  useInitialWorkspaceLoad({ currentPath: current_path, getCurrentWorkspace, getViewingWorkspace, load_directory, loadCustomCommands });
  useRefreshHotkey(refresh_directory);

  const currentWorkspace = getCurrentWorkspace();
  const viewingWorkspace = getViewingWorkspace();
  const activeWorkspace = viewingWorkspace || currentWorkspace;
  const isBusy = loading || is_refreshing;

  const handleRefresh = useCallback(() => {
    clear_error();
    refresh_directory();
  }, [clear_error, refresh_directory]);

  return (
    <div className="h-full flex flex-col">
      {/* 顶部：工作区选择器 + 刷新 */}
      <WorkspaceSelector
        workspaceName={activeWorkspace?.name ?? '选择工作区'}
        onCreateWorkspace={onCreateWorkspace ?? (() => {})}
        onRefresh={handleRefresh}
        onOpenVersions={() => setShowVersions(true)}
        isRefreshing={is_refreshing}
        isDisabled={isBusy || !activeWorkspace}
      />

      {/* 搜索框 */}
      <SearchBar />

      {error && <div className="mx-2 mt-1 p-2 bg-danger-faint border border-danger/30 rounded-lg text-danger text-xs">{error}</div>}

      {/* 文件树 */}
      <div className="flex-1 overflow-auto overflow-x-auto">
        <FileTree />
      </div>

      {showVersions && activeWorkspace && (
        <WorkspaceVersionsModal
          workspaceName={activeWorkspace.name}
          workspacePath={activeWorkspace.path}
          onClose={() => setShowVersions(false)}
        />
      )}
    </div>
  );
}
