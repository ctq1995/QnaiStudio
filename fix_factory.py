import pathlib

p = pathlib.Path(r'E:\Polaris\QnaiStudio\src\ai-runtime\event.ts')
content = p.read_text(encoding='utf-8')

# Add createPermissionRequestEvent factory after createAssistantMessageEvent
factory_code = """
export function createPermissionRequestEvent(
  sessionId: string,
  denials: PermissionDenialInfo[]
): PermissionRequestEvent {
  return { type: 'permission_request', sessionId, denials }
}
"""

# Insert before the isTokenEvent section
content = content.replace(
    '/**\n * 判断事件类型\n */',
    factory_code + '\n/**\n * 判断事件类型\n */'
)

p.write_text(content, encoding='utf-8')
print('Factory function added successfully')
