# Settings UI Complete Redesign - Design Spec

## Overview

Completely rebuild the Settings UI from a Modal-based form to an independent page with shell + section architecture, referencing the codeg project implementation. Introduce shadcn/ui component system for token-driven styling and theme support.

## Architecture

### Layout Change

- **Before:** Modal overlay (`SettingsModal`) with left sidebar + right content
- **After:** Independent page (`SettingsPage`) rendered conditionally in `App.tsx`, with `SettingsShell` providing layout frame

### Shell + Section Pattern

```
SettingsPage
  SettingsShell
    Header (title + back button)
    Sidebar (nav list, w-56)
    Content Area (ScrollArea)
      [Active Section Panel]
```

### Navigation

- Data-driven section list in `settingsOptions.ts`
- `useState` controls active section
- Desktop: permanent left sidebar
- Mobile: Sheet drawer (responsive)

## Settings Sections

| ID | Name | Icon | Description |
|---|---|---|---|
| `engine` | Engine | Cpu | Default engine, CLI path, provider binding, model, connection test |
| `providers` | Model Providers | Server | Provider CRUD, kind/baseUrl/apiKey |
| `appearance` | Appearance | Palette | Theme mode (dark/light/system) - NEW |
| `floating` | Floating Window | MonitorCog | Enable/mode/delay |
| `about` | About | BookOpen | Version info |

## UI Component System

### shadcn/ui Integration

- Copy-paste pattern (not npm package)
- Based on Radix UI primitives + Tailwind CSS
- Key components: Button, Input, Select, Badge, ScrollArea, Switch, AlertDialog, Sheet

### Token Mapping

Map shadcn tokens to existing CSS variables in `tailwind.config.js`:

```js
card:              'var(--bg-elevated)',
foreground:        'var(--text-primary)',
muted:             'var(--bg-surface)',
muted-foreground:  'var(--text-tertiary)',
accent:            'var(--bg-hover)',
accent-foreground: 'var(--text-primary)',
input:             'var(--bg-surface)',
ring:              '#3B82F6',
destructive:       '#F87171',
border:            'var(--border-default)',
```

This ensures shadcn components automatically adapt to the project's dark/light theme.

## Data Flow

- Preserve `useSettingsEditor` local draft model
- Save remains whole-config single-commit
- Each panel mutates `localConfig` via callback props
- Add toast feedback for save success/error (sonner or simple toast)

## Section Card Pattern

Every settings panel follows a consistent section card layout:

```tsx
<section className="rounded-xl border bg-card p-4 space-y-4">
  <div className="flex items-center gap-2">
    <Icon className="h-4 w-4 text-muted-foreground" />
    <h2 className="text-sm font-semibold">Title</h2>
  </div>
  <p className="text-xs text-muted-foreground leading-5">Description</p>
  ...controls...
</section>
```

## File Structure

### New Files

```
src/components/Settings/SettingsShell.tsx
src/components/Settings/SettingsPage.tsx
src/components/Settings/AppearanceSettingsPanel.tsx
src/components/ui/button.tsx
src/components/ui/input.tsx
src/components/ui/select.tsx
src/components/ui/badge.tsx
src/components/ui/scroll-area.tsx
src/components/ui/switch.tsx
src/components/ui/alert-dialog.tsx
src/components/ui/sheet.tsx
src/lib/utils.ts (cn utility)
```

### Modified Files

```
src/components/Settings/EngineSettingsPanel.tsx    (rewrite)
src/components/Settings/ProvidersSettingsPanel.tsx (rewrite)
src/components/Settings/FloatingWindowSettingsPanel.tsx (rewrite)
src/components/Settings/AboutSettingsPanel.tsx     (rewrite)
src/components/Settings/ModelInputWithFetch.tsx    (adapt)
src/components/Settings/settingsOptions.ts         (update)
src/components/Settings/useSettingsEditor.ts       (update)
src/components/Settings/index.ts                   (update)
src/App.tsx                                        (update)
tailwind.config.js                                 (add shadcn tokens)
```

### Deleted Files

```
src/components/Settings/SettingsModal.tsx      (replaced by SettingsPage + SettingsShell)
src/components/Settings/SettingsContent.tsx    (merged into SettingsShell)
src/components/Settings/SettingsToggle.tsx     (replaced by shadcn Switch)
src/components/Settings/SettingsCardOption.tsx (replaced by shadcn Button patterns)
src/components/Settings/DirtyBadge.tsx         (replaced by shadcn Badge)
```

## New Dependencies

- `@radix-ui/react-select`
- `@radix-ui/react-switch`
- `@radix-ui/react-scroll-area`
- `@radix-ui/react-alert-dialog`
- `@radix-ui/react-dialog` (for Sheet)
- `class-variance-authority`
- `tailwind-merge`
- `sonner` (toast notifications)
