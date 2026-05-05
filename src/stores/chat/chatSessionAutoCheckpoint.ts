import { createWorkspaceVersion } from '../../services/workspaceVersionService';
import { extractErrorMessage } from './chatEventUtils';
import { useVersioningStore } from '../versioningStore';
import { useErrorCenterStore } from '../errorCenterStore';

const AUTO_CHECKPOINT_LABEL_PREVIEW_LENGTH = 60;
const AUTO_CHECKPOINT_LABEL_PREFIX = 'AI 自动快照: ';
const AUTO_CHECKPOINT_PROGRESS_MESSAGE = '后台创建版本快照...';
const AUTO_CHECKPOINT_START_DELAY_MS = 300;

function normalizeLabelContent(content: string): string {
  return content.trim().replace(/\s+/g, ' ');
}

export function buildAutoCheckpointLabel(content: string): string | undefined {
  const normalized = normalizeLabelContent(content);
  if (!normalized) return undefined;

  const preview = normalized.length <= AUTO_CHECKPOINT_LABEL_PREVIEW_LENGTH
    ? normalized
    : `${normalized.slice(0, AUTO_CHECKPOINT_LABEL_PREVIEW_LENGTH)}…`;

  return `${AUTO_CHECKPOINT_LABEL_PREFIX}${preview}`;
}

function clearProgressIfCurrent(expected: string) {
  const store = useVersioningStore.getState();
  if (store.operationStatus === 'auto-checkpoint' && store.operationMessage === expected) {
    store.finishOperation();
  }
}

export function scheduleAutoCheckpoint(options: { workspacePath: string; label?: string }) {
  const { workspacePath, label } = options;
  const versioningStore = useVersioningStore.getState();

  versioningStore.beginOperation('auto-checkpoint', AUTO_CHECKPOINT_PROGRESS_MESSAGE);

  window.setTimeout(() => {
    createWorkspaceVersion({ workspacePath, kind: 'auto', label })
      .then(() => {
        clearProgressIfCurrent(AUTO_CHECKPOINT_PROGRESS_MESSAGE);
      })
      .catch((error) => {
        const errorMessage = extractErrorMessage(error, '自动快照失败');
        useErrorCenterStore.getState().pushError({
          scope: 'versioning',
          level: 'error',
          title: '自动快照失败',
          message: errorMessage,
          source: 'chatSessionAutoCheckpoint.scheduleAutoCheckpoint',
        });
        useVersioningStore.getState().failOperation(errorMessage);
        clearProgressIfCurrent(AUTO_CHECKPOINT_PROGRESS_MESSAGE);
      });
  }, AUTO_CHECKPOINT_START_DELAY_MS);
}

