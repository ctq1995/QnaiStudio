import type { EngineeringTranscriptEvent, EngineeringTranscriptEventType, EngineeringTranscriptSnapshot } from './transcript-recorder'

export type EngineeringTranscriptTimelineItemKind =
  | 'session'
  | 'turn'
  | 'tool'
  | 'permission'
  | 'verification'
  | 'review'
  | 'route'
  | 'skipped'
  | 'policy'
  | 'note'
  | 'event'

export interface EngineeringTranscriptTimelinePolicyAction {
  type: string
  path: string
  detail?: string
}

export interface EngineeringTranscriptTimelineItem {
  id: string
  eventId: string
  sequence: number
  kind: EngineeringTranscriptTimelineItemKind
  type: EngineeringTranscriptEventType
  sessionId?: string
  turnId?: string
  taskId?: string
  createdAt: string
  title: string
  summary?: string
  policyActions: EngineeringTranscriptTimelinePolicyAction[]
}

export interface EngineeringTranscriptTimelineGroup {
  id: string
  sessionId?: string
  turnId?: string
  taskId?: string
  items: EngineeringTranscriptTimelineItem[]
}

export interface EngineeringTranscriptTimeline {
  items: EngineeringTranscriptTimelineItem[]
  groups: EngineeringTranscriptTimelineGroup[]
  policyActionCount: number
}

export function buildEngineeringTranscriptTimeline(snapshot: EngineeringTranscriptSnapshot): EngineeringTranscriptTimeline {
  const events = snapshot.events
    .slice()
    .sort((a, b) => a.sequence - b.sequence)
  const items = events.flatMap(createTimelineItems)

  return {
    items,
    groups: groupTimelineItems(items),
    policyActionCount: events.reduce((count, event) => count + extractPolicyActions(event.payload).length, 0),
  }
}

function createTimelineItems(event: EngineeringTranscriptEvent): EngineeringTranscriptTimelineItem[] {
  const policyActions = extractPolicyActions(event.payload)
  const primary: EngineeringTranscriptTimelineItem = {
    id: `timeline-${event.id}`,
    eventId: event.id,
    sequence: event.sequence,
    kind: mapTimelineKind(event.type),
    type: event.type,
    sessionId: event.sessionId,
    turnId: event.turnId,
    taskId: event.taskId,
    createdAt: event.createdAt,
    title: createTimelineTitle(event),
    summary: createTimelineSummary(event),
    policyActions,
  }

  if (policyActions.length === 0) return [primary]

  return [
    primary,
    {
      ...primary,
      id: `timeline-${event.id}-policy`,
      kind: 'policy',
      title: `Policy actions: ${policyActions.length}`,
      summary: summarizePolicyActions(policyActions),
    },
  ]
}

function mapTimelineKind(type: EngineeringTranscriptEventType): EngineeringTranscriptTimelineItemKind {
  if (type === 'session_started' || type === 'session_ended') return 'session'
  if (type === 'turn_started' || type === 'turn_completed' || type === 'turn_failed' || type === 'lifecycle_event') return 'turn'
  if (type === 'tool_call' || type === 'tool_result') return 'tool'
  if (type === 'permission_decision') return 'permission'
  if (type === 'verification_result') return 'verification'
  if (type === 'review_result') return 'review'
  if (type === 'route_decision') return 'route'
  if (type === 'stage_skipped') return 'skipped'
  if (type === 'note') return 'note'
  return 'event'
}

function createTimelineTitle(event: EngineeringTranscriptEvent): string {
  switch (event.type) {
    case 'session_started':
      return 'Session started'
    case 'session_ended':
      return 'Session ended'
    case 'turn_started':
      return 'Turn started'
    case 'turn_completed':
      return 'Turn completed'
    case 'turn_failed':
      return 'Turn failed'
    case 'tool_call':
      return 'Tool call'
    case 'tool_result':
      return 'Tool result'
    case 'route_decision':
      return 'Route decided'
    case 'stage_skipped':
      return 'Stage skipped'
    case 'permission_decision':
      return 'Permission decision'
    case 'verification_result':
      return 'Verification result'
    case 'review_result':
      return 'Review result'
    case 'note':
      return 'Note'
    default:
      return 'Lifecycle event'
  }
}

