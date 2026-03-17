#!/bin/bash

# 修改 eventChatStore.ts 添加 token 统计功能

# 1. 添加 import
sed -i '241 a\
import { estimateMessageTokens } from '\''../utils/tokenEstimator'\''
' src/stores/eventChatStore.ts

# 2. 在 EventChatState 接口中添加 token 字段（在 progressMessage 后）
awk '
/progressMessage: string \| null/ {
  print
  print ""
  print "  /** 当前会话的输入 token 数量 */"
  print "  inputTokens: number"
  print ""
  print "  /** 当前会话的输出 token 数量 */"
  print "  outputTokens: number"
  next
}
{ print }
' src/stores/eventChatStore.ts > src/stores/eventChatStore.ts.tmp && mv src/stores/eventChatStore.ts.tmp src/stores/eventChatStore.ts

# 3. 在初始状态中添加 token 初始值（在 progressMessage: null 后）
awk '
/^  progressMessage: null,$/ {
  print
  print "  inputTokens: 0,"
  print "  outputTokens: 0,"
  next
}
{ print }
' src/stores/eventChatStore.ts > src/stores/eventChatStore.ts.tmp && mv src/stores/eventChatStore.ts.tmp src/stores/eventChatStore.ts

# 4. 在 sendMessage 中添加用户消息 token 统计（在 addMessage 后）
awk '
/get\(\)\.addMessage\(userMessage\)/ {
  print
  print ""
  print "    // 更新输入 token 统计"
  print "    const userTokens = estimateMessageTokens(content, '\''user'\'')"
  print "    set((state) => ({ inputTokens: state.inputTokens + userTokens }))"
  next
}
{ print }
' src/stores/eventChatStore.ts > src/stores/eventChatStore.ts.tmp && mv src/stores/eventChatStore.ts.tmp src/stores/eventChatStore.ts

# 5. 在 finishMessage 中添加助手消息 token 统计
awk '
/const completedMessage: AssistantChatMessage = \{/ {
  found = 1
}
found && /\}$/ && !done {
  print
  print ""
  print "      // 计算输出 token"
  print "      const textContent = currentMessage.blocks"
  print "        .filter((b: ContentBlock) => b.type === '\''text'\'')"
  print "        .map((b: any) => b.content)"
  print "        .join('\'''\'')"
  print "      const assistantTokens = estimateMessageTokens(textContent, '\''assistant'\'')"
  done = 1
  next
}
{ print }
' src/stores/eventChatStore.ts > src/stores/eventChatStore.ts.tmp && mv src/stores/eventChatStore.ts.tmp src/stores/eventChatStore.ts

# 6. 在 finishMessage 的 set 中更新 outputTokens
awk '
/isStreaming: false,$/ && !updated {
  print "          isStreaming: false,"
  print "          outputTokens: state.outputTokens + assistantTokens,"
  updated = 1
  next
}
{ print }
' src/stores/eventChatStore.ts > src/stores/eventChatStore.ts.tmp && mv src/stores/eventChatStore.ts.tmp src/stores/eventChatStore.ts

# 7. 在 clearMessages 中重置 token
awk '
/progressMessage: null,$/ && in_clear {
  print
  print "      inputTokens: 0,"
  print "      outputTokens: 0,"
  next
}
/clearMessages: \(\) => \{/ {
  in_clear = 1
}
/^\  \},$/ {
  in_clear = 0
}
{ print }
' src/stores/eventChatStore.ts > src/stores/eventChatStore.ts.tmp && mv src/stores/eventChatStore.ts.tmp src/stores/eventChatStore.ts

echo "Done!"
