import type { EngineId, FloatingWindowMode } from '../../types';

export type SettingsSectionId = 'engine' | 'floating' | 'about';

export const SETTINGS_SECTIONS: { id: SettingsSectionId; name: string; description: string }[] = [
  { id: 'engine', name: '引擎设置', description: '默认引擎与 CLI 路径' },
  { id: 'floating', name: '悬浮窗', description: '悬浮窗行为与切换方式' },
  { id: 'about', name: '关于', description: '项目信息与鸣谢' },
];

export const ENGINE_OPTIONS: { id: EngineId; name: string; description: string }[] = [
  { id: 'claude-code', name: 'Claude Code', description: 'Anthropic 官方 CLI 工具' },
  { id: 'codex-cli', name: 'Codex CLI', description: 'OpenAI 官方 Codex CLI 工具' },
  { id: 'iflow', name: 'IFlow', description: '智能编程助手 CLI 工具' },
  { id: 'gemini', name: 'Gemini CLI', description: 'Google 官方 Gemini CLI 工具' },
];

export const FLOATING_MODE_OPTIONS: { id: FloatingWindowMode; name: string; description: string }[] = [
  { id: 'auto', name: '自动', description: '鼠标移出主窗口后自动显示悬浮窗' },
  { id: 'manual', name: '手动', description: '仅在手动触发时显示悬浮窗' },
];
