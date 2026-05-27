# Subagent 系统使用指南

## 概述

QnaiStudio 的 Subagent 系统提供了一套完整的专用 Agent 框架，参考 BitFun 架构实现。每个 Subagent 都有特定的职责和工具访问权限。

## 快速开始

### 1. 初始化 Task 调度器

```typescript
import { initializeTaskScheduler, TaskSchedulerConfig } from '@/ai-runtime/subagent'

const config: TaskSchedulerConfig = {
  defaultTimeoutMs: 120000,  // 默认超时 2 分钟
  maxParallelism: 5,          // 最大并行数
  toolExecutor: {
    execute: async (tool, args) => {
      // 实现工具调用逻辑
      // 例如：调用 Tauri 命令或本地函数
      return result
    },
    isAvailable: (tool) => true
  },
  workspacePath: '/path/to/workspace',
  onEvent: (sessionId, event) => {
    console.log(`[${sessionId}]`, event)
  },
  shouldAbort: (sessionId) => false
}

const scheduler = initializeTaskScheduler(config)
```

### 2. 执行单个 Task

```typescript
import { executeTask } from '@/ai-runtime/subagent'

const result = await executeTask({
  subagent_type: 'FileFinder',
  description: 'Find auth files',
  prompt: 'Find files that implement authentication',
  workspace_path: '/project/src'
})

if (result.result.success) {
  console.log(result.result.content)
}
```

### 3. 并行执行多个 Task

```typescript
import { executeTasksParallel } from '@/ai-runtime/subagent'

const parallelResult = await executeTasksParallel({
  tasks: [
    {
      subagent_type: 'ReviewSecurity',
      description: 'Security review',
      prompt: 'Review src/auth for security issues'
    },
    {
      subagent_type: 'ReviewPerformance',
      description: 'Performance review',
      prompt: 'Review src/api for performance issues'
    }
  ],
  failFast: false  // 继续执行即使有失败
})

console.log(`成功: ${parallelResult.successCount}, 失败: ${parallelResult.failureCount}`)
```

## 可用的 Subagent 类型

### FileFinder

**职责**: 语义化文件搜索和定位

**工具**: `LS`, `Read`, `Grep`, `Glob`

**使用场景**:
```typescript
await executeTask({
  subagent_type: 'FileFinder',
  description: 'Find API endpoints',
  prompt: 'Locate files that define REST API endpoints'
})
```

### Explore

**职责**: 宽范围代码库探索

**工具**: `Grep`, `Glob`, `Read`, `LS`

**使用场景**:
```typescript
await executeTask({
  subagent_type: 'Explore',
  description: 'Explore auth flow',
  prompt: 'How does authentication flow through this codebase?'
})
```

### ReviewFixer

**职责**: 代码审查修复

**工具**: `Read`, `Grep`, `Glob`, `LS`, `GetFileDiff`, `Edit`, `Write`, `Bash`, `TodoWrite`, `Git`

**使用场景**:
```typescript
await executeTask({
  subagent_type: 'ReviewFixer',
  description: 'Fix security issues',
  prompt: `
    [CRITICAL] security: SQL injection in auth.ts:45
    Fix: Use parameterized queries
  `
})
```

### ReviewFrontend

**职责**: 前端专项审查

**工具**: `Read`, `Grep`, `Glob`, `LS`, `GetFileDiff`, `Git`

**检查项目**:
- i18n key 同步
- React 性能模式 (memoization, virtualization)
- Effect/Reactivity 依赖
- 可访问性
- 状态管理

### ReviewSecurity

**职责**: 安全漏洞审查

**工具**: `Read`, `Grep`, `Glob`, `LS`, `GetFileDiff`, `Git`

**检查项目**:
- SQL 注入
- XSS
- 命令注入
- 路径遍历
- 敏感数据暴露
- 弱加密

### ReviewArchitecture

**职责**: 架构问题审查

**工具**: `Read`, `Grep`, `Glob`, `LS`, `GetFileDiff`, `Git`

**检查项目**:
- 模块边界违规
- API 契约设计
- 抽象完整性
- 依赖方向
- 循环依赖

### ReviewPerformance

**职责**: 性能问题审查

**工具**: `Read`, `Grep`, `Glob`, `LS`, `GetFileDiff`, `Git`

**检查项目**:
- N+1 查询
- 阻塞调用
- 内存泄漏
- 循环效率
- 缓存策略

### ReviewBusinessLogic

**职责**: 业务逻辑审查

**工具**: `Read`, `Grep`, `Glob`, `LS`, `GetFileDiff`, `Git`

**检查项目**:
- 工作流正确性
- 状态转换
- 数据完整性
- 边界情况
- 输入验证

### ReviewJudge

**职责**: 审查报告仲裁验证

**工具**: `Read`, `Grep`, `Glob`, `LS`, `GetFileDiff`, `Git`

**使用场景**: 验证其他审查 Agent 的报告质量和准确性

## 自定义 Subagent

### 创建自定义 Subagent

```typescript
import { BaseSubagent, registerSubagent, SubagentConfig } from '@/ai-runtime/subagent'

class MyCustomAgent extends BaseSubagent {
  constructor(config?: Partial<SubagentConfig>) {
    super('FileFinder', config) // 继承 FileFinder 的工具集
  }

  protected async run(prompt: string): Promise<string> {
    // 实现自定义逻辑
    this.reportProgress('Starting custom analysis...')

    // 调用工具
    const files = await this.callTool<string[]>('Glob', { pattern: '**/*.ts' })

    // 返回结果
    return `Found ${files.length} TypeScript files`
  }
}

// 注册自定义 Agent
registerSubagent('FileFinder', (config) => new MyCustomAgent(config))
```

## 与现有系统集成

### 与 Engine 集成

```typescript
// 在 custom-cli engine 中使用
import { TaskToolDefinition, executeTask } from '@/ai-runtime/subagent'

// 将 Task 添加到工具列表
const tools = [
  // ... 其他工具
  {
    type: 'function',
    function: TaskToolDefinition
  }
]

// 处理工具调用
async function handleToolCall(name: string, args: any) {
  if (name === 'Task') {
    return await executeTask(args)
  }
  // ... 其他工具处理
}
```

### 与 EventBus 集成

```typescript
import { eventBus } from '@/ai-runtime/event-bus'
import { SubagentEvent } from '@/ai-runtime/subagent'

// 监听 Subagent 事件
const unsubscribe = eventBus.on('subagent:event', (event: SubagentEvent) => {
  if (event.type === 'progress') {
    console.log('Progress:', event.data)
  }
})
```

## 最佳实践

1. **选择正确的 Subagent 类型**: 根据任务性质选择最匹配的类型
2. **编写清晰的 prompt**: 提供详细的上下文和期望输出
3. **设置合理的超时**: 复杂任务可能需要更长时间
4. **并行执行独立任务**: 提高效率
5. **处理事件和错误**: 监听进度事件，妥善处理失败

## 工具权限对照表

| Subagent | Read | Grep | Glob | LS | Edit | Write | Bash | Git |
|----------|------|------|------|-----|------|-------|------|-----|
| FileFinder | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Explore | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ |
| ReviewFixer | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ReviewFrontend | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ |
| ReviewSecurity | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ |
| ReviewArchitecture | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ |
| ReviewPerformance | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ |
| ReviewBusinessLogic | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ |
| ReviewJudge | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ |
