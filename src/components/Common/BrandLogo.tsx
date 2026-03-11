import { BRAND_ICON_SRC, BRAND_NAME } from '../../constants/brand';

interface BrandLogoProps {
  size?: number;
  showName?: boolean;
  nameClassName?: string;
  iconClassName?: string;
}

export function BrandLogo(props: BrandLogoProps) {
  const { size = 28, showName = true, nameClassName = 'text-sm font-semibold text-text-primary', iconClassName = '' } = props;

  return (
    <div className="flex items-center gap-3">
      <img
        src={BRAND_ICON_SRC}
        alt={BRAND_NAME}
        width={size}
        height={size}
        className={`rounded-xl object-cover shadow-soft ${iconClassName}`}
      />
      {showName && <span className={nameClassName}>{BRAND_NAME}</span>}
    </div>
  );
}

