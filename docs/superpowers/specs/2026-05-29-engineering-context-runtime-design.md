# Engineering Context Runtime Design

## 背景

QnaiStudio 自研 Agent 已具备 context builder、context provider registry、token budget、message projection、tool result budget 与 overflow recovery 等模块。对比 PilotDeck 后，下一步需要把这些分散能力收束为统一 Context Runtime，作为后续 auto compaction、router runtime、transcript recovery 和更复杂上下文治理的入口。

## 目标

1. 新增轻量 `EngineeringContextRuntime`。
2. 提供统一 `prepare(input)` 入口，包装现有 `buildEngineeringContext()`。
3. 提供 `projectMessages(messages, options)` 入口，包装现有 `projectEngineeringMessages()`。
4. 提供 `budgetToolResult(content, options)` 入口，包装现有 `budgetToolResult()`。
5. 提供 `buildOverflowAdvice(budget)` 入口，包装现有 `buildOverflowRecoveryAdvice()`。
6. 提供 `snapshot()`，暴露 runtime 配置与能力摘要。
7. 保持低侵入，不替换现有 execution pipeline。

## 非目标

- 不改 UI。
- 不改 Tauri。
- 不替换 `buildEngineeringContext()`。
- 不改变 provider registry 行为。
- 不做模型总结式 compaction。
- 不做持久化上下文缓存。
- 不自动修改消息历史。

## 新增模块

```text
src/ai-runtime/engineering/context-runtime.ts
```

## Runtime API

```ts
export interface EngineeringContextRuntimeDeps extends EngineeringContextBuilderDeps {
  projectionBudgetOptions?: EngineeringContextBudgetOptions
}

export class EngineeringContextRuntime {
  prepare(input: EngineeringRunInput): Promise<EngineeringContextRuntimePrepareResult>
  projectMessages(messages: EngineeringMessage[], options?: EngineeringContextBudgetOptions): ProjectedEngineeringMessages
  budgetToolResult(content: string, options?: ToolResultBudgetOptions): BudgetedToolResult
  buildOverflowAdvice(budget: EngineeringContextBudget): string[]
  snapshot(): EngineeringContextRuntimeSnapshot
}
```

## Prepare Result

```ts
export interface EngineeringContextRuntimePrepareResult {
  context: EngineeringContext
  overflowAdvice: string[]
}
```

`prepare()` 行为：

```text
1. 调用 buildEngineeringContext(input, deps)
2. 根据 context.budget 生成 overflowAdvice
3. 返回 context 与 overflowAdvice
```

## Snapshot

`snapshot()` 返回：

```ts
export interface EngineeringContextRuntimeSnapshot {
  capabilities: string[]
  projectionBudgetOptions?: EngineeringContextBudgetOptions
}
```

第一阶段 capabilities：

```text
prepare
projectMessages
budgetToolResult
buildOverflowAdvice
```

## 成功标准

1. Context Runtime 可独立实例化。
2. `prepare()` 返回现有 `EngineeringContext` 与 overflow advice。
3. `projectMessages()`、`budgetToolResult()`、`buildOverflowAdvice()` 正常委托现有模块。
4. 不影响现有 `buildEngineeringContext()` 调用。
5. `npm run build` 通过。
