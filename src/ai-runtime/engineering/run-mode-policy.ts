import type { EngineeringTaskClassification } from './types'

export type EngineeringRunMode = 'plan' | 'act'

export interface EngineeringRunModeDecision {
  mode: EngineeringRunMode
  allowSnapshot: boolean
  allowExecution: boolean
  allowVerification: boolean
  allowReview: boolean
  skippedStages: string[]
}

export interface ResolveEngineeringRunModeInput {
  requestedMode?: EngineeringRunMode
  classification: EngineeringTaskClassification
}

export function resolveEngineeringRunMode(input: ResolveEngineeringRunModeInput): EngineeringRunModeDecision {
  const mode = input.requestedMode || inferRunMode(input.classification)
  if (mode === 'act') {
    return {
      mode,
      allowSnapshot: true,
      allowExecution: true,
      allowVerification: true,
      allowReview: true,
      skippedStages: [],
    }
  }

  return {
    mode,
    allowSnapshot: false,
    allowExecution: false,
    allowVerification: false,
    allowReview: false,
    skippedStages: ['snapshot', 'execute', 'diff', 'verify', 'review'],
  }
}

function inferRunMode(classification: EngineeringTaskClassification): EngineeringRunMode {
  if (classification.kind === 'feature' || classification.kind === 'bugfix' || classification.kind === 'refactor') return 'act'
  return 'plan'
}
