import { createPortal } from 'react-dom';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: 'primary' | 'danger';
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  zIndexClassName?: string;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  tone = 'primary',
  onConfirm,
  onCancel,
  zIndexClassName = 'z-[3100]',
}: ConfirmDialogProps) {
  if (!open) return null;

  const confirmButtonClassName =
    tone === 'danger'
      ? 'rounded-lg bg-danger px-3 py-1.5 text-sm text-white hover:bg-danger-hover'
      : 'rounded-lg bg-primary px-3 py-1.5 text-sm text-white hover:bg-primary-hover';

  return createPortal(
    <>
      <div className={`fixed inset-0 ${zIndexClassName} bg-black/60`} onClick={onCancel} />
      <div className={`fixed left-1/2 top-1/2 ${zIndexClassName} w-[420px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background-elevated p-5 shadow-xl`}>
        <div className="text-base font-semibold text-text-primary">{title}</div>
        <div className="mt-2 whitespace-pre-wrap text-sm leading-6 text-text-secondary">{message}</div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-sm text-text-secondary hover:bg-background-hover hover:text-text-primary"
          >
            {cancelText}
          </button>
          <button onClick={() => void onConfirm()} className={confirmButtonClassName}>
            {confirmText}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
