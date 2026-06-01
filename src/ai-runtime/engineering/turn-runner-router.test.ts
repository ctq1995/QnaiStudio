import { describe, expect, it } from 'vitest'
import { routeEngineeringAgentTask, type EngineeringAgentRouteCapability, type EngineeringAgentRouteDecision } from './agent-router'
import { buildProjectFingerprint } from './project-fingerprint'
import { EngineeringTurnRunner, type EngineeringTurnEvent } from './turn-runner'
import type { EngineeringRunSummary } from './types'

const workspaceDir = 'E:/workspace/project'

describe('EngineeringTurnRunner router integration', () => {
  it('routes turns by default and passes the decision to the pipeline', async () => {
    const events: EngineeringTurnEvent[] = []
    const calls: unknown[] = []
    const runner = new EngineeringTurnRunner({
      pipeline: createPipeline(calls),
      onTurnEvent: (event) => events.push(event),
      createTurnId: () => 'turn-router-default',
    })

    await runner.run({
      sessionId: 'session-1',
      userRequest: 'review the current diff',
      workspaceDir,
    })

    const routeEvent = events.find((event) => event.type === 'route_decided')
    expect(routeEvent).toEqual(expect.objectContaining({
      type: 'route_decided',
      route: 'review',
      subtype: 'review.diff',
      riskLevel: 'low',
    }))
    expect(events.filter((event) => event.type === 'stage_skipped').map((event) => event.stage)).toEqual(['snapshot', 'execute', 'verify'])
    expect(events).toContainEqual(expect.objectContaining({
      type: 'review_strategy_selected',
      subtype: 'review.diff',
      focus: 'diff',
    }))
    expect(calls).toHaveLength(1)
    expect(calls[0]).toEqual(expect.objectContaining({
      route: 'review',
    }))
  })

  it('respects explicit route decisions', async () => {
    const events: EngineeringTurnEvent[] = []
    const calls: unknown[] = []
    const input = {
      sessionId: 'session-1',
      userRequest: 'review the current diff',
      workspaceDir,
    }
    const explicitDecision: EngineeringAgentRouteDecision = {
      ...routeEngineeringAgentTask(input),
      route: 'execute' as const,
      riskLevel: 'high' as const,
      requiredCapabilities: ['context', 'snapshot', 'agent_execution', 'git_diff', 'verification', 'review'] satisfies EngineeringAgentRouteCapability[],
      skippedStages: [] as string[],
      reason: 'explicit override',
    }
    const runner = new EngineeringTurnRunner({
      pipeline: createPipeline(calls),
      onTurnEvent: (event) => events.push(event),
      createTurnId: () => 'turn-router-override',
    })

    await runner.run({ ...input, routeDecision: explicitDecision })

    expect(events.find((event) => event.type === 'route_decided')).toEqual(expect.objectContaining({
      route: 'execute',
      reason: 'explicit override',
    }))
    expect(calls[0]).toEqual(expect.objectContaining({ route: 'execute' }))
  })
})

function createPipeline(calls: unknown[]) {
  return {
    run: async (_input: unknown, options: { routeDecision?: EngineeringAgentRouteDecision; onEvent?: (event: any) => void }) => {
      calls.push(options.routeDecision)
      options.onEvent?.({
        type: 'review_strategy_selected',
        taskId: 'task-1',
        subtype: options.routeDecision?.subtype,
        focus: 'diff',
        reason: 'test strategy event',
      })
      return createSummary()
    },
  } as any
}

function createSummary(): EngineeringRunSummary {
  return {
    taskId: 'task-1',
    classification: {
      kind: 'review',
      mayModifyFiles: false,
      requiresVerification: false,
      requiresReview: true,
      confidence: 0.8,
      reason: 'test',
    },
    context: {
      workspaceDir,
      selectedFiles: [],
      candidateFiles: [],
      instructions: { files: [], merged: '' },
      budget: { maxTokens: 1000, reservedOutputTokens: 100, estimatedTokens: 0, remainingTokens: 900, overflow: false },
      providers: [],
      projectSignals: { hasFrontend: false, hasTauri: false, buildTools: [], scripts: {}, fingerprint: buildProjectFingerprint({ files: [] }) },
      summary: 'context',
    },
    runModeDecision: { mode: 'plan', allowSnapshot: false, allowExecution: false, allowVerification: false, allowReview: false, skippedStages: ['snapshot', 'execute', 'diff', 'verify', 'review'] },
    snapshot: { created: false },
    agentResult: { success: true, content: 'ok' },
    verificationResults: [],
    review: { success: true, skipped: false },
    audit: { permissionRecords: 0, toolRecords: 0, deniedPermissions: 0, approvalsRequired: 0, toolErrors: 0 },
    success: true,
    finalMessage: 'ok',
  }
}
