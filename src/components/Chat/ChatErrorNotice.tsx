import { XCircle, X } from 'lucide-react';

interface ChatErrorNoticeProps {
  error: string;
  onClose: () => void;
}

export function ChatErrorNotice({ error, onClose }: ChatErrorNoticeProps) {
  return (
    <div className="mx-4 my-3 rounded-2xl border border-danger/30 bg-danger-faint px-4 py-3 text-sm text-danger shadow-sm">
      <div className="flex items-start gap-3">
        <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-medium">工具执行失败</div>
          <div className="mt-1 whitespace-pre-wrap break-words text-danger/90">{error}</div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-danger/70 transition-colors hover:bg-danger/10 hover:text-danger"
          aria-label="关闭错误提示"
          title="关闭"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
