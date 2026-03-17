import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Config, EngineId } from '../../types';

interface UseSettingsEditorOptions {
  config: Config | null;
  updateConfig: (config: Config) => Promise<void>;
  onClose: () => void;
}

interface LocalSettingsDraft {
  localConfig: Config | null;
  setLocalConfig: (updater: (current: Config | null) => Config | null) => void;
}

function useLocalSettingsDraft(config: Config | null): LocalSettingsDraft {
  const [localConfig, setLocalConfigState] = useState<Config | null>(config);

  useEffect(() => {
    if (config) {
      setLocalConfigState(config);
    }
  }, [config]);

  const setLocalConfig = useCallback((updater: (current: Config | null) => Config | null) => {
    setLocalConfigState((current) => updater(current));
  }, []);

  return { localConfig, setLocalConfig };
}

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

export interface SaveFeedback {
  status: SaveStatus;
  message: string | null;
  savedAt: string | null;
}

function isConfigDirty(saved: Config | null, draft: Config | null): boolean {
  if (!saved || !draft) {
    return false;
  }

  return JSON.stringify(saved) !== JSON.stringify(draft);
}

function createIdleFeedback(): SaveFeedback {
  return { status: 'idle', message: null, savedAt: null };
}

export function useSettingsEditor(options: UseSettingsEditorOptions) {
  const { config, updateConfig, onClose } = options;
  const { localConfig, setLocalConfig } = useLocalSettingsDraft(config);

  const [saveFeedback, setSaveFeedback] = useState<SaveFeedback>(createIdleFeedback);
  const hasUnsavedChanges = useMemo(() => isConfigDirty(config, localConfig), [config, localConfig]);

  const markEdited = useCallback(() => {
    setSaveFeedback((current) => (current.status === 'idle' ? current : createIdleFeedback()));
  }, []);

  const updateEngine = useCallback((engineId: EngineId) => {
    markEdited();
    setLocalConfig((current) => (current ? { ...current, defaultEngine: engineId } : current));
  }, [markEdited, setLocalConfig]);

  const updateClaudePath = useCallback((path: string) => {
    markEdited();
    setLocalConfig((current) => (current ? { ...current, claudeCode: { ...current.claudeCode, cliPath: path } } : current));
  }, [markEdited, setLocalConfig]);

  const updateIFlowPath = useCallback((path: string) => {
    markEdited();
    setLocalConfig((current) => (current ? { ...current, iflow: { ...current.iflow, cliPath: path } } : current));
  }, [markEdited, setLocalConfig]);

  const updateCodexPath = useCallback((path: string) => {
    markEdited();
    setLocalConfig((current) => (current ? { ...current, codexCli: { ...current.codexCli, cliPath: path } } : current));
  }, [markEdited, setLocalConfig]);

  const updateGeminiPath = useCallback((path: string) => {
    markEdited();
    setLocalConfig((current) => (current ? { ...current, gemini: { ...current.gemini, cliPath: path } } : current));
  }, [markEdited, setLocalConfig]);

  const updateFloating = useCallback(<K extends keyof Config['floatingWindow']>(key: K, value: Config['floatingWindow'][K]) => {
    markEdited();
    setLocalConfig((current) => (current ? { ...current, floatingWindow: { ...current.floatingWindow, [key]: value } } : current));
  }, [markEdited, setLocalConfig]);

  const updateEngineParam = useCallback((engineId: EngineId, key: string, value: string) => {
    markEdited();
    setLocalConfig((current) => {
      if (!current) return current;
      const engineKey = engineId === 'claude-code' ? 'claudeCode' : engineId === 'codex-cli' ? 'codexCli' : engineId;
      return {
        ...current,
        [engineKey]: { ...(current as any)[engineKey], [key]: value || undefined },
      };
    });
  }, [markEdited, setLocalConfig]);

  const handleSave = useCallback(async () => {
    if (!localConfig) {
      return;
    }

    setSaveFeedback({ status: 'saving', message: '正在保存...', savedAt: null });

    try {
      await updateConfig(localConfig);
      setSaveFeedback({ status: 'success', message: '已保存并生效', savedAt: new Date().toISOString() });
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存配置失败';
      setSaveFeedback({ status: 'error', message, savedAt: null });
    }
  }, [localConfig, updateConfig]);

  const requestClose = useCallback(() => {
    onClose();
  }, [onClose]);

  return {
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
  };
}

