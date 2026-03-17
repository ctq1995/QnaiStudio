import type { UserChatMessage, Workspace } from '../../types';
import { parseWorkspaceReferences, buildSystemPrompt } from '../../services/workspaceReference';
import { startChat, continueChat } from '../../services/tauri';

function normalizeForBackend(text: string): string {
  return text
    .replace(/\r\n/g, '\\n')
    .replace(/\r/g, '\\n')
    .replace(/\n/g, '\\n')
    .trim();
}

export function buildNormalizedChatPayload(options: {
  content: string;
  workspaces: Workspace[];
  contextWorkspaces: Workspace[];
  currentWorkspaceId: string | null;
}) {
  const { processedMessage } = parseWorkspaceReferences(
    options.content,
    options.workspaces,
    options.contextWorkspaces,
    options.currentWorkspaceId,
  );

  const systemPrompt = buildSystemPrompt(
    options.workspaces,
    options.contextWorkspaces,
    options.currentWorkspaceId,
  );

  return {
    normalizedMessage: normalizeForBackend(processedMessage),
    normalizedSystemPrompt: normalizeForBackend(systemPrompt),
  };
}

export function createUserMessage(content: string): UserChatMessage {
  return {
    id: crypto.randomUUID(),
    type: 'user',
    content,
    timestamp: new Date().toISOString(),
  };
}

export async function dispatchChatRequest(options: {
  conversationId: string | null;
  normalizedMessage: string;
  normalizedSystemPrompt: string;
  workDir: string;
}): Promise<string | null> {
  if (options.conversationId) {
    await continueChat({
      sessionId: options.conversationId,
      message: options.normalizedMessage,
      systemPrompt: options.normalizedSystemPrompt,
      workDir: options.workDir,
    });
    return null;
  }

  const newSessionId = await startChat({
    message: options.normalizedMessage,
    systemPrompt: options.normalizedSystemPrompt,
    workDir: options.workDir,
  });
  return newSessionId;
}

