# Agent Engineering Execution Loop Design

## 背景

QnaiStudio 已经具备自研 Agent runtime、工具注册、文件工具、Git 工具、项目上下文分析器、Subagent 调度和工作区版本能力。但当前工程任务执行仍偏向“模型直接调用工具”，缺少稳定的工程闭环：任务识别、修改前快照、修改后 diff、验证、审查和总结。

本设计聚焦第一期能力：把自研 Agent 从“能调用工具”提升为“按工程流程可控执行”。

## 目标

实现一个最小可用的工程执行闭环：

```text
用户工程任务
  -> 任务分类
  -> 最小上下文构建
  -> 修改前快照
  -> 执行现有 Agent / 工具流程
  -> 收集 Git diff
  -> 选择并运行验证命令
  -> 调用 Review Agent 审查 diff
  -> 生成工程执行总结
```

第一期目标不是替换现有 Agent runtime，而是在现有 runtime 外层增加一层工程任务编排能力。

## 非目标

第一期不做以下内容：

- 不实现完整 LSP 或 tree-sitter 符号索引。
- 不重构整个 `src/ai-runtime`。
- 不做复杂 UI 编排页面。
- 不自动修复 review 阶段发现的问题。
- 不自动 rollback。
- 不开放模型自由拼接 shell 命令。
- 不实现命令白名单管理界面。

## 设计原则

1. **最小侵入**：复用现有工具、Git、Subagent、workspace version 能力。
2. **默认保守**：只有可能修改代码的任务才创建快照；验证命令来自内置策略，不由模型自由生成。
3. **事实驱动**：diff、build 输出、review 结果都作为结构化事实进入总结。
4. **失败可解释**：任一阶段失败时，返回明确阶段、原因和可继续操作。
5. **可扩展**：后续可接入符号索引、多 review agent、自动修复和 rollback。

## 新增模块

建议新增目录：

```text
src/ai-runtime/engineering/
  task-classifier.ts
  execution-pipeline.ts
  snapshot-policy.ts
  verification-policy.ts
  review-policy.ts
  summary-builder.ts
  types.ts
  index.ts
```

### `types.ts`

定义工程闭环使用的共享类型：

```ts
export type EngineeringTaskKind = 'feature' | 'bugfix' | 'refactor' | 'review' | 'explain' | 'unknown'

export interface EngineeringTaskClassification {
  kind: EngineeringTaskKind
  mayModifyFiles: boolean
  requiresVerification: boolean
  requiresReview: boolean
  confidence: number
  reason: string
}

export interface VerificationCommand {
  id: string
  label: string
  command: string
  cwd?: string
  risk: 'safe' | 'medium'
}

export interface VerificationResult {
  command: VerificationCommand
  success: boolean
  output: string
  error?: string
}

export interface EngineeringRunInput {
  taskId?: string
  userRequest: string
  workspaceDir: string
  selectedFiles?: string[]
}

export interface EngineeringAgentRequest {
  taskId: string
  userRequest: string
  workspaceDir: string
  classification: EngineeringTaskClassification
}

export interface EngineeringAgentResult {
  success: boolean
  content?: string
  error?: string
}

export interface EngineeringRunSummary {
  taskId: string
  classification: EngineeringTaskClassification
  snapshot?: {
    created: boolean
    versionId?: string
    error?: string
  }
  diff?: string
  verificationResults: VerificationResult[]
  review?: {
    success: boolean
    content?: string
    error?: string
  }
  success: boolean
  finalMessage: string
}
```

### `task-classifier.ts`

职责：根据用户输入和可选上下文判断任务类型。

首期使用规则分类，不依赖模型：

- 包含“修复、报错、失败、bug、error、构建错误”归为 `bugfix`。
- 包含“实现、增加、添加、新功能”归为 `feature`。
- 包含“重构、优化结构、整理”归为 `refactor`。
- 包含“review、审查、检查”归为 `review`。
- 包含“解释、说明、为什么”归为 `explain`。

`mayModifyFiles` 规则：

- `feature`、`bugfix`、`refactor` 默认为 `true`。
- `review`、`explain` 默认为 `false`。

后续可以替换为模型分类器或混合分类器。

### `snapshot-policy.ts`

职责：在可能写文件的工程任务前创建 workspace version。

规则：

- `mayModifyFiles === true` 时尝试创建快照。
- 快照失败不直接终止任务，但必须写入 summary。
- 快照调用现有 workspace version 服务或 Tauri command，不新增第二套快照机制。

快照标签建议：

```text
agent-before-<taskKind>-<timestamp>
```

### `verification-policy.ts`

职责：根据 Git diff 或已修改文件选择验证命令。

首期内置策略：

| 变更范围 | 验证命令 |
| --- | --- |
| `src/**/*.ts`、`src/**/*.tsx`、`package.json`、`vite.config.ts` | `npm run build` |
| `src-tauri/**/*.rs`、`src-tauri/Cargo.toml` | `cargo check`，cwd 为 `src-tauri` |
| 同时改前端和 Tauri | 两个命令都运行 |
| 无 diff | 不运行验证，summary 标注无可验证改动 |

