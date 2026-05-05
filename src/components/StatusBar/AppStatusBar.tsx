import { useMemo } from 'react';
import { useErrorCenterStore } from '../../stores';
import { ErrorCenterPopover } from './ErrorCenterPopover';

interface AppStatusBarProps {
  workspaceName: string;
  workspacePath?: string | null;
  engineLabel: string;
  engineVersion?: string | null;
  endpoint?: string | null;
  modelLabel?: string | null;
}

function formatEndpoint(endpoint?: string | null) {
  const value = endpoint?.trim();
  if (!value) return '默认端点';
  return value;
}

function formatVersion(version?: string | null) {
  const value = version?.trim();
  if (!value) return '未知版本';
  return value.startsWith('v') ? value : `v${value}`;
}

function StatusPill({
  label,
  value,
  title,
  valueClassName = '',
}: {
  label: string;
  value: string;
  title?: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex min-w-0 shrink-0 items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 transition-colors hover:border-border-hover hover:bg-background-hover/60" title={title}>
      <span className="shrink-0 text-xs text-text-tertiary">{label}</span>
      <span className={`truncate text-xs text-text-primary ${valueClassName}`.trim()}>{value}</span>
    </div>
  );
}

export function AppStatusBar({
  workspaceName,
  workspacePath,
  engineLabel,
  engineVersion,
  endpoint,
  modelLabel,
}: AppStatusBarProps) {
  const { errors, toggleOpen } = useErrorCenterStore();

  const errorCount = errors.length;
  const errorButtonTitle = useMemo(() => {
    if (!errorCount) return '当前没有错误';
    return `当前有 ${errorCount} 条错误，点击查看详情`;
  }, [errorCount]);

  return (
    <div className="relative flex h-10 items-center justify-between gap-3 border-t border-border bg-background-elevated px-3">
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto overflow-y-hidden pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <StatusPill
          label="工作区"
          value={workspaceName}
          title={workspacePath ?? workspaceName}
          valueClassName="max-w-[180px]"
        />
        <StatusPill label="智能体" value={engineLabel} valueClassName="max-w-[120px]" />
        <StatusPill label="版本" value={formatVersion(engineVersion)} valueClassName="max-w-[110px]" />
        <StatusPill
          label="端点"
          value={formatEndpoint(endpoint)}
          title={formatEndpoint(endpoint)}
          valueClassName="max-w-[280px]"
        />
        <StatusPill
          label="模型"
          value={modelLabel?.trim() || '未记录'}
          title={modelLabel?.trim() || '未记录'}
          valueClassName="max-w-[180px]"
        />
      </div>

      <div className="relative ml-3 flex shrink-0 items-center">
        <button
          type="button"
          title={errorButtonTitle}
          onClick={toggleOpen}
          className={`relative inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
            errorCount > 0
              ? 'border-danger/50 bg-danger/10 text-danger hover:bg-danger/15'
              : 'border-transparent bg-transparent text-text-tertiary hover:border-border/70 hover:bg-background-hover/70 hover:text-text-primary'
          }`}
        >
          <span className="text-base leading-none">⚠</span>
          {errorCount > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-medium leading-none text-white">
              {errorCount > 99 ? '99+' : errorCount}
            </span>
          ) : null}
        </button>

        <ErrorCenterPopover />
      </div>
    </div>
  );
}
