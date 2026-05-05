use crate::error::{AppError, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::fs;
use std::io::{BufReader, Read};
use std::path::{Path, PathBuf};
use uuid::Uuid;

const APP_DATA_DIR_NAME: &str = "claude-code-pro";
const WORKSPACE_VERSIONS_DIR_NAME: &str = "workspace_versions";
const VERSIONS_DIR_NAME: &str = "versions";
const OBJECTS_DIR_NAME: &str = "objects";
const RECOVERY_DIR_NAME: &str = "recovery";
const VERSION_MANIFEST_SUFFIX: &str = ".json";
const TEMP_MANIFEST_SUFFIX: &str = ".json.tmp";
const MAX_AUTO_VERSIONS: usize = 20;
const MAX_TOTAL_VERSIONS: usize = 60;
const MAX_OBJECT_STORE_BYTES: u64 = 2 * 1024 * 1024 * 1024;

const DEFAULT_IGNORED_TOP_LEVEL_DIRS: [&str; 11] = [
    ".git",
    "node_modules",
    "target",
    "dist",
    ".next",
    ".turbo",
    ".bitfun",
    ".tmp",
    "coverage",
    ".cache",
    ".idea",
];

const DEFAULT_IGNORED_TOP_LEVEL_FILES: [&str; 1] = ["Thumbs.db"];

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum WorkspaceVersionStatus {
    Ready,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceVersionFile {
    pub path: String,
    pub hash: String,
    pub size: u64,
    pub modified_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceVersionManifest {
    pub id: String,
    pub workspace_id: String,
    pub workspace_path: String,
    pub label: String,
    pub kind: WorkspaceVersionKind,
    pub created_at: i64,
    pub status: WorkspaceVersionStatus,
    pub file_count: usize,
    pub total_size: u64,
    pub files: Vec<WorkspaceVersionFile>,
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
    pub status: WorkspaceVersionStatus,
    pub file_count: usize,
    pub total_size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreWorkspaceVersionCheck {
    pub version_id: String,
    pub file_count: usize,
    pub total_size: u64,
    pub missing_objects: usize,
    pub has_backup_capacity: bool,
}

impl WorkspaceVersionManifest {
    fn to_summary(&self) -> WorkspaceVersion {
        WorkspaceVersion {
            id: self.id.clone(),
            workspace_id: self.workspace_id.clone(),
            workspace_path: self.workspace_path.clone(),
            label: self.label.clone(),
            kind: self.kind.clone(),
            created_at: self.created_at,
            status: self.status.clone(),
            file_count: self.file_count,
            total_size: self.total_size,
        }
    }
}

pub fn list_versions(workspace_path: &Path) -> Result<Vec<WorkspaceVersion>> {
    validate_workspace_path(workspace_path)?;
    let workspace_id = workspace_id_for_path(workspace_path);
    let dir = versions_dir(&workspace_id)?;
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut versions = Vec::new();
    for entry in fs::read_dir(&dir)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_file() || path.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }

        let manifest = read_manifest(&path)?;
        if manifest.status == WorkspaceVersionStatus::Ready {
            versions.push(manifest.to_summary());
        }
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

    let mut files = collect_workspace_files(workspace_path)?;
    files.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));

    let objects_root = objects_dir(&workspace_id)?;
    fs::create_dir_all(&objects_root)?;

    let mut manifest_files = Vec::with_capacity(files.len());
    let mut total_size = 0_u64;

    for file in files {
        let hash = hash_file(&file.absolute_path)?;
        ensure_object_present(&objects_root, &hash, &file.absolute_path)?;
        total_size = total_size.saturating_add(file.size);
        manifest_files.push(WorkspaceVersionFile {
            path: normalize_relative_string(&file.relative_path),
            hash,
            size: file.size,
            modified_at: file.modified_at,
        });
    }

    let manifest = WorkspaceVersionManifest {
        id: version_id.clone(),
        workspace_id: workspace_id.clone(),
        workspace_path: workspace_path.to_string_lossy().to_string(),
        label,
        kind,
        created_at,
        status: WorkspaceVersionStatus::Ready,
        file_count: manifest_files.len(),
        total_size,
        files: manifest_files,
    };

    write_manifest_atomic(&workspace_id, &manifest)?;
    cleanup_workspace_versions(&workspace_id)?;

    Ok(manifest.to_summary())
}

pub fn check_restore_version(workspace_path: &Path, version_id: &str) -> Result<RestoreWorkspaceVersionCheck> {
    validate_workspace_path(workspace_path)?;

    let workspace_id = workspace_id_for_path(workspace_path);
    let manifest = read_manifest(&manifest_path_for_version(&workspace_id, version_id)?)?;
    ensure_manifest_ready(&manifest)?;

    let missing_objects = count_missing_manifest_objects(&workspace_id, &manifest)?;
    let workspace_size = compute_workspace_size(workspace_path)?;
    let has_backup_capacity = manifest.total_size.saturating_add(workspace_size) <= MAX_OBJECT_STORE_BYTES;

    Ok(RestoreWorkspaceVersionCheck {
        version_id: version_id.to_string(),
        file_count: manifest.file_count,
        total_size: manifest.total_size,
        missing_objects,
        has_backup_capacity,
    })
}

pub fn restore_version(workspace_path: &Path, version_id: &str) -> Result<()> {
    validate_workspace_path(workspace_path)?;

    let workspace_id = workspace_id_for_path(workspace_path);
    let manifest = read_manifest(&manifest_path_for_version(&workspace_id, version_id)?)?;
    ensure_manifest_ready(&manifest)?;
    validate_manifest_objects(&workspace_id, &manifest)?;

    let recovery_root = recovery_dir(&workspace_id)?;
    if recovery_root.exists() {
        fs::remove_dir_all(&recovery_root)?;
    }
    fs::create_dir_all(&recovery_root)?;

    let staged_dir = recovery_root.join("staged");
    let backup_dir = recovery_root.join("backup");

    if staged_dir.exists() {
        fs::remove_dir_all(&staged_dir)?;
    }
    if backup_dir.exists() {
        fs::remove_dir_all(&backup_dir)?;
    }

    materialize_manifest_to_dir(&workspace_id, &manifest, &staged_dir)?;
    ensure_parent_exists(workspace_path)?;
    copy_workspace_to_backup(workspace_path, &backup_dir)?;

    let apply_result = apply_staged_workspace(workspace_path, &staged_dir);
    if let Err(error) = apply_result {
        let rollback_result = restore_backup_to_workspace(workspace_path, &backup_dir);
        if let Err(rollback_error) = rollback_result {
            return Err(AppError::Unknown(format!(
                "恢复版本失败，且回滚失败: {}; 回滚错误: {}",
                error, rollback_error
            )));
        }
        return Err(error);
    }

    fs::remove_dir_all(&recovery_root)?;
    Ok(())
}

pub fn delete_version(workspace_path: &Path, version_id: &str) -> Result<()> {
    let workspace_id = workspace_id_for_path(workspace_path);
    let manifest_path = manifest_path_for_version(&workspace_id, version_id)?;
    if !manifest_path.exists() {
        return Ok(());
    }
    fs::remove_file(manifest_path)?;
    cleanup_workspace_versions(&workspace_id)?;
    Ok(())
}

#[derive(Debug)]
struct WorkspaceFileEntry {
    absolute_path: PathBuf,
    relative_path: PathBuf,
    size: u64,
    modified_at: i64,
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

fn workspace_root_dir(workspace_id: &str) -> Result<PathBuf> {
    let dir = versions_base_dir()?.join(workspace_id);
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

fn versions_dir(workspace_id: &str) -> Result<PathBuf> {
    let dir = workspace_root_dir(workspace_id)?.join(VERSIONS_DIR_NAME);
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

fn objects_dir(workspace_id: &str) -> Result<PathBuf> {
    let dir = workspace_root_dir(workspace_id)?.join(OBJECTS_DIR_NAME);
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

fn recovery_dir(workspace_id: &str) -> Result<PathBuf> {
    Ok(workspace_root_dir(workspace_id)?.join(RECOVERY_DIR_NAME))
}

fn workspace_id_for_path(workspace_path: &Path) -> String {
    let normalized_path = fs::canonicalize(workspace_path).unwrap_or_else(|_| workspace_path.to_path_buf());
    let normalized = normalized_path.to_string_lossy().replace('\\', "/").to_lowercase();
    Uuid::new_v5(&Uuid::NAMESPACE_URL, normalized.as_bytes()).to_string()
}

fn manifest_path_for_version(workspace_id: &str, version_id: &str) -> Result<PathBuf> {
    Ok(versions_dir(workspace_id)?.join(format!("{}{}", version_id, VERSION_MANIFEST_SUFFIX)))
}

fn write_manifest_atomic(workspace_id: &str, manifest: &WorkspaceVersionManifest) -> Result<()> {
    let final_path = manifest_path_for_version(workspace_id, &manifest.id)?;
    let temp_path = versions_dir(workspace_id)?.join(format!("{}{}", manifest.id, TEMP_MANIFEST_SUFFIX));
    let content = serde_json::to_string_pretty(manifest)?;
    fs::write(&temp_path, content)?;
    fs::rename(temp_path, final_path)?;
    Ok(())
}

fn read_manifest(path: &Path) -> Result<WorkspaceVersionManifest> {
    let content = fs::read_to_string(path)?;
    Ok(serde_json::from_str(&content)?)
}

fn ensure_manifest_ready(manifest: &WorkspaceVersionManifest) -> Result<()> {
    if manifest.status != WorkspaceVersionStatus::Ready {
        return Err(AppError::Unknown("版本尚未完成，无法恢复".to_string()));
    }
    Ok(())
}

fn collect_workspace_files(workspace_path: &Path) -> Result<Vec<WorkspaceFileEntry>> {
    let mut files = Vec::new();
    collect_workspace_files_recursive(workspace_path, Path::new(""), &mut files)?;
    Ok(files)
}

fn collect_workspace_files_recursive(
    current: &Path,
    relative: &Path,
    files: &mut Vec<WorkspaceFileEntry>,
) -> Result<()> {
    for entry in fs::read_dir(current)? {
        let entry = entry?;
        let file_name = entry.file_name();
        let next_relative = relative.join(&file_name);
        if is_ignored_relative_path(&next_relative) {
            continue;
        }

        let file_type = entry.file_type()?;
        let path = entry.path();
        if file_type.is_dir() {
            collect_workspace_files_recursive(&path, &next_relative, files)?;
            continue;
        }

        if !file_type.is_file() {
            continue;
        }

        let metadata = entry.metadata()?;
        let modified_at = metadata
            .modified()
            .ok()
            .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|duration| duration.as_millis() as i64)
            .unwrap_or(0);

        files.push(WorkspaceFileEntry {
            absolute_path: path,
            relative_path: next_relative,
            size: metadata.len(),
            modified_at,
        });
    }

    Ok(())
}

fn is_ignored_relative_path(relative: &Path) -> bool {
    let Some(component) = relative.components().next() else {
        return false;
    };

    let name = component.as_os_str().to_string_lossy();
    DEFAULT_IGNORED_TOP_LEVEL_DIRS
        .iter()
        .any(|ignored| ignored.eq_ignore_ascii_case(name.as_ref()))
        || DEFAULT_IGNORED_TOP_LEVEL_FILES
            .iter()
            .any(|ignored| ignored.eq_ignore_ascii_case(name.as_ref()))
}

fn hash_file(path: &Path) -> Result<String> {
    let file = fs::File::open(path)?;
    let mut reader = BufReader::new(file);
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 8192];

    loop {
        let read = reader.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

fn object_path(objects_root: &Path, hash: &str) -> PathBuf {
    let prefix = &hash[..2];
    objects_root.join(prefix).join(hash)
}

fn ensure_object_present(objects_root: &Path, hash: &str, source_path: &Path) -> Result<()> {
    let object_path = object_path(objects_root, hash);
    if object_path.exists() {
        return Ok(());
    }

    let Some(parent) = object_path.parent() else {
        return Err(AppError::Unknown("对象存储路径无效".to_string()));
    };
    fs::create_dir_all(parent)?;
    let temp_path = object_path.with_extension("tmp");
    fs::copy(source_path, &temp_path)?;
    fs::rename(temp_path, object_path)?;
    Ok(())
}

fn validate_manifest_objects(workspace_id: &str, manifest: &WorkspaceVersionManifest) -> Result<()> {
    let objects_root = objects_dir(workspace_id)?;
    for file in &manifest.files {
        let path = object_path(&objects_root, &file.hash);
        if !path.exists() {
            return Err(AppError::Unknown(format!(
                "版本对象缺失: {} ({})",
                file.path, file.hash
            )));
        }
    }
    Ok(())
}

fn count_missing_manifest_objects(workspace_id: &str, manifest: &WorkspaceVersionManifest) -> Result<usize> {
    let objects_root = objects_dir(workspace_id)?;
    let mut missing = 0_usize;
    for file in &manifest.files {
        let path = object_path(&objects_root, &file.hash);
        if !path.exists() {
            missing += 1;
        }
    }
    Ok(missing)
}

fn materialize_manifest_to_dir(workspace_id: &str, manifest: &WorkspaceVersionManifest, dest: &Path) -> Result<()> {
    if dest.exists() {
        fs::remove_dir_all(dest)?;
    }
    fs::create_dir_all(dest)?;

    let objects_root = objects_dir(workspace_id)?;
    for file in &manifest.files {
        let object = object_path(&objects_root, &file.hash);
        let target = dest.join(Path::new(&file.path));
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::copy(object, target)?;
    }

    Ok(())
}

fn copy_workspace_to_backup(workspace_path: &Path, backup_dir: &Path) -> Result<()> {
    if backup_dir.exists() {
        fs::remove_dir_all(backup_dir)?;
    }
    fs::create_dir_all(backup_dir)?;
    copy_dir_filtered(workspace_path, backup_dir, Path::new(""))
}

fn restore_backup_to_workspace(workspace_path: &Path, backup_dir: &Path) -> Result<()> {
    apply_staged_workspace(workspace_path, backup_dir)
}

fn apply_staged_workspace(workspace_path: &Path, staged_dir: &Path) -> Result<()> {
    let manifest = build_relative_manifest(staged_dir)?;
    prune_workspace(workspace_path, &manifest)?;
    copy_dir_overwrite(staged_dir, workspace_path)?;
    Ok(())
}

fn build_relative_manifest(root: &Path) -> Result<HashSet<PathBuf>> {
    let mut manifest = HashSet::new();
    build_manifest_recursive(root, Path::new(""), &mut manifest)?;
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

        if file_type.is_file() {
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

        if file_type.is_file() {
            if let Some(parent) = dest_path.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::copy(&src_path, &dest_path)?;
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

fn ensure_parent_exists(path: &Path) -> Result<()> {
    let Some(parent) = path.parent() else {
        return Ok(());
    };
    fs::create_dir_all(parent)?;
    Ok(())
}

fn normalize_relative_string(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn cleanup_workspace_versions(workspace_id: &str) -> Result<()> {
    let mut manifests = list_manifest_files(workspace_id)?;
    manifests.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    let mut kept = Vec::new();
    let mut auto_kept = 0_usize;

    for manifest in manifests {
        let should_keep = if manifest.kind == WorkspaceVersionKind::Auto {
            if auto_kept >= MAX_AUTO_VERSIONS {
                false
            } else {
                auto_kept += 1;
                true
            }
        } else {
            true
        };

        if should_keep && kept.len() < MAX_TOTAL_VERSIONS {
            kept.push(manifest);
        } else {
            let path = manifest_path_for_version(workspace_id, &manifest.id)?;
            if path.exists() {
                fs::remove_file(path)?;
            }
        }
    }

    cleanup_unreferenced_objects(workspace_id)?;
    enforce_object_store_size_limit(workspace_id)
}

fn list_manifest_files(workspace_id: &str) -> Result<Vec<WorkspaceVersionManifest>> {
    let mut manifests = Vec::new();
    for entry in fs::read_dir(versions_dir(workspace_id)?)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_file() || path.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }
        manifests.push(read_manifest(&path)?);
    }
    Ok(manifests)
}

fn cleanup_unreferenced_objects(workspace_id: &str) -> Result<()> {
    let manifests = list_manifest_files(workspace_id)?;
    let mut referenced = HashSet::new();
    for manifest in manifests {
        for file in manifest.files {
            referenced.insert(file.hash);
        }
    }

    let objects_root = objects_dir(workspace_id)?;
    if !objects_root.exists() {
        return Ok(());
    }

    for prefix_entry in fs::read_dir(&objects_root)? {
        let prefix_entry = prefix_entry?;
        let prefix_path = prefix_entry.path();
        if !prefix_path.is_dir() {
            continue;
        }

        for object_entry in fs::read_dir(&prefix_path)? {
            let object_entry = object_entry?;
            let object_path = object_entry.path();
            if !object_path.is_file() {
                continue;
            }
            let Some(hash) = object_path.file_name().and_then(|value| value.to_str()) else {
                continue;
            };
            if !referenced.contains(hash) {
                fs::remove_file(object_path)?;
            }
        }

        if fs::read_dir(&prefix_path)?.next().is_none() {
            fs::remove_dir(prefix_path)?;
        }
    }

    Ok(())
}

fn enforce_object_store_size_limit(workspace_id: &str) -> Result<()> {
    let objects_root = objects_dir(workspace_id)?;
    let current_size = compute_dir_size(&objects_root)?;
    if current_size <= MAX_OBJECT_STORE_BYTES {
        return Ok(());
    }

    let mut manifests = list_manifest_files(workspace_id)?;
    manifests.sort_by(|a, b| a.created_at.cmp(&b.created_at));

    for manifest in manifests {
        if manifest.kind == WorkspaceVersionKind::Manual {
            continue;
        }

        let path = manifest_path_for_version(workspace_id, &manifest.id)?;
        if path.exists() {
            fs::remove_file(path)?;
        }
        cleanup_unreferenced_objects(workspace_id)?;

        if compute_dir_size(&objects_root)? <= MAX_OBJECT_STORE_BYTES {
            return Ok(());
        }
    }

    Ok(())
}

fn compute_dir_size(path: &Path) -> Result<u64> {
    if !path.exists() {
        return Ok(0);
    }

    let mut total = 0_u64;
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let entry_path = entry.path();
        let metadata = entry.metadata()?;
        if metadata.is_dir() {
            total = total.saturating_add(compute_dir_size(&entry_path)?);
        } else if metadata.is_file() {
            total = total.saturating_add(metadata.len());
        }
    }
    Ok(total)
}

fn compute_workspace_size(path: &Path) -> Result<u64> {
    let mut total = 0_u64;
    compute_workspace_size_recursive(path, Path::new(""), &mut total)?;
    Ok(total)
}

fn compute_workspace_size_recursive(current: &Path, relative: &Path, total: &mut u64) -> Result<()> {
    for entry in fs::read_dir(current)? {
        let entry = entry?;
        let file_name = entry.file_name();
        let next_relative = relative.join(&file_name);
        if is_ignored_relative_path(&next_relative) {
            continue;
        }

        let metadata = entry.metadata()?;
        if metadata.is_dir() {
            compute_workspace_size_recursive(&entry.path(), &next_relative, total)?;
        } else if metadata.is_file() {
            *total = total.saturating_add(metadata.len());
        }
    }
    Ok(())
}
