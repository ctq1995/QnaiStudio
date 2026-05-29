# Rust Tool Call Integrity Guard Design

## 背景

QnaiStudio built-in Agent 的真实工具调用链路在 Rust 侧：模型返回 `assistant.tool_calls`，运行时执行工具并把 `role = "tool"` 的结果写入 session history，然后下一次 `build_model_request()` 会把 history 转成 `ChatMessage` 发给 OpenAI-compatible 模型。

对比 PilotDeck 后，需要在真实模型请求链路前加入 tool_call / tool_result 成对保护，避免缺失、孤儿或重复 tool result 导致模型协议错误。该能力应贴近参考案例的 `ensureToolResultPairing` 思路，但实现上保持 QnaiStudio Rust 架构低侵入。

## 目标

1. 在 Rust 服务层新增 Tool Call Integrity Guard。
2. 在 `build_model_request()` 中对即将发送给模型的 messages 进行修复。
3. 检测并修复缺失 tool result。
4. 检测并移除孤儿 tool result。
5. 检测并移除重复 tool result。
6. 对缺失结果生成 synthetic error tool message。
7. 不直接修改 session history，第一阶段只修复本次模型请求消息。
8. 添加单元测试覆盖关键协议边界。

## 非目标

- 不改 OpenAI Responses API 转换逻辑。
- 不改前端 UI。
- 不引入持久化审计。
- 不改变工具执行逻辑。
- 不实现跨 session replay。
- 不把修复结果写回 history，避免历史被自动合成消息污染。

## 新增模块

```text
src-tauri/src/services/tool_call_integrity.rs
```

## 接入点

修改：

```text
src-tauri/src/services/mod.rs
src-tauri/src/services/built_in_agent_runtime.rs
```

在 `build_model_request()` 中：

```text
history serde_json::Value -> Vec<ChatMessage>
Vec<ChatMessage> -> repair_tool_call_integrity(...)
repaired messages -> ModelRequest.messages
```

## 修复规则

### 1. Assistant tool_calls 后缺少 tool result

如果 assistant 消息声明了 tool_calls，但在下一条非 tool 消息前没有收到对应 tool result，则插入：

```json
{
  "role": "tool",
  "tool_call_id": "...",
  "content": "ERROR: missing tool result repaired before model request"
}
```

### 2. 孤儿 tool result

如果 `role = "tool"` 的消息没有对应 pending tool_call，则不发送给模型，并记录 repair。

### 3. 重复 tool result

第一个匹配 pending tool_call 的 tool result 保留；之后同一 id 再出现时视为 orphan/duplicate，不发送给模型，并记录 repair。

### 4. 请求末尾仍有 pending tool_call

在消息列表末尾为所有 pending tool_call 插入 synthetic error tool message。

## 数据结构

```rust
pub struct ToolCallIntegrityRepair {
    pub kind: ToolCallIntegrityRepairKind,
    pub tool_call_id: Option<String>,
    pub message: String,
}

pub struct ToolCallIntegrityReport {
    pub messages: Vec<ChatMessage>,
    pub repairs: Vec<ToolCallIntegrityRepair>,
}
```

第一阶段 `repairs` 只供测试和后续审计扩展使用，不在 UI 展示。

## 成功标准

1. 缺失 tool result 会生成 synthetic tool message。
2. 孤儿 tool result 不会进入模型请求。
3. 重复 tool result 不会进入模型请求。
4. 正常成对消息不变。
5. `cargo check --manifest-path src-tauri/Cargo.toml` 通过。
6. `npm run build` 通过。
