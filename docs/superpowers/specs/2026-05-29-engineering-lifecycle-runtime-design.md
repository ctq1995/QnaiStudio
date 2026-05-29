# Engineering Lifecycle Runtime Design

## 背景

QnaiStudio 自研 Agent 已完成 Engineering Turn Runner 与 Agent Session Skeleton，具备 session / turn 外层生命周期。对比 PilotDeck 后，下一步需要补齐可扩展的 lifecycle hook runtime，让 Agent 在关键阶段可以统一分发事件，并为后续 transcript、replay、policy、context injection、subagent status 等能力提供标准扩展点。

## 目标

1. 新增轻量 `EngineeringLifecycleRuntime`。
2. 支持注册多个 lifecycle hook。
3. 支持 hook priority 排序。
4. 支持同步与异步 hook。
5. 支持结构化记录 hook 成功/失败结果。
6. 默认不阻断主流程，避免破坏现有 Agent pipeline。
7. 与 PilotDeck 的 lifecycle 思路对齐，但保持 QnaiStudio 当前架构的低耦合实现。

## 非目标

- 不接入 UI。
- 不做 transcript 持久化。
- 不做 replay。
- 不让 hook 修改 pipeline 输入。
- 不实现 policy 阻断。
- 不实现真正 AbortSignal 传播。
- 不改动当前 `EngineeringExecutionPipeline` 行为。

## 新增模块

```text
src/ai-runtime/engineering/lifecycle-runtime.ts
```

## Lifecycle 事件

第一阶段定义以下事件类型：

```text
SessionStart
TurnStart
UserPromptSubmit
ContextBuilt
BeforeTool
AfterTool
BeforeVerify
AfterVerify
TurnEnd
SessionEnd
```

这些事件覆盖 PilotDeck 中常见的 session、turn、context、tool、verify 生命周期阶段，同时避免过早引入复杂阻断语义。

## 类型设计

生命周期事件使用 discriminated union，而不是单一 `payload?: unknown`。这样 hook 作者可以按 `event.type` 获得稳定、可收窄的事件契约。

```ts
export type EngineeringLifecycleEvent =
  | (EngineeringLifecycleEventBase<'SessionStart'> & { sessionId: string })
  | (EngineeringLifecycleEventBase<'TurnStart'> & { sessionId: string; turnId: string })
  | (EngineeringLifecycleEventBase<'UserPromptSubmit'> & { payload: EngineeringUserPromptSubmitPayload })
  | (EngineeringLifecycleEventBase<'ContextBuilt'> & { payload: EngineeringContextBuiltPayload })
  | (EngineeringLifecycleEventBase<'BeforeTool'> & { payload: EngineeringBeforeToolPayload })
  | (EngineeringLifecycleEventBase<'AfterTool'> & { payload: EngineeringAfterToolPayload })
  | (EngineeringLifecycleEventBase<'BeforeVerify'> & { payload: EngineeringBeforeVerifyPayload })
  | (EngineeringLifecycleEventBase<'AfterVerify'> & { payload: EngineeringAfterVerifyPayload })
  | (EngineeringLifecycleEventBase<'TurnEnd'> & { sessionId: string; turnId: string; payload: EngineeringTurnEndPayload })
  | (EngineeringLifecycleEventBase<'SessionEnd'> & { sessionId: string })

export interface EngineeringLifecycleHook {
  id: string
  priority?: number
  handle(event: EngineeringLifecycleEvent): void | Promise<void>
}
```

## Runtime 行为

`EngineeringLifecycleRuntime` 提供：

```text
registerHook(hook)
unregisterHook(id)
dispatch(event)
listHooks()
```

`dispatch(event)` 行为：

```text
1. 按 priority 从高到低排序 hook
2. 依次执行 hook
3. 捕获 hook 异常
4. 返回每个 hook 的执行结果
5. 默认不向外抛出 hook 异常
```

## 失败处理

hook 失败不会中断主流程，而是返回结构化结果：

```ts
export interface EngineeringLifecycleDispatchResult {
  event: EngineeringLifecycleEvent
  hookResults: EngineeringLifecycleHookResult[]
  failedHooks: number
}
```

后续阶段可以基于这个结果接入：

```text
audit recorder
transcript recorder
policy blocker
error center
```

## 与当前 Agent 的关系

本阶段只新增 runtime 与导出，不深度接入 `EngineeringExecutionPipeline`。后续阶段再逐步接入：

```text
TurnRunner -> SessionStart / TurnStart / TurnEnd
ContextBuilder -> ContextBuilt
ToolScheduler -> BeforeTool / AfterTool
VerificationPolicy -> BeforeVerify / AfterVerify
```

这样可以避免一次性修改过多核心流程。

## 成功标准

1. 新模块可独立实例化。
2. hook 按 priority 稳定执行。
3. hook 异常被捕获并返回结构化结果。
4. `npm run build` 通过。
5. 后续 transcript、replay、policy 阻断可在此基础上扩展。
