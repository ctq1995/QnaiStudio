import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Config, EngineId, ModelProviderConfig, ProviderKind, ClaudeAdvancedParams, CodexAdvancedParams, GeminiAdvancedParams } from '../../types';

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

export interface ProviderDraft {
  name: string;
  kind: ProviderKind;
  baseUrl: string;
  apiKey: string;
}

function createProviderDraft(): ProviderDraft {
  return {
    name: '',
    kind: 'openai-compatible',
    baseUrl: '',
    apiKey: '',
  };
}

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
  const [providerDraft, setProviderDraft] = useState<ProviderDraft | null>(null);
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

  /** Update Claude Code advanced parameters */
  const updateClaudeAdvanced = useCallback(<K extends keyof ClaudeAdvancedParams>(key: K, value: ClaudeAdvancedParams[K]) => {
    markEdited();
    setLocalConfig((current) => {
      if (!current) return current;
      const adv = current.claudeCode.advanced ?? {};
      return {
        ...current,
        claudeCode: { ...current.claudeCode, advanced: { ...adv, [key]: value } },
      };
    });
  }, [markEdited, setLocalConfig]);

  /** Update Codex CLI advanced parameters */
  const updateCodexAdvanced = useCallback(<K extends keyof CodexAdvancedParams>(key: K, value: CodexAdvancedParams[K]) => {
    markEdited();
    setLocalConfig((current) => {
      if (!current) return current;
      const adv = current.codexCli.advanced ?? {};
      return {
        ...current,
        codexCli: { ...current.codexCli, advanced: { ...adv, [key]: value } },
      };
    });
  }, [markEdited, setLocalConfig]);

  /** Update Gemini CLI advanced parameters */
  const updateGeminiAdvanced = useCallback(<K extends keyof GeminiAdvancedParams>(key: K, value: GeminiAdvancedParams[K]) => {
    markEdited();
    setLocalConfig((current) => {
      if (!current) return current;
      const adv = current.gemini.advanced ?? {};
      return {
        ...current,
        gemini: { ...current.gemini, advanced: { ...adv, [key]: value } },
      };
    });
  }, [markEdited, setLocalConfig]);

  const startProviderDraft = useCallback(() => {
    setProviderDraft((current) => current ?? createProviderDraft());
  }, []);

  const updateProviderDraft = useCallback(<K extends keyof ProviderDraft>(key: K, value: ProviderDraft[K]) => {
    setProviderDraft((current) => (current ? { ...current, [key]: value } : current));
  }, []);

  const cancelProviderDraft = useCallback(() => {
    setProviderDraft(null);
  }, []);

  const submitProviderDraft = useCallback(() => {
    if (!providerDraft?.name.trim()) {
      return;
    }

    markEdited();
    setLocalConfig((current) => {
      if (!current) return current;
      const nextProvider: ModelProviderConfig = {
        id: `provider-${Date.now()}`,
        name: providerDraft.name.trim(),
        kind: providerDraft.kind,
        baseUrl: providerDraft.baseUrl.trim(),
        apiKey: providerDraft.apiKey.trim(),
      };
      return {
        ...current,
        providers: [...(current.providers ?? []), nextProvider],
      };
    });
    setProviderDraft(null);
  }, [markEdited, providerDraft, setLocalConfig]);

  const updateProvider = useCallback(<K extends keyof ModelProviderConfig>(providerId: string, key: K, value: ModelProviderConfig[K]) => {
    markEdited();
    setLocalConfig((current) => {
      if (!current) return current;
      return {
        ...current,
        providers: (current.providers ?? []).map((provider) =>
          provider.id === providerId ? { ...provider, [key]: value } : provider,
        ),
      };
    });
  }, [markEdited, setLocalConfig]);

  const removeProvider = useCallback((providerId: string) => {
    markEdited();
    setLocalConfig((current) => {
      if (!current) return current;
      return {
        ...current,
        providers: (current.providers ?? []).filter((provider) => provider.id !== providerId),
        claudeCode: current.claudeCode.providerId === providerId ? { ...current.claudeCode, providerId: undefined } : current.claudeCode,
        codexCli: current.codexCli.providerId === providerId ? { ...current.codexCli, providerId: undefined } : current.codexCli,
        gemini: current.gemini.providerId === providerId ? { ...current.gemini, providerId: undefined } : current.gemini,
        iflow: current.iflow.providerId === providerId ? { ...current.iflow, providerId: undefined } : current.iflow,
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
    updateClaudeAdvanced,
    updateCodexAdvanced,
    updateGeminiAdvanced,
    providerDraft,
    startProviderDraft,
    updateProviderDraft,
    cancelProviderDraft,
    submitProviderDraft,
    updateProvider,
    removeProvider,
    handleSave,
    requestClose,
  };
}

