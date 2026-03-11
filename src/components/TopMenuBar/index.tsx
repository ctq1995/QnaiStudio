import { type ReactNode, useMemo, useState } from 'react';
import { Clock3, Download, LayoutPanelLeft, Minimize, Moon, Plus, Settings2, Sun } from 'lucide-react';
import { useConfigStore, useEventChatStore, useViewStore, useWorkspaceStore } from '../../stores';
import { useFloatingWindowStore } from '../../stores/floatingWindowStore';
import { exportToMarkdown, generateFileName } from '../../services/chatExport';
import * as tauri from '../../services/tauri';
import { BrandLogo, StatusIndicator } from '../Common';
import { ViewMenuContent } from './ViewMenuContent';
import { getCurrentWorkspaceById } from '../../utils/workspaceScope';

interface TopMenuBarProps {
  onNewConversation: () => void;
  onSettings: () => void;
  onCreateWorkspace: () => void;
  onToggleTheme: () => void;
  theme: 'dark' | 'light';
  engineLabel?: string;
  engineVersion?: string;
  engineStatus?: 'online' | 'offline' | 'loading' | 'error';
}

interface ConfirmDialogProps {
  messageCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}

interface ActionButtonProps {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}

function ConfirmNewConversationDialog({ messageCount, onCancel, onConfirm }: ConfirmDialogProps) {
  return (
    <>
      <div className="fixed inset-0 z-[2000] bg-black/50" onClick={onCancel} />
      <div className="fixed left-1/2 top-1/2 z-[2000] w-80 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background-elevated p-5 shadow-xl">
        <h3 className="mb-2 text-base font-semibold text-text-primary">确认新对话</h3>
        <p className="mb-5 text-sm leading-6 text-text-secondary">当前对话包含 {messageCount} 条消息，确认开始新的会话吗？</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-background-hover hover:text-text-primary"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm text-white transition-colors hover:bg-primary-hover"
          >
            确认
          </button>
        </div>
      </div>
    </>
  );
}

function ActionButton({ title, onClick, disabled = false, children }: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm text-text-secondary transition-colors hover:bg-background-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

export function TopMenuBar({
  onNewConversation,
  onSettings,
  onCreateWorkspace: _onCreateWorkspace,
  onToggleTheme,
  theme,
  engineLabel,
  engineVersion,
  engineStatus = 'offline',
}: TopMenuBarProps) {
  const { config } = useConfigStore();
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const currentWorkspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const { clearMessages, messages } = useEventChatStore();
  const { toggleSessionHistory } = useViewStore();
  const { showFloatingWindow } = useFloatingWindowStore();

  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showNewChatConfirm, setShowNewChatConfirm] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const currentWorkspace = useMemo(
    () => getCurrentWorkspaceById(workspaces, currentWorkspaceId),
    [currentWorkspaceId, workspaces],
  );

  const shouldShowFloatingWindowButton =
    config?.floatingWindow?.enabled && config.floatingWindow.mode === 'manual';

  const handleExportChat = async () => {
    if (messages.length === 0) {
      return;
    }

    setIsExporting(true);
    try {
      const content = exportToMarkdown(messages, currentWorkspace?.name);
      const fileName = generateFileName('md');
      await tauri.saveChatToFile(content, fileName);
    } catch (error) {
      console.error('导出对话失败:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleNewConversation = () => {
    if (messages.length > 0) {
      setShowNewChatConfirm(true);
      return;
    }

    clearMessages();
    onNewConversation();
  };

  const confirmNewConversation = () => {
    clearMessages();
    onNewConversation();
    setShowNewChatConfirm(false);
  };

  return (
    <div className="shrink-0 border-b border-border bg-background-base px-3 py-2">
      <div className="flex items-center gap-2">
        {/* 左侧：Logo + 引擎状态 */}
        <div className="flex items-center gap-3 min-w-0">
          <BrandLogo size={26} nameClassName="text-sm font-semibold text-text-primary" iconClassName="rounded-xl" />
          {engineLabel && (
            <div className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-lg bg-background-surface border border-border">
              <StatusIndicator status={engineStatus} size="sm" />
              <div className="flex items-center gap-1 text-xs text-text-secondary">
                <span className="text-text-primary">{engineLabel}</span>
                {engineVersion && (
                  <span className="text-text-tertiary">· {engineVersion}</span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex-1" />

        {/* 右侧：操作按钮组 */}
        <div className="flex items-center gap-1">
          {/* 布局菜单 */}
          <div className="relative hidden md:block">
            <ActionButton title="布局" onClick={() => setShowViewMenu((v) => !v)}>
              <LayoutPanelLeft className="h-4 w-4" />
              <span className="hidden lg:inline">布局</span>
            </ActionButton>
            {showViewMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowViewMenu(false)} />
                <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-xl border border-border bg-background-surface shadow-xl">
                  <ViewMenuContent onClose={() => setShowViewMenu(false)} />
                </div>
              </>
            )}
          </div>

          <ActionButton title="会话历史" onClick={toggleSessionHistory}>
            <Clock3 className="h-4 w-4" />
            <span className="hidden lg:inline">历史</span>
          </ActionButton>

          <ActionButton title="导出对话" onClick={handleExportChat} disabled={messages.length === 0 || isExporting}>
            <Download className="h-4 w-4" />
            <span className="hidden lg:inline">导出</span>
          </ActionButton>

          <ActionButton title="新对话" onClick={handleNewConversation}>
            <Plus className="h-4 w-4" />
            <span className="hidden lg:inline">新对话</span>
          </ActionButton>

          <ActionButton title="设置" onClick={onSettings}>
            <Settings2 className="h-4 w-4" />
            <span className="hidden lg:inline">设置</span>
          </ActionButton>

          <button
            onClick={onToggleTheme}
            title={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-background-hover hover:text-text-primary"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {shouldShowFloatingWindowButton && (
            <button
              onClick={showFloatingWindow}
              title="切换到悬浮窗"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-background-hover hover:text-text-primary"
            >
              <Minimize className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {showNewChatConfirm && (
        <ConfirmNewConversationDialog
          messageCount={messages.length}
          onCancel={() => setShowNewChatConfirm(false)}
          onConfirm={confirmNewConversation}
        />
      )}
    </div>
  );
}
