import { Bot, CheckCircle2, Cpu, Sparkles } from 'lucide-react';
import { ClaudePathSelector } from '../Common';
import type { Config, EngineId } from '../../types';
import { ENGINE_OPTIONS } from './settingsOptions';

interface EngineSettingsPanelProps {
  config: Config;
  loading: boolean;
  onEngineChange: (engineId: EngineId) => void;
  onClaudePathChange: (path: string) => void;
  onIFlowPathChange: (path: string) => void;
  onCodexPathChange: (path: string) => void;
  onGeminiPathChange: (path: string) => void;
}

const ENGINE_ICON: Record<EngineId, typeof Bot> = {
  'claude-code': Bot,
  'codex-cli': Cpu,
  iflow: Cpu,
  gemini: Sparkles,
};

const ENGINE_PATH_META: Record<EngineId, { title: string; label: string; placeholder?: string }> = {
  'claude-code': {
    title: 'Claude Code 路径',
    label: 'Claude CLI 命令路径',
  },
  'codex-cli': {
    title: 'Codex CLI 路径',
    label: 'Codex CLI 命令路径',
    placeholder: 'codex',
  },
  iflow: {
    title: 'IFlow 路径',
    label: 'IFlow CLI 命令路径（可选）',
    placeholder: 'iflow',
  },
  gemini: {
    title: 'Gemini CLI 路径',
    label: 'Gemini CLI 命令路径',
    placeholder: 'gemini',
  },
};

function EngineCard(props: {
  engineId: EngineId;
  name: string;
  description: string;
  selected: boolean;
  onSelect: (engineId: EngineId) => void;
}) {
  const { engineId, name, description, selected, onSelect } = props;
  const Icon = ENGINE_ICON[engineId];

  return (
    <button
      type="button"
      onClick={() => onSelect(engineId)}
      className={`relative rounded-2xl border p-4 text-left transition-all ${
        selected
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border bg-background-surface hover:border-primary/30 hover:bg-background-hover'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className={`mt-0.5 rounded-xl p-2 ${selected ? 'bg-primary/12 text-primary' : 'bg-background text-text-secondary'}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-text-primary">{name}</div>
            <div className="mt-1 text-xs leading-5 text-text-secondary">{description}</div>
          </div>
        </div>
        {selected && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />}
      </div>
    </button>
  );
}

function PathEditor(props: {
  engineId: EngineId;
  value: string;
  loading: boolean;
  onChange: (path: string) => void;
}) {
  const { engineId, value, loading, onChange } = props;
  const meta = ENGINE_PATH_META[engineId];

  return (
    <section className="rounded-2xl border border-border bg-background-surface p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-text-primary">{meta.title}</h3>
        <p className="mt-1 text-xs leading-5 text-text-secondary">
          支持自动检测，也可以手动填写本地可执行文件路径。
        </p>
      </div>

      <label className="mb-2 block text-xs text-text-secondary">{meta.label}</label>
      <ClaudePathSelector
        value={value}
        onChange={onChange}
        engineType={engineId}
        disabled={loading}
        placeholder={meta.placeholder}
      />
    </section>
  );
}

function resolvePathValue(config: Config) {
  if (config.defaultEngine === 'claude-code') {
    return config.claudeCode.cliPath;
  }

  if (config.defaultEngine === 'codex-cli') {
    return config.codexCli.cliPath;
  }

  if (config.defaultEngine === 'gemini') {
    return config.gemini.cliPath;
  }

  return config.iflow.cliPath || 'iflow';
}

function resolvePathHandler(
  engineId: EngineId,
  onClaudePathChange: (path: string) => void,
  onIFlowPathChange: (path: string) => void,
  onCodexPathChange: (path: string) => void,
  onGeminiPathChange: (path: string) => void,
) {
  if (engineId === 'claude-code') {
    return onClaudePathChange;
  }

  if (engineId === 'codex-cli') {
    return onCodexPathChange;
  }

  if (engineId === 'gemini') {
    return onGeminiPathChange;
  }

  return onIFlowPathChange;
}

export function EngineSettingsPanel(props: EngineSettingsPanelProps) {
  const { config, loading, onEngineChange, onClaudePathChange, onIFlowPathChange, onCodexPathChange, onGeminiPathChange } = props;
  const pathValue = resolvePathValue(config);
  const handlePathChange = resolvePathHandler(
    config.defaultEngine,
    onClaudePathChange,
    onIFlowPathChange,
    onCodexPathChange,
    onGeminiPathChange,
  );

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-background-surface p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-text-primary">默认引擎</h3>
          <p className="mt-1 text-xs leading-5 text-text-secondary">
            选择当前会话默认使用的 CLI 引擎，渲染与消息格式保持统一。
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {ENGINE_OPTIONS.map((option) => (
            <EngineCard
              key={option.id}
              engineId={option.id}
              name={option.name}
              description={option.description}
              selected={config.defaultEngine === option.id}
              onSelect={onEngineChange}
            />
          ))}
        </div>
      </section>

      <PathEditor
        engineId={config.defaultEngine}
        value={pathValue}
        loading={loading}
        onChange={handlePathChange}
      />
    </div>
  );
}
