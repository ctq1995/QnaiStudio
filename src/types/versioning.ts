/**
 * 工作区版本管理
 */

export type WorkspaceVersionKind = 'auto' | 'manual';
export type WorkspaceVersionStatus = 'ready' | 'failed';

export interface WorkspaceVersion {
  id: string;
  workspaceId: string;
  workspacePath: string;
  label: string;
  kind: WorkspaceVersionKind;
  createdAt: number;
  status: WorkspaceVersionStatus;
  fileCount: number;
  totalSize: number;
}

export interface RestoreWorkspaceVersionCheck {
  versionId: string;
  fileCount: number;
  totalSize: number;
  missingObjects: number;
  hasBackupCapacity: boolean;
}

