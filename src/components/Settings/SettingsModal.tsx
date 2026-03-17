import { ReactNode, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useConfigStore } from '../../stores';
import type { Config, EngineId } from '../../types';
import { Button } from '../Common';
import { SettingsContent } from './SettingsContent';
import { SETTINGS_SECTIONS, type SettingsSectionId } from './settingsOptions';
import { useSettingsEditor } from './useSettingsEditor';

const MODAL_LAYER_CLASS = 'z-[3000]';
const PANEL_HEIGHT_CLASS = 'h-[72vh]';
const PANEL_MAX_WIDTH_CLASS = 'max-w-5xl';
const SIDEBAR_WIDTH_CLASS = 'w-72';

interface SettingsModalProps {
  onClose: () => void;
}

type SettingsSectionMeta = (typeof SETTINGS_SECTIONS)[number];

interface SettingsOverlayProps {
  children: ReactNode;
}

function SettingsOverlay({ children }: SettingsOverlayProps) {
  const content = (
    <div className={`fixed inset-0 ${MODAL_LAYER_CLASS} flex items-center justify-center bg-black/50 p-4`}>
      {children}
    </div>
  );

  return createPortal(content, document.body);
}

function LoadingState() {
  return (
    <SettingsOverlay>
      <div className="w-full max-w-md rounded-2xl bg-background-elevated p-6 shadow-soft">
        <div className="text-center text-text-primary">正在加载设置...</div>
      </div>
    </SettingsOverlay>
  );
}

interface ConfirmCloseDialogProps {
  onCancel: () => void;
  onConfirm: () => void;
}

function ConfirmCloseDialog({ onCancel, onConfirm }: ConfirmCloseDialogProps) {
  return (
    <>
      <div className="fixed inset-0 z-[3100] bg-black/60" onClick={onCancel} />
      <div className="fixed left-1/2 top-1/2 z-[3101] w-[420px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background-elevated p-5 shadow-xl">
        <div className="text-base font-semibold text-text-primary">放弃未保存的更改？</div>
        <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-secondary">
          当前有已编辑但未保存的配置。关闭后将丢失这些更改。
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-sm text-text-secondary hover:bg-background-hover hover:text-text-primary"
          >
            继续编辑
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-danger px-3 py-1.5 text-sm text-white hover:bg-danger-hover"
          >
            放弃更改并关闭
          </button>
        </div>
      </div>
    </>
  );
}

interface SectionButtonProps {
  section: SettingsSectionMeta;
  selected: boolean;
  onSelect: (sectionId: SettingsSectionId) => void;
}

function SectionButton({ section, selected, onSelect }: SectionButtonProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(section.id)}
      className={`w-full rounded-2xl border px-3 py-2.5 text-left transition-colors ${
        selected
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-background-surface text-text-secondary hover:text-text-primary'
      }`}
    >
      <div className="text-sm font-medium">{section.name}</div>
      <div className="mt-0.5 text-xs opacity-80">{section.description}</div>
    </button>
  );
}

interface SettingsSidebarProps {
  sections: SettingsSectionMeta[];
  activeSection: SettingsSectionId;
  onSelect: (sectionId: SettingsSectionId) => void;
}

function SettingsSidebar({ sections, activeSection, onSelect }: SettingsSidebarProps) {
  return (
    <aside className={`flex h-full ${SIDEBAR_WIDTH_CLASS} flex-col border-r border-border bg-background-surface`}>
      <div className="border-b border-border px-5 py-5">
        <h2 className="text-lg font-semibold text-text-primary">设置</h2>
        <p className="mt-1 text-sm text-text-secondary">
          统一管理引擎配置与界面行为。
        </p>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {sections.map((section) => (
          <SectionButton
            key={section.id}
            section={section}
            selected={section.id === activeSection}
            onSelect={onSelect}
          />
        ))}
      </div>
    </aside>
  );
}

interface SettingsHeaderProps {
  title: string;
  description: string;
  onClose: () => void;
}

