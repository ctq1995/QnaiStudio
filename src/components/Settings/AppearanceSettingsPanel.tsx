import { Moon, Palette, Sun, Monitor, type LucideIcon } from 'lucide-react';

type ThemeMode = 'dark' | 'light';

interface AppearanceSettingsPanelProps {
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
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
  children: React.ReactNode;
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

function ThemeCard({
  icon: Icon,
  label,
  description,
  selected,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
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
        <div className={`rounded-md border p-1.5 ${selected ? 'border-primary/30 text-primary' : 'border-border-default text-text-muted'}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-semibold">{label}</div>
          <div className="mt-0.5 text-xs text-text-muted">{description}</div>
        </div>
      </div>
    </button>
  );
}

export function AppearanceSettingsPanel({ theme, onThemeChange }: AppearanceSettingsPanelProps) {
  return (
    <div className="space-y-4">
      <SettingsSection
        icon={Palette}
        title="主题"
        description="选择主题。"
      >
        <div className="grid gap-3 md:grid-cols-2">
          <ThemeCard
            icon={Moon}
            label="深色"
            description="适合暗光环境，减少视觉疲劳"
            selected={theme === 'dark'}
            onClick={() => onThemeChange('dark')}
          />
          <ThemeCard
            icon={Sun}
            label="浅色"
            description="适合明亮环境，清晰易读"
            selected={theme === 'light'}
            onClick={() => onThemeChange('light')}
          />
        </div>
      </SettingsSection>

      <SettingsSection
        icon={Monitor}
        title="显示"
        description="其他外观相关设置。"
      >
        <div className="rounded-lg border border-dashed border-border-default bg-background-surface px-3 py-3 text-sm text-text-muted">
          更多外观选项将在后续版本中提供。
        </div>
      </SettingsSection>
    </div>
  );
}
