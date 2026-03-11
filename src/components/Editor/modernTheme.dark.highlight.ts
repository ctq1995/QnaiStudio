import { EditorView } from '@codemirror/view';

const fg = {
  primary: '#e6edf3',
  secondary: '#8b949e',
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
  punct: '#e6edf3',
  regex: '#a5d6ff',
  module: '#d2a8ff',
};

const accent = {
  primary: '#58a6ff',
};

export const modernDarkHighlightStyle = EditorView.theme({
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
}, { dark: true });
