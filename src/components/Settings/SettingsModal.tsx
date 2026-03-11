import { ReactNode, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useConfigStore } from '../../stores';
import { Button } from '../Common';
import { SettingsContent } from './SettingsContent';
import { SETTINGS_SECTIONS, type SettingsSectionId } from './settingsOptions';
import { useSettingsEditor } from './useSettingsEditor';
import type { Config, EngineId } from '../../types';

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
          统一管理引擎配置与界面行为，减少层级和无效滚动。
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
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
}

function SettingsFooter({ onClose, onSave, loading }: SettingsFooterProps) {
  return (
    <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
      <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>
        取消
      </Button>
      <Button onClick={onSave} disabled={loading} className="min-w-[88px]">
        {loading ? '保存中...' : '保存'}
      </Button>
    </div>
  );
}

interface SettingsMainProps {
  activeSection: SettingsSectionId;
  activeMeta: SettingsSectionMeta;
  config: Config;
  error: string | null;
  loading: boolean;
  onClose: () => void;
  onSave: () => void;
  onEngineChange: (engineId: EngineId) => void;
  onClaudePathChange: (path: string) => void;
  onIFlowPathChange: (path: string) => void;
  onCodexPathChange: (path: string) => void;
  onGeminiPathChange: (path: string) => void;
  onFloatingChange: <K extends keyof Config['floatingWindow']>(key: K, value: Config['floatingWindow'][K]) => void;
}

function SettingsMain(props: SettingsMainProps) {
  const {
    activeSection,
    activeMeta,
    config,
    error,
    loading,
    onClose,
    onSave,
    onEngineChange,
    onClaudePathChange,
    onIFlowPathChange,
    onCodexPathChange,
    onGeminiPathChange,
    onFloatingChange,
  } = props;

  return (
    <div className="flex-1 flex min-w-0 flex-col bg-background-elevated">
      <SettingsHeader title={activeMeta.name} description={activeMeta.description} onClose={onClose} />
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {error && (
          <div className="mb-4 rounded-xl border border-danger/30 bg-danger-faint px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}
        <SettingsContent
          activeSection={activeSection}
          config={config}
          loading={loading}
          onEngineChange={onEngineChange}
          onClaudePathChange={onClaudePathChange}
          onIFlowPathChange={onIFlowPathChange}
          onCodexPathChange={onCodexPathChange}
          onGeminiPathChange={onGeminiPathChange}
          onFloatingChange={onFloatingChange}
        />
      </div>
      <SettingsFooter onClose={onClose} onSave={onSave} loading={loading} />
    </div>
  );
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { config, loading, error, updateConfig } = useConfigStore();
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('engine');
  const {
    localConfig,
    updateEngine,
    updateClaudePath,
    updateIFlowPath,
    updateCodexPath,
    updateGeminiPath,
    updateFloating,
    handleSave,
  } = useSettingsEditor({ config, updateConfig, onClose });

  const activeMeta = useMemo(() => {
    return SETTINGS_SECTIONS.find((section) => section.id === activeSection) ?? SETTINGS_SECTIONS[0];
  }, [activeSection]);

  if (!localConfig) {
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
          error={error}
          loading={loading}
          onClose={onClose}
          onSave={handleSave}
          onEngineChange={updateEngine}
          onClaudePathChange={updateClaudePath}
          onIFlowPathChange={updateIFlowPath}
          onCodexPathChange={updateCodexPath}
          onGeminiPathChange={updateGeminiPath}
          onFloatingChange={updateFloating}
        />
      </div>
    </SettingsOverlay>
  );
}
