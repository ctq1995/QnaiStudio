/**
 * 状态管理统一导出
 */

export { useConfigStore } from './configStore';

// 统一的 Chat Store（基于 Tauri chat-event，支持历史管理）
export { useEventChatStore, type UnifiedHistoryItem } from './eventChatStore';
export { useChatMessageStore } from './chat/chatMessageStore';

export { useCommandStore } from './commandStore';
export { useToolPanelStore, updateToolByName, updateToolByToolUseId } from './toolPanelStore';
export { useWorkspaceStore } from './workspaceStore';
export { useFileExplorerStore } from './fileExplorerStore';
export { useFileEditorStore } from './fileEditorStore';
export { useViewStore } from './viewStore';
export { useFloatingWindowStore } from './floatingWindowStore';
export { useVersioningStore } from './versioningStore';
export { useErrorCenterStore, type AppErrorItem, type AppErrorLevel, type AppErrorScope } from './errorCenterStore';
export { useEngineeringTaskStateStore, engineeringTaskStateService, type EngineeringTaskCenterAction, type EngineeringTaskCenterActionRequest, type EngineeringTaskStateFilter } from './engineeringTaskStateStore';
