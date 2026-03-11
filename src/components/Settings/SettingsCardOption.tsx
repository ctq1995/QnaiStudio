import type { ReactNode } from 'react';

interface SettingsCardOptionProps {
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  indicator?: ReactNode;
}

export function SettingsCardOption(props: SettingsCardOptionProps) {
  const { title, description, selected, onClick, indicator } = props;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border transition-all ${
        selected ? 'border-primary bg-primary/5' : 'border-border bg-background-surface hover:border-primary/30'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-text-primary">{title}</div>
          <div className="text-sm text-text-secondary mt-1">{description}</div>
        </div>
        {indicator}
      </div>
    </button>
  );
}
