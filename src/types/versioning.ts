/**
 * 工作区版本管理
 */

export type WorkspaceVersionKind = 'auto' | 'manual';

export interface WorkspaceVersion {
  id: string;
  workspaceId: string;
  workspacePath: string;
  label: string;
  kind: WorkspaceVersionKind;
  createdAt: number;
}

