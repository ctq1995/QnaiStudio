# Built-in Agent Streaming Phase 1 Design

## 背景

自研 Agent 当前使用非流式模型调用。OpenAI Chat 适配器请求中 `stream: false`，runtime 等待完整 `ModelResponse` 后才一次性发出 `TextDelta`，导致用户看到的是“等待很久后一次性输出”。

本设计实现第一阶段流式输出：OpenAI Chat 通过 SSE streaming 输出文本 delta，并累积流式 tool call 分片以保持现有工具调用状态机可用。OpenAI Responses 适配器继续走默认非流式路径。

## 目标

1. OpenAI Chat 普通文本响应实时输出。
2. 每个文本 delta 立即转为 `StreamEvent::TextDelta`。
3. 最终仍拼接完整 assistant message 并写入 session history。
4. 流式 tool call 分片被累积为完整 `ToolCall`，继续复用现有工具执行逻辑。
5. OpenAI Responses 适配器暂不变。

## 非目标

- 不修改前端 UI。
- 不修改 Claude/Codex/Gemini CLI 流式逻辑。
- 不重构整个 Agent runtime。
- 不改变工具调用审批流程。

## 设计

### ModelAdapter 扩展

在 `agent_model_adapter.rs` 中新增默认方法：

```rust
async fn stream_chat_completion(
    &self,
    request: ModelRequest,
    on_delta: Box<dyn FnMut(String) + Send>,
) -> Result<ModelResponse>
```

默认实现回退到 `request_chat_completion`，这样 OpenAI Responses 不需要立即实现。

### OpenAI Chat streaming

`OpenAiCompatibleModelAdapter` 覆盖 `stream_chat_completion`。

规则：

```text
request.tools 非空 -> request_chat_completion
request.tools 为空 -> stream=true SSE
```

SSE 解析：

```text
data: {...}
data: [DONE]
```

从 chunk 中提取：

```text
choices[0].delta.content
```

每个 content delta：

```text
on_delta(delta)
full_text.push_str(delta)
```

完成后返回：

```rust
ModelResponse {
  message: ChatMessage {
    role: "assistant",
    content: Some(full_text),
    tool_call_id: None,
    tool_calls: None,
  }
}
```

### BuiltInAgentRuntime 集成

在 `continue_model_loop` 进入模型请求时：

- 如果当前 request 无 tools，调用 `stream_chat_completion`。
- callback 中 `events.push(StreamEvent::TextDelta { text: delta })`。
- 返回的完整 response 仍用于 history。
- 因为无 tools，后续不会触发工具调用。

### 命令层实时 emit

自研 Agent 的 Tauri 命令层需要把 streaming callback 收到的文本 delta 立即 `emit_chat_event` 给前端。runtime 仍返回完整事件列表用于兼容现有流程；命令层在已经实时发送文本 delta 时跳过返回列表中的重复 `TextDelta`。

## 成功标准

1. 无 tools 的 OpenAI Chat 请求产生多个 `TextDelta` 事件。
2. 完整文本仍写入 session history。
3. 有 tools 的请求继续使用非流式路径。
4. `npm run build` 通过。
5. `cargo check` 通过。
