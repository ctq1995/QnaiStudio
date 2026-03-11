import { useEffect } from 'react';
import type { Workspace } from '../../types';

interface WorkspaceSyncOptions {
  getCurrentWorkspace: () => Workspace | null;
  getViewingWorkspace: () => Workspace | null;
  load_directory: (path: string) => void;
  loadCustomCommands: (path: string) => void;
}

interface InitialLoadOptions extends WorkspaceSyncOptions {
  currentPath: string;
}

export function useWorkspaceChangeSync(options: WorkspaceSyncOptions) {
  const { getCurrentWorkspace, getViewingWorkspace, load_directory, loadCustomCommands } = options;

  useEffect(() => {
    const handleWorkspaceChange = (event: Event) => {
      const workspaceId = (event as CustomEvent<{ workspaceId: string }>).detail.workspaceId;
      const viewingWorkspace = getViewingWorkspace();

      if (viewingWorkspace && viewingWorkspace.id !== workspaceId) {
        return;
      }

      const currentWorkspace = getCurrentWorkspace();
      if (!currentWorkspace) {
        return;
      }

      load_directory(currentWorkspace.path);
      loadCustomCommands(currentWorkspace.path);
    };

    window.addEventListener('workspace-changed', handleWorkspaceChange);
    return () => window.removeEventListener('workspace-changed', handleWorkspaceChange);
  }, [getCurrentWorkspace, getViewingWorkspace, loadCustomCommands, load_directory]);
}

export function useInitialWorkspaceLoad(options: InitialLoadOptions) {
  const {
    currentPath,
    getCurrentWorkspace,
    getViewingWorkspace,
    load_directory,
    loadCustomCommands,
  } = options;

  useEffect(() => {
    const targetWorkspace = getViewingWorkspace() || getCurrentWorkspace();
    if (!targetWorkspace || currentPath === targetWorkspace.path) {
      return;
    }

    load_directory(targetWorkspace.path);
    loadCustomCommands(targetWorkspace.path);
  }, [currentPath, getCurrentWorkspace, getViewingWorkspace, loadCustomCommands, load_directory]);
}

export function useRefreshHotkey(refreshDirectory: () => Promise<void>) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isRefreshKey = event.key === 'F5' || (event.ctrlKey && event.key === 'r');
      if (!isRefreshKey) {
        return;
      }

      event.preventDefault();
      refreshDirectory();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [refreshDirectory]);
}
