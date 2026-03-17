/**
 * 对话内关键词搜索浮层
 * 触发：Ctrl+F / Cmd+F
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';

interface ChatSearchProps {
  /** 搜索目标：消息文本数组，index 对应 Virtuoso 的 itemIndex */
  texts: string[];
  onNavigate: (index: number) => void;
  onClose: () => void;
}

export function ChatSearch({ texts, onNavigate, onClose }: ChatSearchProps) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<number[]>([]);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // 自动聚焦
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // 搜索逻辑
  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      setMatches([]);
      setCursor(0);
      return;
    }
    const found: number[] = [];
    texts.forEach((text, i) => {
      if (text.toLowerCase().includes(q)) found.push(i);
    });
    setMatches(found);
    setCursor(0);
    if (found.length > 0) onNavigate(found[0]);
  }, [query, texts]);

  const goNext = useCallback(() => {
    if (matches.length === 0) return;
    const next = (cursor + 1) % matches.length;
    setCursor(next);
    onNavigate(matches[next]);
  }, [cursor, matches, onNavigate]);

  const goPrev = useCallback(() => {
    if (matches.length === 0) return;
    const prev = (cursor - 1 + matches.length) % matches.length;
    setCursor(prev);
    onNavigate(matches[prev]);
  }, [cursor, matches, onNavigate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'Enter') { e.shiftKey ? goPrev() : goNext(); }
  };

  return (
    <div
      className={clsx(
        'absolute top-3 right-16 z-50',
        'flex items-center gap-1.5 px-2 py-1.5',
        'bg-background-elevated border border-border rounded-xl shadow-lg',
        'animate-in fade-in zoom-in-95 duration-150',
      )}
    >
      <Search className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="搜索消息..."
        className="w-44 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary outline-none"
      />
      {query && (
        <span className="text-xs text-text-tertiary whitespace-nowrap">
          {matches.length > 0 ? `${cursor + 1}/${matches.length}` : '无结果'}
        </span>
      )}
      <button
        onClick={goPrev}
        disabled={matches.length === 0}
        className="p-0.5 rounded text-text-tertiary hover:text-text-primary disabled:opacity-30 transition-colors"
        title="上一个 (Shift+Enter)"
      >
        <ChevronUp className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={goNext}
        disabled={matches.length === 0}
        className="p-0.5 rounded text-text-tertiary hover:text-text-primary disabled:opacity-30 transition-colors"
        title="下一个 (Enter)"
      >
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={onClose}
        className="p-0.5 rounded text-text-tertiary hover:text-text-primary transition-colors"
        title="关闭 (Esc)"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
