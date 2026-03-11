import type { FloatingWindowMode, Config, EngineId } from '../../types';
import { AboutSettingsPanel } from './AboutSettingsPanel';
import { EngineSettingsPanel } from './EngineSettingsPanel';
import { FloatingWindowSettingsPanel } from './FloatingWindowSettingsPanel';
import type { SettingsSectionId } from './settingsOptions';

interface SettingsContentProps {
  activeSection: SettingsSectionId;
  config: Config;
  loading: boolean;
  onEngineChange: (engineId: EngineId) => void;
  onClaudePathChange: (path: string) => void;
  onIFlowPathChange: (path: string) => void;
  onCodexPathChange: (path: string) => void;
  onGeminiPathChange: (path: string) => void;
  onFloatingChange: <K extends keyof Config['floatingWindow']>(key: K, value: Config['floatingWindow'][K]) => void;
}

export function SettingsContent(props: SettingsContentProps) {
  const { activeSection, config, loading, onEngineChange, onClaudePathChange, onIFlowPathChange, onCodexPathChange, onGeminiPathChange, onFloatingChange } = props;

  if (activeSection === 'engine') {
    return (
      <EngineSettingsPanel
        config={config}
        loading={loading}
        onEngineChange={onEngineChange}
        onClaudePathChange={onClaudePathChange}
        onIFlowPathChange={onIFlowPathChange}
        onCodexPathChange={onCodexPathChange}
        onGeminiPathChange={onGeminiPathChange}
      />
    );
  }

  if (activeSection === 'about') {
    return <AboutSettingsPanel />;
  }

  return (
    <FloatingWindowSettingsPanel
      config={config}
      onEnabledChange={(enabled) => onFloatingChange('enabled', enabled)}
      onModeChange={(mode: FloatingWindowMode) => onFloatingChange('mode', mode)}
      onExpandOnHoverChange={(expandOnHover) => onFloatingChange('expandOnHover', expandOnHover)}
      onCollapseDelayChange={(collapseDelay) => onFloatingChange('collapseDelay', collapseDelay)}
    />
  );
}
