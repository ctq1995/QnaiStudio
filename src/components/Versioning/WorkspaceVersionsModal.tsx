import { useCallback, useEffect, useMemo, useState } from 'react';
import type { WorkspaceVersion } from '../../types';
import { useEventChatStore, useFileEditorStore, useFileExplorerStore, useVersioningStore } from '../../stores';
import {
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
  danger?: boolean;
  onConfirm: () => Promise<void>;
}

function formatVersionTime(version: WorkspaceVersion): string {
  return new Date(version.createdAt).toLocaleString('zh-CN');
}

function kindLabel(kind: WorkspaceVersion['kind']): string {
  return kind === 'auto' ? '自动' : '手动';
}

export function WorkspaceVersionsModal({ workspaceName, workspacePath, onClose }: WorkspaceVersionsModalProps) {
  const isStreaming = useEventChatStore((state) => state.isStreaming);
  const { autoCheckpointEnabled, setAutoCheckpointEnabled } = useVersioningStore();

  const [versions, setVersions] = useState<WorkspaceVersion[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'creating' | 'restoring' | 'deleting'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [labelInput, setLabelInput] = useState('');
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const canOperate = !isStreaming && status === 'idle';

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
    setStatus('creating');
    setError(null);
    try {
      await createWorkspaceVersion({
        workspacePath,
        kind: 'manual',
        label: labelInput.trim() ? labelInput.trim() : undefined,
      });
      setLabelInput('');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '提交版本失败');
      setStatus('idle');
    }
  }, [canOperate, labelInput, refresh, workspacePath]);

  const doRestore = useCallback(
    async (versionId: string) => {
      setStatus('restoring');
      setError(null);

      await restoreWorkspaceVersion({ workspacePath, versionId });
      await useFileExplorerStore.getState().refresh_directory();
      useFileEditorStore.getState().closeFile();
      setStatus('idle');
      onClose();
    },
    [onClose, workspacePath],
  );

  const handleRestore = useCallback(
    (version: WorkspaceVersion) => {
      if (!canOperate) return;
      setConfirm({
        title: '回退版本',
        message: `将工作区回退到“${version.label}”（${formatVersionTime(version)}）。\n\n该操作会覆盖当前文件，并删除快照中不存在的新增文件。`,
        confirmText: '确认回退',
        danger: true,
        onConfirm: async () => doRestore(version.id),
      });
    },
    [canOperate, doRestore],
  );

  const doDelete = useCallback(
    async (versionId: string) => {
      setStatus('deleting');
      setError(null);

      await deleteWorkspaceVersion({ workspacePath, versionId });
      await refresh();
      setStatus('idle');
    },
    [refresh, workspacePath],
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
      setError(e instanceof Error ? e.message : '操作失败');
      setStatus('idle');
      setConfirm(null);
    }
  }, [confirm]);

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
          {isStreaming && (
            <div className="mb-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
              AI 正在运行中，已禁用版本操作。
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
            快照默认忽略目录：.git、node_modules、target、dist、.next、.turbo。
          </div>
        </div>
      </div>

      {confirm && (
        <>
          <div className="fixed inset-0 z-[2002] bg-black/60" onClick={closeConfirm} />
          <div className="fixed left-1/2 top-1/2 z-[2003] w-[420px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background-elevated p-5 shadow-xl">
            <div className="text-base font-semibold text-text-primary">{confirm.title}</div>
            <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-secondary">{confirm.message}</div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={closeConfirm}
                className="rounded-lg px-3 py-1.5 text-sm text-text-secondary hover:bg-background-hover hover:text-text-primary"
              >
                取消
              </button>
              <button
                onClick={handleConfirm}
                className={
                  confirm.danger
                    ? 'rounded-lg bg-danger px-3 py-1.5 text-sm text-white hover:bg-danger-hover'
                    : 'rounded-lg bg-primary px-3 py-1.5 text-sm text-white hover:bg-primary-hover'
                }
              >
                {confirm.confirmText}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
