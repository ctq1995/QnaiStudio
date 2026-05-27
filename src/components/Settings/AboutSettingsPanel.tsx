import { Copy, ExternalLink, Github, Info, Package, Sparkles, type LucideIcon } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  BRAND_GITHUB_URL,
  BRAND_IDENTIFIER,
  BRAND_NAME,
  BRAND_PACKAGE_NAME,
  BRAND_TAGLINE,
} from '../../constants/brand';
import packageJson from '../../../package.json';
import { Button } from '../ui/button';

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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border-default bg-background-surface px-4 py-3">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="text-sm text-text-primary">{value}</span>
    </div>
  );
}

export function AboutSettingsPanel() {
  const [copied, setCopied] = useState(false);
  const appVersion = `v${packageJson.version}`;

  const handleOpenGithub = () => {
    window.open(BRAND_GITHUB_URL, '_blank', 'noopener,noreferrer');
  };

  const handleCopyVersion = async () => {
    try {
      await navigator.clipboard.writeText(appVersion);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-4">
      <SettingsSection icon={Info} title="应用">
        <div className="rounded-lg border border-border-default bg-background-surface px-4 py-4">
          <p className="text-sm font-semibold text-text-primary">{BRAND_NAME}</p>
          <p className="mt-1 text-xs leading-5 text-text-muted">{BRAND_TAGLINE}</p>
        </div>
        <div className="space-y-2">
          <InfoRow label="软件版本" value={appVersion} />
          <InfoRow label="应用标识" value={BRAND_IDENTIFIER} />
          <InfoRow label="包名称" value={BRAND_PACKAGE_NAME} />
          <InfoRow label="GitHub" value="ctq1995/QnaiStudio" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={handleOpenGithub}>
            <Github className="mr-2 h-4 w-4" />
            打开 GitHub
            <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" onClick={handleCopyVersion}>
            <Copy className="mr-2 h-4 w-4" />
            {copied ? '已复制版本号' : '复制版本号'}
          </Button>
        </div>
      </SettingsSection>

      <SettingsSection icon={Package} title="项目信息">
        <div className="rounded-lg border border-border-default bg-background-surface px-4 py-3 text-sm text-text-muted">
          <p>项目仓库：</p>
          <a
            href={BRAND_GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex text-xs text-primary underline underline-offset-2 hover:text-primary-hover"
          >
            {BRAND_GITHUB_URL}
          </a>
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
