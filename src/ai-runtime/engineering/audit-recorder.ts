import type { EngineeringPermissionDecision, EngineeringPermissionMode } from './permission-policy'

export interface EngineeringPermissionAuditRecord {
  type: 'permission'
  taskId: string
  toolCallId: string
  toolName: string
  mode: EngineeringPermissionMode
  decision: EngineeringPermissionDecision['type']
  reason: string
  createdAt: string
}

export interface EngineeringToolAuditRecord {
  type: 'tool'
  taskId: string
  toolCallId: string
  toolName: string
  status: 'success' | 'error' | 'skipped'
  startedAt: string
  completedAt: string
  durationMs: number
  error?: string
}

export interface EngineeringAuditSummary {
  permissionRecords: number
  toolRecords: number
  deniedPermissions: number
  approvalsRequired: number
  toolErrors: number
}

export interface EngineeringAuditRecorder {
  recordPermission(record: EngineeringPermissionAuditRecord): void
  recordTool(record: EngineeringToolAuditRecord): void
  getSummary(): EngineeringAuditSummary
}

export class InMemoryEngineeringAuditRecorder implements EngineeringAuditRecorder {
  readonly permissionRecords: EngineeringPermissionAuditRecord[] = []
  readonly toolRecords: EngineeringToolAuditRecord[] = []

  recordPermission(record: EngineeringPermissionAuditRecord): void {
    this.permissionRecords.push(record)
  }

  recordTool(record: EngineeringToolAuditRecord): void {
    this.toolRecords.push(record)
  }

  getSummary(): EngineeringAuditSummary {
    return {
      permissionRecords: this.permissionRecords.length,
      toolRecords: this.toolRecords.length,
      deniedPermissions: this.permissionRecords.filter((record) => record.decision === 'deny').length,
      approvalsRequired: this.permissionRecords.filter((record) => record.decision === 'ask').length,
      toolErrors: this.toolRecords.filter((record) => record.status === 'error').length,
    }
  }
}
