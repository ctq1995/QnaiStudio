import { useMemo, useState } from 'react';
import { useConfigStore } from '../../stores';
import { Button, ClaudePathSelector } from './index';
import { getEngineAvailability, getEngineVersion } from '../../types';
import type { EngineId } from '../../types';

const ENGINE_META: Record<
  EngineId,
  { label: string; cliName: string; versionCmd: string; findCmdWin: string; findCmdUnix: string; installHint: string }
> = {
  'claude-code': {
    label: 'Claude Code',
    cliName: 'Claude CLI',
    versionCmd: 'claude --version',
    findCmdWin: 'where claude',
    findCmdUnix: 'which claude',
    installHint: 'npm install -g @anthropic-ai/claude-code',
  },
  'codex-cli': {
    label: 'Codex CLI',
    cliName: 'Codex CLI',
    versionCmd: 'codex --version',
    findCmdWin: 'where codex',
    findCmdUnix: 'which codex',
    installHint: 'npm install -g @openai/codex',
  },
  iflow: {
    label: 'IFlow',
    cliName: 'IFlow CLI',
    versionCmd: 'iflow --version',
    findCmdWin: 'where iflow',
    findCmdUnix: 'which iflow',
    installHint: 'pip install iflow-cli',
  },
  gemini: {
    label: 'Gemini CLI',
    cliName: 'Gemini CLI',
    versionCmd: 'gemini --version',
    findCmdWin: 'where gemini',
    findCmdUnix: 'which gemini',
    installHint: 'npm install -g @google/gemini-cli',
  },
  'custom-cli': {
    label: 'Custom CLI',
    cliName: 'Custom CLI',
    versionCmd: 'custom-cli --version',
    findCmdWin: 'where custom-cli',
    findCmdUnix: 'which custom-cli',
    installHint: '请填写你的自定义 CLI 可执行文件路径',
  },
};

function getCurrentCliPath(engineId: EngineId, config: ReturnType<typeof useConfigStore.getState>['config']) {
  switch (engineId) {
    case 'iflow':
      return config?.iflow?.cliPath ?? '';
    case 'codex-cli':
      return config?.codexCli?.cliPath ?? '';
    case 'gemini':
      return config?.gemini?.cliPath ?? '';
    case 'custom-cli':
      return config?.customCli?.cliPath ?? '';
    case 'claude-code':
    default:
      return config?.claudeCode?.cliPath ?? '';
  }
}

export function ConnectingOverlay() {
  const { config, healthStatus, connectionState, error, retryConnection } = useConfigStore();
  const [showPathInput, setShowPathInput] = useState(false);
  const currentEngine: EngineId = config?.defaultEngine ?? 'claude-code';
  const meta = ENGINE_META[currentEngine];

  const currentCliPath = useMemo(() => getCurrentCliPath(currentEngine, config), [config, currentEngine]);
  const [tempPath, setTempPath] = useState(currentCliPath);
  const detectedVersion = healthStatus ? getEngineVersion(healthStatus, currentEngine) : null;
  const isAvailable = healthStatus ? getEngineAvailability(healthStatus, currentEngine) : false;
  const isConnecting = connectionState === 'connecting';
  const isFailed = connectionState === 'failed';

  const handleRetry = async () => {
    await retryConnection();
  };

  const handlePathSubmit = async () => {
    if (!tempPath.trim()) {
      return;
    }

    await retryConnection(tempPath.trim());
    setShowPathInput(false);
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-background-base/95 px-4">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-background-elevated p-6 shadow-soft">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-background-surface">
            {isConnecting ? (
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-border-subtle border-t-primary" />
            ) : (
              <svg className="h-8 w-8 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            )}
          </div>

          <h2 className="text-lg font-semibold text-text-primary">
            {isConnecting ? `正在连接 ${meta.label}` : '连接失败'}
          </h2>
          <p className="mt-2 text-sm text-text-secondary">
            {isConnecting ? '正在检查本地 CLI 环境，请稍候。' : `无法连接到 ${meta.cliName}`}
          </p>

          {isAvailable && detectedVersion ? (
            <p className="mt-3 text-xs text-text-tertiary">已检测到版本：{detectedVersion}</p>
          ) : isFailed ? (
            <div className="mt-5 w-full space-y-3 text-left text-xs text-text-tertiary">
              <div className="rounded-2xl border border-danger/20 bg-danger-faint px-4 py-3 text-danger">
                {error || `${meta.cliName} 未找到`}
              </div>

              {currentCliPath && (
                <div className="rounded-2xl border border-border bg-background-surface px-4 py-3">
                  <div className="text-[11px] uppercase tracking-wide text-text-tertiary">当前路径</div>
                  <code className="mt-2 block break-all text-text-primary">{currentCliPath}</code>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-background-surface px-4 py-3">
                  <div className="font-medium text-text-primary">排查命令</div>
                  <div className="mt-2 space-y-1">
                    <div><code>{meta.versionCmd}</code></div>
                    <div><code>{meta.findCmdWin}</code></div>
                    <div><code>{meta.findCmdUnix}</code></div>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-background-surface px-4 py-3">
                  <div className="font-medium text-text-primary">安装建议</div>
                  <div className="mt-2 break-all"><code>{meta.installHint}</code></div>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-text-tertiary">正在检测 {meta.cliName}...</p>
          )}

          {isFailed && (
            <div className="mt-5 w-full space-y-3">
              {!showPathInput ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button onClick={handleRetry} variant="primary" className="w-full">
                    重新检测
                  </Button>
                  <Button onClick={() => setShowPathInput(true)} variant="ghost" className="w-full">
                    设置路径
                  </Button>
                </div>
              ) : (
                <div className="rounded-2xl border border-border bg-background-surface p-4 text-left">
                  <p className="mb-3 text-sm text-text-secondary">选择或输入 {meta.cliName} 的本地路径</p>
                  <ClaudePathSelector value={tempPath} onChange={setTempPath} engineType={currentEngine} compact />
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <Button onClick={handlePathSubmit} variant="primary" className="w-full" disabled={!tempPath.trim()}>
                      保存并重试
                    </Button>
                    <Button
                      onClick={() => {
                        setShowPathInput(false);
                        setTempPath(currentCliPath);
                      }}
                      variant="ghost"
                      className="w-full"
                    >
                      取消
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
