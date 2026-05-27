import { useEffect, useMemo, useState } from 'react';
import * as tauri from '../../services/tauri';
import { getEngineCapabilities } from '../../utils/engineLabels';

type EngineType = 'claude-code' | 'iflow' | 'codex-cli' | 'gemini' | 'custom-cli';
type InputMode = 'auto' | 'manual';

interface ClaudePathSelectorProps {
  value: string;
  onChange: (path: string) => void;
  engineType?: EngineType;
  disabled?: boolean;
  compact?: boolean;
  error?: string;
  placeholder?: string;
}

const ENGINE_CONFIG: Record<EngineType, { name: string; placeholder: string; example: string }> = {
  'claude-code': {
    name: 'Claude Code',
    placeholder: '请输入 Claude CLI 的完整路径',
    example: '例如：C:\\Users\\用户名\\AppData\\Roaming\\npm\\claude.cmd',
  },
  'codex-cli': {
    name: 'Codex CLI',
    placeholder: '请输入 Codex CLI 的完整路径',
    example: '例如：C:\\Users\\用户名\\AppData\\Roaming\\npm\\codex.cmd',
  },
  iflow: {
    name: 'IFlow',
    placeholder: '请输入 IFlow CLI 的完整路径',
    example: '例如：C:\\Users\\用户名\\AppData\\Roaming\\npm\\iflow.cmd',
  },
  gemini: {
    name: 'Gemini CLI',
    placeholder: '请输入 Gemini CLI 的完整路径',
    example: '例如：C:\\Users\\用户名\\AppData\\Roaming\\npm\\gemini.cmd',
  },
  'custom-cli': {
    name: '内置 Agent',
    placeholder: '内置 Agent 无需配置本地 CLI 路径',
    example: '内置 Agent 由应用内置提供，无需手动填写本地命令路径。',
  },
};

async function detectPaths(engineType: EngineType): Promise<string[]> {
  switch (engineType) {
    case 'codex-cli':
      return tauri.findCodexPaths();
    case 'iflow':
      return tauri.findIFlowPaths();
    case 'gemini':
      return tauri.findGeminiPaths();
    case 'custom-cli':
      return Promise.resolve([]);
    case 'claude-code':
    default:
      return tauri.findClaudePaths();
  }
}

async function validatePath(engineType: EngineType, path: string) {
  switch (engineType) {
    case 'codex-cli':
      return tauri.validateCodexPath(path);
    case 'iflow':
      return tauri.validateIFlowPath(path);
    case 'gemini':
      return tauri.validateGeminiPath(path);
    case 'custom-cli':
      return Promise.resolve({ valid: null, error: null, version: null });
    case 'claude-code':
    default:
      return tauri.validateClaudePath(path);
  }
}

export function ClaudePathSelector({
  value,
  onChange,
  engineType = 'claude-code',
  disabled = false,
  compact = false,
  error,
  placeholder,
}: ClaudePathSelectorProps) {
  const config = ENGINE_CONFIG[engineType];
  const capabilities = getEngineCapabilities(engineType);
  const [mode, setMode] = useState<InputMode>('manual');
  const [detectedPaths, setDetectedPaths] = useState<string[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const helperText = useMemo(() => {
    if (capabilities.neutralPathValidationMessage) {
      return capabilities.neutralPathValidationMessage;
    }
    return config.example;
  }, [capabilities.neutralPathValidationMessage, config.example]);

  const handleDetectPaths = async () => {
    if (!capabilities.supportsPathAutoDetect) {
      setDetectedPaths([]);
      return;
    }

    setDetecting(true);

    try {
      const paths = await detectPaths(engineType);
      setDetectedPaths(paths);

      if (paths.length > 0 && !value) {
        onChange(paths[0]);
      }
    } catch (detectError) {
      console.error(`检测 ${config.name} 路径失败:`, detectError);
      setDetectedPaths([]);
    } finally {
      setDetecting(false);
    }
  };

  const handleValidatePath = async (path: string) => {
    if (!path.trim()) {
      setIsValid(null);
      setValidationError(null);
      return;
    }

    if (!capabilities.supportsPathValidation) {
      setIsValid(null);
      setValidationError(null);
      return;
    }

    setValidating(true);

    try {
      const result = await validatePath(engineType, path);
      setIsValid(result.valid);
      setValidationError(result.error || null);
    } catch (validateError) {
      setIsValid(false);
      setValidationError(validateError instanceof Error ? validateError.message : '校验失败');
    } finally {
      setValidating(false);
    }
  };

  useEffect(() => {
    if (!capabilities.supportsPathAutoDetect && mode === 'auto') {
      setMode('manual');
      return;
    }

    if (mode === 'auto') {
      void handleDetectPaths();
    }
  }, [capabilities.supportsPathAutoDetect, engineType, mode]);

  return (
    <div className="space-y-3">
      {capabilities.supportsPathAutoDetect && (
        <div className="inline-flex rounded-xl border border-border bg-background p-1">
          <button
            type="button"
            onClick={() => setMode('manual')}
            disabled={disabled}
            className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${
              mode === 'manual' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'
            } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            手动输入
          </button>
          <button
            type="button"
            onClick={() => setMode('auto')}
            disabled={disabled}
            className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${
              mode === 'auto' ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary'
            } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            自动检测
          </button>
        </div>
      )}

      {mode === 'auto' && (
        <div className="space-y-2">
          <div className="flex items-stretch gap-2">
            <select
              value={value}
              onChange={(event) => onChange(event.target.value)}
              disabled={disabled || detecting || detectedPaths.length === 0}
              className={`min-w-0 flex-1 rounded-xl border bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary ${
                error ? 'border-danger' : 'border-border'
              } ${disabled || detecting ? 'opacity-50' : ''}`}
            >
              <option value="">请选择 {config.name} CLI 路径</option>
              {detectedPaths.map((path) => (
                <option key={path} value={path}>
                  {path}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => void handleDetectPaths()}
              disabled={disabled || detecting}
              className="rounded-xl border border-border bg-background px-3 text-text-secondary transition-colors hover:text-text-primary disabled:opacity-50"
              title="重新检测"
            >
              <svg className={`h-4 w-4 ${detecting ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

          {!detecting && detectedPaths.length === 0 && (
            <p className="text-xs leading-5 text-text-tertiary">未检测到 {config.name}，请确认已安装或改用手动输入。</p>
          )}

          {detectedPaths.length > 0 && (
            <p className="text-xs text-text-tertiary">共检测到 {detectedPaths.length} 个可用路径。</p>
          )}
        </div>
      )}

      {mode === 'manual' && (
        <div className="space-y-2">
          <div className="relative">
            <input
              type="text"
              value={value}
              onChange={(event) => {
                onChange(event.target.value);
                void handleValidatePath(event.target.value);
              }}
              disabled={disabled || validating}
              className={`w-full rounded-xl border bg-background px-3 py-2 pr-10 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary ${
                error ? 'border-danger' : 'border-border'
              } ${disabled || validating ? 'opacity-50' : ''}`}
              placeholder={placeholder || config.placeholder}
            />

            {value && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {validating ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                ) : isValid === true ? (
                  <svg className="h-5 w-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : isValid === false ? (
                  <svg className="h-5 w-5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : null}
              </div>
            )}
          </div>

          {validationError && <p className="text-xs text-danger">{validationError}</p>}
          {capabilities.supportsPathValidation && isValid === true && !compact && <p className="text-xs text-success">路径有效，可以正常使用。</p>}
          {!compact && <p className="text-xs text-text-tertiary">{helperText}</p>}
        </div>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
