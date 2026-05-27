use std::path::{Path, PathBuf};
use std::process::Command;

use regex::Regex;
use serde_json::json;

use crate::error::{AppError, Result};
use crate::services::agent_model_adapter::{ToolDefinition, ToolDefinitionFunction};

#[derive(Debug, Clone)]
pub struct ToolSpec {
    pub name: &'static str,
    pub description: &'static str,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ToolExecutionPolicy {
    Allow,
    RequireApproval,
}

#[derive(Debug, Clone)]
pub struct ToolRegistryEntry {
    pub spec: ToolSpec,
    pub policy: ToolExecutionPolicy,
    pub executor: fn(&serde_json::Value, Option<&Path>) -> Result<String>,
}

fn canonicalize_workspace(work_dir: Option<&Path>) -> Result<PathBuf> {
    let workspace = work_dir.ok_or_else(|| AppError::Unknown("缺少工作区目录".to_string()))?;
    let canonical = workspace
        .canonicalize()
        .map_err(|_| AppError::InvalidPath("工作区路径不存在".to_string()))?;

    if !canonical.is_dir() {
        return Err(AppError::InvalidPath("工作区路径不是目录".to_string()));
    }

    Ok(canonical)
}

fn reject_parent_traversal(path: &Path) -> Result<()> {
    if path
        .components()
        .any(|component| matches!(component, std::path::Component::ParentDir))
    {
        return Err(AppError::InvalidPath("路径不能包含上级目录跳转".to_string()));
    }

    Ok(())
}

fn resolve_workspace_path(
    work_dir: Option<&Path>,
    path: &str,
    allow_missing_leaf: bool,
) -> Result<PathBuf> {
    let workspace = canonicalize_workspace(work_dir)?;
    let requested = Path::new(path);
    reject_parent_traversal(requested)?;

    let candidate = if requested.is_absolute() {
        requested.to_path_buf()
    } else {
        workspace.join(requested)
    };

    if allow_missing_leaf && !candidate.exists() {
        let parent = candidate
            .parent()
            .ok_or_else(|| AppError::InvalidPath("目标路径缺少父目录".to_string()))?;
        let canonical_parent = parent
            .canonicalize()
            .map_err(|_| AppError::InvalidPath("目标父目录不存在".to_string()))?;

        if !canonical_parent.starts_with(&workspace) {
            return Err(AppError::InvalidPath("目标路径超出工作区".to_string()));
        }

        return Ok(candidate);
    }

    let canonical = candidate
        .canonicalize()
        .map_err(|_| AppError::InvalidPath("目标路径不存在".to_string()))?;

    if !canonical.starts_with(&workspace) {
        return Err(AppError::InvalidPath("目标路径超出工作区".to_string()));
    }

    Ok(canonical)
}

fn execute_read_file(input: &serde_json::Value, work_dir: Option<&Path>) -> Result<String> {
    let path = input
        .get("path")
        .and_then(|value| value.as_str())
        .ok_or_else(|| AppError::Unknown("read_file 缺少 path".to_string()))?;
    let full_path = resolve_workspace_path(work_dir, path, false)?;
    std::fs::read_to_string(&full_path)
        .map_err(|error| AppError::Unknown(format!("读取文件失败: {}", error)))
}

fn execute_read_file_range(input: &serde_json::Value, work_dir: Option<&Path>) -> Result<String> {
    let path = input
        .get("path")
        .and_then(|value| value.as_str())
        .ok_or_else(|| AppError::Unknown("read_file_range 缺少 path".to_string()))?;
    let start_line = input
        .get("start_line")
        .and_then(|value| value.as_u64())
        .ok_or_else(|| AppError::Unknown("read_file_range 缺少 start_line".to_string()))? as usize;
    let end_line = input
        .get("end_line")
        .and_then(|value| value.as_u64())
        .ok_or_else(|| AppError::Unknown("read_file_range 缺少 end_line".to_string()))? as usize;
    let full_path = resolve_workspace_path(work_dir, path, false)?;
    let content = std::fs::read_to_string(&full_path)
        .map_err(|error| AppError::Unknown(format!("读取文件失败: {}", error)))?;
    let lines: Vec<&str> = content.lines().collect();
    let start = start_line.saturating_sub(1).min(lines.len());
    let end = end_line.min(lines.len());
    Ok(lines[start..end].join("\n"))
}

fn execute_glob_files(input: &serde_json::Value, work_dir: Option<&Path>) -> Result<String> {
    let pattern = input
        .get("pattern")
        .and_then(|value| value.as_str())
        .ok_or_else(|| AppError::Unknown("glob_files 缺少 pattern".to_string()))?;
    let base_path = if let Some(base_path) = input.get("base_path").and_then(|value| value.as_str()) {
        resolve_workspace_path(work_dir, base_path, false)?
    } else {
        canonicalize_workspace(work_dir)?
    };
    
    let mut results = Vec::new();
    fn collect_files(dir: &Path, pattern: &str, results: &mut Vec<String>) {
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    collect_files(&path, pattern, results);
                } else if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    if glob_match::glob_match(pattern, name) {
                        results.push(path.to_string_lossy().to_string());
                    }
                }
            }
        }
    }
    collect_files(&base_path, pattern, &mut results);
    Ok(results.join("\n"))
}

