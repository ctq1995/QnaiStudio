import type { EngineeringAgentRouteSubtype } from './agent-router'

export function shouldRunReview(diff: string): boolean {
  return diff.trim().length > 0
}

export function buildEngineeringReviewPrompt(diff: string): string {
  return [
    'Review this engineering task diff for correctness and safety.',
    '',
    'Focus on:',
    '- Obvious bugs or broken workflow behavior.',
    '- Workspace boundary violations or unsafe file operations.',
    '- Secret, token, API key, or credential exposure.',
    '- Unnecessary large-scope changes unrelated to the task.',
    '- Missing verification signals.',
    '',
    'Return concise findings. If there are no findings, say so explicitly.',
    '',
    'Diff:',
    '```diff',
    diff,
    '```',
  ].join('\n')
}

export function buildEngineeringReviewPromptForSubtype(subtype: EngineeringAgentRouteSubtype | undefined, diff: string): string {
  if (subtype === 'review.security') {
    return buildFocusedReviewPrompt(diff, 'security', [
      'Authentication, authorization, and privilege-boundary mistakes.',
      'Secret, token, API key, credential, or private key exposure.',
      'Injection risks including XSS, command injection, SQL injection, and path traversal.',
      'Unsafe file, process, network, or workspace boundary behavior.',
    ])
  }

  if (subtype === 'review.architecture') {
    return buildFocusedReviewPrompt(diff, 'architecture', [
      'Module boundary violations and dependency direction problems.',
      'API contract changes that are not reflected at call sites.',
      'Over-coupling, misplaced responsibilities, or abstraction leaks.',
      'State flow or lifecycle changes that make the system harder to reason about.',
    ])
  }

  if (subtype === 'review.performance') {
    return buildFocusedReviewPrompt(diff, 'performance', [
      'Latency, hot-path, or unnecessary allocation regressions.',
      'N+1 patterns, over-fetching, repeated expensive work, or blocking calls.',
      'Frontend rendering, memoization, bundle, or event-loop regressions.',
      'Scale-sensitive changes that can degrade on large workspaces or diffs.',
    ])
  }

  return buildEngineeringReviewPrompt(diff)
}

function buildFocusedReviewPrompt(diff: string, focus: string, focusItems: string[]): string {
  return [
    `Review this engineering task diff with a ${focus} focus.`,
    '',
    'Focus on:',
    ...focusItems.map((item) => `- ${item}`),
    '',
    'Return concise findings. If there are no findings, say so explicitly.',
    '',
    'Diff:',
    '```diff',
    diff,
    '```',
  ].join('\n')
}
