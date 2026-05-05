import { Info, Sparkles, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { BRAND_NAME, BRAND_TAGLINE } from '../../constants/brand';

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

export function AboutSettingsPanel() {
  return (
    <div className="space-y-4">
      <SettingsSection icon={Info} title="应用">
        <div className="rounded-lg border border-border-default bg-background-surface px-4 py-4">
          <p className="text-sm font-semibold text-text-primary">{BRAND_NAME}</p>
          <p className="mt-1 text-xs leading-5 text-text-muted">{BRAND_TAGLINE}</p>
        </div>
      </SettingsSection>

      <SettingsSection icon={Sparkles} title="鸣谢">
        <div className="rounded-lg border border-border-default bg-background-surface px-4 py-3 text-sm text-text-muted">
          <p>基于 Polaris 开发，感谢原作者与社区贡献者。</p>
          <a
            href="https://github.com/misxzaiz/Polaris"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex text-xs text-primary underline underline-offset-2 hover:text-primary-hover"
          >
            https://github.com/misxzaiz/Polaris
          </a>
        </div>
      </SettingsSection>
    </div>
  );
}