function createTimelineSummary(event: EngineeringTranscriptEvent): string | undefined {
  if (event.type === 'route_decision') {
    const payload = event.payload
    if (isRouteDecisionPayload(payload)) {
      return `route=${payload.route} risk=${payload.riskLevel} permission=${payload.permissionMode} skipped=${payload.skippedStages.join(',') || 'none'}`
    }
  }
  if (event.type === 'stage_skipped') {
    const payload = event.payload
    if (isStageSkippedPayload(payload)) {
      return `stage=${payload.stage} reason=${payload.reason}`
    }
  }
  const parts = [event.sessionId && `session=${event.sessionId}`, event.turnId && `turn=${event.turnId}`, event.taskId && `task=${event.taskId}`].filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : undefined
}

function isStageSkippedPayload(payload: unknown): payload is { stage: string; reason: string } {
  if (!payload || typeof payload !== 'object') return false
  const candidate = payload as { stage?: unknown; reason?: unknown }
  return typeof candidate.stage === 'string' && typeof candidate.reason === 'string'
}

function isRouteDecisionPayload(payload: unknown): payload is { route: string; riskLevel: string; permissionMode: string; skippedStages: string[] } {
  if (!payload || typeof payload !== 'object') return false
  const candidate = payload as { route?: unknown; riskLevel?: unknown; permissionMode?: unknown; skippedStages?: unknown }
  return typeof candidate.route === 'string'
    && typeof candidate.riskLevel === 'string'
    && typeof candidate.permissionMode === 'string'
    && Array.isArray(candidate.skippedStages)
}

function extractPolicyActions(payload: unknown): EngineeringTranscriptTimelinePolicyAction[] {
  if (!payload || typeof payload !== 'object' || !('policy' in payload)) return []
  const policy = (payload as { policy?: unknown }).policy
  if (!policy || typeof policy !== 'object' || !('actions' in policy)) return []
  const actions = (policy as { actions?: unknown }).actions
  if (!Array.isArray(actions)) return []
  return actions.filter(isPolicyAction).map((action) => ({ ...action }))
}

function isPolicyAction(action: unknown): action is EngineeringTranscriptTimelinePolicyAction {
  if (!action || typeof action !== 'object') return false
  const candidate = action as { type?: unknown; path?: unknown }
  return typeof candidate.type === 'string' && typeof candidate.path === 'string'
}

function summarizePolicyActions(actions: EngineeringTranscriptTimelinePolicyAction[]): string {
  const counts = new Map<string, number>()
  for (const action of actions) {
    counts.set(action.type, (counts.get(action.type) || 0) + 1)
  }
  return Array.from(counts.entries()).map(([type, count]) => `${type}: ${count}`).join(', ')
}

function groupTimelineItems(items: EngineeringTranscriptTimelineItem[]): EngineeringTranscriptTimelineGroup[] {
  const groups = new Map<string, EngineeringTranscriptTimelineGroup>()
  for (const item of items) {
    const groupId = createGroupId(item)
    const existing = groups.get(groupId)
    if (existing) {
      existing.items.push(item)
    } else {
      groups.set(groupId, {
        id: groupId,
        sessionId: item.sessionId,
        turnId: item.turnId,
        taskId: item.taskId,
        items: [item],
      })
    }
  }
  return Array.from(groups.values())
}

function createGroupId(item: EngineeringTranscriptTimelineItem): string {
  if (item.sessionId && item.turnId) return `session:${item.sessionId}:turn:${item.turnId}`
  if (item.sessionId) return `session:${item.sessionId}`
  if (item.taskId) return `task:${item.taskId}`
  return 'ungrouped'
}
