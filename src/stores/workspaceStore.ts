/**
 * 工作区状态管理
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Workspace, WorkspaceStore } from '../types';
import { useConfigStore } from './configStore';
import * as tauri from '../services/tauri';
import {
  getAccessibleWorkspacesByScope,
  getContextWorkspacesByScope,
  getCurrentWorkspaceById,
  sanitizeContextWorkspaceIds,
} from '../utils/workspaceScope';

function findWorkspaceById(workspaces: Workspace[], id: string): Workspace {
  const workspace = workspaces.find((item) => item.id === id);
  if (!workspace) {
    throw new Error('工作区不存在');
  }

  return workspace;
}

function touchWorkspace(workspaces: Workspace[], id: string): Workspace[] {
  const timestamp = new Date().toISOString();

  return workspaces.map((workspace) => (
    workspace.id === id ? { ...workspace, lastAccessed: timestamp } : workspace
  ));
}

function syncConfigWorkDir(path: string) {
  useConfigStore.setState((state) => ({
    config: state.config ? { ...state.config, workDir: path } : state.config,
  }));
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set, get) => ({
      workspaces: [],
      currentWorkspaceId: null,
      contextWorkspaceIds: [],
      viewingWorkspaceId: null,
      isLoading: false,
      error: null,

      createWorkspace: async (name: string, path: string) => {
        set({ isLoading: true, error: null });

        try {
          const isValid = await get().validateWorkspacePath(path);
          if (!isValid) {
            throw new Error('无效的工作区路径');
          }

          const existingWorkspace = get().workspaces.find((workspace) => workspace.path === path);
          if (existingWorkspace) {
            throw new Error('该路径已被其他工作区使用');
          }

          const workspace: Workspace = {
            id: crypto.randomUUID(),
            name,
            path,
            createdAt: new Date().toISOString(),
            lastAccessed: new Date().toISOString(),
          };

          set((state) => ({
            workspaces: [...state.workspaces, workspace],
            currentWorkspaceId: workspace.id,
            isLoading: false,
          }));

          await get().switchWorkspace(workspace.id);
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '创建工作区失败',
            isLoading: false,
          });
          throw error;
        }
      },

      switchWorkspace: async (id: string) => {
        const workspace = findWorkspaceById(get().workspaces, id);

        try {
          await tauri.setWorkDir(workspace.path);
        } catch (error) {
          console.error('更新工作目录失败:', error);
          throw new Error(`切换工作区失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }

        set((state) => ({
          workspaces: touchWorkspace(state.workspaces, id),
          currentWorkspaceId: id,
          contextWorkspaceIds: sanitizeContextWorkspaceIds(state.contextWorkspaceIds, id),
        }));

        syncConfigWorkDir(workspace.path);

        window.dispatchEvent(new CustomEvent('workspace-changed', {
          detail: { workspaceId: id, path: workspace.path },
        }));
        window.dispatchEvent(new CustomEvent('workspace-switched'));
      },

      deleteWorkspace: async (id: string) => {
        const { workspaces, currentWorkspaceId, contextWorkspaceIds } = get();
        if (workspaces.length <= 1) {
          throw new Error('至少需要保留一个工作区');
        }

        findWorkspaceById(workspaces, id);

        const nextWorkspaces = workspaces.filter((workspace) => workspace.id !== id);
        const nextCurrentWorkspaceId = currentWorkspaceId === id
          ? nextWorkspaces[0]?.id || null
          : currentWorkspaceId;
        const nextContextIds = contextWorkspaceIds.filter((contextId) => contextId !== id);

        set({
          workspaces: nextWorkspaces,
          contextWorkspaceIds: sanitizeContextWorkspaceIds(nextContextIds, nextCurrentWorkspaceId),
        });

        if (currentWorkspaceId === id && nextCurrentWorkspaceId) {
          await get().switchWorkspace(nextCurrentWorkspaceId);
          return;
        }

        set({ currentWorkspaceId: nextCurrentWorkspaceId });
      },

      updateWorkspace: async (id: string, updates: Partial<Workspace>) => {
        set((state) => ({
          workspaces: state.workspaces.map((workspace) => (
            workspace.id === id ? { ...workspace, ...updates } : workspace
          )),
        }));
      },

      getCurrentWorkspace: () => {
        const { workspaces, currentWorkspaceId } = get();
        return getCurrentWorkspaceById(workspaces, currentWorkspaceId);
      },

      validateWorkspacePath: async (path: string): Promise<boolean> => {
        try {
          return await tauri.validateWorkspacePath(path);
        } catch {
          return false;
        }
      },

      clearError: () => {
        set({ error: null });
      },

      setContextWorkspaces: (ids: string[]) => {
        set((state) => ({
          contextWorkspaceIds: sanitizeContextWorkspaceIds(ids, state.currentWorkspaceId),
        }));
      },

      addContextWorkspace: (id: string) => {
        set((state) => {
          if (id === state.currentWorkspaceId || state.contextWorkspaceIds.includes(id)) {
            return state;
          }

          return { contextWorkspaceIds: [...state.contextWorkspaceIds, id] };
        });
      },

      removeContextWorkspace: (id: string) => {
        set((state) => ({
          contextWorkspaceIds: state.contextWorkspaceIds.filter((workspaceId) => workspaceId !== id),
        }));
      },

      toggleContextWorkspace: (id: string) => {
        const state = get();
        if (id === state.currentWorkspaceId) {
          return;
        }

        if (state.contextWorkspaceIds.includes(id)) {
          get().removeContextWorkspace(id);
          return;
        }

        get().addContextWorkspace(id);
      },

      clearContextWorkspaces: () => {
        set({ contextWorkspaceIds: [] });
      },

      getContextWorkspaces: () => {
        const state = get();
        return getContextWorkspacesByScope(
          state.workspaces,
          state.currentWorkspaceId,
          state.contextWorkspaceIds,
        );
      },

      getAllAccessibleWorkspaces: () => {
        const state = get();
        return getAccessibleWorkspacesByScope(
          state.workspaces,
          state.currentWorkspaceId,
          state.contextWorkspaceIds,
        );
      },

      setViewingWorkspace: (id: string | null) => {
        set({ viewingWorkspaceId: id });
      },

      getViewingWorkspace: () => {
        const state = get();
        if (!state.viewingWorkspaceId) {
          return getCurrentWorkspaceById(state.workspaces, state.currentWorkspaceId);
        }

        return state.workspaces.find((workspace) => workspace.id === state.viewingWorkspaceId) || null;
      },
    }),
    {
      name: 'workspace-store',
      partialize: (state) => ({
        workspaces: state.workspaces,
        currentWorkspaceId: state.currentWorkspaceId,
        contextWorkspaceIds: state.contextWorkspaceIds,
      }),
    },
  ),
);
