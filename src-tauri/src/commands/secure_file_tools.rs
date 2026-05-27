use crate::error::{AppError, Result};
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

const MAX_FILE_SIZE_BYTES: u64 = 1024 * 1024;
const MAX_SEARCH_DEPTH: usize = 8;
const MAX_SEARCH_RESULTS: usize = 200;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolFileInfo {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolSearchMatch {
    pub path: String,
    pub line: usize,
    pub preview: String,
}

fn canonicalize_existing_workspace(workspace_dir: &str) -> Result<PathBuf> {
    let workspace = Path::new(workspace_dir)
        .canonicalize()
        .map_err(|_| AppError::InvalidPath("工作区路径不存在".to_string()))?;

    if !workspace.is_dir() {
        return Err(AppError::InvalidPath("工作区路径不是目录".to_string()));
    }

    Ok(workspace)
}

fn reject_parent_traversal(path: &Path) -> Result<()> {
    if path.components().any(|component| matches!(component, std::path::Component::ParentDir)) {
        return Err(AppError::InvalidPath("路径不能包含上级目录跳转".to_string()));
    }

    Ok(())
}

fn resolve_workspace_path(workspace_dir: &str, path: &str, allow_missing_leaf: bool) -> Result<PathBuf> {
    let workspace = canonicalize_existing_workspace(workspace_dir)?;
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

#[tauri::command]
pub async fn read_file(workspace_dir: String, path: String, start_line: Option<usize>, limit: Option<usize>) -> Result<String> {
    let target = resolve_workspace_path(&workspace_dir, &path, false)?;

    if target.is_dir() {
        return Err(AppError::InvalidPath("目标路径是目录".to_string()));
    }

    let metadata = fs::metadata(&target)?;
    if metadata.len() > MAX_FILE_SIZE_BYTES {
        return Err(AppError::InvalidPath("文件过大，超过1MB限制".to_string()));
    }

    let content = fs::read_to_string(&target)?;
    let start_line = start_line.unwrap_or(1).max(1);

    if limit.is_none() && start_line == 1 {
        return Ok(content);
    }

    let selected = content
        .lines()
        .skip(start_line - 1)
        .take(limit.unwrap_or(usize::MAX))
        .collect::<Vec<_>>()
        .join("\n");

    Ok(selected)
}

#[tauri::command]
pub async fn write_file(workspace_dir: String, path: String, content: String) -> Result<()> {
    let target = resolve_workspace_path(&workspace_dir, &path, true)?;

    if let Some(parent) = target.parent() {
        let workspace = canonicalize_existing_workspace(&workspace_dir)?;
        let canonical_parent = parent
            .canonicalize()
            .map_err(|_| AppError::InvalidPath("目标父目录不存在".to_string()))?;

        if !canonical_parent.starts_with(&workspace) {
            return Err(AppError::InvalidPath("目标路径超出工作区".to_string()));
        }
    }

    fs::write(target, content)?;
    Ok(())
}

#[tauri::command]
pub async fn list_directory(workspace_dir: String, path: String) -> Result<Vec<ToolFileInfo>> {
    let target = resolve_workspace_path(&workspace_dir, &path, false)?;

    if !target.is_dir() {
        return Err(AppError::InvalidPath("目标路径不是目录".to_string()));
    }

    let mut entries = Vec::new();
    for entry in fs::read_dir(&target)? {
        let entry = entry?;
        let path = entry.path();
        let metadata = entry.metadata()?;
        entries.push(ToolFileInfo {
            name: path.file_name().and_then(|name| name.to_str()).unwrap_or("").to_string(),
            path: path.to_string_lossy().to_string(),
            is_dir: metadata.is_dir(),
            size: if metadata.is_file() { Some(metadata.len()) } else { None },
        });
    }

    entries.sort_by(|a, b| match (a.is_dir, b.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.cmp(&b.name),
    });

    Ok(entries)
}

#[tauri::command]
pub async fn search_file_contents(workspace_dir: String, path: String, pattern: String) -> Result<Vec<ToolSearchMatch>> {
    if pattern.trim().is_empty() {
        return Ok(Vec::new());
    }

    let root = resolve_workspace_path(&workspace_dir, &path, false)?;
    let mut results = Vec::new();
    search_recursive(&root, &pattern.to_lowercase(), 0, &mut results)?;
    Ok(results)
}

fn search_recursive(current: &Path, pattern: &str, depth: usize, results: &mut Vec<ToolSearchMatch>) -> Result<()> {
    if depth > MAX_SEARCH_DEPTH || results.len() >= MAX_SEARCH_RESULTS {
        return Ok(());
    }

    if current.is_file() {
        search_file(current, pattern, results)?;
        return Ok(());
    }

    for entry in fs::read_dir(current)? {
        if results.len() >= MAX_SEARCH_RESULTS {
            break;
        }

        let entry = entry?;
        let path = entry.path();
        let name = path.file_name().and_then(|name| name.to_str()).unwrap_or("");
        if name.starts_with('.') || name == "node_modules" || name == "target" || name == "dist" {
            continue;
        }

        if path.is_dir() {
            search_recursive(&path, pattern, depth + 1, results)?;
        } else {
            search_file(&path, pattern, results)?;
        }
    }

    Ok(())
}

fn search_file(path: &Path, pattern: &str, results: &mut Vec<ToolSearchMatch>) -> Result<()> {
    if results.len() >= MAX_SEARCH_RESULTS {
        return Ok(());
    }

    let metadata = fs::metadata(path)?;
    if metadata.len() > MAX_FILE_SIZE_BYTES {
        return Ok(());
    }

    let Ok(content) = fs::read_to_string(path) else {
        return Ok(());
    };

    for (index, line) in content.lines().enumerate() {
        if results.len() >= MAX_SEARCH_RESULTS {
            break;
        }

        if line.to_lowercase().contains(pattern) {
            results.push(ToolSearchMatch {
                path: path.to_string_lossy().to_string(),
                line: index + 1,
                preview: line.trim().to_string(),
            });
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn resolve_workspace_path_rejects_parent_traversal() {
        let temp = tempfile::tempdir().unwrap();
        let workspace = temp.path().join("workspace");
        fs::create_dir_all(&workspace).unwrap();

        let result = resolve_workspace_path(workspace.to_str().unwrap(), "../secret.txt", false);

        assert!(result.is_err());
    }

    #[test]
    fn resolve_workspace_path_rejects_absolute_path_outside_workspace() {
        let temp = tempfile::tempdir().unwrap();
        let workspace = temp.path().join("workspace");
        let outside = temp.path().join("outside.txt");
        fs::create_dir_all(&workspace).unwrap();
        fs::write(&outside, "secret").unwrap();

        let result = resolve_workspace_path(workspace.to_str().unwrap(), outside.to_str().unwrap(), false);

        assert!(result.is_err());
    }

    #[test]
    fn resolve_workspace_path_accepts_existing_file_inside_workspace() {
        let temp = tempfile::tempdir().unwrap();
        let workspace = temp.path().join("workspace");
        let file = workspace.join("src").join("main.rs");
        fs::create_dir_all(file.parent().unwrap()).unwrap();
        fs::write(&file, "fn main() {}").unwrap();

        let result = resolve_workspace_path(workspace.to_str().unwrap(), "src/main.rs", false).unwrap();

        assert!(result.starts_with(workspace.canonicalize().unwrap()));
    }
}
