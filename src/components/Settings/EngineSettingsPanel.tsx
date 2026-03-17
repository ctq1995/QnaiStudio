import { Bot, CheckCircle2, Cpu, Eye, EyeOff, Sparkles, Loader2, XCircle, Wifi } from 'lucide-react';
import { useState } from 'react';
import { ClaudePathSelector } from '../Common';
import type { Config, EngineId } from '../../types';
import { ENGINE_OPTIONS } from './settingsOptions';
import { testEngineConnection } from '../../services/tauri';
import { ModelInputWithFetch } from './ModelInputWithFetch';
import { DirtyBadge } from './DirtyBadge';

interface EngineSettingsPanelProps {
  config: Config;
  savedConfig: Config;
  loading: boolean;
  onEngineChange: (engineId: EngineId) => void;
  onClaudePathChange: (path: string) => void;
  onIFlowPathChange: (path: string) => void;
  onCodexPathChange: (path: string) => void;
  onGeminiPathChange: (path: string) => void;
  onEngineParamChange: (engineId: EngineId, key: string, value: string) => void;
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

/**
 * 各引擎的环境变量参数字段定义
 * 这些参数以环境变量形式注入到 CLI 子进程
 */
const ENGINE_PARAMS: Record<EngineId, Array<{
  key: string;
  label: string;
  placeholder: string;
  hint: string;
  secret?: boolean;
}>> = {
  'claude-code': [
    {
      key: 'apiKey',
      label: 'API Key',
      placeholder: 'sk-ant-...',
      hint: '环境变量 ANTHROPIC_API_KEY，留空则使用系统环境变量',
      secret: true,
    },
    {
      key: 'baseUrl',
      label: 'API Base URL',
      placeholder: 'https://api.anthropic.com',
      hint: '环境变量 ANTHROPIC_BASE_URL，兼容代理或第三方 Anthropic 端点',
    },
    {
      key: 'model',
      label: '模型 (Model)',
      placeholder: 'claude-opus-4-5',
      hint: '环境变量 ANTHROPIC_MODEL，常用：claude-opus-4-5 / claude-sonnet-4-5',
    },
  ],
  'codex-cli': [
    {
      key: 'apiKey',
      label: 'API Key',
      placeholder: 'sk-...',
      hint: '环境变量 OPENAI_API_KEY，留空则使用系统环境变量',
      secret: true,
    },
    {
      key: 'baseUrl',
      label: 'API Base URL',
      placeholder: 'https://api.openai.com/v1',
      hint: '环境变量 OPENAI_BASE_URL，可指向 Azure / 本地 Ollama 等兼容端点',
    },
    {
      key: 'model',
      label: '模型 (Model)',
      placeholder: 'o4-mini',
      hint: '环境变量 OPENAI_MODEL，常用：o4-mini / gpt-4o / gpt-4.1',
    },
  ],
  iflow: [
    {
      key: 'apiKey',
      label: 'API Key',
      placeholder: 'your-api-key',
      hint: 'IFlow 服务 API Key，留空则使用系统环境变量',
      secret: true,
    },
    {
      key: 'baseUrl',
      label: 'API Base URL',
      placeholder: 'https://api.iflow.example.com',
      hint: 'IFlow 服务端点地址',
    },
    {
      key: 'model',
      label: '模型 (Model)',
      placeholder: '',
      hint: '指定使用的模型名称（如有）',
    },
  ],
  gemini: [
    {
      key: 'apiKey',
      label: 'API Key',
      placeholder: 'AIza...',
      hint: '环境变量 GEMINI_API_KEY / GOOGLE_API_KEY，从 Google AI Studio 获取',
      secret: true,
    },
    {
      key: 'baseUrl',
      label: 'API Base URL',
      placeholder: 'https://generativelanguage.googleapis.com',
      hint: '环境变量 GEMINI_BASE_URL，留空使用默认端点',
    },
    {
      key: 'model',
      label: '模型 (Model)',
      placeholder: 'gemini-2.5-pro',
      hint: '环境变量 GEMINI_MODEL，常用：gemini-2.5-pro / gemini-2.0-flash',
    },
  ],
};

function SecretInput({
  value,
  onChange,
  placeholder,
  disabled,
  dirty = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
  dirty?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className={`w-full rounded-xl border bg-background px-3 py-2 pr-9 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 ${
          dirty ? 'border-primary' : 'border-border'
        }`}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary"
      >
        {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

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

function EngineParamsEditor({
  engineId,
  config,
  savedConfig,
  loading,
  onChange,
}: {
  engineId: EngineId;
  config: Config;
  savedConfig: Config;
  loading: boolean;
  onChange: (engineId: EngineId, key: string, value: string) => void;
}) {
  const params = ENGINE_PARAMS[engineId];
  const engineConfig = (
    engineId === 'claude-code' ? config.claudeCode
    : engineId === 'codex-cli' ? config.codexCli
    : engineId === 'gemini' ? config.gemini
    : config.iflow
  ) as Record<string, string | undefined>;

  const savedEngineConfig = (
    engineId === 'claude-code' ? savedConfig.claudeCode
    : engineId === 'codex-cli' ? savedConfig.codexCli
    : engineId === 'gemini' ? savedConfig.gemini
    : savedConfig.iflow
  ) as Record<string, string | undefined>;

  return (
    <div className="mt-4 space-y-3">
      {params.map((param) => {
        const currentValue = engineConfig[param.key] ?? '';
        const savedValue = savedEngineConfig[param.key] ?? '';
        const dirty = currentValue !== savedValue;

        return (
          <div key={param.key}>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">
              {param.label}
              <DirtyBadge visible={dirty} />
            </label>
            {param.secret ? (
              <SecretInput
                value={currentValue}
                onChange={(v) => onChange(engineId, param.key, v)}
                placeholder={param.placeholder}
                disabled={loading}
                dirty={dirty}
              />
            ) : (
              param.key === 'model' ? (
                <ModelInputWithFetch
                  engineId={engineId}
                  value={currentValue}
                  baseUrl={engineConfig.baseUrl ?? ''}
                  apiKey={engineConfig.apiKey ?? ''}
                  placeholder={param.placeholder}
                  disabled={loading}
                  dirty={dirty}
                  onChange={(v) => onChange(engineId, param.key, v)}
                />
              ) : (
                <input
                  type="text"
                  value={currentValue}
                  onChange={(e) => onChange(engineId, param.key, e.target.value)}
                  disabled={loading}
                  placeholder={param.placeholder}
                  className={`w-full rounded-xl border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 ${
                    dirty ? 'border-primary' : 'border-border'
                  }`}
                />
              )
            )}
            <p className="mt-1 text-xs text-text-tertiary">{param.hint}</p>
          </div>
        );
      })}
    </div>
  );
}

function ConnectionTestButton({ engineId, config }: { engineId: EngineId; config: Config }) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      const res = await testEngineConnection(config, engineId);
      setResult(res);
    } catch (e: any) {
      setResult({ success: false, message: e?.message || String(e) });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={handleTest}
        disabled={testing}
        className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary transition-colors hover:bg-background-hover disabled:opacity-50"
      >
        {testing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Wifi className="h-3.5 w-3.5" />
        )}
        {testing ? '测试中...' : '测试连接'}
      </button>
      {result && (
        <div className={`mt-3 rounded-xl border px-3 py-2.5 text-sm ${
          result.success
            ? 'border-success/30 bg-success/5 text-success'
            : 'border-danger/30 bg-danger-faint text-danger'
        }`}>
          <div className="flex items-start gap-2">
            {result.success ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <pre className="min-w-0 flex-1 whitespace-pre-wrap break-words text-xs font-mono">{result.message}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

function PathEditor(props: {
  engineId: EngineId;
  config: Config;
  savedConfig: Config;
  loading: boolean;
  onPathChange: (path: string) => void;
  onParamChange: (engineId: EngineId, key: string, value: string) => void;
}) {
  const { engineId, config, savedConfig, loading, onPathChange, onParamChange } = props;
  const meta = ENGINE_PATH_META[engineId];
  const pathValue = resolveEngineCliPath(config, engineId);
  const savedPathValue = resolveEngineCliPath(savedConfig, engineId);
  const pathDirty = pathValue !== savedPathValue;

  return (
    <section className="rounded-2xl border border-border bg-background-surface p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-text-primary">{meta.title}</h3>
        <p className="mt-1 text-xs leading-5 text-text-secondary">
          支持自动检测，也可以手动填写本地可执行文件路径。
        </p>
      </div>

      <label className="mb-2 block text-xs text-text-secondary">
        {meta.label}
        <DirtyBadge visible={pathDirty} />
      </label>
      <ClaudePathSelector
        value={pathValue}
        onChange={onPathChange}
        engineType={engineId}
        disabled={loading}
        placeholder={meta.placeholder}
      />

      <div className="mt-5 border-t border-border pt-4">
        <h4 className="mb-1 text-xs font-medium text-text-secondary">高级参数（环境变量注入）</h4>
        <p className="text-xs text-text-tertiary">留空则使用系统环境变量或引擎默认值，保存后立即生效。</p>
        <EngineParamsEditor
          engineId={engineId}
          config={config}
          savedConfig={savedConfig}
          loading={loading}
          onChange={onParamChange}
        />
        <ConnectionTestButton engineId={engineId} config={config} />
      </div>
    </section>
  );
}

function resolveEngineCliPath(config: Config, engineId: EngineId) {
  if (engineId === 'claude-code') {
    return config.claudeCode.cliPath;
  }

  if (engineId === 'codex-cli') {
    return config.codexCli.cliPath;
  }

  if (engineId === 'gemini') {
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
  const {
    config,
    savedConfig,
    loading,
    onEngineChange,
    onClaudePathChange,
    onIFlowPathChange,
    onCodexPathChange,
    onGeminiPathChange,
    onEngineParamChange,
  } = props;
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

        <div className="grid gap-3 md:grid-cols-2">
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
        config={config}
        savedConfig={savedConfig}
        loading={loading}
        onPathChange={handlePathChange}
        onParamChange={onEngineParamChange}
      />
    </div>
  );
}
