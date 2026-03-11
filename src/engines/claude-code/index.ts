/**
 * Claude Code Engine - Claude Code CLI Adapter
 *
 * 这是 Claude Code CLI 的 AI Runtime 适配器实现。
 * 负责将 Claude Code CLI 的输出转换为通用的 AIEvent。
 *
 * @module engines/claude-code
 */

// 导出 Engine
export * from './engine'

// 导出 Session
export * from './session'

// 导出 Event Parser（避免与其他引擎的 parseStreamEventLine 冲突）
export {
  ToolCallManager,
  ClaudeEventParser,
  parseStreamEventLine as parseClaudeStreamEventLine,
  convertClaudeEventsToAIEvents,
} from './event-parser'
export type {
  ClaudeStreamEvent,
  SystemEvent,
  AssistantEvent,
  UserEvent,
  TextDeltaEvent,
  ToolStartEvent,
  ToolEndEvent,
  PermissionRequestEvent,
  ErrorEvent,
  SessionEndEvent,
  MessageContent,
} from './event-parser'
