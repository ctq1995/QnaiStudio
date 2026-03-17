#!/usr/bin/env python3
import re

# 读取文件
with open('src/stores/eventChatStore.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. 添加 import
if 'estimateMessageTokens' not in content:
    import_line = "import { extractToolEventInfo } from '../utils/streamEvent'"
    content = content.replace(
        import_line,
        import_line + "\nimport { estimateMessageTokens } from '../utils/tokenEstimator'"
    )

# 2. 在 EventChatState 接口中添加 token 字段
interface_pattern = r'(progressMessage: string \| null)'
interface_replacement = r'\1\n\n  /** 当前会话的输入 token 数量 */\n  inputTokens: number\n\n  /** 当前会话的输出 token 数量 */\n  outputTokens: number'
content = re.sub(interface_pattern, interface_replacement, content, count=1)

# 3. 在初始状态中添加 token 初始值
init_pattern = r'(  progressMessage: null,)'
init_replacement = r'\1\n  inputTokens: 0,\n  outputTokens: 0,'
content = re.sub(init_pattern, init_replacement, content, count=1)

# 4. 在 sendMessage 中添加用户消息 token 统计
send_pattern = r'(get\(\)\.addMessage\(userMessage\))'
send_replacement = r'\1\n\n    // 更新输入 token 统计\n    const userTokens = estimateMessageTokens(content, \'user\')\n    set((state) => ({ inputTokens: state.inputTokens + userTokens }))'
content = re.sub(send_pattern, send_replacement, content, count=1)

# 5. 在 finishMessage 中添加助手消息 token 统计
finish_pattern = r'(const completedMessage: AssistantChatMessage = \{[^}]+\})'
def add_token_calc(match):
    return match.group(0) + '\n\n      // 计算输出 token\n      const textContent = currentMessage.blocks\n        .filter((b: ContentBlock) => b.type === \'text\')\n        .map((b: any) => b.content)\n        .join(\'\')\n      const assistantTokens = estimateMessageTokens(textContent, \'assistant\')'
content = re.sub(finish_pattern, add_token_calc, content, count=1, flags=re.DOTALL)

# 6. 在 finishMessage 的 set 中更新 outputTokens (两处)
output_pattern = r'(isStreaming: false,)(\s+\})'
output_replacement = r'\1\n          outputTokens: state.outputTokens + assistantTokens,\2'
content = re.sub(output_pattern, output_replacement, content, count=2)

# 7. 在 clearMessages 中重置 token
clear_pattern = r'(clearMessages: \(\) => \{[^}]+progressMessage: null,)'
def add_token_reset(match):
    return match.group(0) + '\n      inputTokens: 0,\n      outputTokens: 0,'
content = re.sub(clear_pattern, add_token_reset, content, count=1, flags=re.DOTALL)

# 写回文件
with open('src/stores/eventChatStore.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done!")
