# Built-in Agent Streaming Phase 1 Design

## 背景

自研 Agent 当前使用非流式模型调用。OpenAI Chat 适配器请求中 `stream: false`，runtime 等待完整 `ModelResponse` 后才一次性发出 `TextDelta`，导致用户看到的是“等待很久后一次性输出”。

本设计实现第一阶段流式输出：仅对没有工具调用的 OpenAI Chat 普通文本请求启用 SSE streaming。带工具调用的请求继续走现有非流式路径，避免破坏 tool calls。

## 目标

1. OpenAI Chat 普通文本响应实时输出。
2. 每个文本 delta 立即转为 `StreamEvent::TextDelta`。
3. 最终仍拼接完整 assistant message 并写入 session history。
4. 有 tools 的请求保持现有非流式行为。
5. OpenAI Responses 适配器暂不变。

## 非目标

- 不实现 streaming tool_calls。
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

### 限制

当前 runtime 仍返回 `Vec<StreamEvent>`，所以如果 Tauri 命令层本身批量返回事件，则后续还需要第二阶段改为边生成边 emit。第一阶段先让 adapter/runtime 具备 delta 事件粒度。

## 成功标准

1. 无 tools 的 OpenAI Chat 请求产生多个 `TextDelta` 事件。
2. 完整文本仍写入 session history。
3. 有 tools 的请求继续使用非流式路径。
4. `npm run build` 通过。
5. `cargo check` 通过。
