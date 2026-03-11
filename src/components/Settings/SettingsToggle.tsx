interface SettingsToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}

export function SettingsToggle(props: SettingsToggleProps) {
  const { label, description, checked, onToggle } = props;

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background-surface px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm text-text-primary">{label}</div>
        <div className="text-xs text-text-secondary mt-1">{description}</div>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-border'}`}
      >
        <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );
}
