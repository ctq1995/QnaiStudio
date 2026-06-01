import type { EngineeringAgentRouteDecision } from './agent-router'
import type { EngineeringAuditSummary } from './audit-recorder'
import type { EngineeringContextProviderResult } from './context-provider'
import type { EngineeringDiagnostic } from './diagnostics-provider'
import type { EngineeringGitDiffContext } from './git-diff-provider'
import type { EngineeringPermissionMode } from './permission-policy'
import type { EngineeringProjectFingerprint } from './project-fingerprint'
import type { EngineeringRepoMap } from './repo-map'
import type { EngineeringRunMode, EngineeringRunModeDecision } from './run-mode-policy'
import type { EngineeringTerminalOutput } from './terminal-provider'
import type { EngineeringContextBudget } from './token-budget'

export type EngineeringTaskKind = 'feature' | 'bugfix' | 'refactor' | 'review' | 'explain' | 'unknown'

export type EngineeringStage =
  | 'classify'
  | 'context'
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
  diagnostics?: EngineeringDiagnostic[]
  terminalOutputs?: EngineeringTerminalOutput[]
  gitDiff?: EngineeringGitDiffContext
  runMode?: EngineeringRunMode
  permissionMode?: EngineeringPermissionMode
  routeDecision?: EngineeringAgentRouteDecision
}

export interface EngineeringProjectSignals {
  hasFrontend: boolean
  hasTauri: boolean
  packageManager?: string
  buildTools: string[]
  scripts: Record<string, string>
  fingerprint: EngineeringProjectFingerprint
}

export interface EngineeringInstructionFile {
  path: string
  content: string
  truncated: boolean
}

export interface EngineeringInstructions {
  files: EngineeringInstructionFile[]
  merged: string
}

export interface EngineeringContext {
  workspaceDir: string
  selectedFiles: string[]
  candidateFiles: string[]
  repoMap?: EngineeringRepoMap
  instructions: EngineeringInstructions
  budget: EngineeringContextBudget
  providers: EngineeringContextProviderResult[]
  projectSignals: EngineeringProjectSignals
  summary: string
}

export interface EngineeringAgentRequest {
  taskId: string
  userRequest: string
  workspaceDir: string
  selectedFiles: string[]
  classification: EngineeringTaskClassification
  context?: EngineeringContext
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
  context?: EngineeringContext
  runModeDecision?: EngineeringRunModeDecision
  snapshot: SnapshotResult
  agentResult?: EngineeringAgentResult
  diff?: string
  diffError?: string
  verificationResults: VerificationResult[]
  review: ReviewResult
  audit?: EngineeringAuditSummary
  success: boolean
  failedStage?: EngineeringStage
  finalMessage: string
}

export type EngineeringRunEvent =
  | { type: 'stage_started'; taskId: string; stage: EngineeringStage }
  | { type: 'stage_completed'; taskId: string; stage: EngineeringStage }
  | { type: 'stage_failed'; taskId: string; stage: EngineeringStage; error: string }
  | { type: 'stage_skipped'; taskId: string; stage: EngineeringStage; reason: string }
  | { type: 'context_built'; taskId: string; candidateFileCount: number }
  | { type: 'snapshot_created'; taskId: string; versionId: string; label?: string }
  | { type: 'verification_started'; taskId: string; command: VerificationCommand }
  | { type: 'verification_completed'; taskId: string; command: VerificationCommand; success: boolean }
  | { type: 'verification_strategy_selected'; taskId: string; subtype?: EngineeringAgentRouteDecision['subtype']; commandIds: string[]; commandLabels: string[]; reason: string }
  | { type: 'review_strategy_selected'; taskId: string; subtype?: EngineeringAgentRouteDecision['subtype']; focus: string; reason: string }
  | { type: 'review_completed'; taskId: string; success: boolean; skipped?: boolean; skippedReason?: string }

export type EngineeringRunEventHandler = (event: EngineeringRunEvent) => void
