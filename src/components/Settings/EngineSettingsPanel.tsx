import {
  Bot,
  CheckCircle2,
  Cpu,
  FolderCog,
  Link2,
  Loader2,
  Shield,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  Wifi,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ClaudePathSelector } from '../Common';
import type { Config, EngineId, ClaudeAdvancedParams, ClaudePermissionMode, ClaudeOutputFormat, CodexAdvancedParams, CodexApprovalMode, GeminiAdvancedParams, GeminiApprovalMode } from '../../types';
import { ENGINE_OPTIONS } from './settingsOptions';
import { testEngineConnection } from '../../services/tauri';
import { ModelInputWithFetch } from './ModelInputWithFetch';

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
  onClaudeAdvancedChange: <K extends keyof ClaudeAdvancedParams>(key: K, value: ClaudeAdvancedParams[K]) => void;
  onCodexAdvancedChange: <K extends keyof CodexAdvancedParams>(key: K, value: CodexAdvancedParams[K]) => void;
  onGeminiAdvancedChange: <K extends keyof GeminiAdvancedParams>(key: K, value: GeminiAdvancedParams[K]) => void;
}

const ENGINE_ICON: Record<EngineId, LucideIcon> = {
  'claude-code': Bot,
  'codex-cli': Cpu,
  iflow: Cpu,
  gemini: Sparkles,
};

const ENGINE_PATH_META: Record<EngineId, { title: string; label: string; placeholder?: string }> = {
  'claude-code': { title: 'Claude Code 路径', label: 'Claude CLI 命令路径' },
  'codex-cli': { title: 'Codex CLI 路径', label: 'Codex CLI 命令路径', placeholder: 'codex' },
  iflow: { title: 'IFlow 路径', label: 'IFlow CLI 命令路径（可选）', placeholder: 'iflow' },
  gemini: { title: 'Gemini CLI 路径', label: 'Gemini CLI 命令路径', placeholder: 'gemini' },
};

const ENGINE_MODEL_META: Record<EngineId, { placeholder: string; hint: string }> = {
  'claude-code': { placeholder: 'claude-opus-4-5', hint: '常用：claude-opus-4-5 / claude-sonnet-4-5' },
  'codex-cli': { placeholder: 'o4-mini', hint: '常用：o4-mini / gpt-4o / gpt-4.1' },
  iflow: { placeholder: '', hint: '指定使用的模型名称（如有）' },
  gemini: { placeholder: 'gemini-2.5-pro', hint: '常用：gemini-2.5-pro / gemini-2.0-flash' },
};

/* ── Section card ── */
function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border-default bg-background-elevated p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-text-muted" />
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
      </div>
      {description && (
        <p className="text-xs text-text-muted leading-5">{description}</p>
      )}
      {children}
    </section>
  );
}

/* ── Engine card ── */
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
      aria-pressed={selected}
      className={`relative w-full rounded-xl border px-4 py-3 text-left transition-colors ${
        selected
          ? 'border-primary bg-primary-faint text-text-primary'
          : 'border-border-default bg-background-elevated text-text-tertiary hover:border-primary/40 hover:text-text-primary'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className={`rounded-md border p-1.5 ${selected ? 'border-primary/30 text-primary' : 'border-border-default text-text-muted'}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold">{name}</div>
            <div className="mt-1 text-xs leading-5 text-text-muted">{description}</div>
          </div>
        </div>
        {selected && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />}
      </div>
    </button>
  );
}

