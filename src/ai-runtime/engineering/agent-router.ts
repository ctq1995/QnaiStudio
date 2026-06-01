import { decideEngineeringPermission, type EngineeringPermissionMode } from './permission-policy'
import { resolveEngineeringRunMode, type EngineeringRunModeDecision } from './run-mode-policy'
import { classifyEngineeringTask } from './task-classifier'
import type { EngineeringRunInput, EngineeringTaskClassification } from './types'

export type EngineeringAgentRoute = 'plan' | 'execute' | 'verify' | 'review' | 'explain' | 'unknown'
export type EngineeringAgentRouteSubtype =
  | 'review.diff'
  | 'review.architecture'
  | 'review.security'
  | 'review.performance'
  | 'verify.build'
  | 'verify.test'
  | 'verify.lint'
  | 'verify.typecheck'
export type EngineeringAgentRouteRiskLevel = 'low' | 'medium' | 'high'
export type EngineeringAgentRouteCapability = 'context' | 'snapshot' | 'agent_execution' | 'git_diff' | 'verification' | 'review'

export interface EngineeringAgentRouterInput extends EngineeringRunInput {
  requestedRoute?: EngineeringAgentRoute
}

export interface EngineeringAgentRouteDecision {
  route: EngineeringAgentRoute
  subtype?: EngineeringAgentRouteSubtype
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
  const subtype = inferRouteSubtype(input.userRequest, route)
  const runModeDecision = resolveEngineeringRunMode({
    requestedMode: route === 'execute' ? input.runMode || 'act' : 'plan',
    classification,
  })
  const requiredCapabilities = resolveRequiredCapabilities(route)

  return {
    route,
    subtype,
    classification,
    runModeDecision,
    permissionMode,
    requiredCapabilities,
    riskLevel: resolveRiskLevel(route, permissionMode),
    reason: buildRouteReason(route, classification),
    skippedStages: resolveSkippedStages(route, requiredCapabilities),
  }
}

function inferRoute(userRequest: string, classification: EngineeringTaskClassification): EngineeringAgentRoute {
  const normalized = userRequest.trim().toLowerCase()
  if (classification.kind === 'review' || /\b(review|audit)\b/i.test(userRequest) || /审查|检查|评审/.test(userRequest)) return 'review'
  if (/\b(verify|test|tests|validate|build|lint|typecheck)\b/i.test(userRequest) || /验证|测试|构建|类型检查/.test(userRequest)) return 'verify'
  if (classification.kind === 'explain' || /\b(explain|describe|how|why|analyze)\b/i.test(userRequest) || /说明|解释|分析/.test(userRequest)) return 'explain'
  if (classification.kind === 'feature' || classification.kind === 'bugfix' || classification.kind === 'refactor') return 'execute'
  if (/\b(add|create|implement|fix|refactor|update|modify|change)\b/i.test(userRequest)) return 'execute'
  if (normalized.length < 16) return 'unknown'
  return 'plan'
}

function inferRouteSubtype(userRequest: string, route: EngineeringAgentRoute): EngineeringAgentRouteSubtype | undefined {
  const text = userRequest.toLowerCase()
  if (route === 'review') return inferReviewSubtype(text)
  if (route === 'verify') return inferVerifySubtype(text)
  return undefined
}

function inferReviewSubtype(text: string): EngineeringAgentRouteSubtype {
  if (/security|安全|漏洞|vulnerab|auth|权限|secret|token|xss|csrf|sql/.test(text)) return 'review.security'
  if (/performance|性能|latency|slow|render|bundle|memory|n\+1/.test(text)) return 'review.performance'
  if (/architecture|架构|设计|module|boundary|abstraction|dependency|结构/.test(text)) return 'review.architecture'
  return 'review.diff'
}

function inferVerifySubtype(text: string): EngineeringAgentRouteSubtype {
  if (/typecheck|type check|类型|tsc/.test(text)) return 'verify.typecheck'
  if (/lint|eslint|代码规范/.test(text)) return 'verify.lint'
  if (/test|测试|spec|vitest|jest/.test(text)) return 'verify.test'
  return 'verify.build'
}

function resolvePermissionMode(route: EngineeringAgentRoute, requested?: EngineeringPermissionMode): EngineeringPermissionMode {
  if (requested) return requested
  if (route === 'execute' || route === 'verify') return 'default'
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
  permissionMode: EngineeringPermissionMode,
): EngineeringAgentRouteRiskLevel {
  const permission = decideEngineeringPermission({ mode: permissionMode, toolKind: route === 'execute' ? 'write' : 'read' })
  if (permission.type === 'deny') return 'high'
  if (route === 'execute') return 'high'
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
