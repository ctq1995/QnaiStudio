use crate::error::{AppError, Result};
use std::path::Path;
use std::process::Command;

fn validate_git_workspace(workspace_dir: &str, repo_path: Option<&str>) -> Result<std::path::PathBuf> {
    let workspace = Path::new(workspace_dir)
        .canonicalize()
        .map_err(|_| AppError::InvalidPath("工作区路径不存在".to_string()))?;

    let target = if let Some(repo) = repo_path {
        let repo_path = Path::new(repo);
        if repo_path.is_absolute() {
            repo_path.to_path_buf()
        } else {
            workspace.join(repo_path)
        }
    } else {
        workspace.clone()
    };

    if !target.exists() {
        return Err(AppError::InvalidPath("目标路径不存在".to_string()));
    }

    let canonical_target = target
        .canonicalize()
        .map_err(|_| AppError::InvalidPath("无法解析目标路径".to_string()))?;

    if !canonical_target.starts_with(&workspace) {
        return Err(AppError::InvalidPath("目标路径超出工作区".to_string()));
    }

    let git_dir = canonical_target.join(".git");
    if !git_dir.exists() {
        return Err(AppError::InvalidPath("目标路径不是 Git 仓库".to_string()));
    }

    Ok(canonical_target)
}

#[tauri::command]
pub async fn git_status(workspace_dir: String, repo_path: Option<String>) -> Result<String> {
    let target = validate_git_workspace(&workspace_dir, repo_path.as_deref())?;

    let output = Command::new("git")
        .args(["status", "--porcelain=v1"])
        .current_dir(&target)
        .output()
        .map_err(|e| AppError::CommandError(format!("执行 git status 失败: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::CommandError(format!("git status 失败: {}", stderr)));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.to_string())
}

#[tauri::command]
pub async fn git_diff(
    workspace_dir: String,
    path: Option<String>,
    staged: bool,
    commit_a: Option<String>,
    commit_b: Option<String>,
) -> Result<String> {
    let target = validate_git_workspace(&workspace_dir, None)?;

    let mut args = vec!["diff"];

    if staged {
        args.push("--staged");
    }

    if let (Some(a), Some(b)) = (commit_a.as_deref(), commit_b.as_deref()) {
        args.push(a);
        args.push(b);
    } else if let Some(a) = commit_a.as_deref() {
        args.push(a);
    }

    if let Some(p) = path.as_deref() {
        args.push("--");
        args.push(p);
    }

    let output = Command::new("git")
        .args(&args)
        .current_dir(&target)
        .output()
        .map_err(|e| AppError::CommandError(format!("执行 git diff 失败: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::CommandError(format!("git diff 失败: {}", stderr)));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.to_string())
}

#[tauri::command]
pub async fn git_log(
    workspace_dir: String,
    path: Option<String>,
    max_count: Option<usize>,
    oneline: Option<bool>,
) -> Result<String> {
    let target = validate_git_workspace(&workspace_dir, None)?;

    let mut args = vec!["log"];

    let count = max_count.unwrap_or(20);
    let count_arg = format!("-{}", count);
    args.push(&count_arg);

    if oneline.unwrap_or(true) {
        args.push("--oneline");
    }

    if let Some(p) = path.as_deref() {
        args.push("--");
        args.push(p);
    }

    let output = Command::new("git")
        .args(&args)
        .current_dir(&target)
        .output()
        .map_err(|e| AppError::CommandError(format!("执行 git log 失败: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::CommandError(format!("git log 失败: {}", stderr)));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.to_string())
}
