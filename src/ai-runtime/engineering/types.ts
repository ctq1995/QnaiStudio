export type EngineeringTaskKind = 'feature' | 'bugfix' | 'refactor' | 'review' | 'explain' | 'unknown'

export type EngineeringStage =
  | 'classify'
  | 'snapshot'
  | 'execute'
  | 'diff'
  | 'verify'
  | 'review'
  | 'summarize'

export interface EngineeringTaskClassification {
  kind: EngineeringTaskKind
  mayModifyFiles: boolean
  requiresVerification: boolean
  requiresReview: boolean
  confidence: number
  reason: string
}

export interface EngineeringRunInput {
  taskId?: string
  userRequest: string
  workspaceDir: string
  selectedFiles?: string[]
}

export interface EngineeringAgentRequest {
  taskId: string
  userRequest: string
  workspaceDir: string
  selectedFiles: string[]
  classification: EngineeringTaskClassification
}

export interface EngineeringAgentResult {
  success: boolean
  content?: string
  error?: string
}

export interface SnapshotResult {
  created: boolean
  label?: string
  versionId?: string
  error?: string
}

export type VerificationRisk = 'safe' | 'medium'

export interface VerificationCommand {
  id: string
  label: string
  command: string
  cwd?: string
  risk: VerificationRisk
}

export interface VerificationResult {
  command: VerificationCommand
  success: boolean
  output: string
  error?: string
}

export interface ReviewResult {
  success: boolean
  skipped?: boolean
  content?: string
  error?: string
}

export interface EngineeringRunSummary {
  taskId: string
  classification: EngineeringTaskClassification
  snapshot: SnapshotResult
  agentResult?: EngineeringAgentResult
  diff?: string
  diffError?: string
  verificationResults: VerificationResult[]
  review: ReviewResult
  success: boolean
  failedStage?: EngineeringStage
  finalMessage: string
}
