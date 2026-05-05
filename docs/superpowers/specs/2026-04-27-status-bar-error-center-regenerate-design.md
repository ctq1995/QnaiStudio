# Status Bar, Error Center, And Regenerate Design

**Goal:** 修复聊天“重新生成”导致的内容链与状态残留问题；在应用底部增加状态栏，展示当前工作区、当前智能体与版本、当前默认智能体的 API endpoint；在右下角增加错误中心入口，统一展示错误，不再把聊天错误插入对话流。

**Scope:**
- 修复 regenerate 的消息链与归档一致性
- 新增底部状态栏 UI
- 新增全局错误中心 store 与弹窗 UI
- 将聊天相关错误从 message bubble 迁移到错误中心

**Out of Scope:**
- success/info/warning 通知中心
- 多引擎 endpoint 同时展示
- 复杂错误筛选、搜索、分组
- 重做全局布局系统

---

## 1. Regenerate Behavior

### Current Problem
当前 `regenerateMessage()` 会保留原 user message，再走 `sendMessage()` 创建一条新的 user message，导致重复用户内容；同时仅裁剪 `messages`，未统一处理 `archivedMessages` 与流式状态，存在长会话残留风险。

### Design
在 `chatMessageStore` 中抽出统一的 conversation truncate 动作，例如 `truncateConversationBefore(messageId)`，负责：
- 按目标消息位置裁剪 `messages`
- 同步处理 `archivedMessages`
- 重置 `currentMessage`
- 清空 `toolBlockMap`
- 重置 token/streaming 相关中间态
- 清理 run status / tool failure 等依附状态

`regenerateMessage()` 只负责：
1. 找到目标 assistant 前最近的一条 user message
2. 调用 conversation truncate 动作
3. 复用已有 user message 内容重新派发请求
4. 不再创建新的 user bubble

### Expected Result
重新生成后链路从 `U1 -> A1` 变为 `U1 -> A2`，而不是 `U1 -> U2 -> A2`。

---

## 2. Bottom Status Bar

### Placement
在主应用布局底部增加一个固定高度状态栏，作为全局信息带，不侵入顶部菜单与聊天内容区。

### Display Fields
从左到右展示：
1. **Workspace** — 当前工作区名称；hover 可显示完整路径
2. **Agent** — 当前默认智能体标签（如 Claude Code / Codex CLI / Gemini / IFlow）
3. **Version** — 当前默认智能体版本号
4. **Endpoint** — 当前默认智能体的 API endpoint（仅单一当前智能体，不展示全部引擎）
5. **Error Center Trigger** — 右下角错误 icon，带数量 badge

### Endpoint Rule
只显示当前默认智能体对应的 endpoint：
- 若存在 `baseUrl`，显示其值
- 若为空，显示“默认端点”或“未配置”

---

## 3. Global Error Center

### Goal
把聊天错误从消息流中移出，统一在应用右下角错误中心查看，避免对话历史被错误提示污染。

### Store Design
新增 `errorCenterStore`，维护全局错误列表与弹窗开关状态。

Suggested item shape:
```ts
type AppErrorItem = {
  id: string;
  scope: 'chat' | 'workspace' | 'editor' | 'versioning' | 'engine' | 'system';
  title: string;
  message: string;
  timestamp: string;
  level: 'error' | 'warning';
  source?: string;
};
```

Suggested actions:
- `pushError(item)`
- `removeError(id)`
- `clearErrors()`
- `toggleOpen()`
- `setOpen(open)`

### UI Design
新增：
- `ErrorCenterButton` — 状态栏右侧错误 icon + 数量 badge
- `ErrorCenterPopover` — 小型浮层，展示错误列表

每条错误显示：
- title
- message
- timestamp
- scope

弹窗支持：
- clear all
- close
- optional remove single item

---

## 4. Error Routing Changes

### Current Problem
聊天错误当前通过 `addErrorMessage(...)` 被插入消息流，导致错误出现在对话框中，污染聊天历史。

### Design
将聊天错误改为写入错误中心，不再追加为 chat message。

Priority migration points:
- `chatSessionStore.ts`
  - send failure
  - regenerate failure
  - interrupt failure / no active session
- `chatSessionEventHandler.ts`
  - runtime error event
- `chatSessionAutoCheckpoint.ts`
  - auto checkpoint failure

Session store 仍可保留局部 `error` 字段用于逻辑控制，但不再把错误渲染为消息气泡。

---

## 5. Integration Notes

- 状态栏优先从现有 store 聚合数据，不新增不必要的中间 store
- 错误中心是新的 app-level domain，应避免与 chat message domain 混合
- regenerate 修复优先落在 store 层，不在 UI 层补丁式处理
- UI 尽量复用现有视觉 token，不再定义一套新的大弹窗体系

---

## 6. Validation

### Functional checks
1. 点击 regenerate 后，不再出现重复 user message
2. 长会话/归档存在时，旧 assistant 分支不会残留
3. 聊天错误不再出现在对话流中
4. 状态栏正确显示：workspace / agent / version / endpoint
5. 右下角错误 icon 在存在错误时显示数量
6. 点击错误 icon 后可查看全部错误并清空

### Build checks
- `pnpm exec tsc -p "E:/Polaris/QnaiStudio/tsconfig.json" --noEmit`
- 如涉及 Tauri 侧联动，再跑：
  - `cargo check --manifest-path "E:/Polaris/QnaiStudio/src-tauri/Cargo.toml"`
