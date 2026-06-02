import type { EngineeringTaskCenterActionRequest } from '../stores/engineeringTaskStateStore';

export type EngineeringTaskControlPermissionStatus = 'allowed' | 'requires_confirmation' | 'denied';

export interface EngineeringTaskControlPermissionDecision {
  type: 'task_control_permission_decision';
  taskId: string;
  action: EngineeringTaskCenterActionRequest['action'];
  status: EngineeringTaskControlPermissionStatus;
  reason: string;
  requestedAt: string;
  decidedAt: string;
}

export interface EngineeringTaskControlPermissionOptions {
  requireCancelConfirmation?: boolean;
}

export function decideEngineeringTaskControlPermission(
  request: EngineeringTaskCenterActionRequest,
  options: EngineeringTaskControlPermissionOptions = {},
): EngineeringTaskControlPermissionDecision {
  const decidedAt = new Date().toISOString();
  if (!request.taskId.trim()) {
    return {
      type: 'task_control_permission_decision',
      taskId: request.taskId,
      action: request.action,
      status: 'denied',
      reason: 'missing_task_id',
      requestedAt: request.requestedAt,
      decidedAt,
    };
  }

  if (request.action === 'cancel' && options.requireCancelConfirmation !== false) {
    return {
      type: 'task_control_permission_decision',
      taskId: request.taskId,
      action: request.action,
      status: 'requires_confirmation',
      reason: 'cancel_requires_confirmation',
      requestedAt: request.requestedAt,
      decidedAt,
    };
  }

  return {
    type: 'task_control_permission_decision',
    taskId: request.taskId,
    action: request.action,
    status: 'allowed',
    reason: 'policy_allowed',
    requestedAt: request.requestedAt,
    decidedAt,
  };
}
