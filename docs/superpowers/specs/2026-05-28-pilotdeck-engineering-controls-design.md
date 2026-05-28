# PilotDeck Engineering Controls Integration Design

## 背景

对 OpenBMB/PilotDeck 源码分析后，适合当前 QnaiStudio 立即吸收的能力是：权限决策、并发安全工具调度、工具审计。PilotDeck 的上下文压缩、模型路由、always-on 工作区发现价值也高，但范围更大，不适合本期直接集成。

QnaiStudio 目前已有工程执行闭环、上下文构建器、项目指令加载器、风险策略和执行事件。本设计在现有 `src/ai-runtime/engineering` 包内继续增强，不引入 PilotDeck 代码依赖，不复制其源码，只借鉴架构思想。

## 目标

实现三类工程控制能力：

1. 权限策略：基于工具类型、权限模式和命令风险做 allow / ask / deny 决策。
2. 工具调度：并发执行只读或显式并发安全的工具，串行执行有副作用工具，并保持结果顺序。
3. 审计记录：记录权限决策和工具执行结果，为后续 UI、日志、问题定位提供结构化数据。

## 非目标

本期不做：

- 不实现 UI 权限弹窗。
- 不持久化审计到数据库或本地文件。
- 不实现真正 sandbox。
- 不实现 PilotDeck RouterRuntime。
- 不实现上下文自动压缩。
- 不改造所有现有工具调用路径。

## 新增模块

```text
src/ai-runtime/engineering/
  permission-policy.ts
  tool-scheduler.ts
  audit-recorder.ts
```

## 权限策略

新增权限模式：

```text
plan             只允许只读工具；拒绝写入、shell、network。
default          只读允许；写入/shell/network 需要 ask；dangerous 命令 deny。
acceptEdits      只读允许；写入允许；shell/network ask；dangerous 命令 deny。
bypassPermissions 除 dangerous 命令外允许。
```

工具类型：

```text
read
write
shell
network
review
unknown
```

命令风险继续复用现有 `assessCommandRisk()`。

## 工具调度

工具调用结构：

```ts
interface EngineeringToolCall<TInput = unknown, TResult = unknown> {
  id: string
  name: string
  kind: EngineeringToolKind
  input: TInput
  isConcurrencySafe: boolean
  run: () => Promise<TResult>
}
```

调度规则：

1. 并发执行 `isConcurrencySafe === true` 的调用。
2. 顺序执行其余调用。
3. 返回结果数组保持原始调用顺序。
4. 单个工具失败不会吞错，结果中记录 error。

## 审计记录

审计记录分两类：

- permission audit：记录 taskId、toolCallId、toolName、mode、decision、reason、createdAt。
- tool audit：记录 taskId、toolCallId、toolName、status、startedAt、completedAt、durationMs、error。

首期提供内存实现 `InMemoryEngineeringAuditRecorder`。

## Pipeline 集成

本期只做轻量集成：

- `EngineeringRunInput` 增加 `permissionMode?: EngineeringPermissionMode`。
- `EngineeringRunSummary` 增加 `audit?: EngineeringAuditSummary`。
- `execution-pipeline` 在 verification 阶段对命令做权限决策并记录审计。
- 被 deny 的 verification 命令不执行，并以失败 verification result 进入 summary。
- ask 决策在没有 UI gate 的情况下不自动执行，返回失败结果并说明需要用户确认。

## 成功标准

1. 新模块可独立导出和复用。
2. verification 命令执行前经过权限策略。
3. 审计记录能在 summary 中体现数量。
4. 并发调度器能独立使用。
5. `npm run build` 通过。
6. 不破坏现有工程闭环调用方。
