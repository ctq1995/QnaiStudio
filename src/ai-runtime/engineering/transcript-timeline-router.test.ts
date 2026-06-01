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
            riskLevel: 'low',
            permissionMode: 'plan',
            requiredCapabilities: ['context', 'git_diff', 'review'],
            skippedStages: ['snapshot', 'execute', 'verify'],
            reason: 'explicit review request',
          },
        },
      ],
    }

    const timeline = buildEngineeringTranscriptTimeline(snapshot)

    expect(timeline.items).toHaveLength(1)
    expect(timeline.items[0]).toEqual(expect.objectContaining({
      kind: 'route',
      title: 'Route decided',
      summary: 'route=review risk=low permission=plan skipped=snapshot,execute,verify',
    }))
  })
})
