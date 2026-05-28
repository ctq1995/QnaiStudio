import type { EngineeringTaskClassification } from './types'

export function shouldCreateSnapshot(classification: EngineeringTaskClassification): boolean {
  return classification.mayModifyFiles
}

export function createSnapshotLabel(kind: EngineeringTaskClassification['kind'], now = new Date()): string {
  const timestamp = now.toISOString().replace(/[:.]/g, '-')
  return `agent-before-${kind}-${timestamp}`
}
