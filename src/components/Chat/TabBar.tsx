/**
 * 多 Tab 会话栏
 */
import { useCallback } from 'react';
import { X, Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { useViewStore } from '../../stores/viewStore';
import { useEventChatStore } from '../../stores/eventChatStore';

export function TabBar() {
  const { tabs, activeTabId, addTab, closeTab, setActiveTab, updateTabMessages, updateTabTitle } = useViewStore();
  const { messages, clearMessages } = useEventChatStore();

  const handleSwitchTab = useCallback((id: string) => {
    if (id === activeTabId) return;
    // 保存当前 Tab 消息
    updateTabMessages(activeTabId, messages);
    // 切换 Tab
    setActiveTab(id);
    // 恢复目标 Tab 消息
    const target = useViewStore.getState().tabs.find((t) => t.id === id);
    useEventChatStore.setState({ messages: target?.messages ?? [] });
  }, [activeTabId, messages, setActiveTab, updateTabMessages]);

  const handleAddTab = useCallback(() => {
    // 保存当前 Tab 消息
    updateTabMessages(activeTabId, messages);
    addTab();
    // 新 Tab 从空白开始
    useEventChatStore.setState({ messages: [] });
  }, [activeTabId, messages, addTab, updateTabMessages]);

  const handleCloseTab = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (id === activeTabId) {
      // 关闭当前 Tab：切换到相邻 Tab 或清空
      const idx = tabs.findIndex((t) => t.id === id);
      const next = tabs[idx - 1] ?? tabs[idx + 1];
      if (next && next.id !== id) {
        updateTabMessages(id, messages);
        setActiveTab(next.id);
        useEventChatStore.setState({ messages: next.messages });
      } else {
        clearMessages();
      }
    }
    closeTab(id);
  }, [activeTabId, tabs, messages, closeTab, setActiveTab, updateTabMessages, clearMessages]);

  // 动态更新活跃 Tab 标题（取第一条 user 消息前20字）
  const activeTab = tabs.find((t) => t.id === activeTabId);
  if (activeTab && messages.length > 0) {
    const firstUser = messages.find((m) => m.type === 'user') as { content?: string } | undefined;
    if (firstUser?.content) {
      const title = firstUser.content.slice(0, 20) + (firstUser.content.length > 20 ? '…' : '');
      if (activeTab.title !== title && !activeTab.title.startsWith('新对话')) {
        updateTabTitle(activeTabId, title);
      } else if (activeTab.title.startsWith('新对话') && firstUser.content) {
        updateTabTitle(activeTabId, title);
      }
    }
  }

  if (tabs.length <= 1) return null;

  return (
    <div className="flex items-center gap-0.5 px-3 pt-1 border-b border-border bg-background-base/60 overflow-x-auto">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => handleSwitchTab(tab.id)}
          className={clsx(
            'group flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg text-xs cursor-pointer transition-colors shrink-0 max-w-[160px]',
            tab.id === activeTabId
              ? 'bg-background-elevated text-text-primary border border-b-0 border-border'
              : 'text-text-tertiary hover:text-text-secondary hover:bg-background-surface',
          )}
        >
          <span className="truncate">{tab.title}</span>
          <button
            onClick={(e) => handleCloseTab(e, tab.id)}
            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-background-hover"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
      <button
        onClick={handleAddTab}
        className="shrink-0 p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-background-surface transition-colors"
        title="新建对话 Tab"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
