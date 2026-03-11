import { EditorView } from '@codemirror/view';

const bg = {
  primary: '#f5f5f7',
  secondary: '#ffffff',
  tertiary: '#ebebed',
  highlight: '#e6e6eb',
};

const fg = {
  primary: '#1a1a1f',
  secondary: '#4a4a52',
  muted: '#7a7a82',
  disabled: '#b0b0b6',
};

const syntax = {
  keyword: '#7c3aed',
  variable: '#1a1a1f',
  string: '#b45309',
  number: '#dc2626',
  comment: '#6b7280',
  type: '#2563eb',
  function: '#7c3aed',
  constant: '#2563eb',
  tag: '#059669',
  attribute: '#2563eb',
  property: '#2563eb',
  operator: '#dc2626',
};

const accent = {
  primary: '#2563eb',
  selection: 'rgba(37, 99, 235, 0.15)',
  selectionFocused: 'rgba(37, 99, 235, 0.25)',
  match: 'rgba(37, 99, 235, 0.12)',
  bracketMatch: 'rgba(37, 99, 235, 0.15)',
  cursor: '#2563eb',
  gutterActive: '#1a1a1f',
};

const status = {
  error: '#dc2626',
  warning: '#d97706',
  info: '#2563eb',
};

export const modernLightTheme = EditorView.theme({
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
    borderRight: '1px solid rgba(0, 0, 0, 0.1)',
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
    borderBottom: '1px solid rgba(37, 99, 235, 0.3)',
  },
  '.cm-nonmatchingBracket': {
    color: status.error,
    borderBottom: '1px solid rgba(220, 38, 38, 0.5)',
  },
  '.cm-searchMatch .cm-searchMatch-selected': {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
  },
  '.cm-lintRange-error': {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 6 3'%3E%3Cpath fill='%23dc2626' d='M0 0h6v1H0zM0 2h6v1H0z'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'repeat-x',
    backgroundPosition: 'bottom left',
    backgroundSize: '6px 3px',
  },
  '.cm-lintRange-warning': {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 6 3'%3E%3Cpath fill='%23d97706' d='M0 0h6v1H0zM0 2h6v1H0z'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'repeat-x',
    backgroundPosition: 'bottom left',
    backgroundSize: '6px 3px',
  },
  '.cm-lintRange-info': {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 6 3'%3E%3Cpath fill='%232563eb' d='M0 0h6v1H0zM0 2h6v1H0z'/%3E%3C/svg%3E")`,
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
    border: '1px solid rgba(0, 0, 0, 0.12)',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
  },
  '.cm-panel.cm-search': {
    padding: '8px',
  },
  '.cm-tooltip': {
    backgroundColor: bg.secondary,
    border: '1px solid rgba(0, 0, 0, 0.12)',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
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
    border: '1px solid rgba(0, 0, 0, 0.12)',
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
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    borderRadius: '6px',
    border: '3px solid transparent',
    backgroundClip: 'padding-box',
  },
  '.cm-scroller::-webkit-scrollbar-thumb:hover': {
    backgroundColor: 'rgba(0, 0, 0, 0.28)',
    backgroundClip: 'padding-box',
  },
  '.cm-scroller::-webkit-scrollbar-corner': {
    backgroundColor: 'transparent',
  },
}, { dark: false });
