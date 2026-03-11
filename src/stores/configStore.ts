/**
 * 配置状态管理
 */

import { create } from 'zustand';
import type { Config, HealthStatus } from '../types';
import { getEngineAvailability } from '../types';
import { getEngineLabel } from '../utils/engineLabels';
import * as tauri from '../services/tauri';

interface ConfigState {
  config: Config | null;
  healthStatus: HealthStatus | null;
  loading: boolean;
  isConnecting: boolean;
  connectionState: 'connecting' | 'success' | 'failed';
  error: string | null;
  loadConfig: () => Promise<void>;
  updateConfig: (config: Config) => Promise<void>;
  setClaudeCmd: (cmd: string) => Promise<void>;
  setCodexCmd: (cmd: string) => Promise<void>;
  refreshHealth: () => Promise<void>;
  retryConnection: (cliPath?: string) => Promise<void>;
}

async function setCurrentEngineCliPath(engineId: Config['defaultEngine'] | undefined, cliPath: string) {
  switch (engineId) {
    case 'iflow':
      await tauri.setIFlowCmd(cliPath);
      return;
    case 'codex-cli':
      await tauri.setCodexCmd(cliPath);
      return;
    case 'claude-code':
    default:
      await tauri.setClaudeCmd(cliPath);
  }
}

async function fetchConfigAndHealth() {
  const [config, healthStatus] = await Promise.all([
    tauri.getConfig(),
    tauri.healthCheck(),
  ]);

  return { config, healthStatus };
}

function getConnectionState(config: Config | null, healthStatus: HealthStatus): 'success' | 'failed' {
  return getEngineAvailability(healthStatus, config?.defaultEngine ?? 'claude-code') ? 'success' : 'failed';
}

export const useConfigStore = create<ConfigState>((set) => ({
  config: null,
  healthStatus: null,
  loading: false,
  isConnecting: true,
  connectionState: 'connecting',
  error: null,

  loadConfig: async () => {
    set({ loading: true, isConnecting: true, error: null, connectionState: 'connecting' });

    try {
      const { config, healthStatus } = await fetchConfigAndHealth();
      set({
        config,
        healthStatus,
        loading: false,
        isConnecting: false,
        connectionState: getConnectionState(config, healthStatus),
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '加载配置失败',
        loading: false,
        isConnecting: false,
        connectionState: 'failed',
      });
    }
  },

  updateConfig: async (config) => {
    set({ loading: true, error: null });

    try {
      await tauri.updateConfig(config);
      set({ config, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '更新配置失败',
        loading: false,
      });
    }
  },

  setClaudeCmd: async (cmd) => {
    set({ loading: true, error: null });

    try {
      await tauri.setClaudeCmd(cmd);
      const config = await tauri.getConfig();
      set({ config, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '设置 Claude 命令失败',
        loading: false,
      });
    }
  },

  setCodexCmd: async (cmd) => {
    set({ loading: true, error: null });

    try {
      await tauri.setCodexCmd(cmd);
      const config = await tauri.getConfig();
      set({ config, loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '设置 Codex 命令失败',
        loading: false,
      });
    }
  },

  refreshHealth: async () => {
    try {
      const healthStatus = await tauri.healthCheck();
      const config = useConfigStore.getState().config;
      set({
        healthStatus,
        connectionState: getConnectionState(config, healthStatus),
      });
    } catch (error) {
      console.error('刷新健康状态失败:', error);
      set({ connectionState: 'failed' });
    }
  },

  retryConnection: async (cliPath?: string) => {
    set({ loading: true, error: null, connectionState: 'connecting' });

    try {
      if (cliPath) {
        const currentEngine = useConfigStore.getState().config?.defaultEngine;
        await setCurrentEngineCliPath(currentEngine, cliPath);
      }

      const { config, healthStatus } = await fetchConfigAndHealth();
      const connectionState = getConnectionState(config, healthStatus);

      if (connectionState === 'failed') {
        const engineLabel = getEngineLabel(config?.defaultEngine);
        set({
          config,
          healthStatus,
          loading: false,
          connectionState,
          error: `${engineLabel} CLI 未找到。当前路径: ${cliPath || '未设置'}`,
        });
        return;
      }

      set({
        config,
        healthStatus,
        loading: false,
        connectionState,
        error: null,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '连接失败',
        loading: false,
        connectionState: 'failed',
      });
    }
  },
}));

