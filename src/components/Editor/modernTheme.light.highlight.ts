import { EditorView } from '@codemirror/view';

const fg = {
  primary: '#1a1a1f',
  secondary: '#4a4a52',
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
  punct: '#1a1a1f',
  regex: '#dc2626',
  module: '#7c3aed',
};

const accent = {
  primary: '#2563eb',
};

export const modernLightHighlightStyle = EditorView.theme({
  '.cm-keyword': {
    color: syntax.keyword,
    fontWeight: '500',
  },
  '.cm-variable': {
    color: syntax.variable,
  },
  '.cm-variableName': {
    color: syntax.variable,
  },
  '.cm-variableDefined': {
    color: syntax.variable,
  },
  '.cm-variableSpecial': {
    color: syntax.function,
  },
  '.cm-string': {
    color: syntax.string,
  },
  '.cm-string-2': {
    color: syntax.string,
  },
  '.cm-number': {
    color: syntax.number,
  },
  '.cm-comment': {
    color: syntax.comment,
    fontStyle: 'italic',
    opacity: 0.85,
  },
  '.cm-type': {
    color: syntax.type,
  },
  '.cm-property': {
    color: syntax.property,
  },
  '.cm-attribute': {
    color: syntax.attribute,
  },
  '.cm-def': {
    color: syntax.function,
    fontWeight: '500',
  },
  '.cm-defName': {
    color: syntax.function,
  },
  '.cm-variableName.function': {
    color: syntax.function,
  },
  '.cm-variableName.function.definition': {
    color: syntax.function,
  },
  '.cm-operator': {
    color: syntax.operator,
  },
  '.cm-punctuation': {
    color: syntax.punct,
  },
  '.cm-bracket': {
    color: syntax.punct,
  },
  '.cm-qualifier': {
    color: syntax.constant,
  },
  '.cm-builtin': {
    color: syntax.constant,
  },
  '.cm-tag': {
    color: syntax.tag,
  },
  '.cm-regex': {
    color: syntax.regex,
  },
  '.cm-namespace': {
    color: syntax.module,
  },
  '.cm-atom': {
    color: syntax.constant,
  },
  '.cm-link': {
    color: accent.primary,
    textDecoration: 'underline',
  },
  '.cm-strong': {
    fontWeight: '700',
  },
  '.cm-emphasis': {
    fontStyle: 'italic',
  },
  '.cm-header': {
    fontWeight: '600',
    color: fg.primary,
  },
  '.cm-quote': {
    color: fg.secondary,
    fontStyle: 'italic',
  },
  '.cm-list': {
    color: accent.primary,
  },
  '.cm-hr': {
    borderColor: fg.disabled,
  },
  '.cm-monospace': {
    fontFamily: 'inherit',
  },
}, { dark: false });
