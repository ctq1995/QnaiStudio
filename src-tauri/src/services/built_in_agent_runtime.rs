use crate::error::{AppError, Result};
use crate::models::config::{Config, ModelProviderConfig};
use crate::models::events::{PermissionDenial, StreamEvent};
use crate::services::agent_model_adapter::{
    build_model_adapter, ChatMessage, ModelAdapterConfig, ModelRequest, ModelResponse,
};
use crate::services::agent_permission::requires_approval;
use crate::services::agent_profiles::built_in_code_profile;
use crate::services::agent_session::PendingToolCall;
use crate::services::agent_tool_registry::{default_tool_definitions, execute_tool};
use crate::services::built_in_agent_session::{BuiltInAgentSession, PendingPermission};
use crate::services::tool_call_integrity::repair_tool_call_integrity;

const MAX_MODEL_TOOL_ROUNDS: usize = 8;

type TextDeltaSink<'a> = Option<&'a mut (dyn FnMut(String) + Send)>;

fn push_streamed_text_delta(
    events: &mut Vec<StreamEvent>,
    sink: &mut TextDeltaSink<'_>,
    text: String,
) {
    if let Some(callback) = sink.as_deref_mut() {
        callback(text.clone());
    }
    events.push(StreamEvent::TextDelta { text });
}

fn resolve_provider(config: &Config) -> Result<ModelProviderConfig> {
    let provider_id = config
        .custom_cli
        .provider_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| AppError::ConfigError("内置 Agent 缺少服务商配置".to_string()))?;

    config
        .providers
        .iter()
        .find(|provider| provider.id == provider_id)
        .cloned()
        .ok_or_else(|| AppError::ConfigError(format!("未找到内置 Agent 服务商: {}", provider_id)))
}

pub fn create_session_from_config(
    session_id: String,
    config: &Config,
) -> Result<BuiltInAgentSession> {
    let provider = resolve_provider(config)?;
    let model = config
        .custom_cli
        .model
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| AppError::ConfigError("内置 Agent 缺少模型配置".to_string()))?
        .to_string();

    Ok(BuiltInAgentSession {
        agent_session: crate::services::agent_session::AgentSession::new(
            session_id,
            crate::services::agent_session::AgentProfileId::BuiltInCode,
            config.work_dir.clone(),
        ),
        provider_id: provider.id,
        provider_kind: provider.kind,
        api_key: provider.api_key,
        base_url: provider.base_url,
        model,
    })
}

fn parse_tool_command(message: &str) -> Option<(String, serde_json::Value)> {
    let trimmed = message.trim();
    if let Some(path) = trimmed.strip_prefix("/read ") {
        return Some((
            "read_file".to_string(),
            serde_json::json!({ "path": path.trim() }),
        ));
    }
    if trimmed == "/git-status" {
        return Some(("git_status".to_string(), serde_json::json!({})));
    }
    if let Some(command) = trimmed.strip_prefix("/bash ") {
        return Some((
            "bash".to_string(),
            serde_json::json!({ "command": command.trim() }),
        ));
    }
    None
}

fn push_tool_result_history(
    session: &mut BuiltInAgentSession,
    pending: &PendingToolCall,
    output: &str,
) {
    *session.pending_permission_mut() = None;
    session.history_mut().push(
        serde_json::to_value(ChatMessage {
            role: "tool".to_string(),
            content: Some(output.to_string()),
            tool_call_id: Some(pending.tool_use_id.clone()),
            tool_calls: None,
        })
        .unwrap_or_else(|_| {
            serde_json::json!({
                "role": "tool",
                "content": output,
                "tool_call_id": pending.tool_use_id,
            })
        }),
    );
}

fn push_assistant_history(session: &mut BuiltInAgentSession, message: &ChatMessage) {
    session
        .history_mut()
        .push(serde_json::to_value(message).unwrap_or_else(|_| {
            serde_json::json!({
                "role": message.role,
                "content": message.content,
                "tool_calls": message.tool_calls,
            })
        }));
}

