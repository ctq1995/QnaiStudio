import { describe, expect, it } from 'vitest'
import { createTranscriptPayloadPolicy } from './transcriptPayloadPolicy'

describe('transcriptPayloadPolicy', () => {
  it('redacts sensitive keys and reports actions', () => {
    const policy = createTranscriptPayloadPolicy()
    const result = policy({ token: 'abc123', safe: 'visible' })

    expect(result.payload).toEqual({ token: '[redacted]', safe: 'visible' })
    expect(result.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'redacted', path: '$.token' }),
    ]))
  })

  it('redacts common secret patterns inside string content', () => {
    const policy = createTranscriptPayloadPolicy()
    const result = policy({ output: 'key sk-abcdefghijklmnopqrstuvwxyz1234567890 done' })

    expect(result.payload).toEqual({ output: 'key [redacted] done' })
    expect(result.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'secret_redacted', path: '$.output', detail: 'matched openai_key' }),
    ]))
  })

  it('truncates long strings and reports omitted characters', () => {
    const policy = createTranscriptPayloadPolicy({ maxStringLength: 5 })
    const result = policy({ output: 'abcdefghij' })

    expect(result.payload).toEqual({ output: 'abcde...[truncated 5 chars]' })
    expect(result.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'truncated', path: '$.output', detail: '5 chars omitted' }),
    ]))
  })

  it('truncates arrays and objects according to budget', () => {
    const policy = createTranscriptPayloadPolicy({ maxArrayItems: 2, maxObjectKeys: 2 })
    const result = policy({ list: [1, 2, 3], object: { a: 1, b: 2, c: 3 } })

    expect(result.payload).toEqual({ list: [1, 2], object: { a: 1, b: 2 } })
    expect(result.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'array_truncated', path: '$.list' }),
      expect.objectContaining({ type: 'object_truncated', path: '$.object' }),
    ]))
  })

  it('detects circular references without flagging shared references', () => {
    const shared = { value: 'shared' }
    const circular: { child?: unknown } = {}
    circular.child = circular
    const policy = createTranscriptPayloadPolicy()

    const sharedResult = policy({ first: shared, second: shared })
    expect(sharedResult.payload).toEqual({ first: { value: 'shared' }, second: { value: 'shared' } })
    expect(sharedResult.actions.some((action) => action.type === 'circular')).toBe(false)

    const circularResult = policy({ circular })
    expect(circularResult.payload).toEqual({ circular: { child: '[circular]' } })
    expect(circularResult.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'circular', path: '$.circular.child' }),
    ]))
  })

  it('reports max depth and converted values', () => {
    const policy = createTranscriptPayloadPolicy({ maxDepth: 2 })
    const result = policy({ nested: { deeper: { value: 'hidden' } }, bigint: 1n })

    expect(result.payload).toEqual({ nested: { deeper: '[max-depth-exceeded]' }, bigint: '1' })
    expect(result.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'max_depth', path: '$.nested.deeper' }),
      expect.objectContaining({ type: 'converted', path: '$.bigint' }),
    ]))
  })
})
