import { describe, expect, it } from 'vitest'
import { buildEngineeringTranscriptTimeline } from './transcript-timeline'
import type { EngineeringTranscriptSnapshot } from './transcript-recorder'

describe('transcript timeline route decisions', () => {
  it('maps route_decision transcript events to route timeline items', () => {
    const snapshot: EngineeringTranscriptSnapshot = {
      events: [
        {
          id: 'route-1',
          sequence: 1,
          type: 'route_decision',
          sessionId: 'session-1',
          turnId: 'turn-1',
          createdAt: '2026-01-01T00:00:00.000Z',
          payload: {
            route: 'review',
            subtype: 'review.diff',
            riskLevel: 'low',
            permissionMode: 'plan',
            requiredCapabilities: ['context', 'git_diff', 'review'],
            skippedStages: ['snapshot', 'execute', 'verify'],
            reason: 'explicit review request',
          },
        },
        {
          id: 'skip-1',
          sequence: 2,
          type: 'stage_skipped',
          sessionId: 'session-1',
          turnId: 'turn-1',
          createdAt: '2026-01-01T00:00:01.000Z',
          payload: {
            stage: 'execute',
            reason: 'Skipped by route=review: explicit review request',
          },
        },
        {
          id: 'verify-strategy-1',
          sequence: 3,
          type: 'verification_strategy',
          sessionId: 'session-1',
          turnId: 'turn-1',
          taskId: 'task-1',
          createdAt: '2026-01-01T00:00:02.000Z',
          payload: {
            subtype: 'verify.lint',
            commandIds: ['npm-lint'],
            commandLabels: ['Frontend lint'],
            reason: 'Selected by subtype=verify.lint',
          },
        },
        {
          id: 'review-strategy-1',
          sequence: 4,
          type: 'review_strategy',
          sessionId: 'session-1',
          turnId: 'turn-1',
          taskId: 'task-1',
          createdAt: '2026-01-01T00:00:03.000Z',
          payload: {
            subtype: 'review.security',
            focus: 'security',
            reason: 'Selected by subtype=review.security',
          },
        },
      ],
    }

    const timeline = buildEngineeringTranscriptTimeline(snapshot)

    expect(timeline.items).toHaveLength(4)
    expect(timeline.items[0]).toEqual(expect.objectContaining({
      kind: 'route',
      title: 'Route decided',
      summary: 'route=review subtype=review.diff risk=low permission=plan skipped=snapshot,execute,verify',
    }))
    expect(timeline.items[1]).toEqual(expect.objectContaining({
      kind: 'skipped',
      title: 'Stage skipped',
      summary: 'stage=execute reason=Skipped by route=review: explicit review request',
    }))
    expect(timeline.items[2]).toEqual(expect.objectContaining({
      kind: 'strategy',
      title: 'Verification strategy selected',
      summary: 'verification subtype=verify.lint commands=npm-lint',
    }))
    expect(timeline.items[3]).toEqual(expect.objectContaining({
      kind: 'strategy',
      title: 'Review strategy selected',
      summary: 'review subtype=review.security focus=security',
    }))
  })
})
