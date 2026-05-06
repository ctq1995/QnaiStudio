import type { EngineId } from '../types';

const DEFAULT_ENGINE_ID: EngineId = 'claude-code';

export interface EngineCapabilityConfig {
  participatesInConnectionOverlay: boolean;
  supportsSessionRestore: boolean;
  supportsPathAutoDetect: boolean;
  supportsPathValidation: boolean;
  neutralPathValidationMessage?: string;
}

export const ENGINE_LABELS: Record<EngineId, string> = {
  'claude-code': 'Claude Code',
  'codex-cli': 'Codex CLI',
  iflow: 'IFlow',
  gemini: 'Gemini CLI',
  'custom-cli': 'Custom CLI',
};

export const ENGINE_VERSION_PREFIX_MAP: Record<EngineId, readonly string[]> = {
  'claude-code': ['Claude Code', 'Claude'],
  'codex-cli': ['Codex CLI', 'Codex'],
  iflow: ['IFlow'],
  gemini: ['Gemini CLI', 'Gemini'],
  'custom-cli': ['Custom CLI', 'custom-cli'],
};

export const ENGINE_CAPABILITIES: Record<EngineId, EngineCapabilityConfig> = {
  'claude-code': {
    participatesInConnectionOverlay: true,
    supportsSessionRestore: true,
    supportsPathAutoDetect: true,
    supportsPathValidation: true,
  },
  'codex-cli': {
    participatesInConnectionOverlay: true,
    supportsSessionRestore: true,
    supportsPathAutoDetect: true,
    supportsPathValidation: true,
  },
  iflow: {
    participatesInConnectionOverlay: true,
    supportsSessionRestore: true,
    supportsPathAutoDetect: true,
    supportsPathValidation: true,
  },
  gemini: {
    participatesInConnectionOverlay: true,
    supportsSessionRestore: true,
    supportsPathAutoDetect: true,
    supportsPathValidation: true,
  },
  'custom-cli': {
    participatesInConnectionOverlay: false,
    supportsSessionRestore: false,
    supportsPathAutoDetect: false,
    supportsPathValidation: false,
    neutralPathValidationMessage: '内置 Agent 不提供本地路径配置与校验。',
  },
};

export function getEngineCapabilities(engineId?: EngineId): EngineCapabilityConfig {
  const resolvedEngineId = engineId ?? DEFAULT_ENGINE_ID;
  return ENGINE_CAPABILITIES[resolvedEngineId] ?? ENGINE_CAPABILITIES[DEFAULT_ENGINE_ID];
}

export function getEngineLabel(engineId?: EngineId): string {
  if (!engineId) {
    return ENGINE_LABELS[DEFAULT_ENGINE_ID];
  }
  return ENGINE_LABELS[engineId] ?? engineId;
}

interface FormatEngineVersionLabelOptions {
  engineId: EngineId;
  engineLabel: string;
  version: string;
  prefixMap?: Record<EngineId, readonly string[]>;
}

export function formatEngineVersionLabel(options: FormatEngineVersionLabelOptions): string {
  const { engineId, engineLabel, version, prefixMap = ENGINE_VERSION_PREFIX_MAP } = options;
  if (!version) {
    return '';
  }

  const normalized = version.trim();
  const candidates = [engineLabel, engineId, ...(prefixMap[engineId] ?? [])].filter(Boolean);

  for (const candidate of candidates) {
    const candidateLower = candidate.toLowerCase();
    const valueLower = normalized.toLowerCase();
    if (valueLower.startsWith(candidateLower)) {
      const stripped = normalized.slice(candidate.length).trim().replace(/^[\s:-]+/, '');
      return stripped || normalized;
    }
  }

  return normalized;
}