fn execute_search_in_files(input: &serde_json::Value, work_dir: Option<&Path>) -> Result<String> {
    let query = input
        .get("query")
        .and_then(|value| value.as_str())
        .ok_or_else(|| AppError::Unknown("search_in_files 缺少 query".to_string()))?;
    let base_path = if let Some(base_path) = input.get("base_path").and_then(|value| value.as_str()) {
        resolve_workspace_path(work_dir, base_path, false)?
    } else {
        canonicalize_workspace(work_dir)?
    };
    let max_results = input
        .get("max_results")
        .and_then(|value| value.as_u64())
        .unwrap_or(50) as usize;
    
    let mut results = Vec::new();
    fn search_file(path: &Path, query: &str, results: &mut Vec<String>, max: usize) {
        if results.len() >= max { return; }
        if let Ok(content) = std::fs::read_to_string(path) {
            for (line_num, line) in content.lines().enumerate() {
                if line.contains(query) {
                    results.push(format!("{}:{}:{}", path.display(), line_num + 1, line));
                    if results.len() >= max { return; }
                }
            }
        }
    }
    fn walk_dir(dir: &Path, query: &str, results: &mut Vec<String>, max: usize) {
        if results.len() >= max { return; }
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    walk_dir(&path, query, results, max);
                } else {
                    search_file(&path, query, results, max);
                }
            }
        }
    }
    walk_dir(&base_path, query, &mut results, max_results);
    Ok(results.join("\n"))
}

fn execute_get_diagnostics(input: &serde_json::Value, work_dir: Option<&Path>) -> Result<String> {
    let paths = input.get("paths").and_then(|v| v.as_array());
    
    // 简化实现：检查文件是否存在并返回基本信息
    // 完整实现需要集成 LSP 或构建系统
    let mut results = Vec::new();
    if let Some(paths) = paths {
        for p in paths {
            if let Some(path_str) = p.as_str() {
                if resolve_workspace_path(work_dir, path_str, false).is_err() {
                    results.push(json!({
                        "path": path_str,
                        "severity": "error",
                        "message": "文件不存在"
                    }).to_string());
                }
            }
        }
    }
    if results.is_empty() {
        results.push("无诊断信息".to_string());
    }
    Ok(results.join("\n"))
}

