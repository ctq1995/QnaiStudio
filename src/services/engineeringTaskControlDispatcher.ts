import type { EngineeringTaskCenterAction, EngineeringTaskCenterActionRequest } from '../stores/engineeringTaskStateStore';

export type EngineeringTaskControlDispatchStatus = 'accepted' | 'rejected' | 'noop';

export interface EngineeringTaskControlDispatchResult {
  taskId: string;
  action: EngineeringTaskCenterAction;
  status: EngineeringTaskControlDispatchStatus;
  reason: string;
  requestedAt: string;
  handledAt: string;
}

export type EngineeringTaskControlAuditEvent =
  | { type: 'task_control_requested'; taskId: string; action: EngineeringTaskCenterAction; requestedAt: string }
  | { type: 'task_control_dispatched'; taskId: string; action: EngineeringTaskCenterAction; status: EngineeringTaskControlDispatchStatus; reason: string; requestedAt: string; handledAt: string };

export interface EngineeringTaskControlDispatchWithAudit {
  result: EngineeringTaskControlDispatchResult;
  events: EngineeringTaskControlAuditEvent[];
}

export function dispatchEngineeringTaskControlAction(
  request: EngineeringTaskCenterActionRequest,
): EngineeringTaskControlDispatchResult {
  const handledAt = new Date().toISOString();
  if (!request.taskId.trim()) {
    return {
      taskId: request.taskId,
      action: request.action,
      status: 'rejected',
      reason: 'missing_task_id',
      requestedAt: request.requestedAt,
      handledAt,
    };
  }

  return {
    taskId: request.taskId,
    action: request.action,
    status: 'accepted',
    reason: getAcceptedReason(request.action),
    requestedAt: request.requestedAt,
    handledAt,
  };
}

export function dispatchEngineeringTaskControlActionWithAudit(
  request: EngineeringTaskCenterActionRequest,
): EngineeringTaskControlDispatchWithAudit {
  const result = dispatchEngineeringTaskControlAction(request);
  return {
    result,
    events: [
      {
        type: 'task_control_requested',
        taskId: request.taskId,
        action: request.action,
        requestedAt: request.requestedAt,
      },
      {
        type: 'task_control_dispatched',
        taskId: result.taskId,
        action: result.action,
        status: result.status,
        reason: result.reason,
        requestedAt: result.requestedAt,
        handledAt: result.handledAt,
      },
    ],
  };
}

function getAcceptedReason(action: EngineeringTaskCenterAction): string {
  if (action === 'open_transcript' || action === 'open_timeline') {
    return 'navigation_pending';
  }
  return 'noop_control_handler';
}
