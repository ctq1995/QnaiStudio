# Engineering Task Runner Adapter Design

## 背景

TaskManager 已支持通过可选 `engineeringRunner` 接管显式工程任务，但还缺少一个将 `EngineeringRuntime` 转换为 `EngineeringTaskRunner` 的标准适配器。对齐参考案例时，关键不是让 TaskManager 直接知道 Pipeline，而是保留 AgentLoop 式组合链：

```text
TaskManager -> EngineeringTaskRunner Adapter -> EngineeringRuntime -> TurnRunner -> ExecutionPipeline -> ContextRuntime/Lifecycle/Transcript
```

## 目标

1. 新增标准 `createEngineeringTaskRunner()`。
2. 将 `AITask` 映射为 `EngineeringRuntime.runTurn()` 输入。
3. 支持注入 `EngineeringExecutionPipelineDeps` 或完整 `EngineeringTurnRunnerDeps`。
4. 保持 TaskManager 与具体 Pipeline 低耦合。
5. 支持 AbortSignal：运行前和运行后检查取消状态。
6. 输出适配为 `EngineeringTaskRunnerResult`。

## 非目标

- 不在 TaskManager 内创建 Pipeline。
- 不接 UI。
- 不改 Rust/Tauri。
- 不在 adapter 中实现具体文件修改、验证或 review 逻辑。
- 不替换现有 engine 系统。

## 新增模块

```text
src/ai-runtime/engineering/task-runner-adapter.ts
```

## API

```ts
export interface EngineeringTaskRunnerAdapterInput {
  sessionId?: string | ((task: AITask) => string)
  lifecycleRuntime?: EngineeringLifecycleRuntime
  transcriptRecorder?: EngineeringTranscriptRecorder
  pipelineDeps?: EngineeringExecutionPipelineDeps
  turnRunnerDeps?: EngineeringTurnRunnerDeps
  mapTaskToRunInput?: EngineeringTaskInputMapper
}

export type EngineeringTaskInputMapper = (task: AITask) => Omit<EngineeringTurnInput, 'sessionId'>

export function createEngineeringTaskRunner(input: EngineeringTaskRunnerAdapterInput): EngineeringTaskRunner
```

## 映射规则

默认映射：

```text
userRequest = task.input.prompt
workspaceDir = task.input.extra.workspaceDir 或 currentWorkspace.path
selectedFiles = task.input.files
runMode = task.input.extra.runMode
permissionMode = task.input.extra.permissionMode
```

## 依赖规则

```text
1. 如果传入 turnRunnerDeps，直接用它创建 EngineeringRuntime。
2. 否则必须传入 pipelineDeps，由 TurnRunner 边界 helper 创建 turnRunnerDeps。
3. 如果两者都没有，在 adapter 工厂创建阶段抛出配置错误。
```

## 成功标准

1. adapter 可生成 TaskManager 可用的 `EngineeringTaskRunner`。
2. task -> turn input 映射稳定。
3. runner 成功返回 `success: true` 与 runtime result。
4. runner 失败返回 `success: false` 与错误信息。
5. AbortSignal 已取消时不会启动 runtime。
6. `npm run build` 通过。
