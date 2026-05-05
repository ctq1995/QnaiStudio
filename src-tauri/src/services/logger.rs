use std::path::PathBuf;

/// 日志服务
pub struct Logger;

impl Logger {
    /// 获取日志目录
    pub fn log_dir() -> PathBuf {
        if let Some(data_dir) = dirs::data_local_dir() {
            data_dir.join("claude-code-pro").join("logs")
        } else {
            std::env::current_dir()
                .unwrap()
                .join("logs")
        }
    }

    /// 获取当前日志文件路径
    pub fn current_log_file() -> PathBuf {
        Self::log_dir().join("app.log")
    }

    /// 清空日志文件
    pub fn clear_logs() -> Result<(), std::io::Error> {
        let log_dir = Self::log_dir();

        // 删除所有日志文件
        for entry in std::fs::read_dir(log_dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("log") ||
               path.extension().and_then(|s| s.to_str()) == Some("gz") {
                std::fs::remove_file(path)?;
            }
        }

        Ok(())
    }

    /// 读取日志内容
    pub fn read_logs(max_lines: usize) -> Result<String, std::io::Error> {
        let log_file = Self::current_log_file();

        if !log_file.exists() {
            return Ok("暂无日志".to_string());
        }

        let content = std::fs::read_to_string(&log_file)?;

        // 只返回最后 N 行
        let lines: Vec<&str> = content.lines().rev().take(max_lines).collect();
        let result = lines.into_iter().rev().collect::<Vec<_>>().join("\n");

        Ok(result)
    }
}

// 使用宏简化日志调用
#[macro_export]
macro_rules! app_info {
    ($($arg:tt)*) => {
        tracing::info!($($arg)*)
    };
}

#[macro_export]
macro_rules! app_error {
    ($($arg:tt)*) => {
        tracing::error!($($arg)*)
    };
}

#[macro_export]
macro_rules! app_warn {
    ($($arg:tt)*) => {
        tracing::warn!($($arg)*)
    };
}

#[macro_export]
macro_rules! app_debug {
    ($($arg:tt)*) => {
        tracing::debug!($($arg)*)
    };
}
