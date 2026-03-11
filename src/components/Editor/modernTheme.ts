import type { Extension } from '@codemirror/state';
import { modernDarkHighlightStyle, modernDarkTheme } from './modernTheme.dark';
import { modernLightHighlightStyle, modernLightTheme } from './modernTheme.light';

export type EditorThemeMode = 'dark' | 'light';

export function getModernTheme(mode: EditorThemeMode): Extension[] {
  if (mode === 'light') {
    return [modernLightTheme, modernLightHighlightStyle];
  }
  return [modernDarkTheme, modernDarkHighlightStyle];
}
