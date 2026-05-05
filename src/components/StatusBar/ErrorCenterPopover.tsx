import { useEffect, useMemo, useRef } from 'react';
import { useErrorCenterStore } from '../../stores';

async function copyErrorText(error: { title: string; message: string; timestamp: string; source?: string }) {
  const text = [
    `标题: ${error.title}`,
    `时间: ${formatTimestamp(error.timestamp)}`,
    error.source ? `来源: ${error.source}` : null,
    '内容:',
    error.message,
  ]
    .filter(Boolean)
    .join('\n');

  await navigator.clipboard.writeText(text);
}

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;

  return date.toLocaleString('zh-CN', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getScopeMeta(scope: string) {
  switch (scope) {
    case 'chat':
      return { label: '对话', className: 'bg-danger/10 text-danger' };
    case 'workspace':
      return { label: '工作区', className: 'bg-primary/10 text-primary' };
    case 'editor':
      return { label: '编辑器', className: 'bg-warning/10 text-warning' };
    case 'versioning':
      return { label: '版本', className: 'bg-primary/10 text-primary' };
    case 'engine':
      return { label: '引擎', className: 'bg-warning/10 text-warning' };
    default:
      return { label: '系统', className: 'bg-text-tertiary/10 text-text-secondary' };
  }
}

export function ErrorCenterPopover() {
  const { errors, isOpen, clearErrors, removeError, setOpen } = useErrorCenterStore();
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const hasErrors = errors.length > 0;
  const errorSummary = useMemo(() => {
    if (!hasErrors) return '当前没有错误';
    return `共有 ${errors.length} 条错误记录`;
  }, [errors.length, hasErrors]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!popoverRef.current) return;
      if (popoverRef.current.contains(event.target as Node)) return;
      setOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, setOpen]);

  if (!isOpen) return null;

  return (
    <div ref={popoverRef} className="absolute bottom-11 right-0 z-[2200] w-[420px] max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border border-border bg-background-elevated shadow-2xl">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-text-primary">错误中心</div>
          <div className="mt-1 text-xs text-text-secondary">{errorSummary}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={clearErrors}
            disabled={!hasErrors}
            className="rounded-md px-2 py-1 text-xs text-text-secondary hover:bg-background-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            清空
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md px-2 py-1 text-xs text-text-secondary hover:bg-background-hover hover:text-text-primary"
          >
            关闭
          </button>
        </div>
      </div>

      <div className="max-h-[360px] overflow-y-auto px-3 py-3">
        {!hasErrors ? (
          <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-text-secondary">
            当前没有需要关注的错误。
          </div>
        ) : (
          <div className="space-y-3">
            {errors.map((error) => {
              const scopeMeta = getScopeMeta(error.scope);

              return (
                <div
                  key={error.id}
                  className="rounded-lg border border-border bg-background px-3 py-3 transition-colors hover:border-border-hover"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-md px-2 py-0.5 text-[11px] ${scopeMeta.className}`}>
                          {scopeMeta.label}
                        </span>
                        <span className="text-sm font-medium text-text-primary">{error.title}</span>
                      </div>
                      <div className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-text-secondary">
                        {error.message}
                      </div>
                      <div className="mt-2 text-[11px] text-text-tertiary">
                        {formatTimestamp(error.timestamp)}
                        {error.source ? ` · ${error.source}` : ''}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          void copyErrorText(error).catch((copyError) => {
                            useErrorCenterStore.getState().pushError({
                              scope: 'system',
                              level: 'warning',
                              title: '复制错误失败',
                              message: copyError instanceof Error ? copyError.message : '无法复制错误内容',
                              source: 'ErrorCenterPopover.copyErrorText',
                            });
                          });
                        }}
                        className="rounded-md px-2 py-1 text-xs text-text-secondary hover:bg-background-hover hover:text-text-primary"
                      >
                        复制
                      </button>
                      <button
                        type="button"
                        onClick={() => removeError(error.id)}
                        className="rounded-md px-2 py-1 text-xs text-text-secondary hover:bg-background-hover hover:text-text-primary"
                      >
                        移除
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
