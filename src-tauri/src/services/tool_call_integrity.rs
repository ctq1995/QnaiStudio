use std::collections::{HashSet, VecDeque};

use crate::services::agent_model_adapter::{ChatMessage, ToolCall};

const SYNTHETIC_MISSING_TOOL_RESULT: &str =
    "ERROR: missing tool result repaired before model request";

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ToolCallIntegrityRepairKind {
    MissingToolResult,
    OrphanToolResult,
    DuplicateToolResult,
    DuplicateToolCallId,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ToolCallIntegrityRepair {
    pub kind: ToolCallIntegrityRepairKind,
    pub tool_call_id: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone)]
pub struct ToolCallIntegrityReport {
    pub messages: Vec<ChatMessage>,
    pub repairs: Vec<ToolCallIntegrityRepair>,
}

#[derive(Debug, Clone)]
struct PendingToolCall {
    id: String,
}

pub fn repair_tool_call_integrity(messages: Vec<ChatMessage>) -> ToolCallIntegrityReport {
    let mut repaired_messages = Vec::with_capacity(messages.len());
    let mut repairs = Vec::new();
    let mut pending = VecDeque::<PendingToolCall>::new();
    let mut completed_current_batch = HashSet::<String>::new();

    for message in messages {
        if message.role == "tool" {
            handle_tool_message(
                message,
                &mut pending,
                &mut completed_current_batch,
                &mut repaired_messages,
                &mut repairs,
            );
            continue;
        }

        flush_missing_tool_results(&mut pending, &mut repaired_messages, &mut repairs);
        completed_current_batch.clear();
        let message = register_assistant_tool_calls(message, &mut pending, &mut repairs);
        repaired_messages.push(message);
    }

    flush_missing_tool_results(&mut pending, &mut repaired_messages, &mut repairs);

    ToolCallIntegrityReport {
        messages: repaired_messages,
        repairs,
    }
}

fn handle_tool_message(
    message: ChatMessage,
    pending: &mut VecDeque<PendingToolCall>,
    completed_current_batch: &mut HashSet<String>,
    repaired_messages: &mut Vec<ChatMessage>,
    repairs: &mut Vec<ToolCallIntegrityRepair>,
) {
    let Some(tool_call_id) = message.tool_call_id.clone() else {
        repairs.push(ToolCallIntegrityRepair {
            kind: ToolCallIntegrityRepairKind::OrphanToolResult,
            tool_call_id: None,
            message: "Removed tool result without tool_call_id".to_string(),
        });
        return;
    };

    let Some(index) = pending.iter().position(|pending| pending.id == tool_call_id) else {
        let kind = if completed_current_batch.contains(&tool_call_id) {
            ToolCallIntegrityRepairKind::DuplicateToolResult
        } else {
            ToolCallIntegrityRepairKind::OrphanToolResult
        };
        let message = if kind == ToolCallIntegrityRepairKind::DuplicateToolResult {
            "Removed duplicate tool result"
        } else {
            "Removed orphan tool result"
        };
        repairs.push(ToolCallIntegrityRepair {
            kind,
            tool_call_id: Some(tool_call_id),
            message: message.to_string(),
        });
        return;
    };

    for missing in pending.drain(..index) {
        repairs.push(ToolCallIntegrityRepair {
            kind: ToolCallIntegrityRepairKind::MissingToolResult,
            tool_call_id: Some(missing.id.clone()),
            message: "Inserted synthetic missing tool result before later tool result".to_string(),
        });
        completed_current_batch.insert(missing.id.clone());
        repaired_messages.push(synthetic_missing_tool_result(&missing.id));
    }

    pending.pop_front();
    completed_current_batch.insert(tool_call_id);
    repaired_messages.push(message);
}

fn register_assistant_tool_calls(
    mut message: ChatMessage,
    pending: &mut VecDeque<PendingToolCall>,
    repairs: &mut Vec<ToolCallIntegrityRepair>,
) -> ChatMessage {
    if message.role != "assistant" {
        return message;
    }

    let Some(tool_calls) = message.tool_calls.take() else {
        return message;
    };

    let mut seen_in_message = HashSet::<String>::new();
    let mut unique_tool_calls = Vec::<ToolCall>::with_capacity(tool_calls.len());
    for tool_call in tool_calls {
        if !seen_in_message.insert(tool_call.id.clone()) {
            repairs.push(ToolCallIntegrityRepair {
                kind: ToolCallIntegrityRepairKind::DuplicateToolCallId,
                tool_call_id: Some(tool_call.id),
                message: "Removed duplicate tool call id from assistant message".to_string(),
            });
            continue;
        }
        pending.push_back(PendingToolCall {
            id: tool_call.id.clone(),
        });
        unique_tool_calls.push(tool_call);
    }

    message.tool_calls = (!unique_tool_calls.is_empty()).then_some(unique_tool_calls);
    message
}

fn flush_missing_tool_results(
    pending: &mut VecDeque<PendingToolCall>,
    repaired_messages: &mut Vec<ChatMessage>,
    repairs: &mut Vec<ToolCallIntegrityRepair>,
) {
    while let Some(missing) = pending.pop_front() {
        repairs.push(ToolCallIntegrityRepair {
            kind: ToolCallIntegrityRepairKind::MissingToolResult,
            tool_call_id: Some(missing.id.clone()),
            message: "Inserted synthetic missing tool result".to_string(),
        });
        repaired_messages.push(synthetic_missing_tool_result(&missing.id));
    }
}

