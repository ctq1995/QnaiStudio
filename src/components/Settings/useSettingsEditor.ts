import { useCallback, useEffect, useState } from 'react';
import type { Config, EngineId } from '../../types';

interface UseSettingsEditorOptions {
  config: Config | null;
  updateConfig: (config: Config) => Promise<void>;
  onClose: () => void;
}

function useLocalSettingsDraft(config: Config | null) {
  const [localConfig, setLocalConfig] = useState<Config | null>(config);

  useEffect(() => {
    if (config) {
      setLocalConfig(config);
    }
  }, [config]);

  return { localConfig, setLocalConfig };
}

export function useSettingsEditor(options: UseSettingsEditorOptions) {
  const { config, updateConfig, onClose } = options;
  const { localConfig, setLocalConfig } = useLocalSettingsDraft(config);

  const updateEngine = useCallback((engineId: EngineId) => {
    setLocalConfig((current) => current ? { ...current, defaultEngine: engineId } : current);
  }, [setLocalConfig]);

  const updateClaudePath = useCallback((path: string) => {
    setLocalConfig((current) => current ? { ...current, claudeCode: { ...current.claudeCode, cliPath: path } } : current);
  }, [setLocalConfig]);

  const updateIFlowPath = useCallback((path: string) => {
    setLocalConfig((current) => current ? { ...current, iflow: { ...current.iflow, cliPath: path } } : current);
  }, [setLocalConfig]);

  const updateCodexPath = useCallback((path: string) => {
    setLocalConfig((current) => current ? { ...current, codexCli: { ...current.codexCli, cliPath: path } } : current);
  }, [setLocalConfig]);

  const updateGeminiPath = useCallback((path: string) => {
    setLocalConfig((current) => current ? { ...current, gemini: { ...current.gemini, cliPath: path } } : current);
  }, [setLocalConfig]);

  const updateFloating = useCallback(<K extends keyof Config['floatingWindow']>(key: K, value: Config['floatingWindow'][K]) => {
    setLocalConfig((current) => current ? { ...current, floatingWindow: { ...current.floatingWindow, [key]: value } } : current);
  }, [setLocalConfig]);

  const handleSave = useCallback(async () => {
    if (!localConfig) {
      return;
    }

    try {
      await updateConfig(localConfig);
      onClose();
    } catch (saveError) {
      console.error('保存配置失败:', saveError);
    }
  }, [localConfig, onClose, updateConfig]);

  return { localConfig, updateEngine, updateClaudePath, updateIFlowPath, updateCodexPath, updateGeminiPath, updateFloating, handleSave };
}
