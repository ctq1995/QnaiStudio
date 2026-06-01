import type { ReactNode } from 'react';
import { clsx } from 'clsx';
import type { EngineeringTaskState } from '../../ai-runtime/engineering';
import { useEngineeringTaskStateStore, type EngineeringTaskCenterAction, type EngineeringTaskControlDispatchResult, type EngineeringTaskStateFilter } from '../../stores';

interface TaskCenterPanelProps {
  className?: string;
  width?: number;
}

const STATUS_OPTIONS: Array<EngineeringTaskState['status']> = [
  'queued',
  'running',
  'routed',
  'context_building',
  'executing',
  'diffing',
  'verifying',
  'reviewing',
  'completed',
  'failed',
  'canceled',
  'aborted',
];

const ROUTE_OPTIONS: Array<NonNullable<EngineeringTaskState['route']>> = [
  'plan',
  'execute',
  'verify',
  'review',
  'explain',
  'unknown',
];

export function TaskCenterPanel({ className = '', width }: TaskCenterPanelProps) {
  const taskStates = useEngineeringTaskStateStore((state) => state.taskStates);
  const filter = useEngineeringTaskStateStore((state) => state.filter);
  const activeTaskId = useEngineeringTaskStateStore((state) => state.activeTaskId);
  const setFilter = useEngineeringTaskStateStore((state) => state.setFilter);
  const selectTask = useEngineeringTaskStateStore((state) => state.selectTask);
  const getFilteredTaskStates = useEngineeringTaskStateStore((state) => state.getFilteredTaskStates);
  const getActiveTask = useEngineeringTaskStateStore((state) => state.getActiveTask);
  const dispatchTaskAction = useEngineeringTaskStateStore((state) => state.dispatchTaskAction);
  const lastActionResult = useEngineeringTaskStateStore((state) => state.lastActionResult);

  const filteredTasks = getFilteredTaskStates();
  const activeTask = getActiveTask() || filteredTasks[0];
  const widthStyle = { width: width ? `${width}px` : '360px' };

  const updateFilter = (patch: EngineeringTaskStateFilter) => {
    setFilter({ ...filter, ...patch });
  };

  return (
    <aside
      className={clsx(
        'flex shrink-0 flex-col border-l border-border bg-background-elevated transition-all duration-300',
        className,
      )}
      style={widthStyle}
    >
      <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-text-primary">Task Center</div>
          <div className="text-xs text-text-tertiary">工程任务状态</div>
        </div>
        <span className="rounded-md bg-background-surface px-2 py-0.5 text-xs text-text-secondary">
          {taskStates.length}
        </span>
      </div>

      <div className="border-b border-border-subtle bg-background-base/40 p-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs text-text-tertiary">
            状态
            <select
              value={filter.status && !Array.isArray(filter.status) ? filter.status : ''}
              onChange={(event) => updateFilter({ status: event.target.value ? event.target.value as EngineeringTaskState['status'] : undefined })}
              className="rounded-lg border border-border bg-background-surface px-2 py-1.5 text-xs text-text-primary outline-none focus:border-primary"
            >
              <option value="">全部</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-xs text-text-tertiary">
            路由
            <select
              value={filter.route && !Array.isArray(filter.route) ? filter.route : ''}
              onChange={(event) => updateFilter({ route: event.target.value ? event.target.value as NonNullable<EngineeringTaskState['route']> : undefined })}
              className="rounded-lg border border-border bg-background-surface px-2 py-1.5 text-xs text-text-primary outline-none focus:border-primary"
            >
              <option value="">全部</option>
              {ROUTE_OPTIONS.map((route) => (
                <option key={route} value={route}>{route}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {taskStates.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-text-tertiary">
          暂无工程任务状态
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <div className="w-1/2 min-w-0 overflow-y-auto border-r border-border-subtle">
            {filteredTasks.length === 0 ? (
              <div className="p-4 text-sm text-text-tertiary">没有匹配的任务</div>
            ) : (
              filteredTasks.map((task) => (
                <button
                  key={task.taskId}
                  type="button"
                  onClick={() => selectTask(task.taskId)}
                  className={clsx(
                    'w-full border-b border-border-subtle px-3 py-2 text-left transition-colors hover:bg-background-hover',
                    (activeTaskId === task.taskId || (!activeTaskId && activeTask?.taskId === task.taskId)) && 'bg-background-surface',
                  )}
                >
                  <div className="truncate text-xs font-medium text-text-primary">{task.taskId}</div>
                  <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                    <Badge>{task.status}</Badge>
                    {task.route && <Badge>{task.route}</Badge>}
                  </div>
                  <div className="mt-1 truncate text-[11px] text-text-tertiary">{task.subtype || task.currentStage || task.updatedAt}</div>
                </button>
              ))
            )}
          </div>

          <div className="min-w-0 flex-1 overflow-y-auto p-3">
            {activeTask ? (
              <TaskDetail
                task={activeTask}
                actionResult={lastActionResult?.taskId === activeTask.taskId ? lastActionResult : undefined}
                onAction={dispatchTaskAction}
              />
            ) : (
              <div className="text-sm text-text-tertiary">请选择任务</div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}

function TaskDetail({
  task,
  actionResult,
  onAction,
}: {
  task: EngineeringTaskState;
  actionResult?: EngineeringTaskControlDispatchResult;
  onAction: (taskId: string, action: EngineeringTaskCenterAction) => void;
}) {
  return (
    <div className="space-y-3 text-xs">
      <div>
        <div className="text-sm font-semibold text-text-primary">{task.taskId}</div>
        <div className="mt-1 text-text-tertiary">更新于 {task.updatedAt}</div>
      </div>

      <DetailGrid
        rows={[
          ['status', task.status],
          ['route', task.route],
          ['subtype', task.subtype],
          ['stage', task.currentStage],
          ['session', task.sessionId],
          ['turn', task.turnId],
        ]}
      />

      <TaskActions task={task} onAction={onAction} />

      {actionResult && (
        <Section title="Last action result">
          <DetailGrid rows={[
            ['action', actionResult.action],
            ['status', actionResult.status],
            ['reason', actionResult.reason],
            ['handled', actionResult.handledAt],
          ]} />
        </Section>
      )}

      <Section title="Skipped stages">
        {task.skippedStages.length > 0 ? (
          <div className="flex flex-wrap gap-1">{task.skippedStages.map((stage) => <Badge key={stage}>{stage}</Badge>)}</div>
        ) : (
          <span className="text-text-tertiary">无</span>
        )}
      </Section>

      <Section title="Verification strategy">
        {task.verificationStrategy ? (
          <DetailGrid rows={[
            ['subtype', task.verificationStrategy.subtype],
            ['commands', task.verificationStrategy.commandIds.join(', ') || 'none'],
          ]} />
        ) : (
          <span className="text-text-tertiary">未选择</span>
        )}
      </Section>

      <Section title="Review strategy">
        {task.reviewStrategy ? (
          <DetailGrid rows={[
            ['subtype', task.reviewStrategy.subtype],
            ['focus', task.reviewStrategy.focus],
          ]} />
        ) : (
          <span className="text-text-tertiary">未选择</span>
        )}
      </Section>
    </div>
  );
}

function TaskActions({
  task,
  onAction,
}: {
  task: EngineeringTaskState;
  onAction: (taskId: string, action: EngineeringTaskCenterAction) => void;
}) {
  const actions: Array<{ action: EngineeringTaskCenterAction; label: string; enabled: boolean }> = [
    { action: 'pause', label: 'Pause', enabled: canPause(task.status) },
    { action: 'resume', label: 'Resume', enabled: canResume(task.status) },
    { action: 'cancel', label: 'Cancel', enabled: canCancel(task.status) },
    { action: 'open_transcript', label: 'Transcript', enabled: true },
    { action: 'open_timeline', label: 'Timeline', enabled: true },
  ];

  return (
    <Section title="Actions">
      <div className="grid grid-cols-2 gap-1.5">
        {actions.map(({ action, label, enabled }) => (
          <button
            key={action}
            type="button"
            disabled={!enabled}
            onClick={() => enabled && onAction(task.taskId, action)}
            className={clsx(
              'rounded-md border px-2 py-1 text-[11px] transition-colors',
              enabled
                ? 'border-border bg-background-surface text-text-primary hover:bg-background-hover'
                : 'cursor-not-allowed border-border-subtle bg-background-base text-text-tertiary opacity-60',
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </Section>
  );
}

function canPause(status: EngineeringTaskState['status']): boolean {
  return ['running', 'routed', 'context_building', 'executing', 'diffing', 'verifying', 'reviewing'].includes(status);
}

function canResume(status: EngineeringTaskState['status']): boolean {
  return status === 'canceled' || status === 'aborted';
}

function canCancel(status: EngineeringTaskState['status']): boolean {
  return ['queued', 'running', 'routed', 'context_building', 'executing', 'diffing', 'verifying', 'reviewing'].includes(status);
}

function DetailGrid({ rows }: { rows: Array<[string, string | undefined]> }) {
  return (
    <div className="space-y-1">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-2 rounded-md bg-background-surface px-2 py-1">
          <span className="text-text-tertiary">{label}</span>
          <span className="truncate text-right text-text-primary">{value || '-'}</span>
        </div>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">{title}</div>
      {children}
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md bg-background-surface px-1.5 py-0.5 text-[11px] text-text-secondary">
      {children}
    </span>
  );
}
