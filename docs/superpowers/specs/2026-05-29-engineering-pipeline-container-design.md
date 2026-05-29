# Engineering Pipeline Container Design

## 背景

当前已经具备：

```text
TaskManager -> EngineeringTaskRunner Adapter -> EngineeringRuntime -> TurnRunner -> EngineeringExecutionPipeline
```

但上层仍需要手动拼装 `EngineeringExecutionPipelineDeps`。参考案例的 AgentLoop 通常会有一个 runtime/container 层，把真实能力依赖集中装配，再注册到任务系统。

本阶段新增一个轻量 container：只聚合真实依赖，不创建占位能力。

## 目标

1. 新增 `createEngineeringPipelineDeps()`。
2. 新增 `registerEngineeringPipelineRunner()`。
3. 支持注入 pipeline 必需真实依赖。
4. 支持注入 lifecycle/transcript/context/audit/onEvent 等运行时横切能力。
5. 保持 bootstrap/container 只做装配，不执行任务。
6. 不伪造 snapshot、agent、diff、verification、review 能力。

## 非目标

- 不实现具体 agent 执行逻辑。
- 不实现 shell command runner。
- 不实现 git diff reader。
- 不实现 snapshot service。
- 不修改 UI。
- 不接 Rust bridge listener。

## 新增 API

```ts
export interface EngineeringPipelineContainerInput {
  createSnapshot: EngineeringExecutionPipelineDeps['createSnapshot']
  executeAgentTask: EngineeringExecutionPipelineDeps['executeAgentTask']
  getGitDiff: EngineeringExecutionPipelineDeps['getGitDiff']
  runVerification: EngineeringExecutionPipelineDeps['runVerification']
  runReview: EngineeringExecutionPipelineDeps['runReview']
  contextBuilder?: EngineeringContextBuilderDeps
  contextRuntime?: EngineeringContextRuntime
  auditRecorder?: EngineeringAuditRecorder
  onEvent?: EngineeringRunEventHandler
  createTaskId?: () => string
}

export function createEngineeringPipelineDeps(input: EngineeringPipelineContainerInput): EngineeringExecutionPipelineDeps
```

注册 helper：

```ts
export interface EngineeringPipelineRunnerRegistrationInput extends EngineeringPipelineContainerInput {
  taskManager?: TaskManager
  sessionId?: EngineeringTaskRunnerAdapterInput['sessionId']
  lifecycleRuntime?: EngineeringLifecycleRuntime
  transcriptRecorder?: EngineeringTranscriptRecorder
  mapTaskToRunInput?: EngineeringTaskInputMapper
}

export function registerEngineeringPipelineRunner(input: EngineeringPipelineRunnerRegistrationInput): EngineeringRunnerBootstrapResult
```

## 对齐参考案例

参考案例的关键不是自动生成能力，而是：

```text
真实依赖 -> runtime container -> runner -> task/session loop
```

本设计对应为：

```text
真实 pipeline deps
  -> createEngineeringPipelineDeps()
  -> createEngineeringTaskRunner({ pipelineDeps })
  -> registerEngineeringRunner()
  -> TaskManager
```

## 成功标准

1. 上层可通过单个 helper 完成真实 pipeline runner 注册。
2. 缺失必需依赖时由 TypeScript 类型约束。
3. container 不导入具体 UI/Rust 服务。
4. `npm run build` 通过。
