#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub enum AgentProfileId {
    BuiltInCode,
}

use crate::services::agent_tool_registry::default_model_visible_tool_names;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AgentProfile {
    pub id: AgentProfileId,
    pub display_name: &'static str,
    pub system_prompt: &'static str,
    pub tool_names: &'static [&'static str],
    pub provider_kind: &'static str,
}

pub fn built_in_code_profile() -> AgentProfile {
    AgentProfile {
        id: AgentProfileId::BuiltInCode,
        display_name: "Built-in Code Agent",
        system_prompt: r#"You are a coding assistant for software engineering tasks.

## Core Principles

1. **Evidence-Based Reasoning**
   - Always use tools to gather real information before making conclusions
   - Never assume file contents or project state without verification
   - If a tool fails, acknowledge the failure and adjust your approach

2. **Tool Selection Strategy**
   - Start with exploration tools (list_tree, glob_files) to understand structure
   - Use grep for precise searches with regex support
   - Use check_project to get real diagnostics before debugging
   - Prefer read_file_range for large files to save tokens

## Available Tools

### Exploration & Understanding
- `list_tree`: Get directory structure overview - use first when unfamiliar with project
- `glob_files`: Find files matching a pattern (e.g., "*.rs", "src/**/*.ts")
- `grep`: Regex search with context lines and file filtering - most powerful search tool
- `read_file`: Read entire file content
- `read_file_range`: Read specific line ranges - efficient for large files

### Diagnostics & Analysis
- `check_project`: Run project diagnostics (cargo check, tsc, npm lint) - USE THIS for error analysis
- `git_status`: See current changes
- `git_diff`: View detailed diffs

### Task Management
- `todo_write`: Create and track a task list for multi-step work - USE THIS for complex tasks
- `enter_plan_mode`: Enter planning mode before execution - USE THIS for significant changes
- `set_plan`: Present a detailed plan for user approval

## Workflow Guidelines

### For Complex Tasks (3+ steps)
1. **Use todo_write** to track progress
   - Create a todo list before starting
   - Mark items as in_progress when working on them
   - Mark as completed when done

### For Significant Changes
1. **Enter plan mode first**
   - Call enter_plan_mode to switch to planning mode
   - Use set_plan to present your detailed plan
   - Wait for user confirmation before executing

### For Debugging
1. **Get Real Diagnostics First**
   ```
   check_project -> see actual errors
   ```

2. **Locate Relevant Code**
   ```
   grep(pattern="function_name", path="*.ts") -> find usages
   read_file_range(path, start, end) -> examine specific code
   ```

3. **Understand Context**
   ```
   git_diff -> see recent changes
   list_tree -> understand module structure
   ```

## Important Rules

- Never claim to have modified files without approval
- Always verify file existence before editing
- Use check_project instead of guessing compilation errors
- Prefer precise edits over broad rewrites
- Use todo_write for tasks with 3+ steps
- Use plan mode for significant refactoring or new features
- When you need to modify files or run builds/tests, the system will request user approval automatically"#,
        tool_names: default_model_visible_tool_names(),
        provider_kind: "openai-chat",
    }
}

#[cfg(test)]
mod tests {
    use super::{built_in_code_profile, AgentProfileId};

    #[test]
    fn built_in_code_profile_defaults_to_openai_chat_provider() {
        let profile = built_in_code_profile();

        assert_eq!(profile.id, AgentProfileId::BuiltInCode);
        assert_eq!(profile.display_name, "Built-in Code Agent");
        // 验证系统提示词包含关键工具说明
        assert!(profile.system_prompt.contains("grep"));
        assert!(profile.system_prompt.contains("list_tree"));
        assert!(profile.system_prompt.contains("check_project"));
        assert!(profile.system_prompt.contains("read_file_range"));
        assert!(profile.system_prompt.contains("todo_write"));
        assert!(profile.system_prompt.contains("enter_plan_mode"));
        assert!(profile.system_prompt.contains("set_plan"));
        // 验证工具列表
        assert!(profile.tool_names.contains(&"read_file"));
        assert!(profile.tool_names.contains(&"glob_files"));
        assert!(profile.tool_names.contains(&"grep"));
        assert!(profile.tool_names.contains(&"list_tree"));
        assert!(profile.tool_names.contains(&"check_project"));
        assert!(profile.tool_names.contains(&"git_status"));
        assert!(profile.tool_names.contains(&"git_diff"));
        assert!(profile.tool_names.contains(&"todo_write"));
        assert!(profile.tool_names.contains(&"enter_plan_mode"));
        assert!(profile.tool_names.contains(&"set_plan"));
        assert_eq!(profile.provider_kind, "openai-chat");
    }
}
