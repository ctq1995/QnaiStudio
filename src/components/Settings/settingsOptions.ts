import type { EngineId, FloatingWindowMode } from '../../types';
import { Cpu, Server, Palette, MonitorCog, BookOpen, type LucideIcon } from 'lucide-react';

export type SettingsSectionId = 'engine' | 'providers' | 'appearance' | 'floating' | 'about';

export interface SettingsSection {
  id: SettingsSectionId;
  name: string;
  description: string;
  icon: LucideIcon;
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  { id: 'engine', name: '引擎设置', description: '引擎配置', icon: Cpu },
  { id: 'providers', name: '模型服务商', description: '端点密钥', icon: Server },
  { id: 'appearance', name: '外观', description: '主题显示', icon: Palette },
  { id: 'floating', name: '通用', description: '悬浮窗', icon: MonitorCog },
  { id: 'about', name: '关于', description: '应用信息', icon: BookOpen },
];

export const ENGINE_OPTIONS: { id: EngineId; name: string; description: string }[] = [
  { id: 'claude-code', name: 'Claude Code', description: 'Anthropic 官方 CLI 工具' },
  { id: 'codex-cli', name: 'Codex CLI', description: 'OpenAI 官方 Codex CLI 工具' },
  { id: 'custom-cli', name: '内置 Agent', description: '基于内置自研 Agent 能力运行，使用所选服务商与模型' },
  { id: 'iflow', name: 'IFlow', description: '智能编程助手 CLI 工具' },
  { id: 'gemini', name: 'Gemini CLI', description: 'Google 官方 Gemini CLI 工具' },
];

export const FLOATING_MODE_OPTIONS: { id: FloatingWindowMode; name: string; description: string }[] = [
  { id: 'auto', name: '自动', description: '鼠标移出主窗口后自动显示悬浮窗' },
  { id: 'manual', name: '手动', description: '仅在手动触发时显示悬浮窗' },
];
