import { assessCommandRisk } from './tool-risk-policy'

export type EngineeringPermissionMode = 'plan' | 'default' | 'acceptEdits' | 'bypassPermissions'
export type EngineeringToolKind = 'read' | 'write' | 'shell' | 'network' | 'review' | 'unknown'

export type EngineeringPermissionDecision =
  | { type: 'allow'; reason: string }
  | { type: 'ask'; reason: string }
  | { type: 'deny'; reason: string }

export interface EngineeringPermissionRequest {
  mode?: EngineeringPermissionMode
  toolKind: EngineeringToolKind
  command?: string
}

export function decideEngineeringPermission(request: EngineeringPermissionRequest): EngineeringPermissionDecision {
  const mode = request.mode || 'default'
  const commandRisk = request.command ? assessCommandRisk(request.command) : undefined

  if (commandRisk?.risk === 'dangerous') {
    return { type: 'deny', reason: commandRisk.reason }
  }

  if (mode === 'bypassPermissions') {
    return { type: 'allow', reason: 'bypassPermissions allows non-dangerous operations' }
  }

  if (mode === 'plan') {
    return request.toolKind === 'read' || request.toolKind === 'review'
      ? { type: 'allow', reason: 'plan mode allows read-only operations' }
      : { type: 'deny', reason: 'plan mode denies side-effect operations' }
  }

  if (mode === 'acceptEdits') {
    if (request.toolKind === 'read' || request.toolKind === 'write' || request.toolKind === 'review') {
      return { type: 'allow', reason: 'acceptEdits allows read, write, and review operations' }
    }
    return { type: 'ask', reason: 'acceptEdits requires approval for shell or network operations' }
  }

  if (request.toolKind === 'read' || request.toolKind === 'review') {
    return { type: 'allow', reason: 'default mode allows read-only and review operations' }
  }

  if (commandRisk?.allowed) {
    return { type: 'allow', reason: commandRisk.reason }
  }

  return { type: 'ask', reason: commandRisk?.reason || 'default mode requires approval for side-effect operations' }
}
