# Engineering Context Provider Design

## 背景

QnaiStudio 工程 Agent 已具备项目指令、上下文预算、Repo Map、Project Fingerprint、权限、审计和执行闭环。当前上下文构建逻辑集中在 `context-builder.ts`，继续扩展 diagnostics、terminal、git diff、memory 等上下文时会变得臃肿。

本设计引入轻量 Context Provider Registry，对标 Continue.dev 的 context provider、Cursor/Windsurf 的 IDE 上下文源和 PilotDeck 的 ContextRuntime 分层收集能力。

## 目标

1. 把上下文来源抽象成 provider。
2. 支持 provider 注册、列表和统一收集。
3. 首期提供 selectedFiles、instructions、repoMap、fingerprint 四个内置 provider。
4. 将 provider 收集结果接入 EngineeringContext。
5. Summary 输出上下文来源诊断。

## 非目标

- 不接入真实 diagnostics provider。
- 不接入真实 terminal provider。
- 不接入真实 git diff provider。
- 不做 UI provider 选择器。
- 不做持久化 provider 配置。
- 不引入模型 ranking。

## 新增模块

```text
src/ai-runtime/engineering/context-provider.ts
```

## 类型

```ts
export type EngineeringContextProviderKind =
  | 'instructions'
  | 'selectedFiles'
  | 'repoMap'
  | 'fingerprint'
  | 'gitDiff'
  | 'diagnostics'
  | 'terminal'
  | 'custom'

export interface EngineeringContextProviderResult {
  id: string
  kind: EngineeringContextProviderKind
  label: string
  priority: number
  summary: string
  itemCount: number
  tokenEstimate: number
}
```

## Registry

```ts
export class EngineeringContextProviderRegistry {
  register(provider): void
  list(): EngineeringContextProvider[]
  collect(input): Promise<EngineeringContextProviderResult[]>
}
```

收集结果按 `priority` 降序排列。

## 内置 Provider

首期内置：

```text
selectedFiles
instructions
repoMap
fingerprint
```

它们不重新扫描文件，不读取额外内容，只从 context-builder 已有中间结果生成 provider result。

## 集成点

- `types.ts`：`EngineeringContext` 增加 `providers: EngineeringContextProviderResult[]`。
- `context-builder.ts`：在构建 context 时收集 providers。
- `summary-builder.ts`：输出 provider 数量和前几个 provider 摘要。
- `index.ts`：导出 context-provider。

## 成功标准

1. provider registry 可独立使用。
2. EngineeringContext 包含 provider 结果。
3. Summary 显示上下文来源数量。
4. `npm run build` 通过。
