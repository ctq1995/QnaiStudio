import { Database, Plus, Server, Trash2, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import type { Config, ModelProviderConfig, ProviderKind } from '../../types';
import type { ProviderDraft } from './useSettingsEditor';

interface ProvidersSettingsPanelProps {
  config: Config;
  savedConfig: Config;
  providerDraft: ProviderDraft | null;
  onStartProviderDraft: () => void;
  onUpdateProviderDraft: <K extends keyof ProviderDraft>(key: K, value: ProviderDraft[K]) => void;
  onCancelProviderDraft: () => void;
  onSubmitProviderDraft: () => void;
  onUpdateProvider: <K extends keyof ModelProviderConfig>(providerId: string, key: K, value: ModelProviderConfig[K]) => void;
  onRemoveProvider: (providerId: string) => void;
}

const PROVIDER_KIND_OPTIONS: { value: ProviderKind; label: string }[] = [
  { value: 'openai-compatible', label: 'OpenAI 兼容' },
  { value: 'anthropic-compatible', label: 'Anthropic 兼容' },
  { value: 'gemini-compatible', label: 'Gemini 兼容' },
  { value: 'custom', label: '自定义' },
];

function SettingsSection({
  icon: Icon,
  title,
  description,
  action,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border-default bg-background-elevated p-4 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-text-muted" />
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        </div>
        {action}
      </div>
      {description && (
        <p className="text-xs text-text-muted leading-5">{description}</p>
      )}
      {children}
    </section>
  );
}

function ProviderEditor({
  title,
  provider,
  savedProvider,
  action,
  onNameChange,
  onKindChange,
  onBaseUrlChange,
  onApiKeyChange,
}: {
  title: string;
  provider: Pick<ModelProviderConfig, 'name' | 'kind' | 'baseUrl' | 'apiKey'>;
  savedProvider?: Pick<ModelProviderConfig, 'name' | 'kind' | 'baseUrl' | 'apiKey'> | null;
  action?: ReactNode;
  onNameChange: (value: string) => void;
  onKindChange: (value: ProviderKind) => void;
  onBaseUrlChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
}) {
  const kindLabel = PROVIDER_KIND_OPTIONS.find((o) => o.value === provider.kind)?.label ?? provider.kind;
  const nameDirty = savedProvider ? provider.name !== savedProvider.name : false;
  const kindDirty = savedProvider ? provider.kind !== savedProvider.kind : false;
  const baseUrlDirty = savedProvider ? (provider.baseUrl ?? '') !== (savedProvider.baseUrl ?? '') : false;
  const apiKeyDirty = savedProvider ? (provider.apiKey ?? '') !== (savedProvider.apiKey ?? '') : false;
  const isDirty = nameDirty || kindDirty || baseUrlDirty || apiKeyDirty;

  return (
    <div className="rounded-xl border border-border-default bg-background-surface p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-text-primary">{title}</span>
            {isDirty && <Badge variant="warning">未保存</Badge>}
          </div>
          <Badge variant="default" className="mt-1.5">{kindLabel}</Badge>
        </div>
        {action}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm text-text-primary">名称</label>
          <Input
            value={provider.name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="例如 OpenRouter / 自建网关"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-text-primary">类型</label>
          <Select value={provider.kind} onValueChange={(v) => onKindChange(v as ProviderKind)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVIDER_KIND_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="md:col-span-2">
          <label className="mb-1.5 block text-sm text-text-primary">Base URL</label>
          <Input
            value={provider.baseUrl ?? ''}
            onChange={(e) => onBaseUrlChange(e.target.value)}
            placeholder="https://api.example.com/v1"
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-1.5 block text-sm text-text-primary">API Key</label>
          <Input
            type="password"
            value={provider.apiKey ?? ''}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder="sk-..."
          />
        </div>
      </div>
    </div>
  );
}

export function ProvidersSettingsPanel({
  config,
  savedConfig,
  providerDraft,
  onStartProviderDraft,
  onUpdateProviderDraft,
  onCancelProviderDraft,
  onSubmitProviderDraft,
  onUpdateProvider,
  onRemoveProvider,
}: ProvidersSettingsPanelProps) {
  const providers = config.providers ?? [];
  const savedProviders = savedConfig.providers ?? [];

  return (
    <div className="space-y-4">
      <SettingsSection
        icon={Database}
        title="模型服务商"
        description="集中管理各引擎可绑定的 API 服务商配置。"
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={onStartProviderDraft}
            disabled={Boolean(providerDraft)}
          >
            <Plus className="h-4 w-4" />
            新增服务商
          </Button>
        }
      >
        {providerDraft ? (
          <ProviderEditor
            title="新服务商"
            provider={providerDraft}
            action={
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={onCancelProviderDraft}>
                  取消
                </Button>
                <Button
                  size="sm"
                  onClick={onSubmitProviderDraft}
                  disabled={!providerDraft.name.trim()}
                >
                  保存服务商
                </Button>
              </div>
            }
            onNameChange={(value) => onUpdateProviderDraft('name', value)}
            onKindChange={(value) => onUpdateProviderDraft('kind', value)}
            onBaseUrlChange={(value) => onUpdateProviderDraft('baseUrl', value)}
            onApiKeyChange={(value) => onUpdateProviderDraft('apiKey', value)}
          />
        ) : null}

        {providers.length === 0 && !providerDraft ? (
          <div className="rounded-xl border border-dashed border-border-default bg-background-surface px-4 py-5 text-sm text-text-muted">
            <div className="font-medium text-text-primary">还没有服务商</div>
            <p className="mt-1 leading-5">新增后即可在引擎设置中绑定默认模型来源。</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={onStartProviderDraft}
              disabled={Boolean(providerDraft)}
            >
              <Plus className="h-4 w-4" />
              新增第一个服务商
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {providers.map((provider) => {
              const saved = savedProviders.find((s) => s.id === provider.id);
              return (
                <ProviderEditor
                  key={provider.id}
                  title={provider.name || '未命名服务商'}
                  provider={provider}
                  savedProvider={saved}
                  action={
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-text-muted hover:text-danger">
                          <Trash2 className="h-4 w-4" />
                          删除
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>删除服务商 "{provider.name}"？</AlertDialogTitle>
                          <AlertDialogDescription>
                            删除后，绑定该服务商的引擎将失去默认模型来源。此操作不可撤销。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => onRemoveProvider(provider.id)}
                            className="bg-danger hover:bg-danger-hover text-white"
                          >
                            确认删除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  }
                  onNameChange={(value) => onUpdateProvider(provider.id, 'name', value)}
                  onKindChange={(value) => onUpdateProvider(provider.id, 'kind', value)}
                  onBaseUrlChange={(value) => onUpdateProvider(provider.id, 'baseUrl', value)}
                  onApiKeyChange={(value) => onUpdateProvider(provider.id, 'apiKey', value)}
                />
              );
            })}
          </div>
        )}
      </SettingsSection>

      <SettingsSection
        icon={Server}
        title="使用说明"
        description="当前服务商会作为引擎的模型来源，Base URL 与 API Key 将用于模型查询和连接测试。"
      >
        <div className="rounded-lg border border-border-default bg-background-surface px-4 py-3 text-xs leading-6 text-text-muted">
          <p>建议为不同平台分别创建独立服务商，便于在引擎页按需切换默认模型。</p>
          <p className="mt-2">如果使用兼容 OpenAI / Anthropic / Gemini 的网关，请填写完整 API 地址和对应密钥。</p>
        </div>
      </SettingsSection>
    </div>
  );
}
