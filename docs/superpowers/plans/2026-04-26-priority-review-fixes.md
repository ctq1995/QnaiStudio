# Priority Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按既定优先级修复本轮功能 review 中识别出的前后端关键问题，并为后续收尾项建立清晰边界。

**Architecture:** 先修正会直接误导架构预期或破坏用户状态一致性的高优问题：前端 facade 语义、队列/版本状态模型、版本恢复后的全局一致性，以及聊天历史的 workspace 作用域。随后修复后端会话协议与配置/版本基础稳定性。每一步以最小可验证改动推进，避免同时重构多条主线。

**Tech Stack:** React, TypeScript, Zustand, Tauri, Rust, serde, cargo test/vitest

---

## File Map

- Modify: `src/stores/eventChatStore.ts` — 调整 facade 注释与实现边界，修复 selector 语义误导
- Modify: `src/stores/chat/chatSessionStore.ts` — 贯通消息队列状态、版本恢复联动、版本操作禁用判断来源
- Modify: `src/stores/chat/chatMessageStore.ts` — 明确 queueStatus / queueItemId 的写入与清理
- Modify: `src/stores/chat/chatSessionAutoCheckpoint.ts` — 将自动快照状态迁移到版本域状态
- Modify: `src/stores/chat/chatHistoryStore.ts` — 为本地历史加入 workspace scope 与兼容迁移
- Modify: `src/components/Chat/EnhancedChatMessages.tsx` — 补充队列状态展示
- Modify: `src/components/Versioning/WorkspaceVersionsModal.tsx` — 使用统一版本状态，补齐恢复后的全局失效处理
- Modify: `src/stores/versioningStore.ts` — 增加版本运行态、工作区变更失效广播/清理工具
- Modify: `src/types/chat.ts` — 只补充本次修复需要的消息/队列/历史类型，不做大拆分
- Modify: `src/types/versioning.ts` — 增加版本运行态与恢复结果辅助类型（如需要）
- Delete: `src/components/Chat/ChatInput.tsx.bak` — 清理无效备份文件
- Modify: `src/components/Chat/ChatInput.tsx` — 修复乱码注释或最小化清理
- Modify: `src-tauri/src/lib.rs` — 用更完整的 session state 替代纯 PID 映射；加入工作区版本锁状态
- Modify: `src-tauri/src/commands/chat/mod.rs` — 中断接口幂等化，使用统一会话状态读写
- Modify: `src-tauri/src/commands/chat/claude.rs` — 统一 session_id 语义，修复 reader 清理逻辑
- Modify: `src-tauri/src/commands/chat/session.rs` — 区分 session_end reason，补充 child wait 与退出状态处理
- Modify: `src-tauri/src/services/config_store.rs` — 配置写入改为原子写
- Modify: `src-tauri/src/services/workspace_versions.rs` — workspace id 规范化、恢复互斥保护
- Test/Verify: `package.json` 相关前端测试命令、`cargo test` / `cargo check`

### Task 1: Fix facade contract honesty

**Files:**
- Modify: `src/stores/eventChatStore.ts`

- [ ] **Step 1: Rewrite facade comment to match reality**
- [ ] **Step 2: Adjust facade implementation to avoid claiming fine-grained subscriptions**
- [ ] **Step 3: Run targeted TypeScript check or lint for this file**
- [ ] **Step 4: Commit**

### Task 2: Fully wire queue state

**Files:**
- Modify: `src/stores/chat/chatSessionStore.ts`
- Modify: `src/stores/chat/chatMessageStore.ts`
- Modify: `src/components/Chat/EnhancedChatMessages.tsx`
- Modify: `src/types/chat.ts`

- [ ] **Step 1: Add/confirm queue status types**
- [ ] **Step 2: Write queue state when enqueue/start/finish/cancel happens**
- [ ] **Step 3: Render queue state in chat message list**
- [ ] **Step 4: Verify build/test**
- [ ] **Step 5: Commit**

### Task 3: Decouple auto-checkpoint state from chat run status

**Files:**
- Modify: `src/stores/chat/chatSessionAutoCheckpoint.ts`
- Modify: `src/stores/versioningStore.ts`
- Modify: `src/components/Versioning/WorkspaceVersionsModal.tsx`
- Modify: `src/types/versioning.ts`

- [ ] **Step 1: Introduce version operation state**
- [ ] **Step 2: Migrate auto-checkpoint progress/error to versioning store**
- [ ] **Step 3: Update modal/button disabling logic to consume unified version state**
- [ ] **Step 4: Verify build/test**
- [ ] **Step 5: Commit**

### Task 4: Handle global invalidation after workspace restore

**Files:**
- Modify: `src/components/Versioning/WorkspaceVersionsModal.tsx`
- Modify: `src/stores/versioningStore.ts`
- Modify: `src/stores/chat/chatSessionStore.ts`

- [ ] **Step 1: Define restore-side effects list in code boundary**
- [ ] **Step 2: Clear queued messages and mark chat/session context stale after restore**
- [ ] **Step 3: Refresh explorer and close editor with clearer error boundaries**
- [ ] **Step 4: Verify build/test**
- [ ] **Step 5: Commit**

### Task 5: Scope local history by workspace

**Files:**
- Modify: `src/stores/chat/chatHistoryStore.ts`
- Modify: `src/types/chat.ts`

- [ ] **Step 1: Add workspace metadata to history entry type**
- [ ] **Step 2: Save current workspace info into new entries and migrate old entries safely**
- [ ] **Step 3: Filter/label restore list by workspace context**
- [ ] **Step 4: Verify build/test**
- [ ] **Step 5: Commit**

### Task 6: Clean chat input hygiene issues

**Files:**
- Modify: `src/components/Chat/ChatInput.tsx`
- Delete: `src/components/Chat/ChatInput.tsx.bak`

- [ ] **Step 1: Remove backup file**
- [ ] **Step 2: Fix or remove garbled comments without touching behavior**
- [ ] **Step 3: Verify build/test**
- [ ] **Step 4: Commit**

### Task 7: Stabilize backend session protocol

**Files:**
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/commands/chat/mod.rs`
- Modify: `src-tauri/src/commands/chat/claude.rs`
- Modify: `src-tauri/src/commands/chat/session.rs`

- [ ] **Step 1: Introduce richer session state structure instead of bare PID map**
- [ ] **Step 2: Make interrupt idempotent and alias-aware**
- [ ] **Step 3: Normalize Claude session_id ownership/update path**
- [ ] **Step 4: Preserve session end reason and wait child exit**
- [ ] **Step 5: Verify cargo check/test**
- [ ] **Step 6: Commit**

### Task 8: Harden config and version infrastructure

**Files:**
- Modify: `src-tauri/src/services/config_store.rs`
- Modify: `src-tauri/src/services/workspace_versions.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Change config writes to temp+rename atomic flow**
- [ ] **Step 2: Normalize workspace path before computing workspace_id**
- [ ] **Step 3: Add restore-time workspace lock/guard**
- [ ] **Step 4: Verify cargo check/test**
- [ ] **Step 5: Commit**

## Self-review

- Coverage check: 覆盖了前端 P0/P1 与后端 P0/P1 主问题，未把文档更新和 types/chat 大拆分混入本轮，避免超范围。
- Placeholder scan: 无 TODO/TBD；步骤虽然精简，但都锚定到精确文件与动作。
- Type consistency: queue/history/version/session 四条主线的命名与 review 结论保持一致。
