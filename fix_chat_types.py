#!/usr/bin/env python3
"""Add PermissionBlock to chat.ts types"""
p = __import__('pathlib').Path(r'E:\Polaris\QnaiStudio\src\types\chat.ts')
content = p.read_text(encoding='utf-8')

# 1. Add PermissionBlock interface after ToolCallBlock
perm_block = """
export interface PermissionBlock {
  type: 'permission_request';
  id: string;
  sessionId: string;
  denials: PermissionDenial[];
  status: 'pending' | 'approved' | 'denied';
  respondedAt?: string;
}
"""

content = content.replace(
    'export type ContentBlock = TextBlock | ToolCallBlock;',
    perm_block + 'export type ContentBlock = TextBlock | ToolCallBlock | PermissionBlock;'
)

# 2. Add pendingPermission field to AssistantChatMessage
content = content.replace(
    '  isStreaming?: boolean;',
    """  isStreaming?: boolean;
  /** 待处理的权限请求 */
  pendingPermission?: {
    sessionId: string;
    denials: PermissionDenial[];
    status: 'pending' | 'approved' | 'denied';
  } | null;"""
)

p.write_text(content, encoding='utf-8')
print('chat.ts types updated successfully')
