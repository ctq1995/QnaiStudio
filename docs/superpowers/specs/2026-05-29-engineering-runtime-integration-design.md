# Engineering Runtime Integration Design

## 背景

当前工程 Agent 已具备 TurnRunner、LifecycleRuntime、TranscriptRecorder、ContextRuntime、AutoCompaction、ExecutionPipeline 等模块，但它们仍偏分散。为了更贴近 PilotDeck 的 AgentLoop / ContextRuntime / TranscriptRuntime / PermissionRuntime 组合形态，需要增加一轮低侵入集成，让运行时形成可观测、可阻断、可回放的闭环。

## 目标

1. 新增统一 `EngineeringRuntime`，组合 session/turn/lifecycle/transcript/context/pipeline。
2. Transcript 自动接入 turn 与 lifecycle 事件。
3. ExecutionPipeline 改为通过 `EngineeringContextRuntime.prepare()` 构建上下文。
4. Lifecycle hook 支持 blocking 语义，但默认保持观察型兼容。
5. 新增 Rust/TS 事件桥接协议 TypeScript 骨架，为后续 Tauri 事件映射做准备。

## 非目标

- 不改 UI。
- 不改 Rust 真实事件发送逻辑。
- 不改变现有 pipeline 执行顺序。
- 不把 AutoCompaction 自动写回 session 历史。
- 不做模型总结式 compaction。
- 不做持久化 transcript writer。

## 新增/修改模块

```text
src/ai-runtime/engineering/engineering-runtime.ts
src/ai-runtime/engineering/runtime-event-bridge.ts
src/ai-runtime/engineering/lifecycle-runtime.ts
src/ai-runtime/engineering/execution-pipeline.ts
src/ai-runtime/engineering/index.ts
```

## EngineeringRuntime

职责：

```text
1. 创建或接收 LifecycleRuntime、TranscriptRecorder、ContextRuntime、TurnRunner。
2. 自动把 lifecycle dispatch 结果写入 transcript。
3. 自动把 turn event 写入 transcript。
4. runTurn(input) 负责 dispatch SessionStart / TurnStart / UserPromptSubmit / TurnEnd。
5. 返回 turn result 与 transcript snapshot。
```

## Blocking Lifecycle Hook

现有 hook 返回 `void | Promise<void>`。本轮扩展为：

```ts
export type EngineeringLifecycleHookDecision =
  | void
  | { type: 'continue' }
  | { type: 'block'; reason: string }
```

规则：

```text
1. 默认 void 等价 continue。
2. hook throw 仍记录 failed hook，不默认阻断，保持兼容。
3. hook 返回 block 时 dispatch 结果标记 blocked。
4. 后续 hook 不再执行。
```

## ContextRuntime 接入 Pipeline

`EngineeringExecutionPipelineDeps` 新增：

```ts
contextRuntime?: EngineeringContextRuntime
```

规则：

```text
1. 优先使用 deps.contextRuntime.prepare(input)。
2. 未传入时创建轻量 ContextRuntime，保持原 contextBuilder 兼容。
3. pipeline 仍只消费 prepareResult.context。
```

## Rust/TS 事件桥接协议骨架

新增 TS 类型与转换函数：

```text
EngineeringRuntimeBridgeEvent
mapBridgeEventToTranscriptInput(event)
```

第一阶段覆盖：

```text
model_stream_started
model_stream_delta
model_stream_completed
tool_call_started
tool_call_completed
permission_requested
permission_resolved
runtime_error
```

仅定义协议和 transcript 映射，不接 Tauri listener。

## 成功标准

1. `EngineeringRuntime` 可运行 turn 并自动记录 turn/lifecycle transcript。
2. Lifecycle hook 可返回 block，dispatch result 可观测 blocked 状态。
3. Pipeline 通过 ContextRuntime 构建上下文。
4. Bridge 类型可映射 transcript note/tool/permission 事件。
5. `npm run build` 通过。