约束：

- 命令必须来自内置策略。
- 不接受模型返回任意 shell 字符串。
- 首期只运行 `safe` 命令。
- 输出需要截断，避免过长日志进入 UI 或模型上下文。

### `review-policy.ts`

职责：修改后基于 diff 发起审查。

首期策略：

- 如果存在 diff，则调用一个综合 review pass。
- 优先使用现有 Subagent Review 能力。
- 审查 prompt 聚焦：
  - 是否引入明显 bug。
  - 是否违反工作区安全边界。
  - 是否泄露密钥或敏感信息。
  - 是否有不必要的大范围改动。
  - 是否缺少验证。

首期不自动修复 review 发现的问题，只把结果汇总给用户。

### `summary-builder.ts`

职责：生成面向用户的最终工程报告。

报告包括：

- 任务分类结果。
- 是否创建快照。
- 修改文件摘要。
- 验证命令及结果。
- Review 结论。
- 是否成功完成。
- 如失败，失败阶段和下一步建议。

### `execution-pipeline.ts`

职责：串联整个流程。

建议接口：

```ts
export interface EngineeringExecutionPipelineDeps {
  createSnapshot: (label: string) => Promise<{ versionId: string }>
  executeAgentTask: (request: EngineeringAgentRequest) => Promise<EngineeringAgentResult>
  getGitDiff: () => Promise<string>
  runVerification: (commands: VerificationCommand[]) => Promise<VerificationResult[]>
  runReview: (diff: string) => Promise<{ success: boolean; content?: string; error?: string }>
}

export class EngineeringExecutionPipeline {
  constructor(private deps: EngineeringExecutionPipelineDeps) {}

  async run(input: EngineeringRunInput): Promise<EngineeringRunSummary> {
    // classify -> snapshot -> execute -> diff -> verify -> review -> summarize
  }
}
```

Pipeline 不直接绑定 Tauri、React 或具体 Agent 实现，便于测试。

## 与现有系统的集成点

### 工具系统

复用：

- `src/ai-runtime/tool-registry.ts`
- `src/ai-runtime/tools/file-tools.ts`
- `src/ai-runtime/tools/git-tools.ts`
- `src/ai-runtime/tools/search-tools.ts`

要求：

- 写文件工具继续要求 workspaceDir。
- Git diff 使用现有 `git_diff` command。
- 不新增绕过 workspace 边界的 AI 文件工具。

### Subagent 系统

复用：

- `src/ai-runtime/subagent/task-tool.ts`
- `src/ai-runtime/subagent/agents/review/*`

第一期只需要一个 review pass，不要求并行多 review。

### 工作区版本系统

复用现有 workspace version 服务。Pipeline 只通过依赖注入调用，不直接耦合具体实现。

### UI 集成

第一期 UI 最小改动：

- 现有聊天流程可以在识别到工程任务时调用 Pipeline。
- 最终 summary 作为普通 assistant 消息展示。
- 阶段事件可以后续再接入进度 UI。

## 错误处理

Pipeline 每个阶段都返回结构化结果：

1. 分类失败：归为 `unknown`，继续执行但不创建快照。
2. 快照失败：记录错误，继续执行。
3. Agent 执行失败：停止后续验证和 review，返回失败 summary。
4. Git diff 失败：记录错误，可继续尝试验证，但 review 跳过。
5. 验证失败：summary 标记失败，并保留输出摘要。
6. Review 失败：不改变验证结果，但标记 review 未完成。

## 安全约束

1. 验证命令必须来自 `verification-policy.ts` 内置列表。
2. 不允许模型自由构造 shell 命令进入 Pipeline。
3. 文件写入必须继续走 workspace 限制工具。
4. Review prompt 必须包含安全检查项。
5. 日志和 summary 不输出完整密钥内容。

## 测试策略

首期建议添加单元测试：

1. `task-classifier`：覆盖 feature、bugfix、refactor、review、explain、unknown。
2. `verification-policy`：给定不同 changed files，返回正确命令集合。
3. `summary-builder`：验证成功、验证失败、快照失败、review 失败四类输出。
4. `execution-pipeline`：使用 mock deps 测试阶段顺序和失败短路。

如项目当前未建立测试框架，先保证 TypeScript 编译通过，并把模块设计成纯函数优先，便于后续补测试。

## 第一阶段验收标准

完成后应支持：

1. 对用户工程任务进行规则分类。
2. 对可能修改文件的任务创建修改前快照。
3. Agent 执行后读取 Git diff。
4. 根据 diff 自动选择 `npm run build` 或 `cargo check`。
5. 对 diff 进行一次 review。
6. 返回结构化工程执行总结。
7. 前端构建通过。

## 后续扩展

后续可以按以下方向继续增强：

1. 接入 ProjectContextBuilder，提升相关文件选择能力。
2. 接入符号搜索和依赖图。
3. 并行调用 Security、Performance、Frontend、Architecture review agents。
4. 支持 review 问题自动修复与二次验证。
5. 支持用户确认后的 rollback。
6. 增加命令风险策略 UI。
