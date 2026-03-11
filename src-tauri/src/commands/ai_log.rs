use crate::error::{AppError, Result};
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;

const AI_LOG_FILE_NAME: &str = "ai-reply.log";
const NEWLINE: &[u8] = b"\n";

fn log_file_path() -> Result<PathBuf> {
    std::env::current_dir()
        .map(|dir| dir.join(AI_LOG_FILE_NAME))
        .map_err(|e| AppError::Unknown(format!("Failed to resolve log path: {}", e)))
}

#[tauri::command]
pub fn append_ai_log(line: String) -> Result<()> {
    let path = log_file_path()?;
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| AppError::Unknown(format!("Failed to open log file: {}", e)))?;

    file.write_all(line.as_bytes())
        .map_err(|e| AppError::Unknown(format!("Failed to write log line: {}", e)))?;
    file.write_all(NEWLINE)
        .map_err(|e| AppError::Unknown(format!("Failed to write log newline: {}", e)))?;
    Ok(())
}
