use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 权限拒绝详情
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionDenial {
    #[serde(rename = "toolName")]
    pub tool_name: String,
    pub reason: String,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

/// 流事件类型 - 对应 Claude CLI stream-json 输出
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum StreamEvent {
    /// 系统事件
    #[serde(rename = "system")]
    System {
        subtype: Option<String>,
        #[serde(flatten)]
        extra: HashMap<String, serde_json::Value>,
    },

    /// 助手消息
    #[serde(rename = "assistant")]
    Assistant {
        message: serde_json::Value,
    },

    /// 用户消息（包含工具结果）
    #[serde(rename = "user")]
    User {
        message: serde_json::Value,
    },

    /// 文本内容
    #[serde(rename = "text_delta")]
    TextDelta { text: String },

    /// 工具调用开始
    #[serde(rename = "tool_start")]
    ToolStart {
        #[serde(rename = "toolUseId")]
        tool_use_id: String,
        #[serde(rename = "toolName")]
        tool_name: String,
        input: serde_json::Value,
    },

    /// 工具调用结束
    #[serde(rename = "tool_end")]
    ToolEnd {
        #[serde(rename = "toolUseId")]
        tool_use_id: String,
        #[serde(rename = "toolName")]
        tool_name: Option<String>,
        output: Option<String>,
    },

    /// 权限请求（工具调用被拒绝）
    #[serde(rename = "permission_request")]
    PermissionRequest {
        #[serde(rename = "sessionId")]
        session_id: String,
        denials: Vec<PermissionDenial>,
    },

    /// 结果
    #[serde(rename = "result")]
    Result {
        subtype: String,
        #[serde(flatten)]
        extra: HashMap<String, serde_json::Value>,
    },

    /// 错误
    #[serde(rename = "error")]
    Error { error: String },

    /// 会话结束
    #[serde(rename = "session_end")]
    SessionEnd,
}

impl StreamEvent {
    /// ?? Claude CLI ? stream-json ?
    pub fn parse_line(line: &str) -> Option<Self> {
        let line = line.trim();
        if line.is_empty() {
            return None;
        }

        let value: serde_json::Value = match serde_json::from_str(line) {
            Ok(value) => value,
            Err(e) => {
                tracing::debug!("[StreamEvent] JSON ????: {} | {}", e, line);
                return None;
            }
        };

        if let Ok(event) = serde_json::from_value::<StreamEvent>(value.clone()) {
            return Some(event);
        }

        match Self::from_unknown_value(&value) {
            Some(event) => Some(event),
            None => {
                tracing::debug!("[StreamEvent] ????: {}", line);
                None
            }
        }
    }

    fn from_unknown_value(value: &serde_json::Value) -> Option<Self> {
        let event_type = value.get("type").and_then(|v| v.as_str())?;
        match event_type {
            "content_block_delta" => parse_content_block_delta(value),
            "content_block_start" => parse_content_block_start(value),
            "tool_result" | "tool_end" => parse_tool_result(value),
            "tool_call_start" => parse_ai_tool_call_start(value),
            "tool_call_end" => parse_ai_tool_call_end(value),
            "assistant_message" => parse_ai_assistant_message(value),
            "token" => parse_ai_token(value),
            "progress" => parse_ai_progress(value),
            "error" => parse_ai_error(value),
            "message_stop" | "message_end" | "session_end" => Some(StreamEvent::SessionEnd),
            _ => None,
        }
    }
}

fn parse_content_block_delta(value: &serde_json::Value) -> Option<StreamEvent> {
    let delta_text = value.pointer("/delta/text").and_then(|v| v.as_str());
    delta_text.map(|text| StreamEvent::TextDelta { text: text.to_string() })
}

fn parse_content_block_start(value: &serde_json::Value) -> Option<StreamEvent> {
    let block = value.get("content_block")?;
    let block_type = block.get("type").and_then(|v| v.as_str())?;
    if block_type != "tool_use" {
        return None;
    }

    let tool_use_id = block.get("id").and_then(|v| v.as_str())?;
    let tool_name = block.get("name").and_then(|v| v.as_str())?;
    let input = block.get("input").cloned().unwrap_or(serde_json::Value::Null);

    Some(StreamEvent::ToolStart {
        tool_use_id: tool_use_id.to_string(),
        tool_name: tool_name.to_string(),
        input,
    })
}

fn parse_tool_result(value: &serde_json::Value) -> Option<StreamEvent> {
    let tool_use_id = value.get("tool_use_id")
        .or_else(|| value.get("toolUseId"))
        .and_then(|v| v.as_str())?;
    let tool_name = value.get("tool_name")
        .or_else(|| value.get("toolName"))
        .and_then(|v| v.as_str())
        .map(|v| v.to_string());
    let output = value.get("content")
        .or_else(|| value.get("output"))
        .map(|v| v.to_string());

    Some(StreamEvent::ToolEnd {
        tool_use_id: tool_use_id.to_string(),
        tool_name,
        output,
    })
}

fn parse_ai_tool_call_start(value: &serde_json::Value) -> Option<StreamEvent> {
    let call_id = value.get("callId")
        .or_else(|| value.get("toolUseId"))
        .and_then(|v| v.as_str())?;
    let tool = value.get("tool")
        .or_else(|| value.get("toolName"))
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");
    let args = value.get("args")
        .or_else(|| value.get("input"))
        .cloned()
        .unwrap_or(serde_json::Value::Null);

    Some(StreamEvent::ToolStart {
        tool_use_id: call_id.to_string(),
        tool_name: tool.to_string(),
        input: args,
    })
}

fn parse_ai_tool_call_end(value: &serde_json::Value) -> Option<StreamEvent> {
    let call_id = value.get("callId")
        .or_else(|| value.get("toolUseId"))
        .and_then(|v| v.as_str())?;
    let tool_name = value.get("tool")
        .or_else(|| value.get("toolName"))
        .and_then(|v| v.as_str())
        .map(|v| v.to_string());
    let output = value.get("result")
        .or_else(|| value.get("output"))
        .map(|v| v.to_string());

    Some(StreamEvent::ToolEnd {
        tool_use_id: call_id.to_string(),
        tool_name,
        output,
    })
}

fn parse_ai_assistant_message(value: &serde_json::Value) -> Option<StreamEvent> {
    let content = value.get("content")
        .or_else(|| value.get("message"))
        .and_then(|v| v.as_str())?;
    let message = serde_json::json!({
        "content": [{ "type": "text", "text": content }]
    });
    Some(StreamEvent::Assistant { message })
}

fn parse_ai_token(value: &serde_json::Value) -> Option<StreamEvent> {
    let text = value.get("value")
        .or_else(|| value.get("text"))
        .and_then(|v| v.as_str())?;
    Some(StreamEvent::TextDelta { text: text.to_string() })
}

fn parse_ai_progress(value: &serde_json::Value) -> Option<StreamEvent> {
    let message = value.get("message").and_then(|v| v.as_str())?;
    let mut extra = HashMap::new();
    extra.insert("message".to_string(), serde_json::Value::String(message.to_string()));
    Some(StreamEvent::System {
        subtype: Some("progress".to_string()),
        extra,
    })
}

fn parse_ai_error(value: &serde_json::Value) -> Option<StreamEvent> {
    let error = value.get("error")
        .or_else(|| value.get("message"))
        .and_then(|v| v.as_str())?;
    Some(StreamEvent::Error { error: error.to_string() })
}

