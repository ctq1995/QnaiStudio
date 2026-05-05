use crate::error::{AppError, Result};
use crate::services::workspace_versions::{
    check_restore_version, create_version, delete_version, list_versions, restore_version,
    RestoreWorkspaceVersionCheck, WorkspaceVersion, WorkspaceVersionKind,
};
use std::path::PathBuf;

fn join_error_to_app_error(error: tokio::task::JoinError) -> AppError {
    AppError::Unknown(error.to_string())
}

#[tauri::command]
pub async fn list_workspace_versions(workspace_path: String) -> Result<Vec<WorkspaceVersion>> {
    let path = PathBuf::from(workspace_path);
    let versions = tokio::task::spawn_blocking(move || list_versions(&path))
        .await
        .map_err(join_error_to_app_error)??;
    Ok(versions)
}

#[tauri::command]
pub async fn create_workspace_version(
    workspace_path: String,
    label: Option<String>,
    kind: WorkspaceVersionKind,
) -> Result<WorkspaceVersion> {
    let path = PathBuf::from(workspace_path);
    let version = tokio::task::spawn_blocking(move || create_version(&path, label, kind))
        .await
        .map_err(join_error_to_app_error)??;
    Ok(version)
}

#[tauri::command]
pub async fn check_restore_workspace_version(
    workspace_path: String,
    version_id: String,
) -> Result<RestoreWorkspaceVersionCheck> {
    let path = PathBuf::from(workspace_path);
    let result = tokio::task::spawn_blocking(move || check_restore_version(&path, &version_id))
        .await
        .map_err(join_error_to_app_error)??;
    Ok(result)
}

#[tauri::command]
pub async fn restore_workspace_version(workspace_path: String, version_id: String) -> Result<()> {
    let path = PathBuf::from(workspace_path);
    tokio::task::spawn_blocking(move || restore_version(&path, &version_id))
        .await
        .map_err(join_error_to_app_error)??;
    Ok(())
}

#[tauri::command]
pub async fn delete_workspace_version(workspace_path: String, version_id: String) -> Result<()> {
    let path = PathBuf::from(workspace_path);
    tokio::task::spawn_blocking(move || delete_version(&path, &version_id))
        .await
        .map_err(join_error_to_app_error)??;
    Ok(())
}
