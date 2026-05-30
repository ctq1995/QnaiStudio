# Session Scoped Runtime Events Design

## 背景

Waitable Built-in Agent Runner、Transcript、Replay 和 RuntimeBridge 都需要把 runtime 事件归属到具体 session / turn / task。此前多数 AIEvent 没有统一携带这些归属字段，导致并发会话下无法稳定聚合输出或归档事件。

## 目标

1. 以最小侵入方式给 AIEvent 增加可选归属字段。
2. 在 AIRuntimeService 把 StreamEvent 转为 AIEvent 时统一注入 sessionId。
3. 支持从 StreamEvent 或 extra 中透传 turnId/taskId。
4. 让 WaitableBuiltInAgentRunner 默认只聚合同一 session 的输出。
5. 保持现有 UI 和 EventBus 消费者兼容。

## 设计

### AIEventScope

新增通用 scope：

```ts
export interface AIEventScope {
  sessionId?: string
  turnId?: string
  taskId?: string
}
```

AIEvent union 通过交叉类型携带该 scope。已有事件中必填的 `sessionId` 或 `taskId` 保持必填，不被 undefined 覆盖。

### AIRuntimeService Scope 注入

`streamEventToAIEvents()` 末尾统一调用：

```ts
attachEventScope(event, streamEvent, sessionId)
```

注入顺序：

1. 保留 event 自身已有字段。
2. 从 StreamEvent 上读取 `sessionId/session_id`、`turnId/turn_id`、`taskId/task_id`。
3. 从 `streamEvent.extra` 读取同名字段。
4. sessionId fallback 到当前 runtime sessionId。

### Waitable Runner 默认聚合

`createWaitableBuiltInAgentRunner()` 启动会话后注册 `onAny()` listener，只处理：

```ts
if (event.sessionId !== sessionId) return
```

默认聚合：

- `assistant_message.content`
- `token.value`
- `tool_call_output.output`
- `result.output`

调用方仍可通过 `collectOutput(event)` 自定义聚合。

## 非目标

- 不重构 AIEvent 为 envelope 格式。
- 不修改 UI 渲染逻辑。
- 不强制所有事件立即拥有 turnId/taskId。
- 不改变 EventBus API。

## 限制

Waitable runner 会在拿到 sessionId 后从 EventBus history 回放同 session 输出，再注册实时 listener。当前 EventBus history 是全局有界历史，因此极高并发或极大量事件场景下，早期输出完整性仍依赖后续进一步的 session-scoped replay buffer。

## 成功标准

1. `npm run build` 通过。
2. session-scoped 输出聚合不混入其他 session。
3. 现有事件消费者不需要迁移。
4. 后续 RuntimeBridge/Transcript 可以按 sessionId/turnId/taskId 归档事件。
