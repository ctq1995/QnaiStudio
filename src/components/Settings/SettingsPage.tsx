import { useConfigStore } from '../../stores';
import { useSettingsEditor } from './useSettingsEditor';
import { SettingsShell } from './SettingsShell';

interface SettingsPageProps {
  onClose: () => void;
  theme: 'dark' | 'light';
  onThemeChange: (theme: 'dark' | 'light') => void;
}

export function SettingsPage({ onClose, theme, onThemeChange }: SettingsPageProps) {
  const { config, loading, error, updateConfig } = useConfigStore();

  const editor = useSettingsEditor({ config, updateConfig, onClose });

  if (!config || !editor.localConfig) {
    return (
      <div className="flex h-screen items-center justify-center bg-background-base">
        <div className="text-sm text-text-muted">加载配置中...</div>
      </div>
    );
  }

  return (
    <SettingsShell
      config={editor.localConfig}
      savedConfig={config}
      loading={loading}
      error={error}
      hasUnsavedChanges={editor.hasUnsavedChanges}
      saveFeedback={editor.saveFeedback}
      onClose={onClose}
      onSave={editor.handleSave}
      onEngineChange={editor.updateEngine}
      onClaudePathChange={editor.updateClaudePath}
      onIFlowPathChange={editor.updateIFlowPath}
      onCodexPathChange={editor.updateCodexPath}
      onGeminiPathChange={editor.updateGeminiPath}
      onEngineParamChange={editor.updateEngineParam}
      onClaudeAdvancedChange={editor.updateClaudeAdvanced}
      onCodexAdvancedChange={editor.updateCodexAdvanced}
      onGeminiAdvancedChange={editor.updateGeminiAdvanced}
      providerDraft={editor.providerDraft}
      onStartProviderDraft={editor.startProviderDraft}
      onUpdateProviderDraft={editor.updateProviderDraft}
      onCancelProviderDraft={editor.cancelProviderDraft}
      onSubmitProviderDraft={editor.submitProviderDraft}
      onUpdateProvider={editor.updateProvider}
      onRemoveProvider={editor.removeProvider}
      onFloatingChange={editor.updateFloating}
      onThemeChange={onThemeChange}
      theme={theme}
    />
  );
}
