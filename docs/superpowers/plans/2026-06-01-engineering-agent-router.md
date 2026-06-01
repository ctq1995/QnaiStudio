# Engineering Agent Router Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lightweight Engineering Agent Router that turns `EngineeringRunInput` into a structured, testable route decision before pipeline execution.

**Architecture:** The router is a pure decision module in `src/ai-runtime/engineering/agent-router.ts`. It composes the existing task classifier and run-mode policy, returns route/capability/risk metadata, and is exported through the engineering runtime entry point without changing the existing execution pipeline.

**Tech Stack:** TypeScript, Vitest, existing `ai-runtime/engineering` modules.

---

### Task 1: Add Router Types and Pure Decision Function

**Files:**
- Create: `src/ai-runtime/engineering/agent-router.ts`
- Test: `src/ai-runtime/engineering/agent-router.test.ts`

- [ ] **Step 1: Write failing tests for feature, explain, review, and unknown routes**

Create `src/ai-runtime/engineering/agent-router.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { routeEngineeringAgentTask } from './agent-router'

const workspaceDir = 'E:/workspace/project'

describe('routeEngineeringAgentTask', () => {
  it('routes modifying feature requests to execute', () => {
    const decision = routeEngineeringAgentTask({
      userRequest: 'add a dark mode setting',
      workspaceDir,
    })

    expect(decision.route).toBe('execute')
    expect(decision.runModeDecision.mode).toBe('act')
    expect(decision.requiredCapabilities).toEqual(['context', 'snapshot', 'agent_execution', 'git_diff', 'verification', 'review'])
    expect(decision.riskLevel).toBe('high')
  })

  it('routes explanation requests to explain', () => {
    const decision = routeEngineeringAgentTask({
      userRequest: 'explain how authentication works',
      workspaceDir,
    })

    expect(decision.route).toBe('explain')
    expect(decision.runModeDecision.mode).toBe('plan')
    expect(decision.requiredCapabilities).toEqual(['context'])
    expect(decision.permissionMode).toBe('plan')
  })

  it('routes review requests to review', () => {
    const decision = routeEngineeringAgentTask({
      userRequest: 'review the current diff for bugs',
      workspaceDir,
    })

    expect(decision.route).toBe('review')
    expect(decision.requiredCapabilities).toEqual(['context', 'git_diff', 'review'])
    expect(decision.riskLevel).toBe('low')
  })

  it('routes ambiguous requests to unknown with conservative permissions', () => {
    const decision = routeEngineeringAgentTask({
      userRequest: 'handle this',
      workspaceDir,
    })

    expect(decision.route).toBe('unknown')
    expect(decision.permissionMode).toBe('plan')
    expect(decision.requiredCapabilities).toEqual(['context'])
  })
})
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
npm test -- src/ai-runtime/engineering/agent-router.test.ts
```

Expected: fails because `./agent-router` does not exist.

- [ ] **Step 3: Implement router module**

Create `src/ai-runtime/engineering/agent-router.ts`:

