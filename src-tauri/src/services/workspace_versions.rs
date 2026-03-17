use crate::error::{AppError, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use uuid::Uuid;

const APP_DATA_DIR_NAME: &str = "claude-code-pro";
const WORKSPACE_VERSIONS_DIR_NAME: &str = "workspace_versions";
const VERSION_META_FILE_NAME: &str = "meta.json";
const VERSION_SNAPSHOT_DIR_NAME: &str = "snapshot";

const DEFAULT_IGNORED_TOP_LEVEL_DIRS: [&str; 6] = [
    ".git",
    "node_modules",
    "target",
    "dist",
    ".next",
    ".turbo",
];

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum WorkspaceVersionKind {
    Auto,
    Manual,
}

impl WorkspaceVersionKind {
    fn default_label(&self) -> &'static str {
        match self {
            WorkspaceVersionKind::Auto => "AI 自动快照",
            WorkspaceVersionKind::Manual => "手动快照",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceVersion {
    pub id: String,
    pub workspace_id: String,
    pub workspace_path: String,
    pub label: String,
    pub kind: WorkspaceVersionKind,
    pub created_at: i64,
}

pub fn list_versions(workspace_path: &Path) -> Result<Vec<WorkspaceVersion>> {
    let workspace_id = workspace_id_for_path(workspace_path);
    let dir = workspace_versions_dir(&workspace_id)?;
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut versions = Vec::new();
    for entry in fs::read_dir(&dir)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let meta_path = path.join(VERSION_META_FILE_NAME);
        let content = fs::read_to_string(meta_path)?;
        let version: WorkspaceVersion = serde_json::from_str(&content)?;
        versions.push(version);
    }

    versions.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(versions)
}

pub fn create_version(
    workspace_path: &Path,
    label: Option<String>,
    kind: WorkspaceVersionKind,
) -> Result<WorkspaceVersion> {
    validate_workspace_path(workspace_path)?;

    let version_id = Uuid::new_v4().to_string();
    let created_at = Utc::now().timestamp_millis();
    let workspace_id = workspace_id_for_path(workspace_path);
    let label = normalize_label(label, kind.default_label());

    let version = WorkspaceVersion {
        id: version_id.clone(),
        workspace_id: workspace_id.clone(),
        workspace_path: workspace_path.to_string_lossy().to_string(),
        label,
        kind,
        created_at,
    };

    let version_root = workspace_versions_dir(&workspace_id)?.join(&version_id);
    let snapshot_dir = version_root.join(VERSION_SNAPSHOT_DIR_NAME);
    fs::create_dir_all(&snapshot_dir)?;

    copy_dir_filtered(workspace_path, &snapshot_dir, Path::new(""))?;
    write_version_meta(&version_root, &version)?;

    Ok(version)
}

pub fn restore_version(workspace_path: &Path, version_id: &str) -> Result<()> {
    validate_workspace_path(workspace_path)?;

    let workspace_id = workspace_id_for_path(workspace_path);
    let version_root = workspace_versions_dir(&workspace_id)?.join(version_id);
    let snapshot_dir = version_root.join(VERSION_SNAPSHOT_DIR_NAME);
    if !snapshot_dir.exists() {
        return Err(AppError::InvalidPath(format!(
            "版本快照不存在: {}",
            snapshot_dir.to_string_lossy()
        )));
    }

    let manifest = build_snapshot_manifest(&snapshot_dir)?;
    prune_workspace(workspace_path, &manifest)?;
    copy_dir_overwrite(&snapshot_dir, workspace_path)?;
    Ok(())
}

pub fn delete_version(workspace_path: &Path, version_id: &str) -> Result<()> {
    let workspace_id = workspace_id_for_path(workspace_path);
    let version_root = workspace_versions_dir(&workspace_id)?.join(version_id);
    if !version_root.exists() {
        return Ok(());
    }
    fs::remove_dir_all(version_root)?;
    Ok(())
}

fn validate_workspace_path(workspace_path: &Path) -> Result<()> {
    if !workspace_path.exists() {
        return Err(AppError::InvalidPath("工作区不存在".to_string()));
    }
    if !workspace_path.is_dir() {
        return Err(AppError::InvalidPath("工作区不是目录".to_string()));
    }
    Ok(())
}

fn normalize_label(label: Option<String>, default_label: &str) -> String {
    let Some(label) = label else {
        return default_label.to_string();
    };

    let trimmed = label.trim();
    if trimmed.is_empty() {
        return default_label.to_string();
    }

    trimmed.to_string()
}

fn versions_base_dir() -> Result<PathBuf> {
    let dir = dirs::data_local_dir()
        .ok_or_else(|| AppError::ConfigError("无法获取数据目录".to_string()))?
        .join(APP_DATA_DIR_NAME)
        .join(WORKSPACE_VERSIONS_DIR_NAME);
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

fn workspace_versions_dir(workspace_id: &str) -> Result<PathBuf> {
    Ok(versions_base_dir()?.join(workspace_id))
}

fn workspace_id_for_path(workspace_path: &Path) -> String {
    let normalized = workspace_path.to_string_lossy();
    Uuid::new_v5(&Uuid::NAMESPACE_URL, normalized.as_bytes()).to_string()
}

fn write_version_meta(version_root: &Path, version: &WorkspaceVersion) -> Result<()> {
    fs::create_dir_all(version_root)?;
    let content = serde_json::to_string_pretty(version)?;
    fs::write(version_root.join(VERSION_META_FILE_NAME), content)?;
    Ok(())
}

fn is_ignored_relative_path(relative: &Path) -> bool {
    let Some(component) = relative.components().next() else {
        return false;
    };

    let dir_name = component.as_os_str().to_string_lossy();
    DEFAULT_IGNORED_TOP_LEVEL_DIRS
        .iter()
        .any(|ignored| ignored.eq_ignore_ascii_case(dir_name.as_ref()))
}

fn copy_dir_filtered(src: &Path, dest: &Path, relative: &Path) -> Result<()> {
    fs::create_dir_all(dest)?;

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let file_name = entry.file_name();
        let next_relative = relative.join(&file_name);
        if is_ignored_relative_path(&next_relative) {
            continue;
        }

        let file_type = entry.file_type()?;
        let src_path = entry.path();
        let dest_path = dest.join(&file_name);

        if file_type.is_dir() {
            copy_dir_filtered(&src_path, &dest_path, &next_relative)?;
            continue;
        }

        if file_type.is_file() || file_type.is_symlink() {
            fs::copy(&src_path, &dest_path)?;
        }
    }

    Ok(())
}

fn copy_dir_overwrite(src: &Path, dest: &Path) -> Result<()> {
    fs::create_dir_all(dest)?;

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let file_name = entry.file_name();

        let file_type = entry.file_type()?;
        let src_path = entry.path();
        let dest_path = dest.join(&file_name);

        if file_type.is_dir() {
            copy_dir_overwrite(&src_path, &dest_path)?;
            continue;
        }

        if file_type.is_file() || file_type.is_symlink() {
            fs::copy(&src_path, &dest_path)?;
        }
    }

    Ok(())
}

fn build_snapshot_manifest(snapshot_dir: &Path) -> Result<HashSet<PathBuf>> {
    let mut manifest = HashSet::new();
    build_manifest_recursive(snapshot_dir, Path::new(""), &mut manifest)?;
    Ok(manifest)
}

fn build_manifest_recursive(current: &Path, relative: &Path, manifest: &mut HashSet<PathBuf>) -> Result<()> {
    for entry in fs::read_dir(current)? {
        let entry = entry?;
        let file_name = entry.file_name();
        let next_relative = relative.join(&file_name);
        manifest.insert(next_relative.clone());

        if entry.file_type()?.is_dir() {
            build_manifest_recursive(&entry.path(), &next_relative, manifest)?;
        }
    }

    Ok(())
}

fn prune_workspace(workspace_path: &Path, manifest: &HashSet<PathBuf>) -> Result<()> {
    prune_workspace_recursive(workspace_path, Path::new(""), manifest)
}

fn prune_workspace_recursive(current: &Path, relative: &Path, manifest: &HashSet<PathBuf>) -> Result<()> {
    for entry in fs::read_dir(current)? {
        let entry = entry?;
        let file_name = entry.file_name();
        let next_relative = relative.join(&file_name);

        if is_ignored_relative_path(&next_relative) {
            continue;
        }

        let path = entry.path();
        let file_type = entry.file_type()?;

        if !manifest.contains(&next_relative) {
            remove_any(&path, file_type.is_dir())?;
            continue;
        }

        if file_type.is_dir() {
            prune_workspace_recursive(&path, &next_relative, manifest)?;
        }
    }

    Ok(())
}

fn remove_any(path: &Path, is_dir: bool) -> Result<()> {
    if is_dir {
        fs::remove_dir_all(path)?;
        return Ok(());
    }

    fs::remove_file(path)?;
    Ok(())
}
