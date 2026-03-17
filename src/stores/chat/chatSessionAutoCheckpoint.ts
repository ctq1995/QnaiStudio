import { createWorkspaceVersion } from '../../services/workspaceVersionService';
import { extractErrorMessage } from './chatEventUtils';
import { useChatMessageStore } from './chatMessageStore';

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
  const store = useChatMessageStore.getState();
  if (store.progressMessage === expected) {
    store.setProgressMessage(null);
  }
}

export function scheduleAutoCheckpoint(options: { workspacePath: string; label?: string }) {
  const { workspacePath, label } = options;
  const store = useChatMessageStore.getState();

  store.setProgressMessage(AUTO_CHECKPOINT_PROGRESS_MESSAGE);

  window.setTimeout(() => {
    createWorkspaceVersion({ workspacePath, kind: 'auto', label })
      .then(() => {
        clearProgressIfCurrent(AUTO_CHECKPOINT_PROGRESS_MESSAGE);
      })
      .catch((error) => {
        store.addErrorMessage(extractErrorMessage(error, '自动快照失败'));
        clearProgressIfCurrent(AUTO_CHECKPOINT_PROGRESS_MESSAGE);
      });
  }, AUTO_CHECKPOINT_START_DELAY_MS);
}

