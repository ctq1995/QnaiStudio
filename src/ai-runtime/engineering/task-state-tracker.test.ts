import { describe, expect, it } from 'vitest'
import { EngineeringTaskStateTracker } from './task-state-tracker'

describe('EngineeringTaskStateTracker', () => {
  const now = () => '2026-06-01T00:00:00.000Z'

  it('captures route decisions and skipped stages from turn events', () => {
    const tracker = new EngineeringTaskStateTracker({ now })

    tracker.recordTurnEvent({ type: 'turn_started', sessionId: 'session-1', turnId: 'turn-1', taskId: 'task-1' })
    tracker.recordTurnEvent({
      type: 'route_decided',
      sessionId: 'session-1',
      turnId: 'turn-1',
      taskId: 'task-1',
      route: 'review',
      subtype: 'review.security',
      riskLevel: 'medium',
      permissionMode: 'plan',
      requiredCapabilities: ['context', 'git_diff', 'review'],
      skippedStages: ['snapshot', 'execute', 'verify'],
      reason: 'explicit security review',
    })

    expect(tracker.getTaskState('task-1')).toEqual(expect.objectContaining({
      taskId: 'task-1',
      sessionId: 'session-1',
      turnId: 'turn-1',
      status: 'routed',
      route: 'review',
      subtype: 'review.security',
      riskLevel: 'medium',
      permissionMode: 'plan',
      skippedStages: ['snapshot', 'execute', 'verify'],
    }))
  })

  it('updates current stage from run stage events', () => {
    const tracker = new EngineeringTaskStateTracker({ now })

    tracker.recordRunEvent({ type: 'stage_started', taskId: 'task-1', stage: 'context' })
    expect(tracker.getTaskState('task-1')).toEqual(expect.objectContaining({
      status: 'context_building',
      currentStage: 'context',
    }))

    tracker.recordRunEvent({ type: 'stage_started', taskId: 'task-1', stage: 'verify' })
    expect(tracker.getTaskState('task-1')).toEqual(expect.objectContaining({
      status: 'verifying',
      currentStage: 'verify',
    }))
  })

  it('captures verification and review strategies', () => {
    const tracker = new EngineeringTaskStateTracker({ now })

    tracker.recordRunEvent({
      type: 'verification_strategy_selected',
      taskId: 'task-1',
      subtype: 'verify.lint',
      commandIds: ['npm-lint'],
      commandLabels: ['Frontend lint'],
      reason: 'Selected by subtype=verify.lint',
    })
    tracker.recordTurnEvent({
      type: 'review_strategy_selected',
      sessionId: 'session-1',
      turnId: 'turn-1',
      taskId: 'task-1',
      subtype: 'review.security',
      focus: 'security',
      reason: 'Selected by subtype=review.security',
    })

    expect(tracker.getTaskState('task-1')).toEqual(expect.objectContaining({
      verificationStrategy: {
        subtype: 'verify.lint',
        commandIds: ['npm-lint'],
      },
      reviewStrategy: {
        subtype: 'review.security',
        focus: 'security',
      },
    }))
  })

  it('records completion and failure final states', () => {
    const completedTracker = new EngineeringTaskStateTracker({ now })
    completedTracker.recordTurnEvent({ type: 'turn_started', sessionId: 'session-1', turnId: 'turn-1', taskId: 'task-1' })
    completedTracker.recordTurnEvent({ type: 'turn_completed', sessionId: 'session-1', turnId: 'turn-1', taskId: 'task-1', success: true })

    expect(completedTracker.getTaskState('task-1')).toEqual(expect.objectContaining({
      status: 'completed',
      completedAt: '2026-06-01T00:00:00.000Z',
      error: undefined,
    }))

    const failedTracker = new EngineeringTaskStateTracker({ now })
    failedTracker.recordTurnEvent({ type: 'turn_failed', sessionId: 'session-1', turnId: 'turn-1', taskId: 'task-2', error: 'model failed' })

    expect(failedTracker.getTaskState('task-2')).toEqual(expect.objectContaining({
      status: 'failed',
      completedAt: '2026-06-01T00:00:00.000Z',
      error: 'model failed',
    }))
  })

  it('resets tracked state', () => {
    const tracker = new EngineeringTaskStateTracker({ now })
    tracker.recordRunEvent({ type: 'stage_started', taskId: 'task-1', stage: 'context' })

    expect(tracker.getAllTaskStates()).toHaveLength(1)
    tracker.reset()
    expect(tracker.getAllTaskStates()).toEqual([])
    expect(tracker.getTaskState('task-1')).toBeUndefined()
  })
})
