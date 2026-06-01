import type { EngineeringTaskCenterAction, EngineeringTaskCenterActionRequest } from '../stores/engineeringTaskStateStore';

export type EngineeringTaskControlRuntimeAction = Extract<EngineeringTaskCenterAction, 'pause' | 'resume' | 'cancel'>;

export interface EngineeringTaskControlRuntimeAckEvent {
  type: 'task_control_runtime_ack';
  taskId: string;
  action: EngineeringTaskControlRuntimeAction;
  status: 'acknowledged';
  reason: 'noop_runtime_handler';
  requestedAt: string;
  acknowledgedAt: string;
}

export interface EngineeringTaskControlRuntimeBridge {
  acknowledge(request: EngineeringTaskCenterActionRequest): Promise<EngineeringTaskControlRuntimeAckEvent | undefined>;
}

export function createNoopEngineeringTaskControlRuntimeBridge(): EngineeringTaskControlRuntimeBridge {
  return {
    acknowledge: async (request) => {
      if (!isRuntimeAction(request.action)) return undefined;
      return {
        type: 'task_control_runtime_ack',
        taskId: request.taskId,
        action: request.action,
        status: 'acknowledged',
        reason: 'noop_runtime_handler',
        requestedAt: request.requestedAt,
        acknowledgedAt: new Date().toISOString(),
      };
    },
  };
}

export function isRuntimeAction(action: EngineeringTaskCenterAction): action is EngineeringTaskControlRuntimeAction {
  return action === 'pause' || action === 'resume' || action === 'cancel';
}