fn execute_git_status(_: &serde_json::Value, work_dir: Option<&Path>) -> Result<String> {
    let work_dir = work_dir.ok_or_else(|| AppError::Unknown("缺少工作区目录".to_string()))?;
    let output = std::process::Command::new("git")
        .arg("status")
        .arg("--short")
        .current_dir(work_dir)
        .output()
        .map_err(|error| AppError::Unknown(format!("git status 执行失败: {}", error)))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn execute_git_diff(input: &serde_json::Value, work_dir: Option<&Path>) -> Result<String> {
    let work_dir = canonicalize_workspace(work_dir)?;
    let path = input.get("path").and_then(|value| value.as_str());
    
    let mut cmd = std::process::Command::new("git");
    cmd.arg("diff").current_dir(&work_dir);
    if let Some(p) = path {
        let full_path = resolve_workspace_path(Some(&work_dir), p, false)?;
        let relative_path = full_path
            .strip_prefix(&work_dir)
            .map_err(|_| AppError::InvalidPath("目标路径超出工作区".to_string()))?;
        cmd.arg("--").arg(relative_path);
    }
    let output = cmd.output()
        .map_err(|error| AppError::Unknown(format!("git diff 执行失败: {}", error)))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn execute_bash(input: &serde_json::Value, work_dir: Option<&Path>) -> Result<String> {
    let command = input
        .get("command")
        .and_then(|value| value.as_str())
        .ok_or_else(|| AppError::Unknown("bash 缺少 command".to_string()))?;
    let work_dir = work_dir.ok_or_else(|| AppError::Unknown("缺少工作区目录".to_string()))?;
    let output = if cfg!(target_os = "windows") {
        std::process::Command::new("cmd")
            .args(["/C", command])
            .current_dir(work_dir)
            .output()
    } else {
        std::process::Command::new("sh")
            .args(["-lc", command])
            .current_dir(work_dir)
            .output()
    }
    .map_err(|error| AppError::Unknown(format!("bash 执行失败: {}", error)))?;
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn execute_apply_patch(input: &serde_json::Value, work_dir: Option<&Path>) -> Result<String> {
    let path = input
        .get("path")
        .and_then(|value| value.as_str())
        .ok_or_else(|| AppError::Unknown("apply_patch 缺少 path".to_string()))?;
    let edits = input
        .get("edits")
        .and_then(|value| value.as_array())
        .ok_or_else(|| AppError::Unknown("apply_patch 缺少 edits".to_string()))?;
    let full_path = resolve_workspace_path(work_dir, path, false)?;
    
    let mut content = std::fs::read_to_string(&full_path)
        .map_err(|error| AppError::Unknown(format!("读取文件失败: {}", error)))?;
    
    for edit in edits {
        let old_text = edit.get("old_text").and_then(|v| v.as_str())
            .ok_or_else(|| AppError::Unknown("edit 缺少 old_text".to_string()))?;
        let new_text = edit.get("new_text").and_then(|v| v.as_str())
            .ok_or_else(|| AppError::Unknown("edit 缺少 new_text".to_string()))?;
        content = content.replace(old_text, new_text);
    }
    
    std::fs::write(&full_path, &content)
        .map_err(|error| AppError::Unknown(format!("写入文件失败: {}", error)))?;
    Ok(format!("已应用 {} 处修改到 {}", edits.len(), path))
}

fn execute_run_tests(input: &serde_json::Value, work_dir: Option<&Path>) -> Result<String> {
    let work_dir = work_dir.ok_or_else(|| AppError::Unknown("缺少工作区目录".to_string()))?;
    let target = input.get("target").and_then(|value| value.as_str());
    
    // 只允许安全的测试命令
    let output = if let Some(t) = target {
        match t {
            "cargo" => std::process::Command::new("cargo")
                .arg("test")
                .arg("--no-run")
                .current_dir(work_dir)
                .output(),
            "npm" => std::process::Command::new("npm")
                .arg("test")
                .current_dir(work_dir)
                .output(),
            _ => return Err(AppError::Unknown(format!("不支持的测试目标: {}", t))),
        }
    } else {
        // 默认尝试检测项目类型
        let cargo_toml = work_dir.join("Cargo.toml");
        let package_json = work_dir.join("package.json");
        
        if cargo_toml.exists() {
            std::process::Command::new("cargo")
                .arg("test")
                .arg("--no-run")
                .current_dir(work_dir)
                .output()
        } else if package_json.exists() {
            std::process::Command::new("npm")
                .arg("test")
                .current_dir(work_dir)
                .output()
        } else {
            return Err(AppError::Unknown("无法确定测试类型".to_string()));
        }
    }
    .map_err(|error| AppError::Unknown(format!("测试执行失败: {}", error)))?;
    
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    Ok(format!("{}\n{}", stdout, stderr))
}

// ========== 工程开发/debug 增强工具 ==========

fn execute_grep(input: &serde_json::Value, work_dir: Option<&Path>) -> Result<String> {
    let pattern = input
        .get("pattern")
        .and_then(|value| value.as_str())
        .ok_or_else(|| AppError::Unknown("grep 缺少 pattern".to_string()))?;
    let base_path = canonicalize_workspace(work_dir)?;
    let path_glob = input.get("path").and_then(|v| v.as_str()).unwrap_or("**/*");
    if !path_glob.contains('*') {
        let _ = resolve_workspace_path(work_dir, path_glob, false)?;
    }
    let case_insensitive = input.get("i").and_then(|v| v.as_bool()).unwrap_or(false);
    let context_lines = input.get("C").and_then(|v| v.as_u64()).unwrap_or(0) as usize;
    let max_results = input.get("head_limit").and_then(|v| v.as_u64()).unwrap_or(100) as usize;
    
    let re = Regex::new(&if case_insensitive {
        format!("(?i){}", pattern)
    } else {
        pattern.to_string()
    }).map_err(|e| AppError::Unknown(format!("正则表达式错误: {}", e)))?;
    
    let mut results = Vec::new();
    fn search_file(path: &Path, re: &Regex, context: usize, max: usize, results: &mut Vec<String>) {
        if results.len() >= max { return; }
        if let Ok(content) = std::fs::read_to_string(path) {
            let lines: Vec<&str> = content.lines().collect();
            for (line_num, line) in lines.iter().enumerate() {
                if re.is_match(line) {
                    let start = line_num.saturating_sub(context);
                    let end = (line_num + context + 1).min(lines.len());
                    for i in start..end {
                        let prefix = if i == line_num { ">" } else { " " };
                        results.push(format!("{}:{}{} {}", path.display(), i + 1, prefix, lines[i]));
                    }
                    results.push("---".to_string());
                    if results.len() >= max { return; }
                }
            }
        }
    }
    
    fn walk_dir(dir: &Path, glob: &str, re: &Regex, context: usize, max: usize, results: &mut Vec<String>) {
        if results.len() >= max { return; }
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    // Skip common non-code directories
                    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                        if ["node_modules", "target", ".git", "dist", "build", "__pycache__"].contains(&name) {
                            continue;
                        }
                    }
                    walk_dir(&path, glob, re, context, max, results);
                } else if glob_match::glob_match(glob, path.to_string_lossy().as_ref()) {
                    search_file(&path, re, context, max, results);
                }
            }
        }
    }
    
    walk_dir(&base_path, path_glob, &re, context_lines, max_results, &mut results);
    if results.is_empty() {
        Ok("No matches found".to_string())
    } else {
        Ok(results.join("\n"))
    }
}

fn execute_list_tree(input: &serde_json::Value, work_dir: Option<&Path>) -> Result<String> {
    let work_dir = canonicalize_workspace(work_dir)?;
    let depth = input.get("depth").and_then(|v| v.as_u64()).unwrap_or(3) as usize;
    let max_files = input.get("max_files").and_then(|v| v.as_u64()).unwrap_or(200) as usize;
    
    let mut results = Vec::new();
    fn walk(dir: &Path, prefix: String, depth: usize, max: usize, count: &mut usize, results: &mut Vec<String>) {
        if *count >= max || depth == 0 { return; }
        if let Ok(entries) = std::fs::read_dir(dir) {
            let mut entries: Vec<_> = entries.filter_map(|e| e.ok()).collect();
            entries.sort_by_key(|e| e.path());
            for entry in entries {
                *count += 1;
                if *count >= max { return; }
                let path = entry.path();
                let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("?");
                // Skip hidden and common non-code directories
                if name.starts_with('.') || ["node_modules", "target", "dist", "build"].contains(&name) {
                    continue;
                }
                if path.is_dir() {
                    results.push(format!("{}{}/", prefix, name));
                    walk(&path, format!("{}  ", prefix), depth - 1, max, count, results);
                } else {
                    results.push(format!("{}{}", prefix, name));
                }
            }
        }
    }
    
    let mut count = 0;
    results.push(format!("{}/", work_dir.file_name().and_then(|n| n.to_str()).unwrap_or("workspace")));
    walk(&work_dir, "  ".to_string(), depth, max_files, &mut count, &mut results);
    Ok(results.join("\n"))
}

