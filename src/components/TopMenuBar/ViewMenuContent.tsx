import { useViewStore } from '../../stores';

interface ViewMenuContentProps {
  onClose: () => void;
}

export function ViewMenuContent({ onClose }: ViewMenuContentProps) {
  const {
    showSidebar,
    showToolPanel,
    showDeveloperPanel,
    toggleSidebar,
    toggleToolPanel,
    toggleDeveloperPanel,
    setAIOnlyMode,
    resetView,
  } = useViewStore();

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  const renderToggle = (active: boolean) => (
    <div className={`w-4 h-4 rounded border ${active ? 'bg-primary border-primary' : 'border-border'} flex items-center justify-center`}>
      {active && (
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </div>
  );

  return (
    <div className="py-1">
      <button
        onClick={() => handleAction(toggleSidebar)}
        className="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-background-hover transition-colors"
      >
        <span>文件浏览器</span>
        {renderToggle(showSidebar)}
      </button>

      <button
        onClick={() => handleAction(toggleToolPanel)}
        className="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-background-hover transition-colors"
      >
        <span>工具面板</span>
        {renderToggle(showToolPanel)}
      </button>

      <button
        onClick={() => handleAction(toggleDeveloperPanel)}
        className="w-full flex items-center justify-between gap-3 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-background-hover transition-colors"
      >
        <span className="flex items-center gap-2">
          Developer
          <span className="text-xs text-text-tertiary bg-background-surface px-1.5 py-0.5 rounded">调试</span>
        </span>
        {renderToggle(showDeveloperPanel)}
      </button>

      <div className="border-t border-border-subtle mt-1 pt-1">
        <button
          onClick={() => handleAction(setAIOnlyMode)}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-background-hover transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          仅 AI 对话
        </button>
      </div>

      <div className="border-t border-border-subtle mt-1 pt-1">
        <button
          onClick={() => handleAction(resetView)}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-background-hover transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          重置视图
        </button>
      </div>
    </div>
  );
}