```ts
import { decideEngineeringPermission, type EngineeringPermissionMode } from './permission-policy'
import { resolveEngineeringRunMode, type EngineeringRunModeDecision } from './run-mode-policy'
import { classifyEngineeringTask } from './task-classifier'
import type { EngineeringRunInput, EngineeringTaskClassification } from './types'

export type EngineeringAgentRoute = 'plan' | 'execute' | 'verify' | 'review' | 'explain' | 'unknown'
export type EngineeringAgentRouteRiskLevel = 'low' | 'medium' | 'high'
export type EngineeringAgentRouteCapability = 'context' | 'snapshot' | 'agent_execution' | 'git_diff' | 'verification' | 'review'

export interface EngineeringAgentRouterInput extends EngineeringRunInput {
  requestedRoute?: EngineeringAgentRoute
}

export interface EngineeringAgentRouteDecision {
  route: EngineeringAgentRoute
  classification: EngineeringTaskClassification
  runModeDecision: EngineeringRunModeDecision
  permissionMode: EngineeringPermissionMode
  requiredCapabilities: EngineeringAgentRouteCapability[]
  riskLevel: EngineeringAgentRouteRiskLevel
  reason: string
  skippedStages: string[]
}

export function routeEngineeringAgentTask(input: EngineeringAgentRouterInput): EngineeringAgentRouteDecision {
  const classification = classifyEngineeringTask(input.userRequest)
  const route = input.requestedRoute || inferRoute(input.userRequest, classification)
  const permissionMode = resolvePermissionMode(route, input.permissionMode)
  const runModeDecision = resolveEngineeringRunMode({
    requestedMode: route === 'execute' ? input.runMode : 'plan',
    classification,
  })
  const requiredCapabilities = resolveRequiredCapabilities(route)

  return {
    route,
    classification,
    runModeDecision,
    permissionMode,
    requiredCapabilities,
    riskLevel: resolveRiskLevel(route, classification, permissionMode),
    reason: buildRouteReason(route, classification),
    skippedStages: resolveSkippedStages(route, requiredCapabilities),
  }
}

function inferRoute(userRequest: string, classification: EngineeringTaskClassification): EngineeringAgentRoute {
  const normalized = userRequest.toLowerCase()
  if (classification.kind === 'feature' || classification.kind === 'bugfix' || classification.kind === 'refactor') return 'execute'
  if (classification.kind === 'review' || /\b(review|audit|检查|审查)\b/i.test(userRequest)) return 'review'
  if (/\b(verify|test|validate|build|验证|测试|构建)\b/i.test(userRequest)) return 'verify'
  if (classification.kind === 'explain' || /\b(explain|describe|how|why|说明|解释|分析)\b/i.test(userRequest)) return 'explain'
  if (normalized.trim().length < 16) return 'unknown'
  return 'plan'
}

function resolvePermissionMode(route: EngineeringAgentRoute, requested?: EngineeringPermissionMode): EngineeringPermissionMode {
  if (requested) return requested
  if (route === 'execute') return 'default'
  return 'plan'
}

function resolveRequiredCapabilities(route: EngineeringAgentRoute): EngineeringAgentRouteCapability[] {
  if (route === 'execute') return ['context', 'snapshot', 'agent_execution', 'git_diff', 'verification', 'review']
  if (route === 'verify') return ['context', 'git_diff', 'verification']
  if (route === 'review') return ['context', 'git_diff', 'review']
  return ['context']
}

function resolveRiskLevel(
  route: EngineeringAgentRoute,
  classification: EngineeringTaskClassification,
  permissionMode: EngineeringPermissionMode,
): EngineeringAgentRouteRiskLevel {
  const permission = decideEngineeringPermission({ mode: permissionMode, toolKind: route === 'execute' ? 'write' : 'read' })
  if (permission.type === 'deny') return 'high'
  if (route === 'execute' || classification.mayModifyFiles) return 'high'
  if (route === 'verify' || permission.type === 'ask') return 'medium'
  return 'low'
}

function buildRouteReason(route: EngineeringAgentRoute, classification: EngineeringTaskClassification): string {
  return `Routed to ${route} because classifier returned ${classification.kind}: ${classification.reason}`
}

function resolveSkippedStages(route: EngineeringAgentRoute, requiredCapabilities: EngineeringAgentRouteCapability[]): string[] {
  const stageByCapability: Record<EngineeringAgentRouteCapability, string> = {
    context: 'context',
    snapshot: 'snapshot',
    agent_execution: 'execute',
    git_diff: 'diff',
    verification: 'verify',
    review: 'review',
  }
  const requiredStages = new Set(requiredCapabilities.map((capability) => stageByCapability[capability]))
  const allStages = ['context', 'snapshot', 'execute', 'diff', 'verify', 'review']
  if (route === 'unknown') return allStages.filter((stage) => stage !== 'context')
  return allStages.filter((stage) => !requiredStages.has(stage))
}
```

- [ ] **Step 4: Run router tests**

Run:

```bash
npm test -- src/ai-runtime/engineering/agent-router.test.ts
```

Expected: PASS.

---

### Task 2: Export Router and Verify Full Test Suite

**Files:**
- Modify: `src/ai-runtime/engineering/index.ts`

- [ ] **Step 1: Export router module**

Add this line to `src/ai-runtime/engineering/index.ts`:

```ts
export * from './agent-router'
```

- [ ] **Step 2: Run all tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: PASS, allowing existing Vite chunk-size warnings.

---

### Task 3: Local Review and Commit

**Files:**
- Review: `src/ai-runtime/engineering/agent-router.ts`
- Review: `src/ai-runtime/engineering/agent-router.test.ts`
- Review: `src/ai-runtime/engineering/index.ts`

- [ ] **Step 1: Check for accidental debug/test-only code**

Run:

```bash
git diff -- src/ai-runtime/engineering/agent-router.ts src/ai-runtime/engineering/agent-router.test.ts src/ai-runtime/engineering/index.ts
```

Check manually that there is no `console.log`, `debugger`, `.only`, or broad unrelated edit.

- [ ] **Step 2: Commit implementation**

Run:

```bash
git add -- src/ai-runtime/engineering/agent-router.ts src/ai-runtime/engineering/agent-router.test.ts src/ai-runtime/engineering/index.ts
git commit -m "feat: add engineering agent router" -m "Generated with BitFun

Co-Authored-By: BitFun"
```

- [ ] **Step 3: Push changes**

Run:

```bash
git push
```
