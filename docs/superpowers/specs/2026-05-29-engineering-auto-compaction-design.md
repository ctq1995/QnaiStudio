# Engineering Auto Compaction Policy Design

## 背景

QnaiStudio 自研 Agent 已具备 Context Runtime、message projection、tool result budget、token budget 和 overflow recovery advice。对比 PilotDeck 后，下一步需要从“只提示上下文溢出”升级为“自动压缩策略”，但第一阶段应保持确定性、低风险，不调用模型总结，不改变现有 pipeline 行为。

## 目标

1. 新增 `EngineeringAutoCompactionPolicy`。
2. 支持 deterministic micro compaction。
3. 支持 deterministic snip compaction。
4. 输入为 `EngineeringMessage[]`。
5. 输出压缩后的 messages、压缩动作列表、前后 budget。
6. 可由 `EngineeringContextRuntime` 暴露为可选能力。
7. 不接入模型总结，不修改原始消息数组。

## 非目标

- 不做 full/model compaction。
- 不调用 LLM 总结历史。
- 不写入 transcript。
- 不持久化压缩结果。
- 不替换 `projectEngineeringMessages()`。
- 不自动接入 execution pipeline。

## 新增模块

```text
src/ai-runtime/engineering/auto-compaction-policy.ts
```

## 压缩策略

### Micro Compaction

规则：

```text
1. 只处理 role = "tool" 的消息。
2. 使用现有 budgetToolResult() 裁剪大型工具输出。
3. 保留消息顺序和角色。
4. 记录每条被裁剪工具消息的 omittedChars。
```

### Snip Compaction

规则：

```text
1. 当 micro 后仍 overflow 时启用。
2. 保留所有 system 消息。
3. 保留最近 N 条消息，默认 6。
4. 中间被移除的消息用一条 assistant marker 替代。
5. marker 内容说明被 snip 的消息数量。
```

### Full Compaction

本阶段不实现 full/model compaction，只预留类型：

```text
full
```

## API

```ts
export type EngineeringCompactionMode = 'micro' | 'snip' | 'full'

export interface EngineeringAutoCompactionOptions {
  budgetOptions?: EngineeringContextBudgetOptions
  toolResultBudgetOptions?: ToolResultBudgetOptions
  recentMessageCount?: number
  mode?: Exclude<EngineeringCompactionMode, 'full'>
}

export interface EngineeringCompactionAction {
  mode: EngineeringCompactionMode
  messageIndex?: number
  omittedChars?: number
  droppedMessages?: number
  reason: string
}

export interface EngineeringCompactionResult {
  messages: EngineeringMessage[]
  actions: EngineeringCompactionAction[]
  beforeBudget: EngineeringContextBudget
  afterBudget: EngineeringContextBudget
}
```

## 成功标准

1. micro 能裁剪大型 tool message。
2. snip 能在 overflow 时保留 system 与最近消息。
3. 原始 messages 不被修改。
4. budget 前后可观测。
5. Context Runtime 暴露 `compactMessages()`。
6. `npm run build` 通过。
