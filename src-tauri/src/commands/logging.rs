use std::path::PathBuf;
use std::io;
use crate::error::{AppError, Result};
use crate::services::logger;

/// 获取日志目录
#[tauri::command]
pub fn get_log_dir() -> PathBuf {
    logger::Logger::log_dir()
}

/// 读取日志内容
#[tauri::command]
pub fn read_logs(max_lines: usize) -> Result<String> {
    logger::Logger::read_logs(max_lines)
        .map_err(|e: io::Error| AppError::Unknown(e.to_string()))
}

/// 清空日志文件
#[tauri::command]
pub fn clear_logs() -> Result<()> {
    logger::Logger::clear_logs()
        .map_err(|e: io::Error| AppError::Unknown(e.to_string()))
}

/// 打开日志目录
#[tauri::command]
pub fn open_log_dir() -> Result<()> {
    let log_dir = logger::Logger::log_dir();

    #[cfg(windows)]
    {
        std::process::Command::new("explorer")
            .arg(&log_dir)
            .spawn()
            .map_err(|e: io::Error| AppError::Unknown(e.to_string()))?;
    }

    #[cfg(not(windows))]
    {
        std::process::Command::new("xdg-open")
            .arg(&log_dir)
            .spawn()
            .map_err(|e: io::Error| AppError::Unknown(e.to_string()))?;
    }

    Ok(())
}
