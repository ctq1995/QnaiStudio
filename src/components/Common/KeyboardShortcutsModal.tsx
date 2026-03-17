/**
 * 快捷键帮助弹窗
 */
import { X } from 'lucide-react';

const SHORTCUT_GROUPS = [
  {
    title: '对话操作',
    shortcuts: [
      { keys: ['Ctrl', 'N'], label: '新建对话' },
      { keys: ['Ctrl', 'K'], label: '聚焦输入框' },
      { keys: ['Enter'], label: '发送消息' },
      { keys: ['Shift', 'Enter'], label: '插入换行' },
      { keys: ['Esc'], label: '中断流式输出' },
    ],
  },
  {
    title: '界面导航',
    shortcuts: [
      { keys: ['Ctrl', 'F'], label: '搜索对话内容' },
      { keys: ['Ctrl', 'Tab'], label: '切换 Tab 标签页' },
      { keys: ['?'], label: '显示此帮助弹窗' },
    ],
  },
  {
    title: '消息操作（悬停气泡时）',
    shortcuts: [
      { keys: ['悬停'], label: '显示复制 / 重新生成 / 删除按钮' },
    ],
  },
];

interface KeyboardShortcutsModalProps {
  onClose: () => void;
}

export function KeyboardShortcutsModal({ onClose }: KeyboardShortcutsModalProps) {
  return (
    <>
      <div className="fixed inset-0 z-[3000] bg-black/50" onClick={onClose} />
      <div className="pointer-events-none fixed inset-0 z-[3000] flex items-center justify-center p-4">
        <div
          className="pointer-events-auto w-full max-w-sm rounded-2xl border border-border bg-background-elevated shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="text-base font-semibold text-text-primary">键盘快捷键</h2>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-text-secondary transition-colors hover:bg-background-hover hover:text-text-primary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="px-4 py-3 space-y-4">
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.title}>
                <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide mb-2">{group.title}</p>
                <div className="space-y-1">
                  {group.shortcuts.map((s, i) => (
                    <div key={i} className="flex items-center justify-between py-1">
                      <span className="text-sm text-text-secondary">{s.label}</span>
                      <div className="flex items-center gap-1">
                        {s.keys.map((k, ki) => (
                          <kbd
                            key={ki}
                            className="px-2 py-0.5 text-xs font-mono rounded bg-background-surface border border-border text-text-primary"
                          >
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-border px-5 py-3 text-xs text-text-tertiary">
            Mac 用户使用 Cmd 替代 Ctrl · 按 <kbd className="px-1 py-0.5 font-mono rounded bg-background-surface border border-border">Esc</kbd> 关闭此弹窗
          </div>
        </div>
      </div>
    </>
  );
}
