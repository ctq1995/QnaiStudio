import { EditorView } from '@codemirror/view';

const bg = {
  primary: '#0d1117',
  secondary: '#161b22',
  tertiary: '#21262d',
  highlight: '#1f242c',
};

const fg = {
  primary: '#e6edf3',
  secondary: '#8b949e',
  muted: '#6e7681',
  disabled: '#484f58',
};

const syntax = {
  keyword: '#ff7b72',
  variable: '#e6edf3',
  string: '#a5d6ff',
  number: '#79c0ff',
  comment: '#8b949e',
  type: '#ffa657',
  function: '#d2a8ff',
  constant: '#79c0ff',
  tag: '#7ee787',
  attribute: '#79c0ff',
  property: '#79c0ff',
  operator: '#ff7b72',
};

const accent = {
  primary: '#58a6ff',
  selection: 'rgba(88, 166, 255, 0.25)',
  selectionFocused: 'rgba(88, 166, 255, 0.35)',
  match: 'rgba(88, 166, 255, 0.15)',
  bracketMatch: 'rgba(38, 139, 210, 0.15)',
  cursor: '#58a6ff',
  gutterActive: '#e6edf3',
};

const status = {
  error: '#f85149',
  warning: '#d29922',
  info: '#58a6ff',
};

export const modernDarkTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: bg.primary,
    color: fg.primary,
    fontSize: '14px',
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', 'Consolas', monospace",
    fontVariantLigatures: 'normal',
    textRendering: 'optimizeLegibility',
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale',
  },
  '.cm-scroller': {
    overflow: 'auto',
    height: '100%',
    fontFamily: 'inherit',
  },
  '.cm-content': {
    padding: '12px 0',
    minHeight: '100%',
    fontFamily: 'inherit',
    lineHeight: '1.7',
    letterSpacing: '0.01em',
  },
  '.cm-line': {
    padding: '0 16px',
    fontFamily: 'inherit',
  },
  '.cm-focused': {
    outline: 'none',
  },
  '.cm-activeLine': {
    backgroundColor: bg.highlight,
  },
  '.cm-lineNumbers': {
    color: fg.secondary,
    backgroundColor: bg.primary,
    fontSize: '13px',
  },
  '.cm-gutters': {
    backgroundColor: bg.primary,
    color: fg.secondary,
    border: 'none',
    borderRight: '1px solid rgba(48, 54, 61, 0.5)',
  },
  '.cm-gutterElement': {
    padding: '0 12px 0 16px',
    minWidth: '40px',
    textAlign: 'right',
    fontFamily: 'inherit',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
    color: accent.gutterActive,
  },
  '.cm-cursor': {
    borderLeftColor: accent.cursor,
    borderLeftWidth: '2px',
  },
  '.cm-selectionBackground': {
    background: accent.selection,
  },
  '&.cm-focused .cm-selectionBackground': {
    background: accent.selectionFocused,
  },
  '.cm-selectionMatch': {
    backgroundColor: accent.match,
  },
  '.cm-matchingBracket': {
    color: accent.primary,
    backgroundColor: accent.bracketMatch,
    borderBottom: '1px solid rgba(88, 166, 255, 0.3)',
  },
  '.cm-nonmatchingBracket': {
    color: status.error,
    borderBottom: '1px solid rgba(248, 81, 73, 0.5)',
  },
  '.cm-searchMatch .cm-searchMatch-selected': {
    backgroundColor: 'rgba(255, 215, 0, 0.3)',
  },
  '.cm-lintRange-error': {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 6 3'%3E%3Cpath fill='%23f85149' d='M0 0h6v1H0zM0 2h6v1H0z'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'repeat-x',
    backgroundPosition: 'bottom left',
    backgroundSize: '6px 3px',
  },
  '.cm-lintRange-warning': {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 6 3'%3E%3Cpath fill='%23d29922' d='M0 0h6v1H0zM0 2h6v1H0z'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'repeat-x',
    backgroundPosition: 'bottom left',
    backgroundSize: '6px 3px',
  },
  '.cm-lintRange-info': {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 6 3'%3E%3Cpath fill='%2358a6ff' d='M0 0h6v1H0zM0 2h6v1H0z'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'repeat-x',
    backgroundPosition: 'bottom left',
    backgroundSize: '6px 3px',
  },
  '.cm-lint-marker-error': {
    color: status.error,
  },
  '.cm-lint-marker-warning': {
    color: status.warning,
  },
  '.cm-lint-marker-info': {
    color: status.info,
  },
  '.cm-panel': {
    backgroundColor: bg.secondary,
    border: '1px solid rgba(48, 54, 61, 0.8)',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
  },
  '.cm-panel.cm-search': {
    padding: '8px',
  },
  '.cm-tooltip': {
    backgroundColor: bg.secondary,
    border: '1px solid rgba(48, 54, 61, 0.8)',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
  },
  '.cm-tooltip-autocomplete': {
    maxWidth: '280px',
    fontFamily: 'inherit',
  },
  'ul.cm-tooltip-autocomplete': {
    maxHeight: '200px',
    overflowY: 'auto',
  },
  '.cm-tooltip-autocomplete ul': {
    maxHeight: '200px',
    overflowY: 'auto',
    fontFamily: 'inherit',
  },
  '.cm-tooltip-autocomplete li': {
    padding: '6px 12px',
    fontSize: '13px',
  },
  '.cm-tooltip-autocomplete li[aria-selected]': {
    backgroundColor: bg.tertiary,
    color: fg.primary,
  },
  '.cm-completionIcon': {
    width: '16px',
    marginRight: '8px',
  },
  '.cm-completionIcon-function': {
    color: syntax.function,
  },
  '.cm-completionIcon-variable': {
    color: syntax.variable,
  },
  '.cm-completionIcon-class': {
    color: syntax.type,
  },
  '.cm-completionIcon-keyword': {
    color: syntax.keyword,
  },
  '.cm-foldPlaceholder': {
    backgroundColor: bg.tertiary,
    border: '1px solid rgba(48, 54, 61, 0.5)',
    borderRadius: '3px',
    color: fg.secondary,
    padding: '0 6px',
    fontSize: '12px',
  },
  '.cm-specialChar': {
    color: accent.primary,
    fontSize: '12px',
    opacity: 0.7,
  },
  '.cm-widget': {
    fontFamily: 'inherit',
  },
  '.cm-scroller::-webkit-scrollbar': {
    width: '12px',
    height: '12px',
  },
  '.cm-scroller::-webkit-scrollbar-track': {
    backgroundColor: 'transparent',
  },
  '.cm-scroller::-webkit-scrollbar-thumb': {
    backgroundColor: 'rgba(139, 148, 158, 0.3)',
    borderRadius: '6px',
    border: '3px solid transparent',
    backgroundClip: 'padding-box',
  },
  '.cm-scroller::-webkit-scrollbar-thumb:hover': {
    backgroundColor: 'rgba(139, 148, 158, 0.5)',
    backgroundClip: 'padding-box',
  },
  '.cm-scroller::-webkit-scrollbar-corner': {
    backgroundColor: 'transparent',
  },
}, { dark: true });
