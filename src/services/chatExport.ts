import type { AssistantChatMessage, ChatMessage, ContentBlock, UserChatMessage } from '../types';
import { BRAND_NAME } from '../constants/brand';

function extractTextFromBlocks(blocks: ContentBlock[]): string {
  return blocks
    .filter((block) => block.type === 'text')
    .map((block) => (block as { content: string }).content)
    .join('');
}

function extractToolSummary(blocks: ContentBlock[]): { count: number; names: string[] } | undefined {
  const toolBlocks = blocks.filter((block) => block.type === 'tool_call');
  if (toolBlocks.length === 0) {
    return undefined;
  }

  return {
    count: toolBlocks.length,
    names: Array.from(new Set(toolBlocks.map((block) => (block as { name: string }).name))),
  };
}

export function exportToMarkdown(messages: ChatMessage[], workspaceName?: string): string {
  const date = new Date().toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  let markdown = `# ${BRAND_NAME} 对话记录\n\n`;
  markdown += `**时间**：${date}\n`;

  if (workspaceName) {
    markdown += `**工作区**：${workspaceName}\n`;
  }

  markdown += `**消息数**：${messages.length}\n\n---\n\n`;

  for (const message of messages) {
    const time = new Date(message.timestamp).toLocaleString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });

    if (message.type === 'user') {
      markdown += `## 用户\n\n<small>${time}</small>\n\n`;
      markdown += formatContent((message as UserChatMessage).content);
      markdown += '\n\n---\n\n';
      continue;
    }

    if (message.type === 'assistant') {
      const assistantMessage = message as AssistantChatMessage;
      markdown += `## 助手\n\n<small>${time}</small>\n\n`;
      markdown += formatContent(extractTextFromBlocks(assistantMessage.blocks));

      const toolSummary = extractToolSummary(assistantMessage.blocks);
      if (toolSummary) {
        markdown += `\n\n*调用了 ${toolSummary.count} 个工具：${toolSummary.names.join('、')}*`;
      }

      markdown += '\n\n---\n\n';
      continue;
    }

    markdown += `## 系统\n\n<small>${time}</small>\n\n`;
    markdown += `*${(message as { content?: string }).content ?? ''}*\n\n---\n\n`;
  }

  return markdown;
}

export function exportToJson(messages: ChatMessage[], workspaceName?: string): string {
  const data = {
    metadata: {
      date: new Date().toISOString(),
      workspace: workspaceName ?? null,
      messageCount: messages.length,
      exportedBy: BRAND_NAME,
    },
    messages: messages.map((message) => ({
      type: message.type,
      content:
        message.type === 'assistant'
          ? extractTextFromBlocks((message as AssistantChatMessage).blocks)
          : (message as UserChatMessage).content,
      timestamp: message.timestamp,
      toolSummary:
        message.type === 'assistant'
          ? extractToolSummary((message as AssistantChatMessage).blocks)
          : undefined,
    })),
  };

  return JSON.stringify(data, null, 2);
}

function formatContent(content: string): string {
  const lines = content.split('\n');
  let result = '';
  let inCodeBlock = false;
  let codeLanguage = '';
  let codeBuffer: string[] = [];

  for (const line of lines) {
    const match = line.match(/^```(\w+)?/);
    if (match) {
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeLanguage = match[1] ?? '';
        codeBuffer = [];
      } else {
        result += '```' + codeLanguage + '\n';
        result += codeBuffer.join('\n');
        result += '\n```\n\n';
        inCodeBlock = false;
        codeLanguage = '';
        codeBuffer = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    result += `${line}\n`;
  }

  if (inCodeBlock) {
    result += '```' + codeLanguage + '\n';
    result += codeBuffer.join('\n');
    result += '\n```\n\n';
  }

  return result.trimEnd();
}

export function generateFileName(format: 'md' | 'json' = 'md'): string {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const time = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  return `对话记录-${date}-${time}.${format}`;
}
