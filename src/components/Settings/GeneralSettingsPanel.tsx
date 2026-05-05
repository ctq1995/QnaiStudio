import { LayoutTemplate, MousePointerSquareDashed, TimerReset, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import type { Config, FloatingWindowMode } from '../../types';
import { FLOATING_MODE_OPTIONS } from './settingsOptions';

interface GeneralSettingsPanelProps {
  config: Config;
  savedConfig: Config;
  onEnabledChange: (enabled: boolean) => void;
  onModeChange: (mode: FloatingWindowMode) => void;
  onExpandOnHoverChange: (expandOnHover: boolean) => void;
  onCollapseDelayChange: (collapseDelay: number) => void;
}

function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border-default bg-background-elevated p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-text-muted" />
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
      </div>
      {description && (
        <p className="text-xs text-text-muted leading-5">{description}</p>
      )}
      {children}
    </section>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  dirty,
  onToggle,
}: {
  label: string;
  description: string;
  checked: boolean;
  dirty: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">{label}</span>
          {dirty && <Badge variant="warning">未保存</Badge>}
        </div>
        <p className="mt-0.5 text-xs text-text-muted">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onToggle} />
    </div>
  );
}

function ModeCard({
  name,
  description,
  selected,
  onClick,
}: {
  name: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
        selected
          ? 'border-primary bg-primary-faint text-text-primary'
          : 'border-border-default bg-background-elevated text-text-tertiary hover:border-primary/40 hover:text-text-primary'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
          selected ? 'border-primary' : 'border-border-default'
        }`}>
          {selected && <div className="h-2 w-2 rounded-full bg-primary" />}
        </div>
        <div>
          <div className="text-sm font-semibold">{name}</div>
          <div className="mt-0.5 text-xs text-text-muted">{description}</div>
        </div>
      </div>
    </button>
  );
}

export function GeneralSettingsPanel(props: GeneralSettingsPanelProps) {
  const {
    config,
    savedConfig,
    onEnabledChange,
    onModeChange,
    onExpandOnHoverChange,
    onCollapseDelayChange,
  } = props;

  const { floatingWindow } = config;
  const saved = savedConfig.floatingWindow;
  const enabledDirty = saved.enabled !== floatingWindow.enabled;
  const modeDirty = saved.mode !== floatingWindow.mode;
  const expandDirty = saved.expandOnHover !== floatingWindow.expandOnHover;
  const delayDirty = saved.collapseDelay !== floatingWindow.collapseDelay;

  return (
    <div className="space-y-4">
      <SettingsSection
        icon={LayoutTemplate}
        title="悬浮窗"
        description="控制悬浮窗显示。"
      >
        <ToggleRow
          label="启用"
          description="离开主窗口时显示。"
          checked={floatingWindow.enabled}
          dirty={enabledDirty}
          onToggle={() => onEnabledChange(!floatingWindow.enabled)}
        />
      </SettingsSection>

      {floatingWindow.enabled && (
        <>
          <SettingsSection
            icon={MousePointerSquareDashed}
            title="模式"
            description="设置切换方式。"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="text-sm font-medium text-text-primary">选择</span>
              {modeDirty && <Badge variant="warning">未保存</Badge>}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {FLOATING_MODE_OPTIONS.map((option) => (
                <ModeCard
                  key={option.id}
                  name={option.name}
                  description={option.description}
                  selected={floatingWindow.mode === option.id}
                  onClick={() => onModeChange(option.id)}
                />
              ))}
            </div>
          </SettingsSection>

          <SettingsSection
            icon={MousePointerSquareDashed}
            title="悬停"
            description="控制悬停展开。"
          >
            <ToggleRow
              label="悬停展开"
              description="鼠标移入时展开。"
              checked={floatingWindow.expandOnHover}
              dirty={expandDirty}
              onToggle={() => onExpandOnHoverChange(!floatingWindow.expandOnHover)}
            />
          </SettingsSection>

          {floatingWindow.mode === 'auto' && (
            <SettingsSection
              icon={TimerReset}
              title="延迟"
              description="设置切换延迟。"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">切换延迟</span>
                      {delayDirty && <Badge variant="warning">未保存</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-text-muted">
                      离开主窗口后再切换。
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-text-primary">{floatingWindow.collapseDelay} ms</span>
                </div>
                <input
                  type="range"
                  min="100"
                  max="3000"
                  step="100"
                  value={floatingWindow.collapseDelay}
                  onChange={(e) => onCollapseDelayChange(Number(e.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-background-active accent-primary"
                />
                <div className="flex justify-between text-xs text-text-muted">
                  <span>100ms</span>
                  <span>3000ms</span>
                </div>
              </div>
            </SettingsSection>
          )}
        </>
      )}
    </div>
  );
}
