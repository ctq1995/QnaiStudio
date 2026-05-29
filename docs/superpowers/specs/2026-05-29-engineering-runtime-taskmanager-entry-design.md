# Engineering Runtime TaskManager Entry Design

## 背景

EngineeringRuntime 已经具备 lifecycle、turn、transcript、blocking hook 与 ContextRuntime 集成能力，但尚未接入 AI Runtime 的真实任务入口。当前 `TaskManager.startTask()` 只将任务标记为 running，并依赖外部 EventBus 的 session/error 事件完成任务。因此需要一个低风险接入点，让工程任务可以真实进入 EngineeringRuntime，同时不影响现有普通任务和现有 Engine 流程。

## 目标

1. 在 `TaskManager` 中新增可选 `engineeringRunner` 适配器。
2. 仅当任务显式标记为 engineering 时启用该适配器。
3. 工程任务执行结果写入 task history，并发出 task completed/failed 事件。
4. 普通任务行为不变。
5. 不在 TaskManager 内部直接创建具体 Pipeline，避免跨层耦合。

## 非目标

- 不替换现有 AIEngine/AISession 调用模型。
- 不把所有 chat/analyze/refactor/generate 都强制改为 engineering runtime。
- 不修改 UI。
- 不修改 Rust/Tauri 事件发送逻辑。
- 不在 TaskManager 中硬编码工程 pipeline 依赖。

## 任务匹配规则

第一阶段使用显式标记：

```ts
task.input.extra?.engineering === true
```

只有同时满足：

```text
TaskManagerConfig.engineeringRunner 存在
task.input.extra.engineering === true
```

才进入 EngineeringRuntime 接入路径。

## 新增类型

```ts
export interface EngineeringTaskRunnerResult {
  output?: unknown
  success: boolean
  error?: string
}

export type EngineeringTaskRunner = (task: AITask, signal: AbortSignal) => Promise<EngineeringTaskRunnerResult>
```

## TaskManager 行为

`startTask()` 启动后：

```text
1. 先保持原有 metadata/execution/task_started 逻辑。
2. 如果是 engineering task，则调用 runEngineeringTask()。
3. 成功时 completeTaskExecution()。
4. 失败时 failTaskExecution()。
5. 如果任务已被 abort，则忽略后续完成结果。
```

## 成功标准

1. 配置 engineeringRunner 后，显式 engineering task 会被真实执行。
2. engineering task 成功后 `execute()` resolve。
3. engineering task 失败后 `execute()` reject。
4. 未配置 runner 或未标记 engineering 的任务行为不变。
5. `npm run build` 通过。
