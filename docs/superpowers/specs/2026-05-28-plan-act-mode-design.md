# Engineering Plan Act Mode Design

## 背景

成熟 coding agent 通常区分 Plan 和 Act：分析规划阶段只读上下文，执行阶段才允许写文件、运行命令、review 和验证。QnaiStudio 已有权限策略和执行闭环，但缺少运行模式这一层。

本设计新增轻量 run mode policy，不修改 UI，不改变权限系统，只让 execution pipeline 在 plan mode 下跳过副作用阶段。

## 目标

1. 定义 `EngineeringRunMode = 'plan' | 'act'`。
2. 支持 `EngineeringRunInput.runMode` 显式指定模式。
3. 未指定模式时根据任务分类推断。
4. plan mode 只执行 classify、context、summary。
5. act mode 保持现有完整闭环。
6. Summary 展示运行模式和跳过阶段。

## 非目标

- 不做 UI 切换。
- 不做用户审批交互。
- 不重构 permission policy。
- 不实现多轮 plan approval。

## 新增模块

```text
src/ai-runtime/engineering/run-mode-policy.ts
```

## 类型

```ts
export type EngineeringRunMode = 'plan' | 'act'

export interface EngineeringRunModeDecision {
  mode: EngineeringRunMode
  allowSnapshot: boolean
  allowExecution: boolean
  allowVerification: boolean
  allowReview: boolean
  skippedStages: string[]
}
```

## 推断规则

如果 input 显式传入 `runMode`，优先使用。

否则：

```text
feature / bugfix / refactor -> act
review / explain / unknown -> plan
```

## Pipeline 行为

### plan mode

执行：

```text
classify
context
summary
```

跳过：

```text
snapshot
executeTask
getDiff
verify
review
```

### act mode

保持当前完整流程。

## 集成点

- `types.ts`：`EngineeringRunInput` 增加 `runMode?: EngineeringRunMode`，summary 增加 `runModeDecision`。
- `execution-pipeline.ts`：在 classification 后 resolve mode，plan mode 早返回 summary。
- `summary-builder.ts`：输出运行模式和跳过阶段。
- `index.ts`：导出 run-mode-policy。

## 成功标准

1. plan mode 不调用 executeTask。
2. act mode 保持当前行为。
3. Summary 显示运行模式。
4. `npm run build` 通过。