fn execute_check_project(input: &serde_json::Value, work_dir: Option<&Path>) -> Result<String> {
    let work_dir = work_dir.ok_or_else(|| AppError::Unknown("缺少工作区目录".to_string()))?;
    let check_type = input.get("type").and_then(|v| v.as_str()).unwrap_or("auto");
    
    // Detect project type and run appropriate check
    let cargo_toml = work_dir.join("Cargo.toml");
    let package_json = work_dir.join("package.json");
    let tsconfig = work_dir.join("tsconfig.json");
    
    let output = if check_type == "cargo" || (check_type == "auto" && cargo_toml.exists()) {
        Command::new("cargo")
            .args(["check", "--message-format=short"])
            .current_dir(work_dir)
            .output()
            .map_err(|e| AppError::Unknown(format!("cargo check 失败: {}", e)))?
    } else if check_type == "tsc" || (check_type == "auto" && tsconfig.exists()) {
        Command::new("npx")
            .args(["tsc", "--noEmit", "--pretty"])
            .current_dir(work_dir)
            .output()
            .map_err(|e| AppError::Unknown(format!("tsc 失败: {}", e)))?
    } else if check_type == "npm" || (check_type == "auto" && package_json.exists()) {
        // Try common npm scripts for checking
        let npm_result = Command::new("npm")
            .args(["run", "--silent", "lint"])
            .current_dir(work_dir)
            .output();
        
        match npm_result {
            Ok(output) => output,
            Err(_) => {
                // Try check script
                let check_result = Command::new("npm")
                    .args(["run", "--silent", "check"])
                    .current_dir(work_dir)
                    .output();
                match check_result {
                    Ok(output) => output,
                    Err(_) => {
                        // Try build script as fallback
                        match Command::new("npm")
                            .args(["run", "--silent", "build"])
                            .current_dir(work_dir)
                            .output()
                        {
                            Ok(output) => output,
                            Err(_) => return Ok("No lint/check/build script found in package.json".to_string()),
                        }
                    }
                }
            }
        }
    } else {
        return Ok("No recognized project type found for diagnostics".to_string());
    };
    
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let combined = format!("{}\n{}", stdout, stderr).trim().to_string();
    
    if combined.is_empty() {
        Ok("No diagnostics found".to_string())
    } else {
        Ok(combined)
    }
}

fn execute_edit_file(input: &serde_json::Value, work_dir: Option<&Path>) -> Result<String> {
    let path = input
        .get("path")
        .and_then(|value| value.as_str())
        .ok_or_else(|| AppError::Unknown("edit_file 缺少 path".to_string()))?;
    let old_string = input
        .get("old_string")
        .and_then(|value| value.as_str())
        .ok_or_else(|| AppError::Unknown("edit_file 缺少 old_string".to_string()))?;
    let new_string = input
        .get("new_string")
        .and_then(|value| value.as_str())
        .ok_or_else(|| AppError::Unknown("edit_file 缺少 new_string".to_string()))?;
    let full_path = resolve_workspace_path(work_dir, path, false)?;
    
    let content = std::fs::read_to_string(&full_path)
        .map_err(|error| AppError::Unknown(format!("读取文件失败: {}", error)))?;
    
    // Count occurrences
    let count = content.matches(old_string).count();
    if count == 0 {
        return Err(AppError::Unknown("未找到要替换的内容".to_string()));
    }
    if count > 1 {
        return Err(AppError::Unknown(format!("找到 {} 处匹配，old_string 必须唯一", count)));
    }
    
    let new_content = content.replace(old_string, new_string);
    std::fs::write(&full_path, &new_content)
        .map_err(|error| AppError::Unknown(format!("写入文件失败: {}", error)))?;
    
    Ok(format!("Successfully edited {}", path))
}

fn execute_write_file(input: &serde_json::Value, work_dir: Option<&Path>) -> Result<String> {
    let path = input
        .get("path")
        .and_then(|value| value.as_str())
        .ok_or_else(|| AppError::Unknown("write_file 缺少 path".to_string()))?;
    let content = input
        .get("content")
        .and_then(|value| value.as_str())
        .ok_or_else(|| AppError::Unknown("write_file 缺少 content".to_string()))?;
    let full_path = resolve_workspace_path(work_dir, path, false)?;
    
    // Create parent directories if needed
    if let Some(parent) = full_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| AppError::Unknown(format!("创建目录失败: {}", error)))?;
    }
    
    std::fs::write(&full_path, content)
        .map_err(|error| AppError::Unknown(format!("写入文件失败: {}", error)))?;
    
    Ok(format!("Successfully wrote {}", path))
}

fn execute_run_build(input: &serde_json::Value, work_dir: Option<&Path>) -> Result<String> {
    let work_dir = work_dir.ok_or_else(|| AppError::Unknown("缺少工作区目录".to_string()))?;
    let build_type = input.get("type").and_then(|v| v.as_str()).unwrap_or("auto");
    let release = input.get("release").and_then(|v| v.as_bool()).unwrap_or(false);
    
    let cargo_toml = work_dir.join("Cargo.toml");
    let package_json = work_dir.join("package.json");
    
    let output = if build_type == "cargo" || (build_type == "auto" && cargo_toml.exists()) {
        let mut args = vec!["build"];
        if release {
            args.push("--release");
        }
        Command::new("cargo")
            .args(&args)
            .current_dir(work_dir)
            .output()
            .map_err(|e| AppError::Unknown(format!("cargo build 失败: {}", e)))?
    } else if build_type == "npm" || (build_type == "auto" && package_json.exists()) {
        Command::new("npm")
            .args(["run", "build"])
            .current_dir(work_dir)
            .output()
            .map_err(|e| AppError::Unknown(format!("npm build 失败: {}", e)))?
    } else {
        return Err(AppError::Unknown("无法确定构建类型".to_string()));
    };
    
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let combined = format!("{}\n{}", stdout, stderr).trim().to_string();
    
    Ok(combined)
}