function SettingsHeader({ title, description, onClose }: SettingsHeaderProps) {
  return (
    <div className="border-b border-border px-6 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-text-tertiary">当前模块</div>
          <h3 className="mt-1 text-lg font-semibold text-text-primary">{title}</h3>
          <p className="mt-1 text-sm text-text-secondary">{description}</p>
        </div>
        <button onClick={onClose} className="text-text-tertiary transition-colors hover:text-text-primary">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

interface SettingsFooterProps {
  onClose: () => void;
  onSave: () => void;
  loading: boolean;
  hasUnsavedChanges: boolean;
  saveHint: string | null;
}

function SettingsFooter({ onClose, onSave, loading, hasUnsavedChanges, saveHint }: SettingsFooterProps) {
  const saveDisabled = loading || !hasUnsavedChanges;
  const saveLabel = loading ? '保存中...' : hasUnsavedChanges ? '保存' : '已保存';

  return (
    <div className="flex items-center gap-3 border-t border-border px-6 py-4">
      <div className="flex-1 text-xs text-text-tertiary">
        {hasUnsavedChanges ? '已修改，未保存' : saveHint}
      </div>
      <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
        关闭
      </Button>
      <Button onClick={onSave} disabled={saveDisabled} className="min-w-[88px]">
        {saveLabel}
      </Button>
    </div>
  );
}

interface SettingsMainProps {
  activeSection: SettingsSectionId;
  activeMeta: SettingsSectionMeta;
  config: Config;
  savedConfig: Config;
  error: string | null;
  loading: boolean;
  hasUnsavedChanges: boolean;
  saveBanner: { type: 'success' | 'error'; message: string } | null;
  onClose: () => void;
  onSave: () => void;
  onEngineChange: (engineId: EngineId) => void;
  onClaudePathChange: (path: string) => void;
  onIFlowPathChange: (path: string) => void;
  onCodexPathChange: (path: string) => void;
  onGeminiPathChange: (path: string) => void;
  onEngineParamChange: (engineId: EngineId, key: string, value: string) => void;
  onFloatingChange: <K extends keyof Config['floatingWindow']>(key: K, value: Config['floatingWindow'][K]) => void;
}

function SettingsMain(props: SettingsMainProps) {
  const {
    activeSection,
    activeMeta,
    config,
    savedConfig,
    error,
    loading,
    hasUnsavedChanges,
    saveBanner,
    onClose,
    onSave,
    onEngineChange,
    onClaudePathChange,
    onIFlowPathChange,
    onCodexPathChange,
    onGeminiPathChange,
    onEngineParamChange,
    onFloatingChange,
  } = props;

  const errorBanner = saveBanner?.type === 'error' ? saveBanner : null;
  const hasNotice = Boolean(errorBanner || hasUnsavedChanges || error);

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-background-elevated">
      <SettingsHeader title={activeMeta.name} description={activeMeta.description} onClose={onClose} />
      {hasNotice && (
        <div className="shrink-0 space-y-3 border-b border-border px-6 py-4">
          {errorBanner && (
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                'border-danger/30 bg-danger-faint text-danger'
              }`}
            >
              {errorBanner.message}
            </div>
          )}

          {hasUnsavedChanges && (
            <div className="rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
              你已编辑了一些参数，但尚未保存。
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-danger/30 bg-danger-faint px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <SettingsContent
          activeSection={activeSection}
          config={config}
          savedConfig={savedConfig}
          loading={loading}
          onEngineChange={onEngineChange}
          onClaudePathChange={onClaudePathChange}
          onIFlowPathChange={onIFlowPathChange}
          onCodexPathChange={onCodexPathChange}
          onGeminiPathChange={onGeminiPathChange}
          onEngineParamChange={onEngineParamChange}
          onFloatingChange={onFloatingChange}
        />
      </div>

      <SettingsFooter
        onClose={onClose}
        onSave={onSave}
        loading={loading}
        hasUnsavedChanges={hasUnsavedChanges}
        saveHint={saveBanner?.type === 'success' ? saveBanner.message : null}
      />
    </div>
  );
}

function formatSavedAt(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN');
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { config, loading, error, updateConfig } = useConfigStore();
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('engine');
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const {
    localConfig,
    hasUnsavedChanges,
    saveFeedback,
    updateEngine,
    updateClaudePath,
    updateIFlowPath,
    updateCodexPath,
    updateGeminiPath,
    updateFloating,
    updateEngineParam,
    handleSave,
    requestClose,
  } = useSettingsEditor({ config, updateConfig, onClose });

  const activeMeta = useMemo(() => {
    return SETTINGS_SECTIONS.find((section) => section.id === activeSection) ?? SETTINGS_SECTIONS[0];
  }, [activeSection]);

  const saveBanner = useMemo(() => {
    if (saveFeedback.status === 'success') {
      const at = saveFeedback.savedAt ? `（${formatSavedAt(saveFeedback.savedAt)}）` : '';
      return { type: 'success' as const, message: `${saveFeedback.message ?? '已保存'}${at}` };
    }

    if (saveFeedback.status === 'error') {
      return { type: 'error' as const, message: saveFeedback.message ?? '保存失败' };
    }

    return null;
  }, [saveFeedback.message, saveFeedback.savedAt, saveFeedback.status]);

  const handleRequestClose = () => {
    if (hasUnsavedChanges) {
      setShowCloseConfirm(true);
      return;
    }
    requestClose();
  };

  const handleConfirmClose = () => {
    setShowCloseConfirm(false);
    requestClose();
  };

  const handleCancelClose = () => {
    setShowCloseConfirm(false);
  };

  if (!localConfig || !config) {
    return <LoadingState />;
  }

  return (
    <SettingsOverlay>
      <div className={`flex w-full ${PANEL_HEIGHT_CLASS} ${PANEL_MAX_WIDTH_CLASS} overflow-hidden rounded-3xl border border-border shadow-soft`}>
        <SettingsSidebar
          sections={SETTINGS_SECTIONS}
          activeSection={activeSection}
          onSelect={setActiveSection}
        />
        <SettingsMain
          activeSection={activeSection}
          activeMeta={activeMeta}
          config={localConfig}
          savedConfig={config}
          error={error}
          loading={loading}
          hasUnsavedChanges={hasUnsavedChanges}
          saveBanner={saveBanner}
          onClose={handleRequestClose}
          onSave={handleSave}
          onEngineChange={updateEngine}
          onClaudePathChange={updateClaudePath}
          onIFlowPathChange={updateIFlowPath}
          onCodexPathChange={updateCodexPath}
          onGeminiPathChange={updateGeminiPath}
          onEngineParamChange={updateEngineParam}
          onFloatingChange={updateFloating}
        />
      </div>

      {showCloseConfirm && (
        <ConfirmCloseDialog onCancel={handleCancelClose} onConfirm={handleConfirmClose} />
      )}
    </SettingsOverlay>
  );
}
