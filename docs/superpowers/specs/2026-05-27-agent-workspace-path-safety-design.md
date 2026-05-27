# Built-in Agent Workspace Path Safety Design Spec

## Overview

Harden the built-in Agent tool registry so all file-oriented tools are constrained to the active workspace. The current registry frequently joins user/model-provided paths with `work_dir` directly, which allows absolute paths or parent traversal to escape the workspace before read, search, diff, or controlled write operations run.

## Goals

- Add one shared path resolver inside the Rust Agent tool registry.
- Reject parent traversal components such as `..`.
- Reject absolute paths outside the active workspace.
- For existing targets, canonicalize and require the resolved path to remain inside the canonical workspace.
- For write targets that may not exist yet, canonicalize the parent directory and require it to remain inside the workspace.
- Apply the resolver to Agent registry tools that read, search, list, diff, edit, write, or patch paths.
- Add Rust tests for traversal, outside absolute paths, allowed existing workspace paths, and allowed missing leaf paths.

## Non-Goals

- Do not redesign the frontend.
- Do not change the visible tool schema unless required for safety.
- Do not remove or refactor old file explorer commands in this pass.
- Do not clean unrelated dead code.
- Do not alter approval policy for controlled tools.

## Target Area

Primary file:
- `src-tauri/src/services/agent_tool_registry.rs`

Existing safer implementation to mirror:
- `src-tauri/src/commands/secure_file_tools.rs`

## Design

### Shared resolver

Add private helpers near the top of `agent_tool_registry.rs`:

- `canonicalize_workspace(work_dir: Option<&Path>) -> Result<PathBuf>`
- `reject_parent_traversal(path: &Path) -> Result<()>`
- `resolve_workspace_path(work_dir: Option<&Path>, path: &str, allow_missing_leaf: bool) -> Result<PathBuf>`

The resolver behavior:

1. Require `work_dir` to exist and be a directory.
2. Reject any path containing `ParentDir` components.
3. If the requested path is relative, join it to the canonical workspace.
4. If the requested path is absolute, keep it but require canonical validation.
5. For existing paths, canonicalize the candidate and verify it starts with the canonical workspace.
6. For missing write targets, canonicalize the parent and verify the parent starts with the canonical workspace.

### Tool updates

Use the resolver for path inputs in these tool paths:

- `read_file`
- `read_file_range`
- `glob_files` base path
- `grep` / search base path
- `list_tree`
- `git_diff` optional path
- `apply_patch`
- `edit_file`
- `write_file`

Low-risk read/search tools should use `allow_missing_leaf = false`.
Controlled write/edit/patch tools should use `allow_missing_leaf = true` only when the operation may create the file.

### Error handling

Return `AppError::InvalidPath` for path boundary failures. Error messages should be clear but not expose extra filesystem details beyond the invalid reason.

### Tests

Add unit tests in `agent_tool_registry.rs` covering:

- Reject `../secret.txt`.
- Reject an absolute file outside the workspace.
- Accept an existing file inside the workspace.
- Accept a missing file inside an existing workspace subdirectory when `allow_missing_leaf = true`.
- Reject a missing file whose parent escapes the workspace.
- Verify at least one read tool and one write-capable resolver path enforce the helper.

## Success Criteria

- `cargo test --manifest-path src-tauri/Cargo.toml` passes.
- `npm run build` still passes.
- Agent tools cannot read, search, diff, edit, patch, or write paths outside the active workspace through absolute paths or `..` traversal.
- Controlled tool approval remains unchanged.