// ========== TodoWrite 和 Plan Mode 工具 ==========

fn execute_todo_write(input: &serde_json::Value, _work_dir: Option<&Path>) -> Result<String> {
    let todos = input
        .get("todos")
        .and_then(|v| v.as_array())
        .ok_or_else(|| AppError::Unknown("todo_write 缺少 todos".to_string()))?;
    
    // 验证每个 todo 项
    for todo in todos {
        let id = todo.get("id").and_then(|v| v.as_str())
            .ok_or_else(|| AppError::Unknown("todo 项缺少 id".to_string()))?;
        let content = todo.get("content").and_then(|v| v.as_str())
            .ok_or_else(|| AppError::Unknown("todo 项缺少 content".to_string()))?;
        let status = todo.get("status").and_then(|v| v.as_str()).unwrap_or("pending");
        
        if !["pending", "in_progress", "completed"].contains(&status) {
            return Err(AppError::Unknown(format!("无效的 todo 状态: {}", status)));
        }
        if content.trim().is_empty() {
            return Err(AppError::Unknown(format!("todo {} 内容不能为空", id)));
        }
    }
    
    // 返回成功信息，实际状态更新由 runtime 处理
    Ok(json!({
        "success": true,
        "count": todos.len(),
        "message": format!("已更新 {} 个任务项", todos.len())
    }).to_string())
}

fn execute_enter_plan_mode(_input: &serde_json::Value, _work_dir: Option<&Path>) -> Result<String> {
    Ok(json!({
        "success": true,
        "mode": "plan",
        "message": "已进入规划模式。请输出完整的执行计划，用户确认后才会执行。"
    }).to_string())
}

fn execute_set_plan(input: &serde_json::Value, _work_dir: Option<&Path>) -> Result<String> {
    let plan = input
        .get("plan")
        .and_then(|v| v.as_str())
        .ok_or_else(|| AppError::Unknown("set_plan 缺少 plan".to_string()))?;
    
    if plan.trim().is_empty() {
        return Err(AppError::Unknown("计划内容不能为空".to_string()));
    }
    
    Ok(json!({
        "success": true,
        "plan": plan,
        "message": "计划已设置，等待用户确认后执行。"
    }).to_string())
}

const TOOL_REGISTRY: &[ToolRegistryEntry] = &[
    // 低风险默认开放工具
    ToolRegistryEntry {
        spec: ToolSpec {
            name: "read_file",
            description: "Read a file inside the workspace",
        },
        policy: ToolExecutionPolicy::Allow,
        executor: execute_read_file,
    },
    ToolRegistryEntry {
        spec: ToolSpec {
            name: "read_file_range",
            description: "Read a range of lines from a file",
        },
        policy: ToolExecutionPolicy::Allow,
        executor: execute_read_file_range,
    },
    ToolRegistryEntry {
        spec: ToolSpec {
            name: "glob_files",
            description: "Find files matching a glob pattern in the workspace",
        },
        policy: ToolExecutionPolicy::Allow,
        executor: execute_glob_files,
    },
    ToolRegistryEntry {
        spec: ToolSpec {
            name: "search_in_files",
            description: "Search for text in workspace files",
        },
        policy: ToolExecutionPolicy::Allow,
        executor: execute_search_in_files,
    },
    ToolRegistryEntry {
        spec: ToolSpec {
            name: "get_diagnostics",
            description: "Get diagnostics/errors for workspace files",
        },
        policy: ToolExecutionPolicy::Allow,
        executor: execute_get_diagnostics,
    },
    ToolRegistryEntry {
        spec: ToolSpec {
            name: "git_status",
            description: "Show git working tree status",
        },
        policy: ToolExecutionPolicy::Allow,
        executor: execute_git_status,
    },
    ToolRegistryEntry {
        spec: ToolSpec {
            name: "git_diff",
            description: "Show git diff for files in the workspace",
        },
        policy: ToolExecutionPolicy::Allow,
        executor: execute_git_diff,
    },
    // 受控工具
    ToolRegistryEntry {
        spec: ToolSpec {
            name: "bash",
            description: "Run an approved shell command",
        },
        policy: ToolExecutionPolicy::RequireApproval,
        executor: execute_bash,
    },
    ToolRegistryEntry {
        spec: ToolSpec {
            name: "apply_patch",
            description: "Apply text patches to a file",
        },
        policy: ToolExecutionPolicy::RequireApproval,
        executor: execute_apply_patch,
    },
    ToolRegistryEntry {
        spec: ToolSpec {
            name: "run_tests",
            description: "Run tests in the workspace (cargo test or npm test)",
        },
        policy: ToolExecutionPolicy::RequireApproval,
        executor: execute_run_tests,
    },
    // 工程开发/debug 增强工具
    ToolRegistryEntry {
        spec: ToolSpec {
            name: "grep",
            description: "Search using regex with context lines and file filtering",
        },
        policy: ToolExecutionPolicy::Allow,
        executor: execute_grep,
    },
    ToolRegistryEntry {
        spec: ToolSpec {
            name: "list_tree",
            description: "List directory tree structure for understanding project layout",
        },
        policy: ToolExecutionPolicy::Allow,
        executor: execute_list_tree,
    },
    ToolRegistryEntry {
        spec: ToolSpec {
            name: "check_project",
            description: "Run project diagnostics (cargo check, tsc, npm lint)",
        },
        policy: ToolExecutionPolicy::Allow,
        executor: execute_check_project,
    },
    ToolRegistryEntry {
        spec: ToolSpec {
            name: "edit_file",
            description: "Edit a file by replacing a unique string (requires approval)",
        },
        policy: ToolExecutionPolicy::RequireApproval,
        executor: execute_edit_file,
    },
    ToolRegistryEntry {
        spec: ToolSpec {
            name: "write_file",
            description: "Write content to a file (requires approval)",
        },
        policy: ToolExecutionPolicy::RequireApproval,
        executor: execute_write_file,
    },
    ToolRegistryEntry {
        spec: ToolSpec {
            name: "run_build",
            description: "Build the project (cargo build or npm run build)",
        },
        policy: ToolExecutionPolicy::RequireApproval,
        executor: execute_run_build,
    },
    // TodoWrite 和 Plan Mode 工具
    ToolRegistryEntry {
        spec: ToolSpec {
            name: "todo_write",
            description: "Create and manage a task list for tracking progress on multi-step tasks",
        },
        policy: ToolExecutionPolicy::Allow,
        executor: execute_todo_write,
    },
    ToolRegistryEntry {
        spec: ToolSpec {
            name: "enter_plan_mode",
            description: "Enter plan mode - outputs a plan for user approval before execution",
        },
        policy: ToolExecutionPolicy::Allow,
        executor: execute_enter_plan_mode,
    },
    ToolRegistryEntry {
        spec: ToolSpec {
            name: "set_plan",
            description: "Set the execution plan in plan mode (awaits user confirmation)",
        },
        policy: ToolExecutionPolicy::Allow,
        executor: execute_set_plan,
    },
];


