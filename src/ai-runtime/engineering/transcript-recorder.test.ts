import { describe, expect, it } from 'vitest'
import { EngineeringTranscriptRecorder } from './transcript-recorder'

describe('EngineeringTranscriptRecorder', () => {
  it('promotes turn event taskId to transcript event taskId', async () => {
    const recorder = new EngineeringTranscriptRecorder({ createEventId: () => 'event-1' })

    const event = await recorder.recordTurnEvent({
      type: 'verification_strategy_selected',
      sessionId: 'session-1',
      turnId: 'turn-1',
      taskId: 'task-1',
      subtype: 'verify.lint',
      commandIds: ['npm-lint'],
      commandLabels: ['Frontend lint'],
      reason: 'Selected by subtype=verify.lint',
    })

    expect(event).toEqual(expect.objectContaining({
      type: 'verification_strategy',
      sessionId: 'session-1',
      turnId: 'turn-1',
      taskId: 'task-1',
    }))
  })
})
