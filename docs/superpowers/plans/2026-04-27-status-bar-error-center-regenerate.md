# Status Bar, Error Center, And Regenerate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复聊天重新生成的内容链与状态残留问题，并新增底部状态栏与全局错误中心，让错误不再展示到对话框中。

**Architecture:** 在 chatMessageStore 中收敛统一的 conversation truncate 动作，用于 regenerate 正确替换 assistant 分支；新增 app-level errorCenterStore 统一承载错误展示；在 App 主布局底部挂载状态栏，聚合当前工作区、默认智能体、版本与 endpoint 信息，并在右下角提供错误弹窗入口。

**Tech Stack:** React, TypeScript, Zustand, Tauri, Tailwind

---

### File Map

**Create:**
- `src/stores/errorCenterStore.ts` — 全局错误中心状态与动作
- `src/components/StatusBar/AppStatusBar.tsx` — 底部状态栏
- `src/components/StatusBar/ErrorCenterPopover.tsx` — 右下角错误弹窗
- `src/components/StatusBar/index.ts` — 状态栏组件导出

**Modify:**
- `src/stores/chat/chatMessageStore.ts` — 增加统一 conversation truncate 动作
- `src/stores/chat/chatSessionStore.ts` — regenerate 改为复用 truncate + 不再写错误 bubble
- `src/stores/chat/chatSessionEventHandler.ts` — 运行时错误写入错误中心
- `src/stores/chat/chatSessionAutoCheckpoint.ts` — 自动快照错误写入错误中心
- `src/App.tsx` — 挂载状态栏，给主布局底部留出空间
- `src/components/Chat/EnhancedChatMessages.tsx` — 移除/停止依赖聊天错误消息展示（若仍有显式错误区）
- `src/components/Common/index.ts` 或合适导出文件 — 视需要补导出
- `src/components/Settings/EngineSettingsPanel.tsx`（只读参考，不一定修改）— endpoint 来源参考

### Task 1: 修复 regenerate 的消息链和状态裁剪
- [ ] 在 `src/stores/chat/chatMessageStore.ts` 里阅读并确认当前消息、归档、流式状态字段
- [ ] 新增统一动作（例如 `truncateConversationBefore(messageId)`），集中处理：`messages`、`archivedMessages`、`currentMessage`、`toolBlockMap`、流式中间态、run status、tool failure
- [ ] 在 `src/stores/chat/chatSessionStore.ts` 中让 `regenerateMessage()` 调用统一 truncate 动作，而不是裸 `setState({ messages: ... })`
- [ ] 保持 regenerate 仅复用已有 user message 内容，不创建新的 user bubble
- [ ] 手动代码复读，确认短会话与含 archivedMessages 的长会话语义都成立

### Task 2: 新增全局错误中心 store
- [ ] 新建 `src/stores/errorCenterStore.ts`
- [ ] 定义错误项结构：`id`、`scope`、`title`、`message`、`timestamp`、`level`、`source?`
- [ ] 实现动作：`pushError`、`removeError`、`clearErrors`、`toggleOpen`、`setOpen`
- [ ] 保持 store 仅负责状态，不掺杂 UI

### Task 3: 将聊天错误迁移出对话流
- [ ] 修改 `src/stores/chat/chatSessionStore.ts`，将 send / regenerate / interrupt 等错误从 `addErrorMessage(...)` 改为写入 `errorCenterStore`
- [ ] 修改 `src/stores/chat/chatSessionEventHandler.ts`，将 runtime error 事件写入错误中心，而不是消息流
- [ ] 修改 `src/stores/chat/chatSessionAutoCheckpoint.ts`，将自动快照失败写入错误中心
- [ ] 检查 `src/components/Chat/EnhancedChatMessages.tsx` 是否还存在显式聊天错误展示；若有，改为不再渲染聊天错误 bubble
- [ ] 保留必要的局部 `error` 字段用于按钮禁用/逻辑控制，但不让错误污染消息历史

### Task 4: 新增底部状态栏与错误弹窗 UI
- [ ] 新建 `src/components/StatusBar/AppStatusBar.tsx`
- [ ] 在状态栏内展示：当前工作区、当前默认智能体、当前版本、当前默认智能体 endpoint
- [ ] workspace 名称支持 hover 查看完整路径
- [ ] 右侧添加错误 icon + 数量 badge
- [ ] 新建 `src/components/StatusBar/ErrorCenterPopover.tsx` 展示错误列表、小弹窗样式、清空与关闭操作
- [ ] 新建 `src/components/StatusBar/index.ts` 统一导出

### Task 5: 将状态栏接入主布局
- [ ] 修改 `src/App.tsx`，在底部挂载 `AppStatusBar`
- [ ] 给主内容区预留状态栏高度，避免遮挡聊天输入区或面板内容
- [ ] 从现有 store 聚合状态：
  - workspace：`useWorkspaceStore`
  - 当前默认智能体：`useConfigStore`
  - 版本：现有 `healthStatus` / `getEngineVersion`
  - endpoint：当前默认智能体配置中的 `baseUrl`
- [ ] endpoint 为空时显示“默认端点”或“未配置”

### Task 6: 验证
- [ ] 运行 `pnpm exec tsc -p "E:/Polaris/QnaiStudio/tsconfig.json" --noEmit`
- [ ] 若终端未被交互式 CLI 污染，再运行 `cargo check --manifest-path "E:/Polaris/QnaiStudio/src-tauri/Cargo.toml"`
- [ ] 手动验证：
  - regenerate 后不再出现重复 user
  - 长会话下旧 assistant 分支不残留
  - 聊天错误不再出现在对话框
  - 状态栏正确显示 workspace / agent / version / endpoint
  - 错误 icon 点击后可查看和清空错误