pub fn default_tool_specs() -> Vec<ToolSpec> {
    TOOL_REGISTRY.iter().map(|entry| entry.spec.clone()).collect()
}

pub fn default_model_visible_tool_names() -> &'static [&'static str] {
    &["read_file", "read_file_range", "glob_files", "grep", "list_tree", "check_project", "git_status", "git_diff", "todo_write", "enter_plan_mode", "set_plan"]
}

pub fn default_tool_definitions() -> Vec<ToolDefinition> {
    TOOL_REGISTRY
        .iter()
        .filter(|entry| default_model_visible_tool_names().contains(&entry.spec.name))
        .map(|entry| ToolDefinition {
            tool_type: "function".to_string(),
            function: ToolDefinitionFunction {
                name: entry.spec.name.to_string(),
                description: entry.spec.description.to_string(),
                parameters: tool_parameters_schema(entry.spec.name),
            },
        })
        .collect()
}

fn tool_parameters_schema(tool_name: &str) -> serde_json::Value {
    match tool_name {
        "read_file" => json!({
            "type": "object",
            "properties": {
                "path": { "type": "string", "description": "Path relative to the workspace root" }
            },
            "required": ["path"]
        }),
        "read_file_range" => json!({
            "type": "object",
            "properties": {
                "path": { "type": "string", "description": "Path relative to the workspace root" },
                "start_line": { "type": "integer", "description": "Start line number (1-based)" },
                "end_line": { "type": "integer", "description": "End line number (1-based)" }
            },
            "required": ["path", "start_line", "end_line"]
        }),
        "glob_files" => json!({
            "type": "object",
            "properties": {
                "pattern": { "type": "string", "description": "Glob pattern to match files" },
                "base_path": { "type": "string", "description": "Base directory to search from (optional)" }
            },
            "required": ["pattern"]
        }),
        "search_in_files" => json!({
            "type": "object",
            "properties": {
                "query": { "type": "string", "description": "Text to search for" },
                "max_results": { "type": "integer", "description": "Maximum number of results (default 50)" }
            },
            "required": ["query"]
        }),
        "get_diagnostics" => json!({
            "type": "object",
            "properties": {
                "paths": { "type": "array", "items": { "type": "string" }, "description": "File paths to check for diagnostics (optional)" }
            }
        }),
        "git_status" => json!({
            "type": "object",
            "properties": {}
        }),
        "git_diff" => json!({
            "type": "object",
            "properties": {
                "path": { "type": "string", "description": "File path to show diff for (optional)" }
            }
        }),
        "bash" => json!({
            "type": "object",
            "properties": {
                "command": { "type": "string", "description": "Shell command to run inside the workspace" }
            },
            "required": ["command"]
        }),
        "apply_patch" => json!({
            "type": "object",
            "properties": {
                "path": { "type": "string", "description": "Path to the file to modify" },
                "edits": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "old_text": { "type": "string", "description": "Text to replace" },
                            "new_text": { "type": "string", "description": "Replacement text" }
                        },
                        "required": ["old_text", "new_text"]
                    }
                }
            },
            "required": ["path", "edits"]
        }),
        "run_tests" => json!({
            "type": "object",
            "properties": {
                "target": { "type": "string", "description": "Test target: 'cargo' or 'npm' (auto-detected if not specified)" }
            }
        }),
        "grep" => json!({
            "type": "object",
            "properties": {
                "pattern": { "type": "string", "description": "Regex pattern to search for" },
                "path": { "type": "string", "description": "Glob pattern for files to search (default: **/*)" },
                "i": { "type": "boolean", "description": "Case insensitive search (default: false)" },
                "C": { "type": "integer", "description": "Context lines around matches (default: 0)" },
                "head_limit": { "type": "integer", "description": "Maximum number of results (default: 100)" }
            },
            "required": ["pattern"]
        }),
        "list_tree" => json!({
            "type": "object",
            "properties": {
                "depth": { "type": "integer", "description": "Maximum depth to traverse (default: 3)" },
                "max_files": { "type": "integer", "description": "Maximum number of files to list (default: 200)" }
            }
        }),
        "check_project" => json!({
            "type": "object",
            "properties": {
                "type": { "type": "string", "description": "Check type: 'cargo', 'tsc', 'npm', or 'auto' (default: auto)" }
            }
        }),
        "edit_file" => json!({
            "type": "object",
            "properties": {
                "path": { "type": "string", "description": "Path to the file to edit" },
                "old_string": { "type": "string", "description": "Text to replace (must be unique in file)" },
                "new_string": { "type": "string", "description": "Replacement text" }
            },
            "required": ["path", "old_string", "new_string"]
        }),
        "write_file" => json!({
            "type": "object",
            "properties": {
                "path": { "type": "string", "description": "Path to the file to write" },
                "content": { "type": "string", "description": "Content to write to the file" }
            },
            "required": ["path", "content"]
        }),
        "run_build" => json!({
            "type": "object",
            "properties": {
                "type": { "type": "string", "description": "Build type: 'cargo' or 'npm' (auto-detected if not specified)" },
                "release": { "type": "boolean", "description": "Build in release mode (default: false)" }
            }
        }),
        "todo_write" => json!({
            "type": "object",
            "properties": {
                "todos": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "id": { "type": "string", "description": "Unique identifier for the todo item" },
                            "content": { "type": "string", "description": "Task description" },
                            "status": { "type": "string", "enum": ["pending", "in_progress", "completed"], "description": "Current status" }
                        },
                        "required": ["id", "content"]
                    }
                }
            },
            "required": ["todos"]
        }),
        "enter_plan_mode" => json!({
            "type": "object",
            "properties": {}
        }),
        "set_plan" => json!({
            "type": "object",
            "properties": {
                "plan": { "type": "string", "description": "The execution plan to present for user approval" }
            },
            "required": ["plan"]
        }),
        _ => json!({
            "type": "object",
            "properties": {}
        }),
    }
}

