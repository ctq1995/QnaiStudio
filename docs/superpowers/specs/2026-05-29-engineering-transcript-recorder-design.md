# Engineering Transcript Recorder Design

## 背景

QnaiStudio 自研 Agent 已具备 Engineering Agent Session、Turn Runner 与 Lifecycle Runtime。对比 PilotDeck 后，下一步需要补齐运行 transcript 能力，让 session、turn、lifecycle、tool、permission、verification 等关键过程可记录，并为后续 replay、debug、恢复、中断续跑和审计提供基础。

## 目标

1. 新增轻量 `EngineeringTranscriptRecorder`。
2. 定义稳定的 transcript event 数据结构。
3. 支持内存 writer，便于当前阶段独立使用和测试。
4. 支持自定义 writer，后续可接文件、数据库或 UI store。
5. 新增基础 replay helper，用于按顺序读取 transcript events。
6. 与 Lifecycle Runtime 对齐，支持把 lifecycle event 转为 transcript event。
7. 默认不接 UI、不写文件、不改变 pipeline 行为。

## 非目标

- 不做持久化文件格式。
- 不接 Tauri 命令层。
- 不接 Zustand store。
- 不实现完整 deterministic replay。
- 不自动重放工具调用副作用。
- 不修改现有 Agent 执行流程。

## 新增模块

```text
src/ai-runtime/engineering/transcript-recorder.ts
src/ai-runtime/engineering/transcript-replay.ts
```

## Transcript Event 类型

第一阶段覆盖以下事件：

```text
session_started
session_ended
turn_started
turn_completed
turn_failed
lifecycle_event
tool_call
tool_result
permission_decision
verification_result
review_result
note
```

每个 event 包含：

```ts
id: string
type: EngineeringTranscriptEventType
sessionId?: string
turnId?: string
taskId?: string
createdAt: string
payload?: unknown
```

## Recorder 行为

`EngineeringTranscriptRecorder` 提供：

```text
record(event)
recordLifecycleEvent(event)
recordTurnEvent(event)
getEvents()
snapshot()
clear()
```

`record(event)` 会：

```text
1. 补齐 id 和 createdAt
2. 传给 writer
3. 返回标准化后的 event
```

## Writer 接口

```ts
export interface EngineeringTranscriptWriter {
  write(event: EngineeringTranscriptEvent): void | Promise<void>
  read?(): EngineeringTranscriptEvent[] | Promise<EngineeringTranscriptEvent[]>
  clear?(): void | Promise<void>
}
```

第一阶段提供：

```text
InMemoryEngineeringTranscriptWriter
```

## Replay 行为

`EngineeringTranscriptReplay` 第一阶段只提供只读顺序回放：

```text
getEvents()
filterBySession(sessionId)
filterByTurn(turnId)
createIterator()
```

它不会重新执行工具或模型请求。

## 成功标准

1. 新模块可独立使用。
2. recorder 可记录标准 transcript event。
3. recorder 可从 lifecycle event / turn event 生成 transcript event。
4. memory writer 可读、可清理、返回副本。
5. replay helper 可按 session/turn 过滤。
6. `npm run build` 通过。
