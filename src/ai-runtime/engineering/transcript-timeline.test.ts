import { describe, expect, it } from 'vitest'
import { buildEngineeringTranscriptTimeline } from './transcript-timeline'
import type { EngineeringTranscriptSnapshot } from './transcript-recorder'

describe('buildEngineeringTranscriptTimeline', () => {
  it('sorts transcript events by sequence and maps basic kinds', () => {
    const snapshot: EngineeringTranscriptSnapshot = {
      events: [
        { id: 'turn', sequence: 2, type: 'turn_started', sessionId: 's1', turnId: 't1', createdAt: '2026-01-01T00:00:02.000Z' },
        { id: 'session', sequence: 1, type: 'session_started', sessionId: 's1', createdAt: '2026-01-01T00:00:01.000Z' },
      ],
    }

    const timeline = buildEngineeringTranscriptTimeline(snapshot)

    expect(timeline.items.map((item) => item.eventId)).toEqual(['session', 'turn'])
    expect(timeline.items.map((item) => item.kind)).toEqual(['session', 'turn'])
  })

  it('groups items by session and turn when available', () => {
    const snapshot: EngineeringTranscriptSnapshot = {
      events: [
        { id: 'a', sequence: 1, type: 'turn_started', sessionId: 's1', turnId: 't1', createdAt: '2026-01-01T00:00:01.000Z' },
        { id: 'b', sequence: 2, type: 'tool_call', sessionId: 's1', turnId: 't1', createdAt: '2026-01-01T00:00:02.000Z' },
        { id: 'c', sequence: 3, type: 'turn_started', sessionId: 's1', turnId: 't2', createdAt: '2026-01-01T00:00:03.000Z' },
      ],
    }

    const timeline = buildEngineeringTranscriptTimeline(snapshot)

    expect(timeline.groups.map((group) => group.id)).toEqual(['session:s1:turn:t1', 'session:s1:turn:t2'])
    expect(timeline.groups[0].items.map((item) => item.eventId)).toEqual(['a', 'b'])
  })

  it('creates policy timeline items and counts policy actions', () => {
    const snapshot: EngineeringTranscriptSnapshot = {
      events: [
        {
          id: 'payload',
          sequence: 1,
          type: 'tool_result',
          sessionId: 's1',
          turnId: 't1',
          createdAt: '2026-01-01T00:00:01.000Z',
          payload: {
            payload: { output: '[redacted]' },
            policy: {
              actions: [
                { type: 'secret_redacted', path: '$.output', detail: 'matched openai_key' },
                { type: 'truncated', path: '$.output', detail: '10 chars omitted' },
              ],
            },
          },
        },
      ],
    }

    const timeline = buildEngineeringTranscriptTimeline(snapshot)

    expect(timeline.policyActionCount).toBe(2)
    expect(timeline.items).toHaveLength(2)
    expect(timeline.items[0]).toEqual(expect.objectContaining({ kind: 'tool', policyActions: expect.arrayContaining([
      expect.objectContaining({ type: 'secret_redacted' }),
    ]) }))
    expect(timeline.items[1]).toEqual(expect.objectContaining({
      kind: 'policy',
      title: 'Policy actions: 2',
      summary: 'secret_redacted: 1, truncated: 1',
    }))
  })

  it('uses fallback groups for unscoped events', () => {
    const snapshot: EngineeringTranscriptSnapshot = {
      events: [
        { id: 'note', sequence: 1, type: 'note', createdAt: '2026-01-01T00:00:01.000Z' },
      ],
    }

    const timeline = buildEngineeringTranscriptTimeline(snapshot)

    expect(timeline.groups).toHaveLength(1)
    expect(timeline.groups[0].id).toBe('ungrouped')
  })
})
