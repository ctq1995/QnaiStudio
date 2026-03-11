import { BRAND_NAME, BRAND_TAGLINE } from '../../constants/brand';

export function AboutSettingsPanel() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-background-surface p-5 shadow-soft">
        <h4 className="text-sm font-semibold text-text-primary">应用信息</h4>
        <p className="mt-2 text-sm text-text-secondary">{BRAND_NAME}</p>
        <p className="mt-1 text-xs text-text-tertiary">{BRAND_TAGLINE}</p>
      </div>

      <div className="rounded-2xl border border-border bg-background-surface p-5 shadow-soft">
        <h4 className="text-sm font-semibold text-text-primary">来源与鸣谢</h4>
        <p className="mt-2 text-sm text-text-secondary">
          本项目基于 Polaris 二次开发，向原作者与社区贡献者致谢。
        </p>
        <a
          href="https://github.com/misxzaiz/Polaris"
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex text-xs text-primary hover:text-primary-hover underline"
        >
          https://github.com/misxzaiz/Polaris
        </a>
      </div>
    </div>
  );
}