fn push_tool_error_history(
    session: &mut BuiltInAgentSession,
    tool_use_id: &str,
    error_message: impl Into<String>,
) -> String {
    let output = format!("ERROR: {}", error_message.into());
    session.history_mut().push(
        serde_json::to_value(ChatMessage {
            role: "tool".to_string(),
            content: Some(output.clone()),
            tool_call_id: Some(tool_use_id.to_string()),
            tool_calls: None,
        })
        .unwrap_or_else(|_| {
            serde_json::json!({
                "role": "tool",
                "content": output,
                "tool_call_id": tool_use_id,
            })
        }),
    );
    output
}

fn build_model_request(
    session: &BuiltInAgentSession,
) -> Result<(ModelAdapterConfig, ModelRequest)> {
    let messages = session
        .history()
        .iter()
        .cloned()
        .map(serde_json::from_value)
        .collect::<std::result::Result<Vec<ChatMessage>, _>>()
        .map_err(crate::error::AppError::from)?;

    let integrity_report = repair_tool_call_integrity(messages);
    if !integrity_report.repairs.is_empty() {
        tracing::warn!(
            repair_count = integrity_report.repairs.len(),
            "repaired built-in agent tool call integrity before model request"
        );
    }

    Ok((
        ModelAdapterConfig {
            kind: session.provider_kind.clone(),
            base_url: session.base_url.clone().unwrap_or_default(),
            api_key: session.api_key.clone().unwrap_or_default(),
        },
        ModelRequest {
            model: session.model.clone(),
            system_prompt: Some(built_in_code_profile().system_prompt.to_string()),
            messages: integrity_report.messages,
            tools: default_tool_definitions(),
        },
    ))
}

async fn continue_model_loop(
    session: &mut BuiltInAgentSession,
    events: &mut Vec<StreamEvent>,
    initial_response: ModelResponse,
    initial_response_streamed: bool,
    on_text_delta: &mut TextDeltaSink<'_>,
) {
    let mut response = initial_response;
    let mut response_text_streamed = initial_response_streamed;

    for round in 0..MAX_MODEL_TOOL_ROUNDS {
        let assistant_message = response.message;
        let tool_calls = assistant_message.tool_calls.clone().unwrap_or_default();
        let assistant_text = assistant_message.content.clone().unwrap_or_default();
        push_assistant_history(session, &assistant_message);

        if !assistant_text.is_empty() && !response_text_streamed {
            events.push(StreamEvent::TextDelta {
                text: assistant_text,
            });
        }

        if tool_calls.is_empty() {
            break;
        }

        for tool_call in tool_calls {
            let tool_name = tool_call.function.name.clone();
            let input =
                match serde_json::from_str::<serde_json::Value>(&tool_call.function.arguments) {
                    Ok(value) => value,
                    Err(error) => {
                        let output = push_tool_error_history(
                            session,
                            &tool_call.id,
                            format!("工具参数解析失败: {}", error),
                        );
                        events.push(StreamEvent::ToolEnd {
                            tool_use_id: tool_call.id,
                            tool_name: Some(tool_name),
                            output: Some(output),
                        });
                        continue;
                    }
                };

            events.push(StreamEvent::ToolStart {
                tool_use_id: tool_call.id.clone(),
                tool_name: tool_name.clone(),
                input: input.clone(),
            });

            if requires_approval(&tool_name) {
                *session.pending_permission_mut() = Some(PendingPermission {
                    tool_use_id: tool_call.id.clone(),
                    tool_name: tool_name.clone(),
                    input,
                });
                events.push(StreamEvent::PermissionRequest {
                    session_id: session.session_id().to_string(),
                    denials: vec![PermissionDenial {
                        tool_name,
                        reason: "approval required".to_string(),
                        extra: std::collections::HashMap::new(),
                    }],
                });
                return;
            }

            match execute_tool(&tool_name, &input, session.work_dir()) {
                Ok(output) => {
                    let pending = PendingToolCall {
                        tool_use_id: tool_call.id.clone(),
                        tool_name: tool_name.clone(),
                        input,
                    };
                    push_tool_result_history(session, &pending, &output);
                    events.push(StreamEvent::ToolEnd {
                        tool_use_id: tool_call.id,
                        tool_name: Some(tool_name),
                        output: Some(output),
                    });
                }
                Err(error) => {
                    let output = push_tool_error_history(session, &tool_call.id, error.to_string());
                    events.push(StreamEvent::ToolEnd {
                        tool_use_id: tool_call.id,
                        tool_name: Some(tool_name),
                        output: Some(output),
                    });
                }
            }
        }

        let (adapter_config, request) = match build_model_request(session) {
            Ok(value) => value,
            Err(error) => {
                events.push(StreamEvent::Error {
                    error: error.to_string(),
                });
                return;
            }
        };

        let adapter = match build_model_adapter(&adapter_config) {
            Ok(adapter) => adapter,
            Err(error) => {
                events.push(StreamEvent::Error {
                    error: error.to_string(),
                });
                return;
            }
        };

        let mut streamed_text = false;
        response = match adapter
            .stream_chat_completion(
                request,
                Box::new(|delta| {
                    streamed_text = true;
                    push_streamed_text_delta(events, on_text_delta, delta);
                }),
            )
            .await
        {
            Ok(response) => response,
            Err(error) => {
                events.push(StreamEvent::Error {
                    error: error.to_string(),
                });
                return;
            }
        };

        response_text_streamed = streamed_text;

        if round + 1 == MAX_MODEL_TOOL_ROUNDS {
            events.push(StreamEvent::Error {
                error: format!(
                    "built-in agent reached max model/tool rounds ({MAX_MODEL_TOOL_ROUNDS})"
                ),
            });
            return;
        }
    }
}