fn synthetic_missing_tool_result(tool_call_id: &str) -> ChatMessage {
    ChatMessage {
        role: "tool".to_string(),
        content: Some(SYNTHETIC_MISSING_TOOL_RESULT.to_string()),
        tool_call_id: Some(tool_call_id.to_string()),
        tool_calls: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::agent_model_adapter::ToolFunctionCall;

    fn user(content: &str) -> ChatMessage {
        ChatMessage {
            role: "user".to_string(),
            content: Some(content.to_string()),
            tool_call_id: None,
            tool_calls: None,
        }
    }

    fn assistant_with_tool_call(id: &str) -> ChatMessage {
        assistant_with_tool_calls(vec![id])
    }

    fn assistant_with_tool_calls(ids: Vec<&str>) -> ChatMessage {
        ChatMessage {
            role: "assistant".to_string(),
            content: None,
            tool_call_id: None,
            tool_calls: Some(
                ids.into_iter()
                    .map(|id| ToolCall {
                        id: id.to_string(),
                        call_type: "function".to_string(),
                        function: ToolFunctionCall {
                            name: "read_file".to_string(),
                            arguments: "{}".to_string(),
                        },
                    })
                    .collect(),
            ),
        }
    }

    fn tool_result(id: &str, content: &str) -> ChatMessage {
        ChatMessage {
            role: "tool".to_string(),
            content: Some(content.to_string()),
            tool_call_id: Some(id.to_string()),
            tool_calls: None,
        }
    }

    #[test]
    fn preserves_valid_paired_tool_call() {
        let report = repair_tool_call_integrity(vec![
            user("hello"),
            assistant_with_tool_call("call_1"),
            tool_result("call_1", "ok"),
        ]);

        assert!(report.repairs.is_empty());
        assert_eq!(report.messages.len(), 3);
        assert_eq!(report.messages[2].content.as_deref(), Some("ok"));
    }

    #[test]
    fn inserts_synthetic_result_for_missing_tool_result() {
        let report = repair_tool_call_integrity(vec![
            assistant_with_tool_call("call_1"),
            user("next"),
        ]);

        assert_eq!(report.repairs.len(), 1);
        assert_eq!(
            report.repairs[0].kind,
            ToolCallIntegrityRepairKind::MissingToolResult
        );
        assert_eq!(report.messages[1].role, "tool");
        assert_eq!(report.messages[1].tool_call_id.as_deref(), Some("call_1"));
        assert_eq!(report.messages[2].role, "user");
    }

    #[test]
    fn removes_orphan_tool_result() {
        let report = repair_tool_call_integrity(vec![tool_result("call_1", "orphan")]);

        assert_eq!(report.messages.len(), 0);
        assert_eq!(report.repairs.len(), 1);
        assert_eq!(
            report.repairs[0].kind,
            ToolCallIntegrityRepairKind::OrphanToolResult
        );
    }

    #[test]
    fn removes_duplicate_tool_result() {
        let report = repair_tool_call_integrity(vec![
            assistant_with_tool_call("call_1"),
            tool_result("call_1", "first"),
            tool_result("call_1", "second"),
        ]);

        assert_eq!(report.messages.len(), 2);
        assert_eq!(report.messages[1].content.as_deref(), Some("first"));
        assert_eq!(report.repairs.len(), 1);
        assert_eq!(
            report.repairs[0].kind,
            ToolCallIntegrityRepairKind::DuplicateToolResult
        );
    }

    #[test]
    fn repairs_pending_tool_call_at_end() {
        let report = repair_tool_call_integrity(vec![assistant_with_tool_call("call_1")]);

        assert_eq!(report.messages.len(), 2);
        assert_eq!(report.messages[1].role, "tool");
        assert_eq!(report.messages[1].tool_call_id.as_deref(), Some("call_1"));
        assert_eq!(report.repairs.len(), 1);
    }

    #[test]
    fn preserves_reused_tool_call_id_in_later_round() {
        let report = repair_tool_call_integrity(vec![
            assistant_with_tool_call("call_1"),
            tool_result("call_1", "first"),
            assistant_with_tool_call("call_1"),
            tool_result("call_1", "second"),
        ]);

        assert!(report.repairs.is_empty());
        assert_eq!(report.messages.len(), 4);
        assert_eq!(report.messages[1].content.as_deref(), Some("first"));
        assert_eq!(report.messages[3].content.as_deref(), Some("second"));
    }

    #[test]
    fn removes_duplicate_tool_call_id_from_assistant_message() {
        let report = repair_tool_call_integrity(vec![
            assistant_with_tool_calls(vec!["call_1", "call_1"]),
            tool_result("call_1", "first"),
        ]);

        assert_eq!(report.messages.len(), 2);
        assert_eq!(report.repairs.len(), 1);
        assert_eq!(
            report.repairs[0].kind,
            ToolCallIntegrityRepairKind::DuplicateToolCallId
        );
        let tool_calls = report.messages[0].tool_calls.as_ref().unwrap();
        assert_eq!(tool_calls.len(), 1);
        assert_eq!(tool_calls[0].id, "call_1");
    }
}