pub fn find_tool(tool_name: &str) -> Option<&'static ToolRegistryEntry> {
    TOOL_REGISTRY.iter().find(|entry| entry.spec.name == tool_name)
}

pub fn execute_tool(
    tool_name: &str,
    input: &serde_json::Value,
    work_dir: Option<&Path>,
) -> Result<String> {
    let entry = find_tool(tool_name)
        .ok_or_else(|| AppError::Unknown(format!("未支持的工具: {}", tool_name)))?;
    (entry.executor)(input, work_dir)
}

#[cfg(test)]
mod tests {
    use super::{
        default_model_visible_tool_names, default_tool_definitions, default_tool_specs, find_tool,
        resolve_workspace_path, ToolExecutionPolicy,
    };
    use std::fs;

    #[test]
    fn resolve_workspace_path_rejects_parent_traversal() {
        let temp = tempfile::tempdir().unwrap();
        let workspace = temp.path().join("workspace");
        fs::create_dir_all(&workspace).unwrap();

        let result = resolve_workspace_path(Some(&workspace), "../secret.txt", false);

        assert!(result.is_err());
    }

    #[test]
    fn resolve_workspace_path_rejects_absolute_path_outside_workspace() {
        let temp = tempfile::tempdir().unwrap();
        let workspace = temp.path().join("workspace");
        let outside = temp.path().join("outside.txt");
        fs::create_dir_all(&workspace).unwrap();
        fs::write(&outside, "secret").unwrap();

        let result = resolve_workspace_path(Some(&workspace), outside.to_str().unwrap(), false);

        assert!(result.is_err());
    }

    #[test]
    fn resolve_workspace_path_accepts_existing_file_inside_workspace() {
        let temp = tempfile::tempdir().unwrap();
        let workspace = temp.path().join("workspace");
        let file = workspace.join("src").join("main.rs");
        fs::create_dir_all(file.parent().unwrap()).unwrap();
        fs::write(&file, "fn main() {}").unwrap();

        let result = resolve_workspace_path(Some(&workspace), "src/main.rs", false).unwrap();

        assert!(result.starts_with(workspace.canonicalize().unwrap()));
    }

    #[test]
    fn resolve_workspace_path_accepts_missing_leaf_inside_workspace() {
        let temp = tempfile::tempdir().unwrap();
        let workspace = temp.path().join("workspace");
        let src = workspace.join("src");
        fs::create_dir_all(&src).unwrap();

        let result = resolve_workspace_path(Some(&workspace), "src/new.rs", true).unwrap();

        assert!(result.starts_with(src.canonicalize().unwrap()));
        assert_eq!(result.file_name().unwrap(), "new.rs");
    }

    #[test]
    fn resolve_workspace_path_rejects_missing_leaf_outside_workspace() {
        let temp = tempfile::tempdir().unwrap();
        let workspace = temp.path().join("workspace");
        let outside = temp.path().join("outside");
        fs::create_dir_all(&workspace).unwrap();
        fs::create_dir_all(&outside).unwrap();
        let outside_file = outside.join("new.rs");

        let result = resolve_workspace_path(Some(&workspace), outside_file.to_str().unwrap(), true);

        assert!(result.is_err());
    }

