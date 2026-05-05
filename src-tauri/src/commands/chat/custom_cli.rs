use super::{ChatContext, ContinueChatArgs, StartChatArgs};
use crate::error::{AppError, Result};
use crate::services::custom_cli_protocol::CustomCliRequest;
use uuid::Uuid;

pub async fn start_custom_cli_chat(_ctx: &ChatContext<'_>, args: &StartChatArgs) -> Result<String> {
    let session_id = args.session_id.clone().unwrap_or_else(|| Uuid::new_v4().to_string());
    let _request = CustomCliRequest {
        session_id: session_id.clone(),
        message: args.message.clone(),
        system_prompt: args.system_prompt.clone(),
    };

    Err(AppError::ConfigError("custom-cli 聊天桥接尚未实现".to_string()))
}

pub async fn continue_custom_cli_chat(
    _ctx: &ChatContext<'_>,
    args: &ContinueChatArgs,
) -> Result<()> {
    let _request = CustomCliRequest {
        session_id: args.session_id.clone(),
        message: args.message.clone(),
        system_prompt: args.system_prompt.clone(),
    };

    Err(AppError::ConfigError("custom-cli 聊天桥接尚未实现".to_string()))
}
