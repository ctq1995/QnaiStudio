# Engineering Turn Runner Design

## 背景

QnaiStudio 自研 Agent 已有 engineering execution pipeline、Plan/Act、context providers、permission/audit、streaming 等能力，但缺少类似 PilotDeck 的 session / turn 生命周期骨架。当前 pipeline 更像单次工程任务执行器，不是可恢复、可审计、可扩展的 Agent runtime 状态机。

本设计新增轻量 Engineering Agent Session 与 Turn Runner，先建立统一生命周期，不改 UI，不替换现有 pipeline。

## 目标

1. 定义工程 Agent session 状态机。
2. 定义工程 turn 输入、事件和结果。
3. 新增 `EngineeringAgentSession`，管理 session 状态、turnId、abort、snapshot。
4. 新增 `EngineeringTurnRunner`，包装现有 `EngineeringExecutionPipeline`。
5. 保持依赖注入，不直接耦合 UI store、Tauri backend 或文件系统。

## 非目标

- 不实现 transcript 持久化。
- 不实现 replay。
- 不实现 lifecycle hook runtime。
- 不替换当前 UI 调用链。
- 不改变 execution pipeline 内部语义。

## 新增模块

```text
src/ai-runtime/engineering/agent-session.ts
src/ai-runtime/engineering/turn-runner.ts
```

## 类型设计

```ts
export type EngineeringAgentSessionStatus = 'idle' | 'running' | 'failed' | 'aborted'

export interface EngineeringAgentSessionSnapshot {
  sessionId: string
  status: EngineeringAgentSessionStatus
  currentTurnId?: string
  turns: EngineeringTurnResult[]
}

export interface EngineeringTurnInput extends EngineeringRunInput {
  sessionId: string
  turnId?: string
}

export interface EngineeringTurnResult {
  sessionId: string
  turnId: string
  status: EngineeringAgentSessionStatus
  summary: EngineeringRunSummary
}
```

## Agent Session 行为

`EngineeringAgentSession` 负责：

```text
submit(input)
mark aborted state with abort(reason?)
snapshot()
```

第一阶段的 `abort()` 只标记 session 状态和结果，不会中断底层 pipeline 的副作用。真正的 `AbortSignal` 传播将在后续 lifecycle / runtime 阶段实现。

`submit` 行为：

```text
status = running
currentTurnId = generated/provided turnId
调用 turnRunner.run(...)
成功后 status = idle
失败后 status = failed
aborted 后 status = aborted
保存 turn result
```

## Turn Runner 行为

`EngineeringTurnRunner` 负责：

```text
生成 turnId
派发 turn_started / turn_completed / turn_failed 事件
调用 EngineeringExecutionPipeline.run(input)
包装 EngineeringTurnResult
```

事件先复用现有 engineering event channel，不引入新全局 event bus。

## 成功标准

1. 新模块可独立使用。
2. 不破坏现有 `EngineeringExecutionPipeline`。
3. `npm run build` 通过。
4. 未来可继续接入 transcript、lifecycle、replay。
