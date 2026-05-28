# Context Budget Controls Design

## 背景

QnaiStudio 已经具备工程执行闭环、项目指令加载、权限策略、工具审计和执行事件。继续借鉴 PilotDeck 时，下一块高价值能力是上下文窗口治理：token 预算、工具结果裁剪、消息投影和溢出恢复建议。

本设计只实现工程包内的轻量能力，不接入 UI，不重写聊天 store，不实现完整上下文压缩引擎。

## 目标

1. 提供轻量 token 预算估算能力。
2. 对大工具结果进行 head/tail 保留式裁剪。
3. 支持按预算投影工程消息。
4. 在上下文超预算时给出恢复建议。
5. 将预算诊断接入 `EngineeringContext` 和最终 summary。

## 非目标

- 不实现精确 tokenizer。
- 不实现语义压缩。
- 不修改现有聊天历史存储结构。
- 不做 UI 展示。
- 不自动删除用户上下文。

## 新增模块

```text
src/ai-runtime/engineering/
  token-budget.ts
  tool-result-budget.ts
  message-projector.ts
  overflow-recovery.ts
```

## Token Budget

使用近似估算：

```text
estimatedTokens = ceil(charCount / 4)
```

默认预算：

```text
maxTokens = 120000
reservedOutputTokens = 8000
```

输出：

```ts
interface EngineeringContextBudget {
  maxTokens: number
  reservedOutputTokens: number
  estimatedTokens: number
  remainingTokens: number
  overflow: boolean
}
```

## Tool Result Budget

对工具结果使用 head/tail 策略：

```text
maxChars = 12000
preserveHead = 8000
preserveTail = 4000
```

超出时输出：

```text
<head>

[tool result truncated: N characters omitted]

<tail>
```

## Message Projection

消息结构保持独立，不绑定现有 chat 类型：

```ts
interface EngineeringMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  priority?: number
}
```

投影策略：

1. `system` 消息最高优先级。
2. `user` 消息次高。
3. `assistant` 消息再次。
4. `tool` 消息可裁剪。
5. 同优先级保留较新的消息。

## Overflow Recovery

当预算溢出时输出建议：

- 减少候选文件。
- 裁剪工具结果。
- 压缩历史消息。
- 仅保留最近几轮对话。
- 降低指令文件读取上限。

## 集成点

- `types.ts` 增加 `EngineeringContextBudget` 和 context budget 字段。
- `context-builder.ts` 基于 context summary、candidate files、instructions 估算预算。
- `summary-builder.ts` 输出预算诊断和 overflow 建议。
- `index.ts` 导出新增模块。

## 成功标准

1. 新模块可独立导出。
2. `EngineeringContext` 包含预算诊断。
3. summary 显示 token 估算、剩余 token、是否溢出。
4. 工具结果裁剪函数可复用。
5. 消息投影函数可复用。
6. `npm run build` 通过。
