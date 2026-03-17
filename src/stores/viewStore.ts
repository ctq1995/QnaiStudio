/**
 * 视图显示状态管理
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatMessage } from '../types';

/** Tab 数据 */
export interface ChatTab {
  id: string;
  title: string;
  messages: ChatMessage[];
}

/** 视图状态 */
interface ViewState {
  showSidebar: boolean;
  showEditor: boolean;
  showToolPanel: boolean;
  showDeveloperPanel: boolean;
  showSessionHistory: boolean;
  sidebarWidth: number;
  editorWidth: number;
  toolPanelWidth: number;
  developerPanelWidth: number;
  theme: 'dark' | 'light';
  tabs: ChatTab[];
  activeTabId: string;
}

/** 视图操作 */
interface ViewActions {
  toggleSidebar: () => void;
  toggleEditor: () => void;
  toggleToolPanel: () => void;
  toggleDeveloperPanel: () => void;
  toggleSessionHistory: () => void;
  toggleTheme: () => void;
  setShowEditor: (show: boolean) => void;
  setAIOnlyMode: () => void;
  resetView: () => void;
  setSidebarWidth: (width: number) => void;
  setEditorWidth: (width: number) => void;
  setToolPanelWidth: (width: number) => void;
  setDeveloperPanelWidth: (width: number) => void;
  // Tab 操作
  addTab: () => string;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTabMessages: (id: string, messages: ChatMessage[]) => void;
  updateTabTitle: (id: string, title: string) => void;
}

/** 完整的 View Store 类型 */
export type ViewStore = ViewState & ViewActions;

export const useViewStore = create<ViewStore>()(
  persist(
    (set) => ({
      // 初始状态
      showSidebar: true,
      showEditor: false,
      showToolPanel: true,
      showDeveloperPanel: false,
      showSessionHistory: false,
      sidebarWidth: 240,
      editorWidth: 50,
      toolPanelWidth: 320,
      developerPanelWidth: 400,
      theme: 'dark' as const,
      tabs: [{ id: 'tab-1', title: '新对话', messages: [] }],
      activeTabId: 'tab-1',

      // 切换侧边栏
      toggleSidebar: () => set((state) => ({ showSidebar: !state.showSidebar })),

      // 切换编辑器
      toggleEditor: () => set((state) => ({ showEditor: !state.showEditor })),

      // 设置编辑器显示状态
      setShowEditor: (show: boolean) => set({ showEditor: show }),

      // 切换工具面板
      toggleToolPanel: () => set((state) => ({ showToolPanel: !state.showToolPanel })),

      // 切换 Developer 面板
      toggleDeveloperPanel: () => set((state) => ({ showDeveloperPanel: !state.showDeveloperPanel })),

      // 切换会话历史面板
      toggleSessionHistory: () => set((state) => ({ showSessionHistory: !state.showSessionHistory })),

      // 切换主题
      toggleTheme: () => set((state) => {
        const newTheme = state.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        return { theme: newTheme };
      }),

      // 仅 AI 对话模式
      setAIOnlyMode: () => set({
        showSidebar: false,
        showEditor: false,
        showToolPanel: false,
        showDeveloperPanel: false,
      }),

      // 重置视图
      resetView: () => set({
        showSidebar: true,
        showEditor: false,
        showToolPanel: true,
        showDeveloperPanel: false,
      }),

      // 设置侧边栏宽度
      setSidebarWidth: (width: number) => set({ sidebarWidth: width }),

      // 设置编辑器宽度百分比
      setEditorWidth: (width: number) => set({ editorWidth: width }),

      // 设置工具面板宽度
      setToolPanelWidth: (width: number) => set({ toolPanelWidth: width }),

      // 设置 Developer 面板宽度
      setDeveloperPanelWidth: (width: number) => set({ developerPanelWidth: width }),

      // Tab 操作
      addTab: () => {
        const id = `tab-${Date.now()}`;
        set((state) => ({
          tabs: [...state.tabs, { id, title: `新对话 ${state.tabs.length + 1}`, messages: [] }],
          activeTabId: id,
        }));
        return id;
      },

      closeTab: (id) => {
        set((state) => {
          if (state.tabs.length <= 1) {
            // 只剩一个 Tab 时，清空消息而不关闭
            return { tabs: [{ ...state.tabs[0], messages: [] }] };
          }
          const newTabs = state.tabs.filter((t) => t.id !== id);
          const newActiveId = state.activeTabId === id
            ? newTabs[Math.max(0, state.tabs.findIndex((t) => t.id === id) - 1)].id
            : state.activeTabId;
          return { tabs: newTabs, activeTabId: newActiveId };
        });
      },

      setActiveTab: (id) => set({ activeTabId: id }),

      updateTabMessages: (id, messages) => {
        set((state) => ({
          tabs: state.tabs.map((t) => t.id === id ? { ...t, messages } : t),
        }));
      },

      updateTabTitle: (id, title) => {
        set((state) => ({
          tabs: state.tabs.map((t) => t.id === id ? { ...t, title } : t),
        }));
      },
    }),
    {
      name: 'view-store',
    }
  )
);
