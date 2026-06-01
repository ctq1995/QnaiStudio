import { describe, expect, it } from 'vitest'
import { buildEngineeringReviewPrompt, buildEngineeringReviewPromptForSubtype } from './review-policy'

const diff = 'diff --git a/src/App.tsx b/src/App.tsx'

describe('review subtype prompt selection', () => {
  it('uses default prompt when subtype is missing or diff review', () => {
    expect(buildEngineeringReviewPromptForSubtype(undefined, diff)).toBe(buildEngineeringReviewPrompt(diff))
    expect(buildEngineeringReviewPromptForSubtype('review.diff', diff)).toBe(buildEngineeringReviewPrompt(diff))
  })

  it('builds security-focused prompt', () => {
    const prompt = buildEngineeringReviewPromptForSubtype('review.security', diff)

    expect(prompt).toContain('security focus')
    expect(prompt).toContain('Authentication, authorization')
    expect(prompt).toContain(diff)
  })

  it('builds architecture-focused prompt', () => {
    const prompt = buildEngineeringReviewPromptForSubtype('review.architecture', diff)

    expect(prompt).toContain('architecture focus')
    expect(prompt).toContain('Module boundary violations')
    expect(prompt).toContain(diff)
  })

  it('builds performance-focused prompt', () => {
    const prompt = buildEngineeringReviewPromptForSubtype('review.performance', diff)

    expect(prompt).toContain('performance focus')
    expect(prompt).toContain('Latency, hot-path')
    expect(prompt).toContain(diff)
  })
})
