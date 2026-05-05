import { useCallback, useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '../Common';
import type { WorkspaceVersion } from '../../types';
import { useEventChatStore, useFileEditorStore, useFileExplorerStore, useVersioningStore } from '../../stores';
import { useToolPanelStore } from '../../stores/toolPanelStore';
import {
  checkRestoreWorkspaceVersion,
  createWorkspaceVersion,
  deleteWorkspaceVersion,
  listWorkspaceVersions,
  restoreWorkspaceVersion,
} from '../../services/workspaceVersionService';

interface WorkspaceVersionsModalProps {
  workspaceName: string;
  workspacePath: string;
  onClose: () => void;
}

interface ConfirmState {
  title: string;
  message: string;
  confirmText: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => Promise<void>;
}

function formatVersionTime(version: WorkspaceVersion): string {
  return new Date(version.createdAt).toLocaleString('zh-CN');
}

function kindLabel(kind: WorkspaceVersion['kind']): string {
  return kind === 'auto' ? '自动' : '手动';
}

function formatVersionSize(totalSize: number): string {
  if (totalSize < 1024) return `${totalSize} B`;
  if (totalSize < 1024 * 1024) return `${(totalSize / 1024).toFixed(1)} KB`;
  if (totalSize < 1024 * 1024 * 1024) return `${(totalSize / (1024 * 1024)).toFixed(1)} MB`;
  return `${(totalSize / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function WorkspaceVersionsModal({ workspaceName, workspacePath, onClose }: WorkspaceVersionsModalProps) {
  const isStreaming = useEventChatStore((state) => state.isStreaming);
  const pendingQueue = useEventChatStore((state) => state.pendingQueue);
  const clearPendingQueue = useEventChatStore((state) => state.clearPendingQueue);
  const hasUnsavedChanges = useFileEditorStore((state) => state.hasUnsavedChanges);
  const discardCurrentFile = useFileEditorStore((state) => state.discardCurrentFile);
  const {
    autoCheckpointEnabled,
    setAutoCheckpointEnabled,
    operationStatus,
    operationMessage,
    lastRestoreNotice,
    beginOperation,
    finishOperation,
    failOperation,
    setLastRestoreNotice,
  } = useVersioningStore();

  const [versions, setVersions] = useState<WorkspaceVersion[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [labelInput, setLabelInput] = useState('');
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const hasQueuedWork = pendingQueue.length > 0;
  const isVersionBusy = operationStatus !== 'idle';
  const canOperate = !isStreaming && !hasQueuedWork && !isVersionBusy && status === 'idle';

  const refresh = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const items = await listWorkspaceVersions(workspacePath);
      setVersions(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载版本列表失败');
    } finally {
      setStatus('idle');
    }
  }, [workspacePath]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sortedVersions = useMemo(() => versions.slice().sort((a, b) => b.createdAt - a.createdAt), [versions]);

  const handleCreate = useCallback(async () => {
    if (!canOperate) return;
    setError(null);
    beginOperation('creating', '正在创建版本快照…');
    try {
      await createWorkspaceVersion({
        workspacePath,
        kind: 'manual',
        label: labelInput.trim() ? labelInput.trim() : undefined,
      });
      setLabelInput('');
      await refresh();
      finishOperation();
    } catch (e) {
      const message = e instanceof Error ? e.message : '提交版本失败';
      setError(message);
      failOperation(message);
    }
  }, [beginOperation, canOperate, failOperation, finishOperation, labelInput, refresh, workspacePath]);

  const doRestore = useCallback(
    async (versionId: string) => {
      beginOperation('restoring', '正在恢复工作区版本…');
      setError(null);

      await restoreWorkspaceVersion({ workspacePath, versionId });

      clearPendingQueue();
      useToolPanelStore.getState().clearTools();
      discardCurrentFile();

      let refreshError: string | null = null;
      try {
        await useFileExplorerStore.getState().refresh_directory();
      } catch (e) {
        refreshError = e instanceof Error ? e.message : '文件树刷新失败';
      }

      const restoreNotice = refreshError
        ? `工作区已恢复到目标版本，但后续界面刷新未完全成功：${refreshError}`
        : '工作区已恢复到目标版本，已清空待发送队列并重置工具面板。';

      setLastRestoreNotice(restoreNotice);
      finishOperation();
      onClose();
    },
    [beginOperation, clearPendingQueue, discardCurrentFile, finishOperation, onClose, setLastRestoreNotice, workspacePath],
  );

  const handleRestore = useCallback(
    async (version: WorkspaceVersion) => {
      if (!canOperate) return;
      setError(null);
      try {
        const check = await checkRestoreWorkspaceVersion({ workspacePath, versionId: version.id });
        const warnings: string[] = [];
        if (check.missingObjects > 0) {
          warnings.push(`检测到 ${check.missingObjects} 个对象缺失，当前版本可能无法恢复。`);
        }
        if (!check.hasBackupCapacity) {
          warnings.push('当前工作区与目标快照总体积较大，恢复时可能没有足够空间用于临时备份。');
        }

        const restoreMessage = `将工作区回退到“${version.label}”（${formatVersionTime(version)}）。\n\n快照文件数：${check.fileCount}\n快照体积：${formatVersionSize(check.totalSize)}\n\n该操作会安全恢复当前工作区到该增量快照状态，并移除该版本中不存在的新增文件。恢复失败时会自动尝试回滚。${warnings.length ? `\n\n预检查警告：\n- ${warnings.join('\n- ')}` : ''}`;

        if (hasUnsavedChanges()) {
          setConfirm({
            title: '先处理未保存文件',
            message: `当前编辑器存在未保存改动。若继续恢复版本，未保存内容将被丢弃。\n\n${restoreMessage}`,
            confirmText: '放弃改动并回退',
            cancelText: '继续编辑',
            danger: true,
            onConfirm: async () => doRestore(version.id),
          });
          return;
        }

        setConfirm({
          title: '回退版本',
          message: restoreMessage,
          confirmText: '确认回退',
          danger: true,
          onConfirm: async () => doRestore(version.id),
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : '恢复前预检查失败');
      }
    },
    [canOperate, doRestore, hasUnsavedChanges, workspacePath],
  );

  const doDelete = useCallback(
    async (versionId: string) => {
      beginOperation('deleting', '正在删除版本…');
      setError(null);

      await deleteWorkspaceVersion({ workspacePath, versionId });
      await refresh();
      finishOperation();
    },
    [beginOperation, finishOperation, refresh, workspacePath],
  );

  const handleDelete = useCallback(
    (version: WorkspaceVersion) => {
      if (!canOperate) return;
      setConfirm({
        title: '删除版本',
        message: `确定删除“${version.label}”（${formatVersionTime(version)}）吗？`,
        confirmText: '删除',
        danger: true,
        onConfirm: async () => doDelete(version.id),
      });
    },
    [canOperate, doDelete],
  );

  const closeConfirm = useCallback(() => setConfirm(null), []);

  const handleConfirm = useCallback(async () => {
    if (!confirm) return;
    try {
      await confirm.onConfirm();
      setConfirm(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : '操作失败';
      setError(message);
      failOperation(message);
      setConfirm(null);
    }
  }, [confirm, failOperation]);

  return (
    <>
      <div className="fixed inset-0 z-[2000] bg-black/50" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 z-[2001] w-[720px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background-elevated shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="text-base font-semibold text-text-primary">版本管理</div>
            <div className="mt-1 truncate text-xs text-text-tertiary">{workspaceName}</div>
          </div>
          <button
            className="rounded-lg px-2 py-1 text-sm text-text-secondary hover:bg-background-hover hover:text-text-primary"
            onClick={onClose}
          >
            关闭
          </button>
        </div>

        <div className="px-5 py-4">
          {(isStreaming || hasQueuedWork || isVersionBusy) && (
            <div className="mb-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              {isStreaming
                ? 'AI 正在运行中，已禁用版本操作。'
                : hasQueuedWork
                  ? '存在待发送队列，已禁用版本操作。'
                  : operationMessage || '版本操作进行中，已暂时禁用其它版本操作。'}
            </div>
          )}

          {lastRestoreNotice && !error && (
            <div className="mb-3 rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-xs text-text-secondary">
              {lastRestoreNotice}
            </div>
          )}

          {error && (
            <div className="mb-3 rounded-lg border border-danger/30 bg-danger-faint px-3 py-2 text-xs text-danger">
              {error}
            </div>
          )}

          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-border bg-background-surface p-3">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="text-text-secondary">发送给 AI 前自动创建快照（后台，首次发送）</span>
              <input
                type="checkbox"
                checked={autoCheckpointEnabled}
                onChange={(e) => setAutoCheckpointEnabled(e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
            </label>

            <div className="flex items-center gap-2">
              <input
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                placeholder="版本备注（可选）"
                className="flex-1 rounded-lg border border-border bg-background-base px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary"
                disabled={!canOperate}
              />
              <button
                onClick={handleCreate}
                disabled={!canOperate}
                className="rounded-lg bg-primary px-3 py-2 text-sm text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                提交版本
              </button>
              <button
                onClick={refresh}
                disabled={!canOperate}
                className="rounded-lg border border-border px-3 py-2 text-sm text-text-secondary hover:bg-background-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                刷新
              </button>
            </div>
          </div>

          <div className="max-h-[50vh] overflow-auto rounded-xl border border-border">
            {sortedVersions.length === 0 ? (
              <div className="p-6 text-center text-sm text-text-tertiary">
                暂无版本。建议在开始大改动前先创建一次快照。
              </div>
            ) : (
              <div className="divide-y divide-border">
                {sortedVersions.map((v) => (
                  <div key={v.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="truncate text-sm font-medium text-text-primary">{v.label}</div>
                        <span className="rounded bg-background-hover px-1.5 py-0.5 text-[11px] text-text-tertiary">
                          {kindLabel(v.kind)}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-text-tertiary">{formatVersionTime(v)}</div>
                      <div className="mt-1 text-[11px] text-text-tertiary">
                        {v.fileCount} 个文件 · {formatVersionSize(v.totalSize)} · {v.status === 'ready' ? '可恢复' : '异常'}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => handleRestore(v)}
                        disabled={!canOperate}
                        className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-text-secondary hover:bg-background-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        回退
                      </button>
                      <button
                        onClick={() => handleDelete(v)}
                        disabled={!canOperate}
                        className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-2 text-xs text-text-tertiary">
            版本采用文件级增量快照，默认忽略：.git、node_modules、target、dist、.next、.turbo、.bitfun、.tmp、coverage、.cache、.idea。
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmText={confirm?.confirmText ?? '确认'}
        cancelText={confirm?.cancelText ?? '取消'}
        tone={confirm?.danger ? 'danger' : 'primary'}
        onCancel={closeConfirm}
        onConfirm={handleConfirm}
        zIndexClassName="z-[2003]"
      />
    </>
  );
}
