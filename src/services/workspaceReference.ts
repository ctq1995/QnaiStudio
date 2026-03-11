/**
 * 工作区引用服务 - 处理 @workspace:path 语法
 */

import type { ParsedWorkspaceMessage, Workspace, WorkspaceReference } from '../types';

const WORKSPACE_REF_PATTERN = /@(?:([\w\u4e00-\u9fa5-]+):)?([^\s]+)/g;

function getReferenceableWorkspaces(
  workspaces: Workspace[],
  contextWorkspaces: Workspace[],
  currentWorkspaceId: string | null,
): Workspace[] {
  const currentWorkspace = workspaces.find((workspace) => workspace.id === currentWorkspaceId);
  const workspacesById = new Map<string, Workspace>();

  if (currentWorkspace) {
    workspacesById.set(currentWorkspace.id, currentWorkspace);
  }

  for (const workspace of contextWorkspaces) {
    workspacesById.set(workspace.id, workspace);
  }

  return [...workspacesById.values()];
}

function collectReferenceMatches(message: string) {
  const matches: Array<{
    fullMatch: string;
    workspaceName: string | null;
    relativePath: string;
    startIndex: number;
    endIndex: number;
  }> = [];

  WORKSPACE_REF_PATTERN.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = WORKSPACE_REF_PATTERN.exec(message)) !== null) {
    const fullMatch = match[0];
    const workspaceName = match[1] || null;
    const relativePath = match[2];
    const looksLikePath = relativePath.includes('.') || relativePath.includes('/') || relativePath.includes('\\');

    if (looksLikePath) {
      matches.push({
        fullMatch,
        workspaceName,
        relativePath,
        startIndex: match.index,
        endIndex: match.index + fullMatch.length,
      });
    }
  }

  return matches;
}

function buildWorkspaceIndex(workspaces: Workspace[]) {
  const workspaceByName = new Map<string, Workspace>();

  for (const workspace of workspaces) {
    workspaceByName.set(workspace.name.toLowerCase(), workspace);
  }

  return workspaceByName;
}

function buildAbsolutePath(workspace: Workspace, relativePath: string) {
  const separator = workspace.path.includes('\\') ? '\\' : '/';
  return `${workspace.path}${separator}${relativePath}`;
}

function generateContextHeader(
  references: WorkspaceReference[],
  contextWorkspaces: Workspace[],
  currentWorkspace: Workspace | null,
): string {
  if (references.length === 0 && contextWorkspaces.length === 0) {
    return '';
  }

  const lines: string[] = [
    '',
    '==============================',
    '          工作区信息',
    '==============================',
    `当前工作区: ${currentWorkspace?.name || '未设置'}`,
  ];

  if (currentWorkspace) {
    lines.push(`  路径: ${currentWorkspace.path}`);
    lines.push('  引用语法: @/path');
  }

  if (contextWorkspaces.length > 0) {
    lines.push('', '关联工作区:');
    for (const workspace of contextWorkspaces) {
      lines.push(`  - ${workspace.name}`);
      lines.push(`    路径: ${workspace.path}`);
      lines.push(`    引用语法: @${workspace.name}:path`);
    }
  }

  if (references.length > 0) {
    lines.push('', '本次引用的工作区:');
    for (const workspaceName of new Set(references.map((reference) => reference.workspaceName))) {
      lines.push(`  - ${workspaceName}`);
    }
  }

  lines.push('==============================');
  return lines.join('\n');
}

export function parseWorkspaceReferences(
  message: string,
  workspaces: Workspace[],
  contextWorkspaces: Workspace[],
  currentWorkspaceId: string | null,
): ParsedWorkspaceMessage {
  const references: WorkspaceReference[] = [];
  const referenceableWorkspaces = getReferenceableWorkspaces(
    workspaces,
    contextWorkspaces,
    currentWorkspaceId,
  );
  const currentWorkspace = referenceableWorkspaces.find((workspace) => workspace.id === currentWorkspaceId) || null;
  const workspaceByName = buildWorkspaceIndex(referenceableWorkspaces);
  const matches = collectReferenceMatches(message);
  let processedMessage = message;

  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const match = matches[index];
    const workspace = match.workspaceName
      ? workspaceByName.get(match.workspaceName.toLowerCase())
      : currentWorkspace || undefined;

    if (!workspace) {
      continue;
    }

    const absolutePath = buildAbsolutePath(workspace, match.relativePath);
    references.unshift({
      workspaceName: match.workspaceName || workspace.name,
      workspacePath: workspace.path,
      relativePath: match.relativePath,
      absolutePath,
      originalText: match.fullMatch,
    });
    processedMessage = `${processedMessage.slice(0, match.startIndex)}@${absolutePath}${processedMessage.slice(match.endIndex)}`;
  }

  return {
    processedMessage,
    references,
    contextHeader: generateContextHeader(references, contextWorkspaces, currentWorkspace),
  };
}

export function getWorkspaceByName(name: string, workspaces: Workspace[]): Workspace | undefined {
  return workspaces.find((workspace) => workspace.name.toLowerCase() === name.toLowerCase());
}

export function isValidWorkspaceReference(text: string): boolean {
  return /^@[\w\u4e00-\u9fa5-]+:/.test(text);
}

export function buildWorkspaceContextExtra(
  workspaces: Workspace[],
  contextWorkspaces: Workspace[],
  currentWorkspaceId: string | null,
): { currentWorkspace: { name: string; path: string }; contextWorkspaces: Array<{ name: string; path: string }> } | null {
  const currentWorkspace = workspaces.find((workspace) => workspace.id === currentWorkspaceId);

  if (!currentWorkspace) {
    return null;
  }

  return {
    currentWorkspace: {
      name: currentWorkspace.name,
      path: currentWorkspace.path,
    },
    contextWorkspaces: contextWorkspaces.map((workspace) => ({
      name: workspace.name,
      path: workspace.path,
    })),
  };
}

export function buildSystemPrompt(
  workspaces: Workspace[],
  contextWorkspaces: Workspace[],
  currentWorkspaceId: string | null,
): string {
  const currentWorkspace = workspaces.find((workspace) => workspace.id === currentWorkspaceId);

  if (!currentWorkspace) {
    return '';
  }

  const lines = [
    `你正在 ${currentWorkspace.name} 项目中工作。`,
    `项目路径: ${currentWorkspace.path}`,
    '文件引用语法: @/path',
  ];

  if (contextWorkspaces.length > 0) {
    lines.push('', '关联工作区:');
    for (const workspace of contextWorkspaces) {
      lines.push(`- ${workspace.name} (${workspace.path})`);
      lines.push(`  引用语法: @${workspace.name}:path`);
    }
  }

  return lines.join('\n');
}

