# Built-in Agent Engineering Tools Design Spec

## Overview

Enhance QnaiStudio built-in Agent from a minimal multi-round tool loop into a practical engineering agent by expanding safe codebase inspection tools and adding controlled execution tools.

## Goals

- Default-open low-risk engineering tools for file discovery, search, reading, diagnostics, and git inspection.
- Keep code mutation and test execution on the controlled path.
- Reuse the existing Rust agent runtime, tool registry, permission flow, and frontend tool-block UI.
- Improve built-in Agent task completion rate for debugging, code inspection, and guided code changes.

## Non-Goals

- No generic shell exposure to the model.
- No delete-file or destructive workspace operations.
- No browser automation, desktop automation, or network fetch tools.
- No credential discovery, secret scanning, or bulk harvesting features.

## Tool Scope

### Default-open tools
- `glob_files(pattern, base_path?)`
- `search_in_files(query, glob?, base_path?, max_results?)`
- `read_file(path)`
- `read_file_range(path, start_line, end_line)`
- `get_diagnostics(paths?)`
- `git_status()`
- `git_diff(path?)`

### Controlled tools
- `apply_patch(path, edits[])`
- `run_tests(target?)`

## Architecture

### Registry layer
Extend the existing Rust tool registry so each tool definition includes:
- stable tool name
- JSON input schema
- risk level / approval requirement
- model-visible default exposure
- executor binding

### Execution layer
The built-in Agent runtime continues to use the existing model -> tool -> model loop. New tools are executed inside Rust service boundaries rather than by exposing generic shell access.

### Service boundaries
- File search/read tools should reuse or wrap existing workspace/file search capabilities where possible.
- Diagnostics should reuse existing error/diagnostic collection services if available, otherwise add a narrow workspace diagnostic provider.
- Git inspection should use existing git context/diff services where possible.
- Controlled patch/test tools should remain approval-gated.

## Permission Model

Default-open only applies to the low-risk inspection tools listed above.

The following remain controlled:
- `apply_patch`
- `run_tests`
- any existing slash-command/bash path

## Frontend Impact

Reuse current tool UI:
- tool call blocks
- permission cards
- assistant inline status

Only add minimal labels/result summaries needed for new tools. No major UI redesign.

## Success Criteria

- Built-in Agent can inspect project structure and code with multiple search/read tools without permission prompts.
- Built-in Agent can inspect git status/diff and diagnostics as part of the same loop.
- Controlled tools still require approval.
- Existing frontend can display the new tool activity without protocol breakage.
- Rust tests and frontend build pass after integration.
