import { invoke } from '@tauri-apps/api/core';
import type { WorkspaceVersion, WorkspaceVersionKind } from '../types';

export async function listWorkspaceVersions(workspacePath: string): Promise<WorkspaceVersion[]> {
  return invoke<WorkspaceVersion[]>('list_workspace_versions', { workspacePath });
}

export async function createWorkspaceVersion(options: {
  workspacePath: string;
  kind: WorkspaceVersionKind;
  label?: string;
}): Promise<WorkspaceVersion> {
  const { workspacePath, kind, label } = options;
  return invoke<WorkspaceVersion>('create_workspace_version', { workspacePath, label, kind });
}

export async function restoreWorkspaceVersion(options: {
  workspacePath: string;
  versionId: string;
}): Promise<void> {
  const { workspacePath, versionId } = options;
  return invoke('restore_workspace_version', { workspacePath, versionId });
}

export async function deleteWorkspaceVersion(options: {
  workspacePath: string;
  versionId: string;
}): Promise<void> {
  const { workspacePath, versionId } = options;
  return invoke('delete_workspace_version', { workspacePath, versionId });
}

