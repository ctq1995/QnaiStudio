# Engineering Runner Bootstrap Design

## 背景

TaskManager 已支持 `engineeringRunner`，Engineering 层也已有 `createEngineeringTaskRunner()` adapter。当前还缺一个面向应用启动/装配层的显式注册入口，把真实工程 runner 注册到 TaskManager。

参考案例的关键模式是组合式 AgentLoop：启动层只装配真实依赖，不伪造工具、上下文或执行能力。因此本阶段采用显式注册，而不是自动占位注册。

## 目标

1. 提供 `registerEngineeringRunner()` 显式注册入口。
2. 支持调用方传入已有 `EngineeringTaskRunner`。
3. 支持调用方传入 `pipelineDeps` / `turnRunnerDeps`，由 adapter 创建 runner。
4. 注册到指定或全局 TaskManager。
5. 返回明确 snapshot，便于上层判断是否已注册。
6. 不在 bootstrap 中创建占位 Pipeline 或伪造 agent 执行能力。

## 非目标

- 不自动推断 workspace、model、agent executor。
- 不修改 UI。
- 不把所有任务默认标记为 engineering。
- 不改变普通 TaskManager 行为。
- 不接 Rust/Tauri bridge listener。

## 新增模块

```text
src/core/engineering-runtime-bootstrap.ts
```

## API

```ts
export interface EngineeringRunnerBootstrapInput {
  taskManager?: TaskManager
  runner?: EngineeringTaskRunner
  adapter?: EngineeringTaskRunnerAdapterInput
}

export interface EngineeringRunnerBootstrapResult {
  registered: boolean
  source: 'runner' | 'adapter'
}

export function registerEngineeringRunner(input: EngineeringRunnerBootstrapInput): EngineeringRunnerBootstrapResult
```

## 注册规则

```text
1. 如果传入 runner，直接注册 runner。
2. 否则如果传入 adapter，调用 createEngineeringTaskRunner(adapter) 创建 runner。
3. runner 和 adapter 都缺失时抛配置错误。
4. runner 与 adapter 同时传入时，优先 runner。
5. 默认注册到 getTaskManager() 返回的全局 TaskManager。
```

## 成功标准

1. 上层可通过一行显式调用完成注册。
2. 无真实依赖时不会生成假 runner。
3. `npm run build` 通过。
4. TaskManager 保持 engineering 模块解耦。