    #[test]
    fn registry_exposes_builtin_tools() {
        let specs = default_tool_specs();
        // 低风险工具: read_file, read_file_range, glob_files, grep, list_tree, check_project, git_status, git_diff (8)
        // 受控工具: bash, apply_patch, run_tests, edit_file, write_file, run_build (6)
        // TodoWrite 和 Plan Mode: todo_write, enter_plan_mode, set_plan (3)
        // 遗留工具: search_in_files, get_diagnostics (2) - 保留兼容
        assert_eq!(specs.len(), 19);
        // 低风险工具
        assert!(specs.iter().any(|spec| spec.name == "read_file"));
        assert!(specs.iter().any(|spec| spec.name == "read_file_range"));
        assert!(specs.iter().any(|spec| spec.name == "glob_files"));
        assert!(specs.iter().any(|spec| spec.name == "grep"));
        assert!(specs.iter().any(|spec| spec.name == "list_tree"));
        assert!(specs.iter().any(|spec| spec.name == "check_project"));
        assert!(specs.iter().any(|spec| spec.name == "git_status"));
        assert!(specs.iter().any(|spec| spec.name == "git_diff"));
        // TodoWrite 和 Plan Mode
        assert!(specs.iter().any(|spec| spec.name == "todo_write"));
        assert!(specs.iter().any(|spec| spec.name == "enter_plan_mode"));
        assert!(specs.iter().any(|spec| spec.name == "set_plan"));
        // 受控工具
        assert!(specs.iter().any(|spec| spec.name == "bash"));
        assert!(specs.iter().any(|spec| spec.name == "apply_patch"));
        assert!(specs.iter().any(|spec| spec.name == "run_tests"));
        assert!(specs.iter().any(|spec| spec.name == "edit_file"));
        assert!(specs.iter().any(|spec| spec.name == "write_file"));
        assert!(specs.iter().any(|spec| spec.name == "run_build"));
    }

    #[test]
    fn controlled_tools_require_approval() {
        let bash = find_tool("bash").expect("bash should exist");
        assert_eq!(bash.policy, ToolExecutionPolicy::RequireApproval);
        let apply_patch = find_tool("apply_patch").expect("apply_patch should exist");
        assert_eq!(apply_patch.policy, ToolExecutionPolicy::RequireApproval);
        let run_tests = find_tool("run_tests").expect("run_tests should exist");
        assert_eq!(run_tests.policy, ToolExecutionPolicy::RequireApproval);
        let edit_file = find_tool("edit_file").expect("edit_file should exist");
        assert_eq!(edit_file.policy, ToolExecutionPolicy::RequireApproval);
        let write_file = find_tool("write_file").expect("write_file should exist");
        assert_eq!(write_file.policy, ToolExecutionPolicy::RequireApproval);
        let run_build = find_tool("run_build").expect("run_build should exist");
        assert_eq!(run_build.policy, ToolExecutionPolicy::RequireApproval);
        // 低风险工具默认开放
        let read_file = find_tool("read_file").expect("read_file should exist");
        assert_eq!(read_file.policy, ToolExecutionPolicy::Allow);
        let grep = find_tool("grep").expect("grep should exist");
        assert_eq!(grep.policy, ToolExecutionPolicy::Allow);
        let check_project = find_tool("check_project").expect("check_project should exist");
        assert_eq!(check_project.policy, ToolExecutionPolicy::Allow);
    }

    #[test]
    fn tool_definitions_only_expose_low_risk_tools() {
        let definitions = default_tool_definitions();
        assert_eq!(definitions.len(), 11);
        assert!(definitions.iter().all(|tool| tool.tool_type == "function"));
        // 受控工具不暴露给模型
        assert!(definitions.iter().all(|tool| tool.function.name != "bash"));
        assert!(definitions.iter().all(|tool| tool.function.name != "apply_patch"));
        assert!(definitions.iter().all(|tool| tool.function.name != "run_tests"));
        assert!(definitions.iter().all(|tool| tool.function.name != "edit_file"));
        assert!(definitions.iter().all(|tool| tool.function.name != "write_file"));
        assert!(definitions.iter().all(|tool| tool.function.name != "run_build"));
        // 低风险工具应该存在
        let read_file = definitions
            .iter()
            .find(|tool| tool.function.name == "read_file")
            .expect("read_file tool definition should exist");
        let grep = definitions
            .iter()
            .find(|tool| tool.function.name == "grep")
            .expect("grep tool definition should exist");
        let check_project = definitions
            .iter()
            .find(|tool| tool.function.name == "check_project")
            .expect("check_project tool definition should exist");
        let todo_write = definitions
            .iter()
            .find(|tool| tool.function.name == "todo_write")
            .expect("todo_write tool definition should exist");
        let enter_plan_mode = definitions
            .iter()
            .find(|tool| tool.function.name == "enter_plan_mode")
            .expect("enter_plan_mode tool definition should exist");

        assert!(read_file.function.parameters.get("properties").is_some());
        assert!(grep.function.parameters.get("properties").is_some());
        assert!(check_project.function.parameters.get("properties").is_some());
        assert!(todo_write.function.parameters.get("properties").is_some());
        assert!(enter_plan_mode.function.parameters.get("properties").is_some());
    }

    #[test]
    fn model_visible_tool_names_match_low_risk_definitions() {
        let names = default_model_visible_tool_names();
        let definitions = default_tool_definitions();

        assert_eq!(names.len(), definitions.len());
        assert!(definitions
            .iter()
            .all(|tool| names.contains(&tool.function.name.as_str())));
        assert!(names.contains(&"read_file"));
        assert!(names.contains(&"glob_files"));
        assert!(names.contains(&"grep"));
        assert!(names.contains(&"list_tree"));
        assert!(names.contains(&"check_project"));
        assert!(names.contains(&"git_status"));
        assert!(names.contains(&"git_diff"));
        assert!(names.contains(&"todo_write"));
        assert!(names.contains(&"enter_plan_mode"));
        assert!(names.contains(&"set_plan"));
        // 受控工具不可见
        assert!(!names.contains(&"bash"));
        assert!(!names.contains(&"apply_patch"));
        assert!(!names.contains(&"run_tests"));
        assert!(!names.contains(&"edit_file"));
        assert!(!names.contains(&"write_file"));
        assert!(!names.contains(&"run_build"));
    }
}