pub async fn resume_pending_tool_events(
    session: &mut BuiltInAgentSession,
    pending: &PendingToolCall,
    output: String,
) -> Vec<StreamEvent> {
    let mut on_text_delta = None;
    resume_pending_tool_events_with_sink(session, pending, output, &mut on_text_delta).await
}

pub async fn resume_pending_tool_events_with_sink(
    session: &mut BuiltInAgentSession,
    pending: &PendingToolCall,
    output: String,
    on_text_delta: &mut TextDeltaSink<'_>,
) -> Vec<StreamEvent> {
    let mut events = vec![StreamEvent::ToolEnd {
        tool_use_id: pending.tool_use_id.clone(),
        tool_name: Some(pending.tool_name.clone()),
        output: Some(output.clone()),
    }];
    push_tool_result_history(session, pending, &output);

    let mut follow_up_streamed = false;
    let follow_up = match build_model_request(session) {
        Ok((adapter_config, request)) => match build_model_adapter(&adapter_config) {
            Ok(adapter) => {
                adapter
                    .stream_chat_completion(
                        request,
                        Box::new(|delta| {
                            follow_up_streamed = true;
                            push_streamed_text_delta(&mut events, on_text_delta, delta);
                        }),
                    )
                    .await
            }
            Err(error) => Err(error),
        },
        Err(error) => Err(error),
    };

    match follow_up {
        Ok(response) => {
            continue_model_loop(
                session,
                &mut events,
                response,
                follow_up_streamed,
                on_text_delta,
            )
            .await
        }
        Err(error) => events.push(StreamEvent::Error {
            error: error.to_string(),
        }),
    }

    session.increment_round_count();
    events.push(StreamEvent::SessionEnd {
        reason: "completed".to_string(),
    });
    events
}

