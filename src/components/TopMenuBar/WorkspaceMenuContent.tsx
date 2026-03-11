import { useState } from 'react';
import { useWorkspaceStore } from '../../stores';

interface WorkspaceMenuContentProps {
  onCreateWorkspace: () => void;
}

interface DeleteDialogProps {
  workspaceName: string;
  onCancel: () => void;
  onConfirm: () => void;
}

function DeleteWorkspaceDialog({ workspaceName, onCancel, onConfirm }: DeleteDialogProps) {
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[2000]" onClick={onCancel} />
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[2000] w-80 bg-background-elevated rounded-xl border border-border shadow-xl p-5">
        <h3 className="text-base font-semibold text-text-primary mb-2">删除工作区</h3>
        <p className="text-sm text-text-secondary mb-4">
          确定要删除 <span className="font-medium text-text-primary">“{workspaceName}”</span> 吗？
        </p>
        <p className="text-xs text-text-tertiary mb-5">
          此操作只会从列表中移除该工作区，不会删除实际文件夹。
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary hover:bg-background-hover rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 text-sm bg-danger text-white rounded-lg hover:bg-danger-hover transition-colors"
          >
            删除
          </button>
        </div>
      </div>
    </>
  );
}

function ContextToggleButton({ isContext, onClick }: { isContext: boolean; onClick: () => void }) {
  return (
    <button
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={`absolute right-8 top-1/2 -translate-y-1/2 p-1 rounded transition-colors ${
        isContext
          ? 'text-primary bg-primary/10'
          : 'text-text-tertiary hover:text-text-primary hover:bg-background-hover'
      }`}
      title={isContext ? '从关联移除' : '添加到关联'}
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        {isContext ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 4.784M14.12 14.12a3 3 0 100-4.243m4.242 4.242L9.878 9.878" />
        )}
      </svg>
    </button>
  );
}

function DeleteWorkspaceButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-text-tertiary hover:text-danger hover:bg-background-surface opacity-0 group-hover:opacity-100 transition-opacity"
      title="删除工作区"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  );
}

export function WorkspaceMenuContent({ onCreateWorkspace }: WorkspaceMenuContentProps) {
  const {
    workspaces,
    currentWorkspaceId,
    contextWorkspaceIds,
    switchWorkspace,
    deleteWorkspace,
    toggleContextWorkspace,
    getCurrentWorkspace,
    getContextWorkspaces,
  } = useWorkspaceStore();

  const [workspaceIdToDelete, setWorkspaceIdToDelete] = useState<string | null>(null);

  const currentWorkspace = getCurrentWorkspace();
  const contextWorkspaces = getContextWorkspaces();
  const workspaceToDelete = workspaces.find((workspace) => workspace.id === workspaceIdToDelete);
  const canManageMultipleWorkspaces = workspaces.length > 1;

  const handleSwitchWorkspace = async (workspaceId: string) => {
    if (workspaceId === currentWorkspaceId) {
      return;
    }

    await switchWorkspace(workspaceId);
  };

  const handleDeleteWorkspace = async (workspaceId: string) => {
    try {
      await deleteWorkspace(workspaceId);
      setWorkspaceIdToDelete(null);
    } catch (error) {
      console.error('删除工作区失败:', error);
    }
  };

  return (
    <div className="py-1 max-h-[60vh] overflow-y-auto">
      <div className="px-3 py-2 text-xs font-medium text-text-tertiary border-b border-border-subtle flex items-center justify-between">
        <span>当前工作区</span>
        <button
          onClick={onCreateWorkspace}
          className="text-primary hover:text-primary-hover transition-colors"
        >
          + 创建
        </button>
      </div>

      <div className="max-h-48 overflow-y-auto">
        {workspaces.map((workspace) => {
          const isCurrent = workspace.id === currentWorkspaceId;
          const isContext = contextWorkspaceIds.includes(workspace.id);

          return (
            <div
              key={workspace.id}
              className={`group relative flex items-center ${isCurrent ? 'bg-primary/10' : ''}`}
            >
              {isCurrent && <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />}

              <button
                onClick={() => handleSwitchWorkspace(workspace.id)}
                className={`flex-1 text-left px-3 py-2 text-sm transition-colors ${
                  isCurrent
                    ? 'text-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-background-hover'
                }`}
              >
                <div className="pr-12 font-medium truncate flex items-center gap-2">
                  {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                  {workspace.name}
                </div>
                <div className="text-xs truncate text-text-tertiary">{workspace.path}</div>
              </button>

              {!isCurrent && canManageMultipleWorkspaces && (
                <ContextToggleButton
                  isContext={isContext}
                  onClick={() => toggleContextWorkspace(workspace.id)}
                />
              )}

              {!isCurrent && canManageMultipleWorkspaces && (
                <DeleteWorkspaceButton onClick={() => setWorkspaceIdToDelete(workspace.id)} />
              )}
            </div>
          );
        })}
      </div>

      <div className="border-t border-border-subtle mt-1 pt-1">
        <div className="px-3 py-2 text-xs text-text-tertiary flex items-center justify-between">
          <span className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            关联工作区 ({contextWorkspaces.length + 1})
          </span>
        </div>

        {contextWorkspaces.length > 0 ? (
          <div className="max-h-32 overflow-y-auto">
            {currentWorkspace && (
              <div className="group flex items-center px-3 py-1.5 text-sm text-text-secondary bg-primary/5">
                <span className="w-2 h-2 rounded-full bg-primary mr-2" />
                <span className="flex-1 truncate">{currentWorkspace.name}</span>
                <span className="text-xs text-text-tertiary mr-2">当前工作区</span>
              </div>
            )}

            {contextWorkspaces.map((workspace) => (
              <div
                key={workspace.id}
                className="group flex items-center px-3 py-1.5 text-sm text-text-secondary hover:bg-background-hover"
              >
                <span className="w-2 h-2 rounded-full bg-primary/50 mr-2" />
                <span className="flex-1 truncate">{workspace.name}</span>
                <button
                  onClick={() => toggleContextWorkspace(workspace.id)}
                  className="p-1 rounded text-text-tertiary hover:text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                  title="从关联移除"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-3 py-3 text-xs text-text-tertiary text-center">未设置关联工作区</div>
        )}
      </div>

      {contextWorkspaces.length > 0 && (
        <div className="mx-2 my-2 p-2 bg-primary/5 border border-primary/20 rounded text-xs text-text-secondary">
          AI 可访问当前工作区和全部关联工作区
        </div>
      )}

      {workspaceIdToDelete && workspaceToDelete && (
        <DeleteWorkspaceDialog
          workspaceName={workspaceToDelete.name}
          onCancel={() => setWorkspaceIdToDelete(null)}
          onConfirm={() => handleDeleteWorkspace(workspaceIdToDelete)}
        />
      )}
    </div>
  );
}
