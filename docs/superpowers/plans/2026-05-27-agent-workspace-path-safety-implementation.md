# Agent Workspace Path Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Constrain built-in Agent file-oriented tools to the active workspace and block path traversal or outside absolute paths.

**Architecture:** Add one private resolver in the Rust Agent tool registry and route all tool path inputs through it. Keep the existing tool schema and approval policies unchanged; only tighten filesystem boundary checks and add focused unit tests.

**Tech Stack:** Rust, Tauri command/service layer, serde_json, std::fs/path, existing `AppError`/`Result` types.

---

## File Structure

- Modify: `src-tauri/src/services/agent_tool_registry.rs`
  - Add private workspace path helpers near the top of the file.
  - Replace direct `work_dir.join(path)` usages in Agent tools with the resolver.
  - Add unit tests in the existing `#[cfg(test)] mod tests` block.
- No frontend files should change.
- No public tool schema should change.

---

### Task 1: Add workspace resolver tests

**Files:**
- Modify: `src-tauri/src/services/agent_tool_registry.rs`

- [ ] **Step 1: Import filesystem helpers in the test module**

In `src-tauri/src/services/agent_tool_registry.rs`, update the `#[cfg(test)] mod tests` imports from:

```rust
    use super::{
        default_model_visible_tool_names, default_tool_definitions, default_tool_specs, find_tool,
        ToolExecutionPolicy,
    };
```

To:

```rust
    use super::{
        default_model_visible_tool_names, default_tool_definitions, default_tool_specs, find_tool,
        resolve_workspace_path, ToolExecutionPolicy,
    };
    use std::fs;
```

- [ ] **Step 2: Add failing resolver tests**

Add these tests before `registry_exposes_builtin_tools`:

```rust
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

        assert_eq!(result, src.join("new.rs"));
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
```

- [ ] **Step 3: Run tests to verify they fail before implementation**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml agent_tool_registry::tests::resolve_workspace_path -- --nocapture
```

Expected: compile failure because `resolve_workspace_path` is not defined or not imported yet.

- [ ] **Step 4: Commit only if tests were added and fail for the expected reason**

Do not commit a compile-failing state if this plan is being implemented directly on `main`. If using an isolated worktree/branch, commit with:

```bash
git add src-tauri/src/services/agent_tool_registry.rs
git commit -m "test: cover agent workspace path resolver"
```

---

### Task 2: Implement shared workspace resolver

**Files:**
- Modify: `src-tauri/src/services/agent_tool_registry.rs:1-29`

- [ ] **Step 1: Update top-level imports**

Change:

```rust
use std::path::Path;
```

To:

```rust
use std::path::{Path, PathBuf};
```

- [ ] **Step 2: Add resolver helpers after `ToolRegistryEntry`**

Insert this code after the `ToolRegistryEntry` struct:

```rust
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
```

- [ ] **Step 3: Run resolver tests**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml agent_tool_registry::tests::resolve_workspace_path -- --nocapture
```

Expected: the five resolver tests pass.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/services/agent_tool_registry.rs
git commit -m "fix: add agent workspace path resolver"
```

---

### Task 3: Route read/search/list/diff tools through the resolver

**Files:**
- Modify: `src-tauri/src/services/agent_tool_registry.rs:29-184`
- Modify: `src-tauri/src/services/agent_tool_registry.rs:282-380`

- [ ] **Step 1: Update `execute_read_file`**

Replace:

```rust
    let work_dir = work_dir.ok_or_else(|| AppError::Unknown("缺少工作区目录".to_string()))?;
    let full_path = work_dir.join(path);
```

With:

```rust
    let full_path = resolve_workspace_path(work_dir, path, false)?;
```

- [ ] **Step 2: Update `execute_read_file_range`**

Replace:

```rust
    let work_dir = work_dir.ok_or_else(|| AppError::Unknown("缺少工作区目录".to_string()))?;
    let full_path = work_dir.join(path);
```

With:

```rust
    let full_path = resolve_workspace_path(work_dir, path, false)?;
