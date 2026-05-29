# Engineering Real Pipeline Adapters Design

## 背景

Engineering Pipeline Container 已经允许上层注入真实工程能力，但还缺少把现有服务适配为 pipeline deps 的标准模块。本阶段按顺序实现五项真实依赖适配：

1. `executeAgentTask` 接显式可等待的真实 AI agent runner。
2. `getGitDiff` 接显式 raw git diff provider。
3. `createSnapshot` 接 workspace version service。
4. `runVerification` 接显式验证 runner。
5. `runReview` 接显式 review runner。

## 目标

1. 新增服务层适配模块，输出 `EngineeringExecutionPipelineDeps`。
2. 复用现有 workspace version service 创建快照。
3. 对需要等待完成或 raw diff 的能力采用显式函数注入，不做占位实现。
4. 保持验证命令显式配置，不自动猜测项目语言或执行任意命令。
5. 保持 review runner 显式注入，不伪造模型审查。

## 非目标

- 不新增 Rust/Tauri 命令。
- 不执行任意 shell 命令。
- 不用“启动 AI 会话成功”冒充 agent 任务完成。
- 不用 Git status/stats 摘要冒充 raw git diff。
- 不实现 UI。

## 新增模块

```text
src/services/engineeringPipelineAdapters.ts
```

## API

```ts
export interface EngineeringServicePipelineAdapterInput {
  executeAgentTask: EngineeringAgentTaskRunner
  getRawGitDiff: EngineeringRawDiffProvider
  runVerification: EngineeringVerificationRunner
  runReview: EngineeringReviewRunner
  contextBuilder?: EngineeringContextBuilderDeps
  contextRuntime?: EngineeringContextRuntime
  auditRecorder?: EngineeringAuditRecorder
  onEvent?: EngineeringRunEventHandler
  createTaskId?: () => string
}

export function createEngineeringServicePipelineDeps(input: EngineeringServicePipelineAdapterInput): EngineeringExecutionPipelineDeps
```

## 真实能力映射

### executeAgentTask

由调用方显式注入可等待完成的真实 agent runner。adapter 不把 `AIRuntimeService.sendMessage()` 的会话启动结果当作完成态。

### getGitDiff

由调用方显式注入 raw diff provider。adapter 校验非空 diff 必须包含 `diff --git` header，避免摘要文本破坏 pipeline 的变更文件提取和验证选择。

### createSnapshot

使用：

```text
createWorkspaceVersion({ kind: 'auto' })
```

### runVerification / runReview

由调用方显式注入真实实现。

## 成功标准

1. `npm run build` 通过。
2. 没有占位实现。
3. 没有自动执行未知命令。
4. 不会把异步会话启动误判为 agent 完成。
5. 不会把 Git 摘要误传给 raw diff 契约。
6. 可与 `registerEngineeringPipelineRunner()` 直接组合。