/* ── Params editor ── */
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
  const engineConfig = resolveEngineBinding(config, engineId) as Record<string, string | undefined>;
  const savedEngineConfig = resolveEngineBinding(savedConfig, engineId) as Record<string, string | undefined>;
  const providers = config.providers ?? [];
  const selectedProvider = providers.find((p) => p.id === engineConfig.providerId) ?? null;
  const providerDirty = (engineConfig.providerId ?? '') !== (savedEngineConfig.providerId ?? '');
  const modelDirty = (engineConfig.model ?? '') !== (savedEngineConfig.model ?? '');
  const modelMeta = ENGINE_MODEL_META[engineId];

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1.5 flex items-center gap-2">
          <label className="text-sm font-medium text-text-primary">模型服务商</label>
          {providerDirty && <Badge variant="warning">未保存</Badge>}
        </div>
        <Select
          value={engineConfig.providerId ?? ''}
          onValueChange={(v) => onChange(engineId, 'providerId', v)}
          disabled={loading || providers.length === 0}
        >
          <SelectTrigger className={providerDirty ? 'border-primary' : ''}>
            <SelectValue placeholder={providers.length === 0 ? '请先新增服务商' : '选择服务商'} />
          </SelectTrigger>
          <SelectContent>
            {providers.map((provider) => (
              <SelectItem key={provider.id} value={provider.id}>
                {provider.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-1.5 text-xs leading-5 text-text-muted">选择服务商。</p>
      </div>

      <div>
        <div className="mb-1.5 flex items-center gap-2">
          <label className="text-sm font-medium text-text-primary">模型 (Model)</label>
          {modelDirty && <Badge variant="warning">未保存</Badge>}
        </div>
        <ModelInputWithFetch
          engineId={engineId}
          value={engineConfig.model ?? ''}
          baseUrl={selectedProvider?.baseUrl ?? engineConfig.baseUrl ?? ''}
          apiKey={selectedProvider?.apiKey ?? engineConfig.apiKey ?? ''}
          placeholder={modelMeta.placeholder}
          disabled={loading || providers.length === 0 || !engineConfig.providerId}
          dirty={modelDirty}
          onChange={(v) => onChange(engineId, 'model', v)}
        />
        <p className="mt-1.5 text-xs leading-5 text-text-muted">{modelMeta.hint}</p>
      </div>
    </div>
  );
}

/* ── Connection test ── */
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
    <div className="space-y-3">
      <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
        {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
        {testing ? '测试中...' : '测试连接'}
      </Button>
      {result && (
        <div className={`rounded-lg border px-3 py-2 text-sm ${
          result.success
            ? 'border-success/30 bg-success-faint text-success'
            : 'border-danger/30 bg-danger-faint text-danger'
        }`}>
          <div className="flex items-start gap-2">
            {result.success ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <pre className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm font-mono">{result.message}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Claude Code advanced params ── */
function ClaudeAdvancedEditor({
  config,
  savedConfig,
  onChange,
}: {
  config: Config;
  savedConfig: Config;
  onChange: <K extends keyof ClaudeAdvancedParams>(key: K, value: ClaudeAdvancedParams[K]) => void;
}) {
  const adv = config.claudeCode.advanced ?? {};
  const savedAdv = savedConfig.claudeCode.advanced ?? {};

  return (
    <div className="space-y-4">
      {/* System Prompt */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-sm font-medium text-text-primary">系统提示词 (System Prompt)</label>
          {(adv.systemPrompt ?? '') !== (savedAdv.systemPrompt ?? '') && <Badge variant="warning">未保存</Badge>}
        </div>
        <Input
          value={adv.systemPrompt ?? ''}
          onChange={(e) => onChange('systemPrompt', e.target.value || undefined)}
          placeholder="可选，注入 --system-prompt 参数"
        />
        <p className="mt-1.5 text-xs leading-5 text-text-muted">覆盖默认系统提示词。</p>
      </div>

      {/* Append System Prompt */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-sm font-medium text-text-primary">追加系统提示词 (Append System Prompt)</label>
          {(adv.appendSystemPrompt ?? '') !== (savedAdv.appendSystemPrompt ?? '') && <Badge variant="warning">未保存</Badge>}
        </div>
        <Input
          value={adv.appendSystemPrompt ?? ''}
          onChange={(e) => onChange('appendSystemPrompt', e.target.value || undefined)}
          placeholder="可选，注入 --append-system-prompt 参数"
        />
        <p className="mt-1.5 text-xs leading-5 text-text-muted">在默认提示词后追加。</p>
      </div>

      {/* Permission Mode */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-sm font-medium text-text-primary">权限模式 (Permission Mode)</label>
          {(adv.permissionMode ?? 'bypassPermissions') !== (savedAdv.permissionMode ?? 'bypassPermissions') && <Badge variant="warning">未保存</Badge>}
        </div>
        <Select
          value={adv.permissionMode ?? 'bypassPermissions'}
          onValueChange={(v) => onChange('permissionMode', v as ClaudePermissionMode)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="bypassPermissions">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-3.5 w-3.5 text-danger" />
                <span>绕过权限 (bypassPermissions)</span>
              </div>
            </SelectItem>
            <SelectItem value="default">
              <div className="flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-text-muted" />
                <span>默认 (default)</span>
              </div>
            </SelectItem>
            <SelectItem value="plan">
              <div className="flex items-center gap-2">
                <Terminal className="h-3.5 w-3.5 text-primary" />
                <span>计划模式 (plan)</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="mt-1.5 text-xs leading-5 text-text-muted">控制权限确认方式。</p>
      </div>

      {/* Max Turns */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-sm font-medium text-text-primary">最大轮次 (Max Turns)</label>
          {(adv.maxTurns ?? '') !== (savedAdv.maxTurns ?? '') && <Badge variant="warning">未保存</Badge>}
        </div>
        <Input
          type="number"
          min={1}
          max={200}
          value={adv.maxTurns ?? ''}
          onChange={(e) => {
            const v = e.target.value;
            onChange('maxTurns', v ? parseInt(v, 10) : undefined);
          }}
          placeholder="不限"
        />
        <p className="mt-1.5 text-xs leading-5 text-text-muted">留空表示不限制。</p>
      </div>

      {/* Output Format */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-sm font-medium text-text-primary">输出格式 (Output Format)</label>
          {(adv.outputFormat ?? '') !== (savedAdv.outputFormat ?? '') && <Badge variant="warning">未保存</Badge>}
        </div>
        <Select
          value={adv.outputFormat ?? ''}
          onValueChange={(v) => onChange('outputFormat', (v || undefined) as ClaudeOutputFormat | undefined)}
        >
          <SelectTrigger>
            <SelectValue placeholder="跟随运行模式" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="stream-json">stream-json（流式 JSON）</SelectItem>
            <SelectItem value="text">text（纯文本）</SelectItem>
            <SelectItem value="json">json（JSON）</SelectItem>
          </SelectContent>
        </Select>
        <p className="mt-1.5 text-xs leading-5 text-text-muted">留空则自动决定。</p>
      </div>

      {/* Verbose */}
      <div className="flex items-center justify-between rounded-lg border border-border-default bg-background-surface px-3 py-2.5">
        <div>
          <div className="text-sm font-medium text-text-primary">详细输出 (Verbose)</div>
          <p className="text-xs text-text-muted">输出详细日志。</p>
        </div>
        <Switch
          checked={adv.verbose ?? true}
          onCheckedChange={(v) => onChange('verbose', v)}
        />
      </div>
    </div>
  );
}

/* ── Codex CLI advanced params ── */
function CodexAdvancedEditor({
  config,
  savedConfig,
  onChange,
}: {
  config: Config;
  savedConfig: Config;
  onChange: <K extends keyof CodexAdvancedParams>(key: K, value: CodexAdvancedParams[K]) => void;
}) {
  const adv = config.codexCli.advanced ?? {};
  const savedAdv = savedConfig.codexCli.advanced ?? {};

  return (
    <div className="space-y-4">
      {/* Skip Git Repo Check */}
      <div className="flex items-center justify-between rounded-lg border border-border-default bg-background-surface px-3 py-2.5">
        <div>
          <div className="text-sm font-medium text-text-primary">跳过 Git 仓库检查</div>
          <p className="text-xs text-text-muted">允许在非 Git 仓库中运行。</p>
        </div>
        <Switch
          checked={adv.skipGitRepoCheck ?? true}
          onCheckedChange={(v) => onChange('skipGitRepoCheck', v)}
        />
        {(adv.skipGitRepoCheck ?? true) !== (savedAdv.skipGitRepoCheck ?? true) && <Badge variant="warning" className="ml-2">未保存</Badge>}
      </div>

      {/* Bypass Approvals and Sandbox */}
      <div className="flex items-center justify-between rounded-lg border border-border-default bg-background-surface px-3 py-2.5">
        <div>
          <div className="text-sm font-medium text-text-primary">绕过审批和沙箱</div>
          <p className="text-xs text-text-muted">关闭审批和沙箱。</p>
        </div>
        <Switch
          checked={adv.bypassApprovalsAndSandbox ?? true}
          onCheckedChange={(v) => onChange('bypassApprovalsAndSandbox', v)}
        />
        {(adv.bypassApprovalsAndSandbox ?? true) !== (savedAdv.bypassApprovalsAndSandbox ?? true) && <Badge variant="warning" className="ml-2">未保存</Badge>}
      </div>

      {/* Approval Mode */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-sm font-medium text-text-primary">审批模式 (Approval Mode)</label>
          {(adv.approvalMode ?? '') !== (savedAdv.approvalMode ?? '') && <Badge variant="warning">未保存</Badge>}
        </div>
        <Select
          value={adv.approvalMode ?? ''}
          onValueChange={(v) => onChange('approvalMode', (v || undefined) as CodexApprovalMode | undefined)}
        >
          <SelectTrigger>
            <SelectValue placeholder="未设置（跟随绕过审批开关）" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="suggest">suggest（建议模式）</SelectItem>
            <SelectItem value="auto-edit">auto-edit（自动编辑）</SelectItem>
            <SelectItem value="full-auto">full-auto（全自动）</SelectItem>
          </SelectContent>
        </Select>
        <p className="mt-1.5 text-xs leading-5 text-text-muted">设置审批方式。</p>
      </div>
    </div>
  );
}

/* ── Gemini CLI advanced params ── */
function GeminiAdvancedEditor({
  config,
  savedConfig,
  onChange,
}: {
  config: Config;
  savedConfig: Config;
  onChange: <K extends keyof GeminiAdvancedParams>(key: K, value: GeminiAdvancedParams[K]) => void;
}) {
  const adv = config.gemini.advanced ?? {};
  const savedAdv = savedConfig.gemini.advanced ?? {};

  return (
    <div className="space-y-4">
      {/* Approval Mode */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label className="text-sm font-medium text-text-primary">审批模式 (Approval Mode)</label>
          {(adv.approvalMode ?? '') !== (savedAdv.approvalMode ?? '') && <Badge variant="warning">未保存</Badge>}
        </div>
        <Select
          value={adv.approvalMode ?? ''}
          onValueChange={(v) => onChange('approvalMode', (v || undefined) as GeminiApprovalMode | undefined)}
        >
          <SelectTrigger>
            <SelectValue placeholder="未设置（跟随 YOLO 开关）" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">default（默认，逐步确认）</SelectItem>
            <SelectItem value="auto-edit">auto-edit（自动编辑）</SelectItem>
            <SelectItem value="yolo">yolo（自动批准所有操作）</SelectItem>
            <SelectItem value="plan">plan（计划模式，仅规划不执行）</SelectItem>
          </SelectContent>
        </Select>
        <p className="mt-1.5 text-xs leading-5 text-text-muted">设置 Gemini CLI 的审批交互模式。设置后优先于 YOLO 开关。</p>
      </div>

      {/* YOLO Mode */}
      <div className="flex items-center justify-between rounded-lg border border-border-default bg-background-surface px-3 py-2.5">
        <div>
          <div className="text-sm font-medium text-text-primary">自动批准模式 (YOLO)</div>
          <p className="text-xs text-text-muted">自动批准所有工具操作，无需手动确认（--yolo）。关闭后操作需逐步确认。审批模式设置后此开关无效。</p>
        </div>
        <Switch
          checked={adv.yolo ?? true}
          onCheckedChange={(v) => onChange('yolo', v)}
        />
        {(adv.yolo ?? true) !== (savedAdv.yolo ?? true) && <Badge variant="warning" className="ml-2">未保存</Badge>}
      </div>

      {/* Sandbox */}
      <div className="flex items-center justify-between rounded-lg border border-border-default bg-background-surface px-3 py-2.5">
        <div>
          <div className="text-sm font-medium text-text-primary">沙箱模式 (Sandbox)</div>
          <p className="text-xs text-text-muted">在沙箱中执行操作，限制文件系统和网络访问（--sandbox）。</p>
        </div>
        <Switch
          checked={adv.sandbox ?? false}
          onCheckedChange={(v) => onChange('sandbox', v)}
        />
        {(adv.sandbox ?? false) !== (savedAdv.sandbox ?? false) && <Badge variant="warning" className="ml-2">未保存</Badge>}
      </div>
    </div>
  );
}

/* ── Helpers ── */
function resolveEngineBinding(config: Config, engineId: EngineId) {
  if (engineId === 'claude-code') return config.claudeCode;
  if (engineId === 'codex-cli') return config.codexCli;
  if (engineId === 'gemini') return config.gemini;
  return config.iflow;
}

function resolveEngineCliPath(config: Config, engineId: EngineId) {
  if (engineId === 'claude-code') return config.claudeCode.cliPath;
  if (engineId === 'codex-cli') return config.codexCli.cliPath;
  if (engineId === 'gemini') return config.gemini.cliPath;
  return config.iflow.cliPath || 'iflow';
}

function resolvePathHandler(
  engineId: EngineId,
  onClaudePathChange: (path: string) => void,
  onIFlowPathChange: (path: string) => void,
  onCodexPathChange: (path: string) => void,
  onGeminiPathChange: (path: string) => void,
) {
  if (engineId === 'claude-code') return onClaudePathChange;
  if (engineId === 'codex-cli') return onCodexPathChange;
  if (engineId === 'gemini') return onGeminiPathChange;
  return onIFlowPathChange;
}

/* ── Main panel ── */
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
    onClaudeAdvancedChange,
    onCodexAdvancedChange,
    onGeminiAdvancedChange,
  } = props;

  const handlePathChange = resolvePathHandler(
    config.defaultEngine,
    onClaudePathChange,
    onIFlowPathChange,
    onCodexPathChange,
    onGeminiPathChange,
  );

  const pathValue = resolveEngineCliPath(config, config.defaultEngine);
  const savedPathValue = resolveEngineCliPath(savedConfig, config.defaultEngine);
  const pathDirty = pathValue !== savedPathValue;

  return (
    <div className="space-y-4">
      <SettingsSection icon={Cpu} title="默认引擎" description="选择引擎。">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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
      </SettingsSection>

      <SettingsSection
        icon={FolderCog}
        title={ENGINE_PATH_META[config.defaultEngine].title}
        description="配置 CLI 路径。"
      >
        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <label className="text-sm font-medium text-text-primary">
              {ENGINE_PATH_META[config.defaultEngine].label}
            </label>
            {pathDirty && <Badge variant="warning">未保存</Badge>}
          </div>
          <ClaudePathSelector
            value={pathValue}
            onChange={handlePathChange}
            engineType={config.defaultEngine}
            disabled={loading}
            placeholder={ENGINE_PATH_META[config.defaultEngine].placeholder}
          />
        </div>
      </SettingsSection>

      <SettingsSection icon={Link2} title="服务商与模型" description="设置服务商和模型。">
        <EngineParamsEditor
          engineId={config.defaultEngine}
          config={config}
          savedConfig={savedConfig}
          loading={loading}
          onChange={onEngineParamChange}
        />
      </SettingsSection>

      <SettingsSection icon={Wifi} title="连接测试" description="测试当前配置。">
        <ConnectionTestButton engineId={config.defaultEngine} config={config} />
      </SettingsSection>

      <SettingsSection icon={SlidersHorizontal} title="高级参数" description="设置附加参数。">
        {config.defaultEngine === 'claude-code' && (
          <ClaudeAdvancedEditor config={config} savedConfig={savedConfig} onChange={onClaudeAdvancedChange} />
        )}
        {config.defaultEngine === 'codex-cli' && (
          <CodexAdvancedEditor config={config} savedConfig={savedConfig} onChange={onCodexAdvancedChange} />
        )}
        {config.defaultEngine === 'gemini' && (
          <GeminiAdvancedEditor config={config} savedConfig={savedConfig} onChange={onGeminiAdvancedChange} />
        )}
        {config.defaultEngine === 'iflow' && (
          <div className="rounded-lg border border-dashed border-border-default bg-background-surface px-3 py-3 text-sm text-text-muted">
            IFlow 暂无额外高级参数配置。
          </div>
        )}
      </SettingsSection>
    </div>
  );
}