```

- [ ] **Step 3: Update `execute_glob_files` base path handling**

Replace:

```rust
    let work_dir = work_dir.ok_or_else(|| AppError::Unknown("缺少工作区目录".to_string()))?;
    let base_path = input
        .get("base_path")
        .and_then(|value| value.as_str())
        .map(|p| work_dir.join(p))
        .unwrap_or_else(|| work_dir.to_path_buf());
```

With:

```rust
    let base_path = if let Some(base_path) = input.get("base_path").and_then(|value| value.as_str()) {
        resolve_workspace_path(work_dir, base_path, false)?
    } else {
        canonicalize_workspace(work_dir)?
    };
```

- [ ] **Step 4: Update `execute_search_in_files` to validate optional base path**

Replace:

```rust
    let work_dir = work_dir.ok_or_else(|| AppError::Unknown("缺少工作区目录".to_string()))?;
    let max_results = input
```

With:

```rust
    let base_path = if let Some(base_path) = input.get("base_path").and_then(|value| value.as_str()) {
        resolve_workspace_path(work_dir, base_path, false)?
    } else {
        canonicalize_workspace(work_dir)?
    };
    let max_results = input
```

Then replace:

```rust
    walk_dir(work_dir, query, &mut results, max_results);
```

With:

```rust
    walk_dir(&base_path, query, &mut results, max_results);
```

- [ ] **Step 5: Update `execute_get_diagnostics` path checks**

Replace the block:

```rust
    let work_dir = work_dir.ok_or_else(|| AppError::Unknown("缺少工作区目录".to_string()))?;
    let paths = input.get("paths").and_then(|v| v.as_array());
```

With:

```rust
    let paths = input.get("paths").and_then(|v| v.as_array());
