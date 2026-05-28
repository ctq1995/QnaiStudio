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
