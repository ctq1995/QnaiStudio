# Engineering Git Diff Provider Design

## 背景

工程 Agent 的 review、验证和总结通常依赖当前变更 diff。QnaiStudio 的 execution pipeline 已经会读取 diff，但 diff 还不是统一 Context Provider 系统的一部分。

本设计新增 Git Diff Context Provider，仅接受外部注入的 diff，不主动执行 git 命令，不改变 pipeline 时序。

## 目标

1. 定义通用 `EngineeringGitDiffContext` 类型。
2. 新增 git diff context provider。
3. 支持从 `EngineeringRunInput` 注入 git diff。
4. 复用工具结果预算策略裁剪大 diff。
5. 将 git diff provider 接入默认 provider registry。

## 非目标

- 不主动调用 git。
- 不修改 pipeline 执行顺序。
- 不做 post-execution context rebuild。
- 不解析 hunk。
- 不应用 patch。

## 新增模块

```text
src/ai-runtime/engineering/git-diff-provider.ts
```

## 类型

```ts
export interface EngineeringGitDiffContext {
  diff?: string
  changedFiles?: string[]
}
```

## Provider 行为

`createGitDiffProvider()` 输出：

```text
Git Diff: 3 changed files
Changed files:
- src/foo.ts
- src/bar.ts

Diff:
...
```

策略：

- changedFiles 最多展示前 50 个。
- diff 通过 `budgetToolResult` 裁剪。
- diff 为空时输出 `Git Diff: none`。

## 集成点

- `types.ts`：`EngineeringRunInput` 增加 `gitDiff?: EngineeringGitDiffContext`。
- `context-provider.ts`：input 增加 gitDiff，默认 registry 注册 git diff provider。
- `context-builder.ts`：传入 `input.gitDiff`。
- `index.ts`：导出 git-diff-provider。

## 成功标准

1. git diff context 类型可复用。
2. default context provider registry 包含 git diff provider。
3. EngineeringRunInput 可接收 gitDiff。
4. `npm run build` 通过。
