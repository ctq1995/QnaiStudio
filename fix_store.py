#!/usr/bin/env python3
# -*- coding: utf-8 -*-

with open('src/stores/eventChatStore.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 1. 添加 import (在第241行后)
lines.insert(241, "import { estimateMessageTokens } from '../utils/tokenEstimator'\n")

# 2. 在 EventChatState 接口添加字段 (第3857行后，现在是3858因为插入了一行)
lines.insert(3858, "\n  /** 当前会话的输入 token 数量 */\n  inputTokens: number\n\n  /** 当前会话的输出 token 数量 */\n  outputTokens: number\n")

# 3. 初始状态添加值 (第4560行后，现在需要调整)
# 找到 progressMessage: null, 这一行
for i, line in enumerate(lines):
    if i > 4500 and 'progressMessage: null,' in line and 'currentMessage' not in lines[i+1]:
        lines.insert(i+1, "  inputTokens: 0,\n  outputTokens: 0,\n")
        break

# 4. clearMessages 重置
for i, line in enumerate(lines):
    if i > 4800 and 'progressMessage: null,' in line and i < 5000:
        lines.insert(i+1, "      inputTokens: 0,\n      outputTokens: 0,\n")
        break

# 5. sendMessage 添加统计
for i, line in enumerate(lines):
    if 'get().addMessage(userMessage)' in line:
        lines.insert(i+1, "\n    // 更新输入 token 统计\n    const userTokens = estimateMessageTokens(content)\n    set((state) => ({ inputTokens: state.inputTokens + userTokens }))\n")
        break

# 6. finishMessage 中添加 token 计算
for i, line in enumerate(lines):
    if 'if (currentMessage) {' in line and i > 5100:
        lines.insert(i+1, "\n      // 计算输出 token\n      const textContent = currentMessage.blocks\n        .filter((b: ContentBlock) => b.type === 'text')\n        .map((b: any) => b.content)\n        .join('')\n      const assistantTokens = estimateMessageTokens(textContent)\n")
        break

# 7. 更新两处 isStreaming: false 后添加 outputTokens
count = 0
for i, line in enumerate(lines):
    if i > 5200 and 'isStreaming: false,' in line and count < 2:
        # 检查下一行是否已经有 outputTokens
        if i+1 < len(lines) and 'outputTokens' not in lines[i+1]:
            lines.insert(i+1, "          outputTokens: state.outputTokens + assistantTokens,\n")
            count += 1

with open('src/stores/eventChatStore.ts', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print("Fixed!")
