import type { Config, FloatingWindowMode } from '../../types';
import { FLOATING_MODE_OPTIONS } from './settingsOptions';
import { SettingsCardOption } from './SettingsCardOption';
import { SettingsToggle } from './SettingsToggle';

interface FloatingWindowSettingsPanelProps {
  config: Config;
  onEnabledChange: (enabled: boolean) => void;
  onModeChange: (mode: FloatingWindowMode) => void;
  onExpandOnHoverChange: (expandOnHover: boolean) => void;
  onCollapseDelayChange: (collapseDelay: number) => void;
}

function DotIndicator({ selected }: { selected: boolean }) {
  return (
    <div className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${selected ? 'border-primary' : 'border-border'}`}>
      {selected && <div className="h-2 w-2 rounded-full bg-primary" />}
    </div>
  );
}

export function FloatingWindowSettingsPanel(props: FloatingWindowSettingsPanelProps) {
  const { config, onEnabledChange, onModeChange, onExpandOnHoverChange, onCollapseDelayChange } = props;
  const { floatingWindow } = config;

  return (
    <div className="space-y-4">
      <SettingsToggle
        label="启用悬浮窗"
        description="鼠标移出主窗口时显示精简悬浮窗。"
        checked={floatingWindow.enabled}
        onToggle={() => onEnabledChange(!floatingWindow.enabled)}
      />

      {floatingWindow.enabled && (
        <section className="space-y-4 rounded-2xl border border-border bg-background-surface p-4">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">悬浮窗模式</h3>
            <p className="mt-1 text-xs leading-5 text-text-secondary">决定主窗口与悬浮窗之间的切换方式。</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {FLOATING_MODE_OPTIONS.map((option) => (
              <SettingsCardOption
                key={option.id}
                title={option.name}
                description={option.description}
                selected={floatingWindow.mode === option.id}
                onClick={() => onModeChange(option.id)}
                indicator={<DotIndicator selected={floatingWindow.mode === option.id} />}
              />
            ))}
          </div>

          <SettingsToggle
            label="悬浮窗悬停时展开"
            description="鼠标移入悬浮窗后自动展开主窗口。"
            checked={floatingWindow.expandOnHover}
            onToggle={() => onExpandOnHoverChange(!floatingWindow.expandOnHover)}
          />

          {floatingWindow.mode === 'auto' && (
            <div className="rounded-2xl border border-border bg-background px-4 py-3">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-text-primary">切换延迟</div>
                  <div className="mt-1 text-xs leading-5 text-text-secondary">
                    鼠标移出主窗口后，延迟多久切换到悬浮窗。
                  </div>
                </div>
                <div className="text-sm font-semibold text-primary">{floatingWindow.collapseDelay} ms</div>
              </div>

              <input
                type="range"
                min="100"
                max="3000"
                step="100"
                value={floatingWindow.collapseDelay}
                onChange={(event) => onCollapseDelayChange(Number(event.target.value))}
                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-border-subtle accent-primary"
              />

              <div className="mt-2 flex justify-between text-xs text-text-tertiary">
                <span>100ms</span>
                <span>3000ms</span>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
