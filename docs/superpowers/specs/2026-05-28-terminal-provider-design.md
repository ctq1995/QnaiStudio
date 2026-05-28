# Engineering Terminal Provider Design

## 背景

工程 Agent 的修复闭环通常依赖终端输出：构建失败、测试失败、lint 错误和命令退出码。QnaiStudio 已有 Context Provider Registry 和 Diagnostics Provider，但还缺少通用 terminal output 上下文协议。

本设计只定义 terminal output 输入结构和 provider，不主动执行命令、不监听终端、不修改 UI。

## 目标

1. 定义通用 `EngineeringTerminalOutput` 类型。
2. 新增 terminal context provider。
3. 支持从 `EngineeringRunInput` 注入 terminal outputs。
4. 复用工具结果预算策略裁剪 stdout/stderr。
5. 将 terminal provider 接入默认 provider registry。

## 非目标

- 不执行终端命令。
- 不接入 Tauri terminal。
- 不监听 shell。
- 不持久化终端历史。
- 不修改 UI。

## 新增模块

```text
src/ai-runtime/engineering/terminal-provider.ts
```

## 类型

```ts
export interface EngineeringTerminalOutput {
  command: string
  cwd?: string
  exitCode?: number
  stdout?: string
  stderr?: string
  startedAt?: string
  finishedAt?: string
}
```

## Provider 行为

`createTerminalProvider()` 输出：

```text
Terminal: 1 failed, 2 total
[failed] npm run build
cwd: E:/workspace
stderr:
...
```

策略：

- 最多展示最近 5 条输出。
- stdout / stderr 分别通过 `budgetToolResult` 裁剪。
- failed 定义为 `exitCode !== undefined && exitCode !== 0`。

## 集成点

- `types.ts`：`EngineeringRunInput` 增加 `terminalOutputs?: EngineeringTerminalOutput[]`。
- `context-provider.ts`：input 增加 terminalOutputs，默认 registry 注册 terminal provider。
- `context-builder.ts`：传入 `input.terminalOutputs || []`。
- `index.ts`：导出 terminal-provider。

## 成功标准

1. terminal output 类型可复用。
2. default context provider registry 包含 terminal provider。
3. EngineeringRunInput 可接收 terminalOutputs。
4. `npm run build` 通过。
