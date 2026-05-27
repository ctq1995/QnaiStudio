use async_trait::async_trait;
use reqwest::{header::{AUTHORIZATION, CONTENT_TYPE}, StatusCode};
use serde::{Deserialize, Serialize};
use tokio::time::{sleep, Duration};

use crate::error::{AppError, Result};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCall>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolCall {
    pub id: String,
    #[serde(rename = "type")]
    pub call_type: String,
    pub function: ToolFunctionCall,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolFunctionCall {
    pub name: String,
    pub arguments: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolDefinition {
    #[serde(rename = "type")]
    pub tool_type: String,
    pub function: ToolDefinitionFunction,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ToolDefinitionFunction {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value,
}

#[derive(Debug, Clone)]
pub struct ModelRequest {
    pub model: String,
    pub system_prompt: Option<String>,
    pub messages: Vec<ChatMessage>,
    pub tools: Vec<ToolDefinition>,
}

#[derive(Debug, Clone)]
pub struct ModelResponse {
    pub message: ChatMessage,
}

#[async_trait]
pub trait ModelAdapter {
    async fn request_chat_completion(&self, request: ModelRequest) -> Result<ModelResponse>;
}

#[derive(Debug, Clone)]
pub struct ModelAdapterConfig {
    pub kind: String,
    pub base_url: String,
    pub api_key: String,
}

#[derive(Debug)]
pub struct OpenAiCompatibleModelAdapter {
    base_url: String,
    api_key: String,
}

#[derive(Debug)]
pub struct OpenAiResponsesModelAdapter {
    base_url: String,
    api_key: String,
}

#[derive(Debug, Serialize)]
struct ChatCompletionRequest {
    model: String,
    messages: Vec<ChatMessage>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    tools: Vec<ToolDefinition>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tool_choice: Option<&'static str>,
    stream: bool,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<ChatCompletionChoice>,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionChoice {
    message: ChatMessage,
}

#[derive(Debug, Serialize)]
struct ResponsesApiRequest {
    model: String,
    input: Vec<ResponsesApiInputItem>,
    #[serde(skip_serializing_if = "Option::is_none")]
    tools: Option<Vec<ResponsesApiToolDefinition>>,
}

#[derive(Debug, Serialize)]
struct ResponsesApiInputItem {
    role: String,
    content: Vec<ResponsesApiContentItem>,
}

#[derive(Debug, Serialize)]
struct ResponsesApiContentItem {
    #[serde(rename = "type")]
    item_type: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    call_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    output: Option<String>,
}

#[derive(Debug, Serialize)]
struct ResponsesApiToolDefinition {
    #[serde(rename = "type")]
    tool_type: String,
    name: String,
    description: String,
    parameters: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct ResponsesApiResponse {
    #[serde(default)]
    output: Vec<ResponsesApiOutputItem>,
}

#[derive(Debug, Deserialize)]
struct ResponsesApiOutputItem {
    #[serde(rename = "type")]
    item_type: Option<String>,
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    arguments: Option<String>,
    #[serde(default)]
    content: Vec<ResponsesApiOutputContentItem>,
}

#[derive(Debug, Deserialize)]
struct ResponsesApiOutputContentItem {
    #[serde(rename = "type")]
    item_type: Option<String>,
    text: Option<String>,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    arguments: Option<String>,
}

impl OpenAiCompatibleModelAdapter {
    pub fn new(base_url: impl Into<String>, api_key: impl Into<String>) -> Self {
        Self {
            base_url: base_url.into(),
            api_key: api_key.into(),
        }
    }
}

impl OpenAiResponsesModelAdapter {
    pub fn new(base_url: impl Into<String>, api_key: impl Into<String>) -> Self {
        Self {
            base_url: base_url.into(),
            api_key: api_key.into(),
        }
    }
}

fn convert_tools_to_responses_api(tools: Vec<ToolDefinition>) -> Option<Vec<ResponsesApiToolDefinition>> {
    if tools.is_empty() {
        return None;
    }

    Some(
        tools
            .into_iter()
            .map(|tool| ResponsesApiToolDefinition {
                tool_type: tool.tool_type,
                name: tool.function.name,
                description: tool.function.description,
                parameters: tool.function.parameters,
            })
            .collect(),
    )
}

fn convert_messages_to_responses_input(messages: Vec<ChatMessage>) -> Vec<ResponsesApiInputItem> {
    messages
        .into_iter()
        .map(|message| {
            let content = match message.role.as_str() {
                "tool" => vec![ResponsesApiContentItem {
                    item_type: "function_call_output".to_string(),
                    text: None,
                    call_id: message.tool_call_id,
                    output: Some(message.content.unwrap_or_default()),
                }],
                _ => vec![ResponsesApiContentItem {
                    item_type: "input_text".to_string(),
                    text: Some(message.content.unwrap_or_default()),
                    call_id: None,
                    output: None,
                }],
            };

            ResponsesApiInputItem {
                role: message.role,
                content,
            }
        })
        .collect()
}

fn extract_responses_output(payload: ResponsesApiResponse) -> Result<ChatMessage> {
    let mut text_parts = Vec::new();
    let mut tool_calls = Vec::new();

    for item in payload.output {
        match item.item_type.as_deref() {
            Some("function_call") => {
                let name = item.name.unwrap_or_default();
                if name.trim().is_empty() {
                    continue;
                }
                tool_calls.push(ToolCall {
                    id: item.id.unwrap_or_else(|| format!("call_{}", tool_calls.len() + 1)),
                    call_type: "function".to_string(),
                    function: ToolFunctionCall {
                        name,
                        arguments: item.arguments.unwrap_or_else(|| "{}".to_string()),
                    },
                });
            }
            _ => {
                for content in item.content {
                    match content.item_type.as_deref() {
                        Some("output_text") => {
                            if let Some(text) = content.text.filter(|value| !value.trim().is_empty()) {
                                text_parts.push(text);
                            }
                        }
                        Some("refusal") => {
                            if let Some(text) = content.text.filter(|value| !value.trim().is_empty()) {
                                text_parts.push(text);
                            }
                        }
                        Some("function_call") => {
                            let name = content.name.unwrap_or_default();
                            if name.trim().is_empty() {
                                continue;
                            }
                            tool_calls.push(ToolCall {
                                id: item.id.clone().unwrap_or_else(|| format!("call_{}", tool_calls.len() + 1)),
                                call_type: "function".to_string(),
                                function: ToolFunctionCall {
                                    name,
                                    arguments: content.arguments.unwrap_or_else(|| "{}".to_string()),
                                },
                            });
                        }
                        Some("json") => {
                            if let Some(text) = content.text.filter(|value| !value.trim().is_empty()) {
                                let normalized = serde_json::from_str::<serde_json::Value>(&text)
                                    .map(|value| serde_json::to_string_pretty(&value).unwrap_or(text.clone()))
                                    .unwrap_or(text);
                                text_parts.push(normalized);
                            }
                        }
                        _ => {
                            if let Some(text) = content.text.filter(|value| !value.trim().is_empty()) {
                                text_parts.push(text);
                            }
                        }
                    }
                }
            }
        }
    }

    let content = (!text_parts.is_empty()).then(|| text_parts.join("\n\n"));
    let tool_calls = (!tool_calls.is_empty()).then_some(tool_calls);

    if content.as_deref().unwrap_or_default().trim().is_empty() && tool_calls.is_none() {
        return Err(AppError::ParseError("模型响应缺少 assistant message".to_string()));
    }

    Ok(ChatMessage {
        role: "assistant".to_string(),
        content,
        tool_calls,
        tool_call_id: None,
    })
}

const MAX_HTTP_RETRIES: usize = 2;
const RETRY_DELAY_MILLIS: u64 = 200;

fn should_retry_status(status: StatusCode) -> bool {
    status.is_server_error()
}

fn should_retry_error(error: &reqwest::Error) -> bool {
    error.is_timeout() || error.is_connect() || error.is_request()
}

fn prepend_system_message(system_prompt: Option<String>, mut messages: Vec<ChatMessage>) -> Vec<ChatMessage> {
    if let Some(system_prompt) = system_prompt.filter(|prompt| !prompt.trim().is_empty()) {
        messages.insert(
            0,
            ChatMessage {
                role: "system".to_string(),
                content: Some(system_prompt),
                tool_call_id: None,
                tool_calls: None,
            },
        );
    }
    messages
}

pub fn select_model_adapter_kind(config: &ModelAdapterConfig) -> Result<&'static str> {
    match config.kind.trim() {
        "openai-chat" => Ok("openai-chat"),
        "openai-responses" => Ok("openai-responses"),
        other => Err(AppError::ConfigError(format!("当前最小模型接入暂不支持 provider kind: {}", other))),
    }
}

pub fn build_model_adapter(config: &ModelAdapterConfig) -> Result<Box<dyn ModelAdapter + Send + Sync>> {
    match select_model_adapter_kind(config)? {
        "openai-chat" => Ok(Box::new(OpenAiCompatibleModelAdapter::new(
            normalize_openai_chat_base_url(&require_base_url(&config.base_url)?),
            require_api_key(&config.api_key)?,
        ))),
        "openai-responses" => Ok(Box::new(OpenAiResponsesModelAdapter::new(
            normalize_openai_responses_base_url(&require_base_url(&config.base_url)?),
            require_api_key(&config.api_key)?,
        ))),
        _ => unreachable!(),
    }
}

#[async_trait]
impl ModelAdapter for OpenAiCompatibleModelAdapter {
    async fn request_chat_completion(&self, request: ModelRequest) -> Result<ModelResponse> {
        let tools = request.tools;
        let body = ChatCompletionRequest {
            model: request.model,
            messages: prepend_system_message(request.system_prompt, request.messages),
            tool_choice: (!tools.is_empty()).then_some("auto"),
            tools,
            stream: false,
        };

        let client = reqwest::Client::new();
        let mut last_error = None;

        for attempt in 0..=MAX_HTTP_RETRIES {
            let response = match client
                .post(&self.base_url)
                .header(CONTENT_TYPE, "application/json")
                .header(AUTHORIZATION, format!("Bearer {}", self.api_key))
                .json(&body)
                .send()
                .await
            {
                Ok(response) => response,
                Err(error) => {
                    if attempt < MAX_HTTP_RETRIES && should_retry_error(&error) {
                        sleep(Duration::from_millis(RETRY_DELAY_MILLIS)).await;
                        continue;
                    }
                    return Err(AppError::ProcessError(format!("模型请求失败: {}", error)));
                }
            };

            if !response.status().is_success() {
                let status = response.status();
                let text = response.text().await.unwrap_or_default();
                if attempt < MAX_HTTP_RETRIES && should_retry_status(status) {
                    last_error = Some(format!("模型响应失败: {} {}", status, text));
                    sleep(Duration::from_millis(RETRY_DELAY_MILLIS)).await;
                    continue;
                }
                return Err(AppError::ProcessError(format!("模型响应失败: {} {}", status, text)));
            }

            let payload: ChatCompletionResponse = response
                .json()
                .await
                .map_err(|error| AppError::ParseError(format!("解析模型响应失败: {}", error)))?;

            let message = payload
                .choices
                .into_iter()
                .next()
                .map(|choice| choice.message)
                .ok_or_else(|| AppError::ParseError("模型响应缺少 assistant message".to_string()))?;

            if message.content.as_deref().unwrap_or_default().trim().is_empty()
                && message.tool_calls.as_ref().map(|calls| calls.is_empty()).unwrap_or(true)
            {
                return Err(AppError::ParseError("模型响应缺少 assistant message".to_string()));
            }

            return Ok(ModelResponse { message });
        }

        Err(AppError::ProcessError(
            last_error.unwrap_or_else(|| "模型请求失败: exceeded retry budget".to_string()),
        ))
    }
}

#[async_trait]
impl ModelAdapter for OpenAiResponsesModelAdapter {
    async fn request_chat_completion(&self, request: ModelRequest) -> Result<ModelResponse> {
        let input = convert_messages_to_responses_input(prepend_system_message(
            request.system_prompt,
            request.messages,
        ));

        let body = ResponsesApiRequest {
            model: request.model,
            input,
            tools: convert_tools_to_responses_api(request.tools),
        };

        let client = reqwest::Client::new();
        let mut last_error = None;

        for attempt in 0..=MAX_HTTP_RETRIES {
            let response = match client
                .post(&self.base_url)
                .header(CONTENT_TYPE, "application/json")
                .header(AUTHORIZATION, format!("Bearer {}", self.api_key))
                .json(&body)
                .send()
                .await
            {
                Ok(response) => response,
                Err(error) => {
                    if attempt < MAX_HTTP_RETRIES && should_retry_error(&error) {
                        sleep(Duration::from_millis(RETRY_DELAY_MILLIS)).await;
                        continue;
                    }
                    return Err(AppError::ProcessError(format!("模型请求失败: {}", error)));
                }
            };

            if !response.status().is_success() {
                let status = response.status();
                let text = response.text().await.unwrap_or_default();
                if attempt < MAX_HTTP_RETRIES && should_retry_status(status) {
                    last_error = Some(format!("模型响应失败: {} {}", status, text));
                    sleep(Duration::from_millis(RETRY_DELAY_MILLIS)).await;
                    continue;
                }
                return Err(AppError::ProcessError(format!("模型响应失败: {} {}", status, text)));
            }

            let payload: ResponsesApiResponse = response
                .json()
                .await
                .map_err(|error| AppError::ParseError(format!("解析模型响应失败: {}", error)))?;

            return Ok(ModelResponse {
                message: extract_responses_output(payload)?,
            });
        }

        Err(AppError::ProcessError(
            last_error.unwrap_or_else(|| "模型请求失败: exceeded retry budget".to_string()),
        ))
    }
}

fn require_api_key(api_key: &str) -> Result<String> {
    let api_key = api_key.trim();
    if api_key.is_empty() {
        Err(AppError::ConfigError("内置 Agent 缺少 API Key".to_string()))
    } else {
        Ok(api_key.to_string())
    }
}

fn require_base_url(base_url: &str) -> Result<String> {
    let base_url = base_url.trim();
    if base_url.is_empty() {
        Err(AppError::ConfigError(
            "内置 Agent 缺少 baseUrl，当前最小模型接入仅支持 OpenAI Chat / OpenAI Responses 请求格式".to_string(),
        ))
    } else {
        Ok(base_url.to_string())
    }
}

fn normalize_openai_chat_base_url(base_url: &str) -> String {
    let trimmed = base_url.trim().trim_end_matches('/');
    if trimmed.ends_with("/chat/completions") {
        trimmed.to_string()
    } else if trimmed.ends_with("/v1") {
        format!("{}/chat/completions", trimmed)
    } else {
        format!("{}/v1/chat/completions", trimmed)
    }
}

fn normalize_openai_responses_base_url(base_url: &str) -> String {
    let trimmed = base_url.trim().trim_end_matches('/');
    if trimmed.ends_with("/responses") {
        trimmed.to_string()
    } else if trimmed.ends_with("/v1") {
        format!("{}/responses", trimmed)
    } else {
        format!("{}/v1/responses", trimmed)
    }
}

#[cfg(test)]
mod tests {
    use super::{
        normalize_openai_chat_base_url, normalize_openai_responses_base_url,
        prepend_system_message, select_model_adapter_kind, should_retry_error,
        should_retry_status, ChatCompletionRequest, ChatMessage, ModelAdapterConfig,
        ModelRequest,
    };
    use reqwest::StatusCode;

    #[test]
    fn openai_chat_provider_maps_to_openai_adapter() {
        let config = ModelAdapterConfig {
            kind: "openai-chat".to_string(),
            base_url: "https://api.openai.com".to_string(),
            api_key: "secret".to_string(),
        };

        assert_eq!(select_model_adapter_kind(&config).unwrap(), "openai-chat");
    }

    #[test]
    fn openai_responses_provider_maps_to_responses_adapter() {
        let config = ModelAdapterConfig {
            kind: "openai-responses".to_string(),
            base_url: "https://api.openai.com".to_string(),
            api_key: "secret".to_string(),
        };

        assert_eq!(select_model_adapter_kind(&config).unwrap(), "openai-responses");
    }

    #[test]
    fn normalize_openai_chat_base_url_appends_chat_completions_path() {
        assert_eq!(
            normalize_openai_chat_base_url("https://api.openai.com"),
            "https://api.openai.com/v1/chat/completions"
        );
        assert_eq!(
            normalize_openai_chat_base_url("https://api.openai.com/v1"),
            "https://api.openai.com/v1/chat/completions"
        );
        assert_eq!(
            normalize_openai_chat_base_url("https://api.openai.com/v1/chat/completions"),
            "https://api.openai.com/v1/chat/completions"
        );
    }

    #[test]
    fn normalize_openai_responses_base_url_appends_responses_path() {
        assert_eq!(
            normalize_openai_responses_base_url("https://api.openai.com"),
            "https://api.openai.com/v1/responses"
        );
        assert_eq!(
            normalize_openai_responses_base_url("https://api.openai.com/v1"),
            "https://api.openai.com/v1/responses"
        );
        assert_eq!(
            normalize_openai_responses_base_url("https://api.openai.com/v1/responses"),
            "https://api.openai.com/v1/responses"
        );
    }

    #[test]
    fn chat_message_supports_tool_calls_and_tool_results() {
        let assistant: ChatMessage = serde_json::from_value(serde_json::json!({
            "role": "assistant",
            "content": null,
            "tool_calls": [{
                "id": "call_1",
                "type": "function",
                "function": {
                    "name": "git_status",
                    "arguments": "{}"
                }
            }]
        }))
        .expect("assistant tool call should deserialize");

        assert_eq!(assistant.tool_calls.as_ref().map(|calls| calls.len()), Some(1));
        assert_eq!(assistant.content, None);

        let tool_message = ChatMessage {
            role: "tool".to_string(),
            content: Some("ok".to_string()),
            tool_call_id: Some("call_1".to_string()),
            tool_calls: None,
        };
        let serialized = serde_json::to_value(tool_message).expect("tool message should serialize");
        assert_eq!(serialized.get("tool_call_id").and_then(|value| value.as_str()), Some("call_1"));
    }

    #[test]
    fn chat_completion_request_serializes_system_message_in_messages() {
        let body = ChatCompletionRequest {
            model: "demo-model".to_string(),
            messages: prepend_system_message(
                Some("system prompt".to_string()),
                vec![ChatMessage {
                    role: "user".to_string(),
                    content: Some("hello".to_string()),
                    tool_call_id: None,
                    tool_calls: None,
                }],
            ),
            tools: Vec::new(),
            tool_choice: None,
            stream: false,
        };

        let serialized = serde_json::to_value(body).expect("request should serialize");
        assert!(serialized.get("system").is_none());
        let messages = serialized
            .get("messages")
            .and_then(|value| value.as_array())
            .expect("messages should serialize as array");
        assert_eq!(messages[0].get("role").and_then(|value| value.as_str()), Some("system"));
        assert_eq!(messages[0].get("content").and_then(|value| value.as_str()), Some("system prompt"));
    }

    #[test]
    fn model_request_keeps_system_prompt() {
        let request = ModelRequest {
            model: "demo-model".to_string(),
            system_prompt: Some("system prompt".to_string()),
            messages: Vec::new(),
            tools: Vec::new(),
        };

        assert_eq!(request.system_prompt.as_deref(), Some("system prompt"));
    }

    #[test]
    fn chat_completion_request_sets_tool_choice_only_when_tools_exist() {
        let with_tools = serde_json::to_value(ChatCompletionRequest {
            model: "demo-model".to_string(),
            messages: Vec::new(),
            tools: vec![serde_json::from_value(serde_json::json!({
                "type": "function",
                "function": {
                    "name": "read_file",
                    "description": "Read a file",
                    "parameters": {"type": "object"}
                }
            }))
            .expect("tool should deserialize")],
            tool_choice: Some("auto"),
            stream: false,
        })
        .expect("request should serialize");
        assert_eq!(with_tools.get("tool_choice").and_then(|value| value.as_str()), Some("auto"));

        let without_tools = serde_json::to_value(ChatCompletionRequest {
            model: "demo-model".to_string(),
            messages: Vec::new(),
            tools: Vec::new(),
            tool_choice: None,
            stream: false,
        })
        .expect("request should serialize");
        assert!(without_tools.get("tool_choice").is_none());
    }

    #[test]
    fn retry_policy_only_retries_network_errors_and_5xx() {
        assert!(should_retry_status(StatusCode::INTERNAL_SERVER_ERROR));
        assert!(should_retry_status(StatusCode::BAD_GATEWAY));
        assert!(!should_retry_status(StatusCode::BAD_REQUEST));
        assert!(!should_retry_status(StatusCode::UNAUTHORIZED));

        let network_error = tokio::runtime::Runtime::new()
            .expect("runtime should build")
            .block_on(async { reqwest::get("http://127.0.0.1:1").await.expect_err("request should fail") });
        assert!(should_retry_error(&network_error));
    }
}