async fn run_message(
    session: &mut BuiltInAgentSession,
    message: &str,
    progress_message: &str,
    on_text_delta: &mut TextDeltaSink<'_>,
) -> Vec<StreamEvent> {
    let mut events = vec![StreamEvent::System {
        subtype: Some("progress".to_string()),
        extra: std::collections::HashMap::from([(
            "message".to_string(),
            serde_json::json!(progress_message),
        )]),
    }];

    session.history_mut().push(
        serde_json::to_value(ChatMessage {
            role: "user".to_string(),
            content: Some(message.to_string()),
            tool_call_id: None,
            tool_calls: None,
        })
        .unwrap_or_else(|_| serde_json::json!({ "role": "user", "content": message })),
    );

    if let Some((tool_name, input)) = parse_tool_command(message) {
        let input_for_pending = input.clone();
        let tool_use_id = format!(
            "{}-tool-{}",
            session.session_id(),
            session.round_count() + 1
        );
        events.push(StreamEvent::ToolStart {
            tool_use_id: tool_use_id.clone(),
            tool_name: tool_name.clone(),
            input: input.clone(),
        });

        if requires_approval(&tool_name) {
            *session.pending_permission_mut() = Some(PendingPermission {
                tool_use_id: tool_use_id.clone(),
                tool_name: tool_name.clone(),
                input: input_for_pending,
            });
            events.push(StreamEvent::PermissionRequest {
                session_id: session.session_id().to_string(),
                denials: vec![PermissionDenial {
                    tool_name,
                    reason: "approval required".to_string(),
                    extra: std::collections::HashMap::new(),
                }],
            });
            return events;
        }

        match execute_tool(&tool_name, &input, session.work_dir()) {
            Ok(output) => {
                push_tool_result_history(
                    session,
                    &PendingToolCall {
                        tool_use_id: tool_use_id.clone(),
                        tool_name: tool_name.clone(),
                        input: input.clone(),
                    },
                    &output,
                );
                events.push(StreamEvent::ToolEnd {
                    tool_use_id,
                    tool_name: Some(tool_name),
                    output: Some(output.clone()),
                });
                events.push(StreamEvent::TextDelta { text: output });
            }
            Err(error) => {
                let output = format!("ERROR: {}", error);
                events.push(StreamEvent::ToolEnd {
                    tool_use_id,
                    tool_name: Some(tool_name),
                    output: Some(output.clone()),
                });
                events.push(StreamEvent::TextDelta { text: output });
            }
        }
    } else {
        let llm_request = build_model_request(session);

        match llm_request {
            Ok((adapter_config, request)) => match build_model_adapter(&adapter_config) {
                Ok(adapter) => {
                    let mut streamed_text = false;
                    match adapter
                        .stream_chat_completion(
                            request,
                            Box::new(|delta| {
                                streamed_text = true;
                                push_streamed_text_delta(&mut events, on_text_delta, delta);
                            }),
                        )
                        .await
                    {
                        Ok(response) => {
                            continue_model_loop(
                                session,
                                &mut events,
                                response,
                                streamed_text,
                                on_text_delta,
                            )
                            .await;
                        }
                        Err(error) => {
                            events.push(StreamEvent::Error {
                                error: error.to_string(),
                            });
                        }
                    }
                }
                Err(error) => {
                    events.push(StreamEvent::Error {
                        error: error.to_string(),
                    });
                }
            },
            Err(error) => {
                events.push(StreamEvent::Error {
                    error: error.to_string(),
                });
            }
        }
    }

    session.increment_round_count();
    events.push(StreamEvent::SessionEnd {
        reason: "completed".to_string(),
    });
    events
}

#[cfg(test)]
mod tests {
    use super::{build_model_request, push_tool_error_history, MAX_MODEL_TOOL_ROUNDS};
    use crate::services::agent_session::{AgentProfileId, AgentSession};
    use crate::services::built_in_agent_session::BuiltInAgentSession;

    fn sample_session() -> BuiltInAgentSession {
        BuiltInAgentSession {
            agent_session: AgentSession::new(
                "session-1".to_string(),
                AgentProfileId::BuiltInCode,
                Some("E:/demo".into()),
            ),
            provider_id: "provider".to_string(),
            provider_kind: "openai-chat".to_string(),
            api_key: Some("secret".to_string()),
            base_url: Some("https://example.com".to_string()),
            model: "demo-model".to_string(),
        }
    }

