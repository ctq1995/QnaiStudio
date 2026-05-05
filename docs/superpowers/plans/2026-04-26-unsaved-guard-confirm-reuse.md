# Unsaved Guard And Confirm Reuse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为编辑器关闭与工作区版本恢复增加统一的未保存拦截，并复用一套通用确认弹窗，避免重复 UI 定义。

**Architecture:** 抽离一个通用 ConfirmDialog 组件，统一承载确认类交互；将“是否存在未保存内容”的判断与“放弃当前编辑”的动作集中到 fileEditorStore，通过薄 UI 接入已有的版本管理确认流与编辑器关闭入口。

**Tech Stack:** React, TypeScript, Zustand, Tauri, Tailwind

---

### File Map

**Create:**
- `src/components/Common/ConfirmDialog.tsx` — 通用确认弹窗组件

**Modify:**
- `src/components/Common/index.ts` — 导出通用确认弹窗
- `src/types/fileEditor.ts` — 增加未保存守卫相关 action 类型
- `src/stores/fileEditorStore.ts` — 集中未保存判断与放弃编辑动作
- `src/components/Versioning/WorkspaceVersionsModal.tsx` — 复用 ConfirmDialog，并在恢复前接入未保存拦截
- `src/components/Settings/SettingsModal.tsx` — 复用 ConfirmDialog，消除重复内联确认 UI
- `src/components/TopMenuBar/index.tsx` — 暂不改行为，可视情况后续复用 ConfirmDialog
- `src/components/Editor/EditorPanel.tsx` — 接入关闭前未保存确认

### Task 1: 抽离通用 ConfirmDialog
- [ ] 新建 `src/components/Common/ConfirmDialog.tsx`
- [ ] 支持 title / message / confirmText / cancelText / tone / onConfirm / onCancel
- [ ] 导出到 `src/components/Common/index.ts`
- [ ] 替换 `SettingsModal.tsx` 中 `ConfirmCloseDialog` 的内联实现

### Task 2: 在 fileEditorStore 集中未保存守卫逻辑
- [ ] 修改 `src/types/fileEditor.ts`，新增：`hasUnsavedChanges`、`discardCurrentFile`
- [ ] 修改 `src/stores/fileEditorStore.ts`，实现统一未保存判断
- [ ] 保持 store 不直接渲染 UI，仅暴露状态和动作

### Task 3: 编辑器关闭前接入确认
- [ ] 检查 `src/components/Editor/EditorPanel.tsx` 当前关闭入口
- [ ] 若存在未保存内容，使用通用 ConfirmDialog 确认
- [ ] 确认后调用 `discardCurrentFile`，取消则保持编辑器打开

### Task 4: 版本恢复前接入未保存拦截
- [ ] 修改 `src/components/Versioning/WorkspaceVersionsModal.tsx`
- [ ] 在原有恢复确认链路前增加“未保存文件”拦截
- [ ] 复用同一个 ConfirmDialog，不新增额外视觉定义
- [ ] 确认后放弃当前编辑，再继续版本恢复流程

### Task 5: 验证
- [ ] 运行 `pnpm exec tsc -p "E:/Polaris/QnaiStudio/tsconfig.json" --noEmit`
- [ ] 若涉及 Rust/Tauri 类型边界，再运行 `cargo check --manifest-path "E:/Polaris/QnaiStudio/src-tauri/Cargo.toml"`
- [ ] 手动检查：关闭已修改文件、恢复版本时存在未保存文件、取消确认时状态保持不变
