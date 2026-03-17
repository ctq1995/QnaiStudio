import { useEffect, useMemo, useRef, useState } from 'react';
import { Layout, SettingsModal, FileExplorer, ResizeHandle, ConnectingOverlay, ErrorBoundary } from './components/Common';
import { KeyboardShortcutsModal } from './components/Common/KeyboardShortcutsModal';
import { EnhancedChatMessages, ChatInput } from './components/Chat';
import { ToolPanel } from './components/ToolPanel';
import { EditorPanel } from './components/Editor';
import { DeveloperPanel } from './components/Developer';
import { TopMenuBar as TopMenuBarComponent } from './components/TopMenuBar';
import { CreateWorkspaceModal } from './components/Workspace';
import { SessionHistoryPanel } from './components/Chat/SessionHistoryPanel';
import { useConfigStore, useEventChatStore, useViewStore, useWorkspaceStore, useFloatingWindowStore } from './stores';
import { TabBar } from './components/Chat/TabBar';
import * as tauri from './services/tauri';
import { bootstrapEngines } from './core/engine-bootstrap';
import { getEngineAvailability, getEngineVersion } from './types';
import { ENGINE_VERSION_PREFIX_MAP, formatEngineVersionLabel, getEngineLabel } from './utils/engineLabels';
import { listen, emit } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getCurrentWorkspaceById } from './utils/workspaceScope';
import './index.css';
function App() {
  const { healthStatus, isConnecting, connectionState, loadConfigFast, refreshHealth, config } = useConfigStore();
  const {
    isStreaming,
    sendMessage,
    interruptChat,
    restoreFromStorage,
    saveToStorage,
    initializeEventListeners,
    messages,
  } = useEventChatStore();
  const workspaces = useWorkspaceStore(state => state.workspaces);
  const currentWorkspaceId = useWorkspaceStore(state => state.currentWorkspaceId);
  const currentWorkspace = useMemo(
    () => getCurrentWorkspaceById(workspaces, currentWorkspaceId),
    [currentWorkspaceId, workspaces],
  );
  const currentWorkspacePath = currentWorkspace?.path;
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [workspacesHydrated, setWorkspacesHydrated] = useState(
    () => useWorkspaceStore.persist?.hasHydrated?.() ?? true,
  );
  // 使用 ref 确保初始化只执行一次
  const isInitialized = useRef(false);
  const hasCheckedWorkspaces = useRef(false);
  const hasSyncedWorkspaceRef = useRef(false);
  const mouseLeaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localStorageSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    showSidebar,
    showEditor,
    showToolPanel,
    showDeveloperPanel,
    showSessionHistory,
    sidebarWidth,
    editorWidth,
    toolPanelWidth,
    developerPanelWidth,
    theme,
    setSidebarWidth,
    setEditorWidth,
    setToolPanelWidth,
    setDeveloperPanelWidth,
    toggleSessionHistory,
    toggleTheme,
  } = useViewStore();
  const { showFloatingWindow } = useFloatingWindowStore();

  // 应用持久化的主题
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // 等待 zustand persist 完成恢复，避免启动时误判“无工作区”
  useEffect(() => {
    const onFinish = useWorkspaceStore.persist?.onFinishHydration;
    if (!onFinish) {
      setWorkspacesHydrated(true);
      return;
    }

    const unsub = onFinish(() => setWorkspacesHydrated(true));
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  const currentEngine = config?.defaultEngine ?? 'claude-code';
  const currentEngineLabel = getEngineLabel(currentEngine);
  const isCurrentEngineAvailable = healthStatus
    ? getEngineAvailability(healthStatus, currentEngine)
    : false;
  const currentEngineVersion = healthStatus
    ? getEngineVersion(healthStatus, currentEngine)
    : '未知版本';
  const engineVersionLabel = formatEngineVersionLabel({
    engineId: currentEngine,
    engineLabel: currentEngineLabel,
    version: currentEngineVersion,
    prefixMap: ENGINE_VERSION_PREFIX_MAP,
  });
  const engineStatus = connectionState === 'failed'
    ? 'error'
    : isConnecting
      ? 'loading'
      : isCurrentEngineAvailable
        ? 'online'
        : 'offline';

  // 初始化配置（只执行一次）
  useEffect(() => {
    const initializeApp = async () => {
      // 双重检查：防止 Strict Mode 或其他原因导致重复执行
      if (isInitialized.current) return;
      isInitialized.current = true;

      try {
        // 快速加载配置（不做健康检查），尽快显示窗口
        await loadConfigFast();

        // 立即显示主窗口
        await getCurrentWindow().show();

        // 获取默认引擎 ID
        const config = useConfigStore.getState().config;
        const defaultEngine = config?.defaultEngine || 'claude-code';

        // 按需初始化 AI Engine Registry，只加载默认引擎
        await bootstrapEngines(defaultEngine);

        // 尝试从本地存储恢复聊天状态
        const restored = restoreFromStorage();
        if (restored) {
          console.log('[App] 已从本地恢复聊天状态');
        }

        // 后台刷新健康状态，不阻塞启动
        refreshHealth();
      } catch (error) {
        console.error('[App] 初始化失败', error);
        // 失败时重置标志，允许重试
        isInitialized.current = false;
      }
    };

    initializeApp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 单独一个 effect：检查工作区状态
  // 使用 ref 确保只检查一次，避免重复弹出模态框
  useEffect(() => {
    if (hasCheckedWorkspaces.current) return;
    if (!workspacesHydrated) return;

    if (!isInitialized.current) return;
    hasCheckedWorkspaces.current = true;

    let cancelled = false;

    const checkWorkspaces = async () => {
      if (workspaces.length === 0) {
        console.log('[App] 无工作区，显示创建工作区模态框');
        if (!cancelled) setShowCreateWorkspace(true);
        return;
      }

      const candidates = currentWorkspace
        ? [currentWorkspace, ...workspaces.filter((w) => w.id !== currentWorkspace.id)]
        : workspaces;

      for (const ws of candidates) {
        try {
          const isValid = await tauri.validateWorkspacePath(ws.path);
          if (!isValid) continue;

          // 确保后端 workDir 与当前可用工作区同步
          if (ws.id !== currentWorkspaceId) {
            await useWorkspaceStore.getState().switchWorkspace(ws.id);
          }
          return;
        } catch (error) {
          console.error('[App] 校验/切换工作区失败', error);
        }
      }

      // 所有工作区路径都不可用，避免后端持有无效 workDir
      try {
        await tauri.setWorkDir(null);
      } catch (error) {
        console.error('[App] 清空后端工作目录失败', error);
      }

      if (!cancelled) setShowCreateWorkspace(true);
    };

    checkWorkspaces();
    return () => { cancelled = true; };
  }, [workspacesHydrated, workspaces, currentWorkspace, currentWorkspaceId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 同步当前工作区路径到后端配置
  useEffect(() => {
    if (!currentWorkspacePath || !isInitialized.current) return;
    if (hasSyncedWorkspaceRef.current) return;
    if (config?.workDir === currentWorkspacePath) {
      hasSyncedWorkspaceRef.current = true;
      return;
    }

    const syncWorkspace = async () => {
      try {
        await tauri.setWorkDir(currentWorkspacePath);
        hasSyncedWorkspaceRef.current = true;
        console.log('[App] 工作区路径已同步:', currentWorkspacePath);
      } catch (error) {
        console.error('[App] 同步工作区路径失败', error);
      }
    };

    syncWorkspace();
  }, [config?.workDir, currentWorkspacePath]);

  // 监听崩溃保存事件
  useEffect(() => {
    const handleCrashSave = () => {
      console.log('[App] 检测到崩溃信号，保存状态..');
      saveToStorage();
    };

    window.addEventListener('app:crash-save', handleCrashSave);
    return () => window.removeEventListener('app:crash-save', handleCrashSave);
  }, [saveToStorage]);

  // 监听恢复事件
  useEffect(() => {
    const handleRecover = () => {
      console.log('[App] 收到恢复信号...');
      const restored = restoreFromStorage();
      if (restored) {
        window.location.reload();
      }
    };

    window.addEventListener('app:recover', handleRecover);
    return () => window.removeEventListener('app:recover', handleRecover);
  }, [restoreFromStorage]);

  // 监听工作区切换事件，清除聊天错误
  useEffect(() => {
    const handleWorkspaceSwitched = () => {
      // 清除聊天相关的错误提示
      const { error } = useEventChatStore.getState();
      if (error) {
        useEventChatStore.getState().setError(null);
      }
    };

    window.addEventListener('workspace-switched', handleWorkspaceSwitched);
    return () => window.removeEventListener('workspace-switched', handleWorkspaceSwitched);
  }, []);

  // 初始化事件监听器（事件驱动架构核心）
  const eventListenersCleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (eventListenersCleanupRef.current) return; // 已经初始化过了
    const cleanup = initializeEventListeners();
    eventListenersCleanupRef.current = cleanup;
    return () => {
      if (cleanup) cleanup();
    };
  }, [initializeEventListeners]);

  // 窗口焦点检查 - 自动切换到悬浮窗模式
  useEffect(() => {
    // 只在配置启用且模式为 auto 时才监听
    const floatingConfig = config?.floatingWindow
    if (!floatingConfig?.enabled || floatingConfig.mode !== 'auto') {
      return
    }

    const delay = floatingConfig.collapseDelay || 500

    // 窗口失去焦点时，延迟后切换到悬浮窗
    const handleBlur = () => {
      console.log('[App] 窗口失去焦点，准备切换到悬浮窗');
      // 延迟后切换到悬浮窗
      mouseLeaveTimerRef.current = setTimeout(() => {
        if (document.visibilityState === 'visible') {
          console.log('[App] 仍未获得焦点，切换到悬浮窗');
          showFloatingWindow();
        }
      }, delay);
    };

    // 窗口获得焦点时，取消切换
    const handleFocus = () => {
      console.log('[App] 窗口获得焦点，取消自动切换');
      if (mouseLeaveTimerRef.current) {
        clearTimeout(mouseLeaveTimerRef.current);
        mouseLeaveTimerRef.current = null;
      }
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      if (mouseLeaveTimerRef.current) {
        clearTimeout(mouseLeaveTimerRef.current);
      }
    };
    // 使用具体值作为依赖，避免对象引用变化导致重复执行
  }, [config?.floatingWindow?.enabled, config?.floatingWindow?.mode, config?.floatingWindow?.collapseDelay]);

  // 跨窗口数据同步 - 同步消息到 localStorage（供悬浮窗读取，防抖 500ms）
  useEffect(() => {
    if (localStorageSyncTimerRef.current) {
      clearTimeout(localStorageSyncTimerRef.current);
    }
    localStorageSyncTimerRef.current = setTimeout(() => {
      localStorage.setItem('chat_messages_sync', JSON.stringify(messages));
      localStorage.setItem('chat_is_streaming', JSON.stringify(isStreaming));
    }, 500);
    return () => {
      if (localStorageSyncTimerRef.current) {
        clearTimeout(localStorageSyncTimerRef.current);
      }
    };
  }, [messages, isStreaming]);

  // 跨窗口数据同步 - 监听悬浮窗发送的消息
  useEffect(() => {
    const unlistenPromise = listen('floating:send_message', async (event: any) => {
      const { message } = event.payload;
      await sendMessage(message);
    });

    return () => {
      unlistenPromise.then(unlisten => unlisten());
    };
  }, [sendMessage]);

  // 跨窗口数据同步 - 监听悬浮窗的中断请求
  useEffect(() => {
    const unlistenPromise = listen('floating:interrupt_chat', async () => {
      interruptChat();
    });

    return () => {
      unlistenPromise.then(unlisten => unlisten());
    };
  }, [interruptChat]);

  // 跨窗口数据同步 - 同步流式状态
  useEffect(() => {
    emit('chat:streaming_changed', { isStreaming });
  }, [isStreaming]);

  // 配置更新时通知悬浮窗
  useEffect(() => {
    if (config) {
      emit('config:updated', { config });
      // 同时保存到 localStorage 供悬浮窗读取
      localStorage.setItem('app_config', JSON.stringify(config));
    }
  }, [config]);

  // 全局快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;
      const tag = (document.activeElement as HTMLElement)?.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA';

      if (isMod && e.key === 'f') {
        e.preventDefault();
        window.dispatchEvent(new Event('chat:open-search'));
        return;
      }
      if (isMod && e.key === 'n') {
        e.preventDefault();
        useEventChatStore.getState().clearMessages();
        return;
      }
      if (isMod && e.key === 'k') {
        e.preventDefault();
        const textarea = document.querySelector<HTMLTextAreaElement>('textarea');
        textarea?.focus();
        return;
      }
      if (e.key === 'Escape' && isStreaming) {
        e.preventDefault();
        interruptChat();
        return;
      }
      if (e.key === '?' && !isInput) {
        e.preventDefault();
        setShowShortcuts(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isStreaming, interruptChat]);

  // Sidebar 拖拽处理（右边手柄）
  const handleSidebarResize = (delta: number) => {
    const newWidth = Math.max(150, Math.min(600, sidebarWidth + delta));
    setSidebarWidth(newWidth);
  };

  // ToolPanel 拖拽处理（左边手柄）
  const handleToolPanelResize = (delta: number) => {
    const newWidth = Math.max(200, Math.min(600, toolPanelWidth - delta));
    setToolPanelWidth(newWidth);
  };

  // DeveloperPanel 拖拽处理（左边手柄）
  const handleDeveloperPanelResize = (delta: number) => {
    const newWidth = Math.max(300, Math.min(800, developerPanelWidth - delta));
    setDeveloperPanelWidth(newWidth);
  };

  // Editor/Chat 分割拖拽处理
  const handleEditorResize = (delta: number) => {
    const containerWidth = window.innerWidth - sidebarWidth - toolPanelWidth - (showDeveloperPanel ? developerPanelWidth : 0);
    const currentEditorWidth = containerWidth * (editorWidth / 100);
    const newEditorWidth = currentEditorWidth + delta;
    const minEditorWidth = containerWidth * 0.3;
    const maxEditorWidth = containerWidth * 0.7;

    const clampedWidth = Math.max(minEditorWidth, Math.min(maxEditorWidth, newEditorWidth));
    const newPercent = (clampedWidth / containerWidth) * 100;

    setEditorWidth(Math.round(newPercent));
  };

  return (
    <ErrorBoundary>
      <Layout>
        {(isConnecting || connectionState === 'failed') && <ConnectingOverlay />}

        <TopMenuBarComponent
          onNewConversation={() => {
            useEventChatStore.getState().clearMessages();
          }}
          onSettings={() => setShowSettings(true)}
          onCreateWorkspace={() => setShowCreateWorkspace(true)}
          onToggleTheme={toggleTheme}
          theme={theme}
          engineLabel={currentEngineLabel}
          engineVersion={engineVersionLabel}
          engineStatus={engineStatus}
        />

        <div className="flex-1 overflow-hidden px-3 pb-3">
          <div className="flex h-full gap-3 overflow-hidden">
            {showSidebar && (
              <>
                <div
                  className="rounded-2xl border border-border bg-background-elevated/80 shadow-soft"
                  style={{ width: sidebarWidth }}
                >
                  <FileExplorer onCreateWorkspace={() => setShowCreateWorkspace(true)} />
                </div>
                <ResizeHandle
                  direction="horizontal"
                  position="right"
                  onDrag={handleSidebarResize}
                />
              </>
            )}

            <div className="flex min-w-0 flex-1 gap-3 overflow-hidden">
              {showEditor && (
                <div
                  className="flex min-w-[320px] flex-col overflow-hidden rounded-2xl border border-border bg-background-elevated/80 shadow-soft"
                  style={{ width: editorWidth + '%' }}
                >
                  <EditorPanel />
                </div>
              )}

              {showEditor && (
                <ResizeHandle
                  direction="horizontal"
                  position="right"
                  onDrag={handleEditorResize}
                />
              )}

              <div className="flex min-w-[320px] flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-background-elevated/80 shadow-soft">
                <TabBar />
                <EnhancedChatMessages />

                <div className="border-t border-border bg-background-base/40">
                  <ChatInput
                    onSend={sendMessage}
                    onInterrupt={interruptChat}
                    disabled={!isCurrentEngineAvailable || !currentWorkspace}
                    isStreaming={isStreaming}
                  />
                </div>
              </div>
            </div>

            {showToolPanel && (
              <ResizeHandle
                direction="horizontal"
                position="left"
                onDrag={handleToolPanelResize}
              />
            )}

            {showToolPanel && (
              <ToolPanel
                width={toolPanelWidth}
                className="overflow-hidden rounded-2xl border border-border border-l-0 bg-background-elevated/80 shadow-soft"
              />
            )}

            {showDeveloperPanel && (
              <ResizeHandle
                direction="horizontal"
                position="left"
                onDrag={handleDeveloperPanelResize}
              />
            )}

            {showDeveloperPanel && (
              <DeveloperPanel
                width={developerPanelWidth}
                className="overflow-hidden rounded-2xl border border-border border-l-0 bg-background-elevated/80 shadow-soft"
              />
            )}
          </div>
        </div>

        {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

        {showCreateWorkspace && (
          <CreateWorkspaceModal onClose={() => setShowCreateWorkspace(false)} />
        )}

        {showShortcuts && (
          <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />
        )}

        {showSessionHistory && (
          <>
            <div className="fixed inset-0 z-[2000] bg-black/50" onClick={toggleSessionHistory} />
            <div className="pointer-events-none fixed inset-0 z-[2000] flex items-center justify-center p-4">
              <div
                className="pointer-events-auto flex h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-background-elevated shadow-xl"
                onClick={(event) => event.stopPropagation()}
              >
                <SessionHistoryPanel onClose={toggleSessionHistory} />
              </div>
            </div>
          </>
        )}
      </Layout>
    </ErrorBoundary>
  );
}

export default App;