```

Then replace:

```rust
                let full_path = work_dir.join(path_str);
                if !full_path.exists() {
```

With:

```rust
                if resolve_workspace_path(work_dir, path_str, false).is_err() {
```

- [ ] **Step 6: Update `execute_git_diff` optional path**

Replace:

```rust
    let work_dir = work_dir.ok_or_else(|| AppError::Unknown("缺少工作区目录".to_string()))?;
    let path = input.get("path").and_then(|value| value.as_str());
```

With:

```rust
    let work_dir = canonicalize_workspace(work_dir)?;
    let path = input.get("path").and_then(|value| value.as_str());
```

Replace:

```rust
    if let Some(p) = path {
        cmd.arg("--").arg(p);
    }
```

With:

```rust
    if let Some(p) = path {
        let full_path = resolve_workspace_path(Some(&work_dir), p, false)?;
        let relative_path = full_path
            .strip_prefix(&work_dir)
            .map_err(|_| AppError::InvalidPath("目标路径超出工作区".to_string()))?;
        cmd.arg("--").arg(relative_path);
    }
```

- [ ] **Step 7: Update `execute_grep` to validate optional path**

After `let work_dir = ...` replace the whole work_dir/path_glob setup:

```rust
    let work_dir = work_dir.ok_or_else(|| AppError::Unknown("缺少工作区目录".to_string()))?;
    let path_glob = input.get("path").and_then(|v| v.as_str()).unwrap_or("**/*");
```

With:

```rust
    let base_path = canonicalize_workspace(work_dir)?;
    let path_glob = input.get("path").and_then(|v| v.as_str()).unwrap_or("**/*");
    if !path_glob.contains('*') {
        let _ = resolve_workspace_path(work_dir, path_glob, false)?;
    }
```

Then replace:

```rust
    walk_dir(work_dir, path_glob, &re, context_lines, max_results, &mut results);
```

With:

```rust
    walk_dir(&base_path, path_glob, &re, context_lines, max_results, &mut results);
```

- [ ] **Step 8: Update `execute_list_tree` to use canonical workspace**

Replace:

```rust
    let work_dir = work_dir.ok_or_else(|| AppError::Unknown("缺少工作区目录".to_string()))?;
```

With:

```rust
    let work_dir = canonicalize_workspace(work_dir)?;
```

- [ ] **Step 9: Run Rust tests**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml agent_tool_registry -- --nocapture
```

Expected: all `agent_tool_registry` tests pass.

- [ ] **Step 10: Commit**

```bash
git add src-tauri/src/services/agent_tool_registry.rs
git commit -m "fix: constrain agent read tools to workspace"
```

---

### Task 4: Route write/edit/patch tools through the resolver

**Files:**
- Modify: `src-tauri/src/services/agent_tool_registry.rs:207-233`
- Modify: `src-tauri/src/services/agent_tool_registry.rs:450-507`

- [ ] **Step 1: Update `execute_apply_patch`**

Replace:

```rust
    let work_dir = work_dir.ok_or_else(|| AppError::Unknown("缺少工作区目录".to_string()))?;
    let full_path = work_dir.join(path);
```

With:

```rust
    let full_path = resolve_workspace_path(work_dir, path, false)?;
```

- [ ] **Step 2: Update `execute_edit_file`**

Replace:

```rust
    let work_dir = work_dir.ok_or_else(|| AppError::Unknown("缺少工作区目录".to_string()))?;
    let full_path = work_dir.join(path);
```

With:

```rust
    let full_path = resolve_workspace_path(work_dir, path, false)?;
```

- [ ] **Step 3: Update `execute_write_file`**

Replace:

```rust
    let work_dir = work_dir.ok_or_else(|| AppError::Unknown("缺少工作区目录".to_string()))?;
    let full_path = work_dir.join(path);
```

With:

```rust
    let full_path = resolve_workspace_path(work_dir, path, true)?;
```

- [ ] **Step 4: Keep parent creation after boundary validation**

Verify `execute_write_file` still creates parent directories after `resolve_workspace_path(...)`. The block should remain:

```rust
    if let Some(parent) = full_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|error| AppError::Unknown(format!("创建目录失败: {}", error)))?;
    }
```

- [ ] **Step 5: Add executor-level safety tests**

Add these tests near the resolver tests:

```rust
    #[test]
    fn read_file_tool_rejects_parent_traversal() {
        let temp = tempfile::tempdir().unwrap();
        let workspace = temp.path().join("workspace");
        fs::create_dir_all(&workspace).unwrap();
        let input = serde_json::json!({ "path": "../secret.txt" });

        let result = super::execute_tool("read_file", &input, Some(&workspace));

        assert!(result.is_err());
    }

    #[test]
    fn write_file_tool_rejects_absolute_path_outside_workspace() {
        let temp = tempfile::tempdir().unwrap();
        let workspace = temp.path().join("workspace");
        let outside = temp.path().join("outside.txt");
        fs::create_dir_all(&workspace).unwrap();
        let input = serde_json::json!({
            "path": outside.to_str().unwrap(),
            "content": "secret"
        });

        let result = super::execute_tool("write_file", &input, Some(&workspace));

        assert!(result.is_err());
        assert!(!outside.exists());
    }
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml agent_tool_registry::tests -- --nocapture
```

Expected: all agent tool registry tests pass.

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/services/agent_tool_registry.rs
git commit -m "fix: constrain agent write tools to workspace"
```

---

### Task 5: Run full verification

**Files:**
- No code changes expected unless verification exposes a compile/test issue.

- [ ] **Step 1: Run Rust tests**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: all Rust tests pass. Existing dead-code warnings may remain.

- [ ] **Step 2: Run frontend build**

Run:

```bash
npm run build
```

Expected: TypeScript and Vite build pass. Existing large chunk warnings may remain.

- [ ] **Step 3: Inspect git diff**

Run:

```bash
git diff -- src-tauri/src/services/agent_tool_registry.rs
```

Expected: diff is limited to resolver helpers, path resolver adoption, and related tests.

- [ ] **Step 4: Commit verification fixes if any were required**

If Step 1 or Step 2 required code changes, commit them:

```bash
git add src-tauri/src/services/agent_tool_registry.rs
git commit -m "fix: complete agent path safety verification"
```

If no code changes were needed, do not create an empty commit.

---

## Self-Review

- Spec coverage: the plan adds a shared resolver, blocks parent traversal and outside absolute paths, applies it to read/search/list/diff/edit/write/patch paths, and adds Rust tests.
- Placeholder scan: no `TBD`, `TODO`, or unspecified implementation steps remain.
- Type consistency: helper signatures use `Option<&Path>` and `PathBuf`, matching the existing `ToolRegistryEntry` executor type.
