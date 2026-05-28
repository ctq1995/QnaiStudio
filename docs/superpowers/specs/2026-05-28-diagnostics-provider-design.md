# Engineering Diagnostics Provider Design

## 背景

QnaiStudio 已有工程执行闭环和 Context Provider Registry。继续参考 Cursor、Windsurf、Continue.dev 的优秀能力时，应将 IDE Problems、编译错误、lint 错误、测试错误等诊断信息抽象为 Agent 上下文来源。

本设计只建立通用 diagnostics 协议和 provider，不直接耦合 UI store、Tauri 命令或具体语言工具。

## 目标

1. 定义通用 `EngineeringDiagnostic` 类型。
2. 新增 diagnostics context provider。
3. 支持从 `EngineeringRunInput` 注入 diagnostics。
4. 将 diagnostics 接入 provider registry。
5. Summary 展示 diagnostics provider 摘要。

## 非目标

- 不直接读取 `errorCenterStore`。
- 不运行编译器或 linter。
- 不解析终端输出。
- 不修改 UI。
- 不做 diagnostics 持久化。

## 新增模块

```text
src/ai-runtime/engineering/diagnostics-provider.ts
```

## 类型

```ts
export type EngineeringDiagnosticSeverity = 'error' | 'warning' | 'info'

export interface EngineeringDiagnostic {
  file?: string
  line?: number
  column?: number
  severity: EngineeringDiagnosticSeverity
  message: string
  source?: string
}
```

## Provider 行为

`createDiagnosticsProvider()` 输出：

```text
Diagnostics: 2 errors, 1 warnings, 3 total
src/foo.ts:12:5 error TS2322 ...
```

最多展示前 20 条，避免上下文过长。

## 集成点

- `types.ts`：`EngineeringRunInput` 增加 `diagnostics?: EngineeringDiagnostic[]`。
- `context-provider.ts`：input 增加 diagnostics，并注册 diagnostics provider。
- `context-builder.ts`：将 `input.diagnostics || []` 传入 provider registry。
- `summary-builder.ts`：现有 provider summary 自动展示 diagnostics。
- `index.ts`：导出 diagnostics-provider。

## 成功标准

1. diagnostics 类型可复用。
2. default context provider registry 包含 diagnostics provider。
3. EngineeringRunInput 可接收 diagnostics。
4. `npm run build` 通过。
