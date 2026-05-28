# Engineering Repo Map Design

## 背景

QnaiStudio 已经具备工程闭环、指令加载、权限与审计、上下文预算。继续参考 PilotDeck / Aider / Continue 的优秀能力时，下一步应补足代码库结构理解能力：轻量 Repo Map。

本设计只实现纯函数式 repo map 构建，不做 tree-sitter、LSP、持久化索引、文件监听或 UI 展示。

## 目标

1. 根据文件路径列表构建轻量 repo map。
2. 识别文件类别：frontend、tauri、config、docs、test、script、unknown。
3. 识别关键入口文件。
4. 输出压缩摘要和分类统计。
5. 接入 EngineeringContext，供 Agent 执行前使用。

## 非目标

- 不读取文件内容。
- 不解析 AST。
- 不做语义索引。
- 不实现后台扫描。
- 不修改文件浏览器。

## 新增模块

```text
src/ai-runtime/engineering/repo-map.ts
```

## 类型

```ts
export type RepoMapFileKind = 'frontend' | 'tauri' | 'config' | 'docs' | 'test' | 'script' | 'unknown'

export interface EngineeringRepoMapFile {
  path: string
  kind: RepoMapFileKind
  isEntry: boolean
}

export interface EngineeringRepoMap {
  files: EngineeringRepoMapFile[]
  entries: EngineeringRepoMapFile[]
  kindCounts: Record<RepoMapFileKind, number>
  summary: string
}
```

## 规则

忽略路径包含以下片段的文件：

```text
.git
node_modules
dist
build
target
.next
```

入口文件：

```text
package.json
vite.config.ts
tsconfig.json
src/main.tsx
src/App.tsx
src-tauri/Cargo.toml
src-tauri/src/lib.rs
src-tauri/src/main.rs
README.md
SOUL.md
USER.md
```

分类规则：

```text
src-tauri/** -> tauri
src/** + ts/tsx/js/jsx/css -> frontend
*.md 或 docs/** -> docs
*.test.* / *.spec.* / tests/** / __tests__/** -> test
package.json / tsconfig / vite / Cargo.toml -> config
scripts/** 或 *.ps1/*.sh -> script
其他 -> unknown
```

## 集成点

- `types.ts`：`EngineeringContext` 增加 `repoMap?: EngineeringRepoMap`。
- `context-builder.ts`：基于候选文件构建 repo map。
- `summary-builder.ts`：输出 repo map 文件数和入口数。
- `index.ts`：导出 repo-map。

## 成功标准

1. repo map 模块可独立使用。
2. EngineeringContext 包含 repo map。
3. Summary 展示 repo map 文件数和入口数。
4. `npm run build` 通过。
