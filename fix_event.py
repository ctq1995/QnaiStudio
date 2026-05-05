import pathlib

p = pathlib.Path(r'E:\Polaris\QnaiStudio\src\ai-runtime\event.ts')
content = p.read_text(encoding='utf-8')

# 1. Add PermissionRequestEvent interface before AIEvent union
perm_interface = """
/**
 * 权限请求事件 - CLI 暂停等待用户批准
 */
export interface PermissionRequestEvent {
  type: 'permission_request'
  /** 会话 ID */
  sessionId: string
  /** 权限拒绝详情列表 */
  denials: PermissionDenialInfo[]
}

/**
 * 权限拒绝信息
 */
export interface PermissionDenialInfo {
  /** 工具名称 */
  toolName: string
  /** 拒绝原因 */
  reason: string
  /** 附加信息 */
  details?: Record<string, unknown>
}

"""

content = content.replace('export type AIEvent =', perm_interface + 'export type AIEvent =')

# 2. Add PermissionRequestEvent to the union
content = content.replace(
    '| AssistantMessageEvent',
    '| AssistantMessageEvent\n  | PermissionRequestEvent'
)

p.write_text(content, encoding='utf-8')
print('event.ts updated successfully')
