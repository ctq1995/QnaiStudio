import type { Workspace } from '../types';

export function sanitizeContextWorkspaceIds(
  contextWorkspaceIds: string[],
  currentWorkspaceId: string | null,
): string[] {
  const uniqueIds = new Set<string>();

  for (const workspaceId of contextWorkspaceIds) {
    if (workspaceId && workspaceId !== currentWorkspaceId) {
      uniqueIds.add(workspaceId);
    }
  }

  return [...uniqueIds];
}

export function getCurrentWorkspaceById(
  workspaces: Workspace[],
  currentWorkspaceId: string | null,
): Workspace | null {
  return workspaces.find((workspace) => workspace.id === currentWorkspaceId) || null;
}

export function getContextWorkspacesByScope(
  workspaces: Workspace[],
  currentWorkspaceId: string | null,
  contextWorkspaceIds: string[],
): Workspace[] {
  const sanitizedIds = new Set(sanitizeContextWorkspaceIds(contextWorkspaceIds, currentWorkspaceId));
  return workspaces.filter((workspace) => sanitizedIds.has(workspace.id));
}

export function getAccessibleWorkspacesByScope(
  workspaces: Workspace[],
  currentWorkspaceId: string | null,
  contextWorkspaceIds: string[],
): Workspace[] {
  const accessibleIds = new Set(sanitizeContextWorkspaceIds(contextWorkspaceIds, currentWorkspaceId));

  return workspaces.filter(
    (workspace) => workspace.id === currentWorkspaceId || accessibleIds.has(workspace.id),
  );
}
