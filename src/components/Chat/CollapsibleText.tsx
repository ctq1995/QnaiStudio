import { useMemo, useState } from 'react';

interface CollapsibleTextProps {
  content: string;
  className?: string;
}

const COLLAPSE_CHAR_THRESHOLD = 320;
const COLLAPSE_LINE_THRESHOLD = 8;
const COLLAPSED_MAX_HEIGHT_PX = 168;

export function CollapsibleText({ content, className = '' }: CollapsibleTextProps) {
  const [expanded, setExpanded] = useState(false);
  const shouldCollapse = useMemo(() => {
    const lines = content.split('\n').length;
    return content.length > COLLAPSE_CHAR_THRESHOLD || lines > COLLAPSE_LINE_THRESHOLD;
  }, [content]);

  return (
    <div>
      <div className={`relative overflow-hidden ${className}`} style={!expanded && shouldCollapse ? { maxHeight: `${COLLAPSED_MAX_HEIGHT_PX}px` } : undefined}>
        <div className="whitespace-pre-wrap break-words">{content}</div>
        {!expanded && shouldCollapse && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-primary/90 to-transparent" />}
      </div>
      {shouldCollapse && (
        <button type="button" onClick={() => setExpanded((value) => !value)} className="mt-2 text-xs font-medium text-text-secondary transition-colors hover:text-text-primary">
          {expanded ? '收起长消息' : '展开长消息'}
        </button>
      )}
    </div>
  );
}