    #[test]
    fn model_request_uses_profile_system_prompt_and_low_risk_tools() {
        let session = sample_session();
        let (_, request) = build_model_request(&session).expect("request should build");
        let tool_names = request
            .tools
            .iter()
            .map(|tool| tool.function.name.as_str())
            .collect::<Vec<_>>();

        // 验证系统提示词包含工程开发工具
        assert!(request.system_prompt.as_deref().unwrap().contains("grep"));
        assert!(request
            .system_prompt
            .as_deref()
            .unwrap()
            .contains("list_tree"));
        assert!(request
            .system_prompt
            .as_deref()
            .unwrap()
            .contains("check_project"));
        assert!(request
            .system_prompt
            .as_deref()
            .unwrap()
            .contains("read_file_range"));
        assert!(request
            .system_prompt
            .as_deref()
            .unwrap()
            .contains("todo_write"));
        assert!(request
            .system_prompt
            .as_deref()
            .unwrap()
            .contains("enter_plan_mode"));
        assert!(request.messages.is_empty());
        // 验证低风险工具可见
        assert!(tool_names.contains(&"read_file"));
        assert!(tool_names.contains(&"glob_files"));
        assert!(tool_names.contains(&"grep"));
        assert!(tool_names.contains(&"list_tree"));
        assert!(tool_names.contains(&"check_project"));
        assert!(tool_names.contains(&"git_status"));
        assert!(tool_names.contains(&"git_diff"));
        assert!(tool_names.contains(&"todo_write"));
        assert!(tool_names.contains(&"enter_plan_mode"));
        assert!(tool_names.contains(&"set_plan"));
        // 验证受控工具不可见
        assert!(!tool_names.contains(&"bash"));
        assert!(!tool_names.contains(&"apply_patch"));
        assert!(!tool_names.contains(&"run_tests"));
        assert!(!tool_names.contains(&"edit_file"));
        assert!(!tool_names.contains(&"write_file"));
        assert!(!tool_names.contains(&"run_build"));
    }

    #[test]
    fn push_tool_error_history_writes_tool_message() {
        let mut session = sample_session();
        let output = push_tool_error_history(&mut session, "tool-1", "boom");

        assert_eq!(output, "ERROR: boom");
        assert_eq!(session.history().len(), 1);
        assert_eq!(
            session.history()[0]
                .get("tool_call_id")
                .and_then(|value| value.as_str()),
            Some("tool-1")
        );
        assert_eq!(
            session.history()[0]
                .get("content")
                .and_then(|value| value.as_str()),
            Some("ERROR: boom")
        );
    }

    #[test]
    fn model_tool_round_limit_is_small_and_non_zero() {
        assert!(MAX_MODEL_TOOL_ROUNDS > 0);
        assert!(MAX_MODEL_TOOL_ROUNDS <= 8);
    }
}

pub async fn start_message_events(
    session: &mut BuiltInAgentSession,
    message: &str,
) -> Vec<StreamEvent> {
    let mut on_text_delta = None;
    run_message(
        session,
        message,
        "built-in agent started",
        &mut on_text_delta,
    )
    .await
}

pub async fn continue_message_events(
    session: &mut BuiltInAgentSession,
    message: &str,
) -> Vec<StreamEvent> {
    let mut on_text_delta = None;
    run_message(
        session,
        message,
        "built-in agent continued",
        &mut on_text_delta,
    )
    .await
}

pub async fn start_message_events_with_sink(
    session: &mut BuiltInAgentSession,
    message: &str,
    on_text_delta: &mut TextDeltaSink<'_>,
) -> Vec<StreamEvent> {
    run_message(session, message, "built-in agent started", on_text_delta).await
}

pub async fn continue_message_events_with_sink(
    session: &mut BuiltInAgentSession,
    message: &str,
    on_text_delta: &mut TextDeltaSink<'_>,
) -> Vec<StreamEvent> {
    run_message(session, message, "built-in agent continued", on_text_delta).await
}
