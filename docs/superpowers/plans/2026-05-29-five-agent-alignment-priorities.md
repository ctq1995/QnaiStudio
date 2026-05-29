# Five Priority Agent Alignment Implementation Plans

## 1. Waitable Built-in Agent Runner

目标：实现一个 `executeAgentTask` runner，能够启动真实 AI 会话并等待会话完成，而不是把会话启动成功当作完成。

计划：

1. 新增服务层 waitable runner 模块。
2. 使用 `AIRuntimeService.sendMessage()` 启动真实会话。
3. 订阅 `EventBus` 的 `session_end` 和 `error` 事件。
4. 聚合同一 session 的消息/输出事件。
5. 会话完成后返回 `EngineeringAgentResult`。
6. 支持 timeout 和 cleanup，避免事件监听泄漏。

## 2. Raw Git Diff API

目标：提供 pipeline 需要的 raw diff，保留 `diff --git` header。

计划：

1. 在 TS Tauri service 中新增 `gitDiff()` wrapper。
2. 新增 `getRawGitDiff()` 服务函数。
3. 同时读取 unstaged 和 staged diff。
4. 合并 diff 输出。
5. 返回空字符串表示无变更。
6. 不用 status/stats 摘要替代 raw diff。

## 3. Controlled Verification Runner

目标：实现受控验证 runner，只执行调用方显式允许的命令。

计划：

1. 新增 verification runner factory。
2. 输入为显式命令列表，而不是自动猜测。
3. 默认不执行 shell，由调用方注入 command executor。
4. 收集 command、exitCode、stdout、stderr。
5. 映射为 `EngineeringVerificationResult`。
6. 保持后续可接权限 hook。

## 4. Model Review Runner

目标：实现模型 review runner 适配器。

计划：

1. 新增 review runner factory。
2. 输入为显式 model reviewer 函数。
3. 将 diff、verification、agent result 组合成 review request。
4. 映射为 `EngineeringReviewResult`。
5. 不伪造通过结果。
6. 保持 review finding 结构化。

## 5. RuntimeBridge Event Wiring Skeleton

目标：把已有 bridge event 协议接入 transcript recorder 的注册骨架。

计划：

1. 新增 bridge listener registration helper。
2. 接收事件 subscribe 函数，而不是直接绑定 Tauri。
3. 将 bridge event 映射为 transcript input。
4. 写入 transcript recorder。
5. 返回 cleanup 函数。
6. 后续可接真实 Tauri/Rust event stream。

## 成功标准

1. `npm run build` 通过。
2. 不引入不安全命令执行。
3. 不用 fake completion、fake diff、fake review。
4. 五个 helper 均可与现有 pipeline/container 组合。
