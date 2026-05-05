# Settings Compact System Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the settings window into a compact system-settings-style layout with a white primary panel, narrower sidebar, tighter grouped forms, and unchanged settings behavior.

**Architecture:** Keep the existing settings data flow and section routing intact, but replace the current modal shell and per-section presentation with a unified compact layout language. The modal remains a two-column settings window, while each section becomes a stack of consistent white form groups with restrained borders and compact spacing.

**Tech Stack:** React, TypeScript, Tailwind CSS, Zustand stores, Tauri/Vite build

---

## File map

- Modify: `src/components/Settings/SettingsModal.tsx`
  - Owns the settings shell, overlay, sidebar, header, footer, and content framing.
- Modify: `src/components/Settings/SettingsContent.tsx`
  - Owns page-level spacing wrapper for each settings section.
- Modify: `src/components/Settings/EngineSettingsPanel.tsx`
  - Owns the most complex settings page; needs compact grouped sections.
- Modify: `src/components/Settings/ProvidersSettingsPanel.tsx`
  - Owns provider creation/editing/removal layout.
- Modify: `src/components/Settings/FloatingWindowSettingsPanel.tsx`
  - Owns floating window settings groups.
- Modify: `src/components/Settings/AboutSettingsPanel.tsx`
  - Owns compact information groups for About.
- Modify: `src/components/Settings/SettingsCardOption.tsx`
  - Shared selectable option block.
- Modify: `src/components/Settings/SettingsToggle.tsx`
  - Shared system-settings-style toggle row.
- Modify: `src/components/Settings/DirtyBadge.tsx`
  - Shared unsaved tag.
- Test/Verify: `npm run build`

### Task 1: Rebuild the modal shell

**Files:**
- Modify: `src/components/Settings/SettingsModal.tsx`
- Modify: `src/components/Settings/SettingsContent.tsx`
- Test: `npm run build`

- [ ] **Step 1: Update modal shell sizing, overlay, sidebar, and white main panel**

Replace the outer layout styling in `src/components/Settings/SettingsModal.tsx` so the modal uses a dark translucent overlay, a white primary panel, a narrow light-gray sidebar, and a compact white content area.

```tsx
const PANEL_HEIGHT_CLASS = 'h-[82vh]';
const PANEL_MAX_WIDTH_CLASS = 'max-w-[1160px]';
const SIDEBAR_WIDTH_CLASS = 'w-[204px]';

function SettingsOverlay({ children }: SettingsOverlayProps) {
  const content = (
    <div className={`fixed inset-0 ${MODAL_LAYER_CLASS} flex items-center justify-center bg-neutral-950/55 p-5`}>
      {children}
    </div>
  );

  return createPortal(content, document.body);
}

function SettingsSidebar({ sections, activeSection, onSelect }: SettingsSidebarProps) {
  return (
    <aside className={`flex h-full ${SIDEBAR_WIDTH_CLASS} flex-col border-r border-slate-200 bg-slate-50 px-3 py-3`}>
      {/* compact title */}
      {/* section list */}
      {/* bottom tip */}
    </aside>
  );
}

return (
  <SettingsOverlay>
    <div className={`flex w-full ${PANEL_HEIGHT_CLASS} ${PANEL_MAX_WIDTH_CLASS} overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.18)]`}>
      <SettingsSidebar ... />
      <SettingsMain ... />
    </div>
  </SettingsOverlay>
);
```

- [ ] **Step 2: Rewrite sidebar items into compact system-style rows**

Adjust `SectionButton` in `src/components/Settings/SettingsModal.tsx` so each item becomes a compact row with a thin left active bar, smaller icon container, and no descriptive second line.

```tsx
function SectionButton({ section, selected, onSelect }: SectionButtonProps) {
  const Icon = SECTION_ICONS[section.id];

  return (
    <button
      type="button"
      onClick={() => onSelect(section.id)}
      className={`relative w-full rounded-lg border px-3 py-2 text-left transition-colors ${
        selected
          ? 'border-slate-200 bg-white text-slate-900'
          : 'border-transparent bg-transparent text-slate-500 hover:border-slate-200 hover:bg-white hover:text-slate-900'
      }`}
    >
      <span className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-full ${selected ? 'bg-primary' : 'bg-transparent'}`} />
      <div className="flex items-center gap-2.5 pl-3">
        <div className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="truncate text-sm font-medium">{section.name}</div>
      </div>
    </button>
  );
}
```

- [ ] **Step 3: Tighten header, error strip, content region, and footer**

Update the right-side shell in `src/components/Settings/SettingsModal.tsx` to use a smaller title band, a compact red error strip, a plain white content scroll area, and a restrained footer.

```tsx
function SettingsHeader({ title, description, hasUnsavedChanges, onClose }: SettingsHeaderProps) {
  return (
    <div className="border-b border-slate-200 bg-white px-5 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">Preferences</div>
          <div className="mt-1.5 flex items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
            {hasUnsavedChanges ? <span className="rounded-md border border-amber-700 bg-amber-700 px-2 py-0.5 text-[11px] font-medium text-white">未保存</span> : null}
          </div>
          <p className="mt-1.5 text-sm leading-5 text-slate-500">{description}</p>
        </div>
        <button ... aria-label="关闭设置" />
      </div>
    </div>
  );
}

<div className="space-y-3 border-b border-slate-200 px-5 py-3">
  <div className="rounded-lg border border-red-700 bg-red-700 px-4 py-2.5 text-sm font-medium text-white">
    {errorBanner.message}
  </div>
</div>

<div className="min-h-0 flex-1 overflow-y-auto bg-white px-5 py-5">
  <SettingsContent ... />
</div>

<div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3">
  <div className="text-sm text-slate-500">{hasUnsavedChanges ? '你有未保存的更改' : '当前没有未保存的更改'}</div>
  <div className="flex items-center gap-2.5">
    <Button variant="ghost" size="sm" ...>关闭</Button>
    <Button size="sm" ...>保存设置</Button>
  </div>
</div>
```

- [ ] **Step 4: Tighten page-level wrapper spacing in `SettingsContent.tsx`**

Keep the current routing logic but make the page frame use tighter spacing so section stacks match the compact shell.

```tsx
function SettingsPageFrame({ children }: { children: ReactNode }) {
  return <div className="space-y-3.5">{children}</div>;
}
```

- [ ] **Step 5: Run build to verify shell changes**

Run: `npm run build`
Expected: `tsc && vite build` completes successfully.

### Task 2: Normalize shared settings primitives

**Files:**
- Modify: `src/components/Settings/SettingsCardOption.tsx`
- Modify: `src/components/Settings/SettingsToggle.tsx`
- Modify: `src/components/Settings/DirtyBadge.tsx`
- Test: `npm run build`

- [ ] **Step 1: Make `DirtyBadge` a minimal field-level tag**

Ensure `src/components/Settings/DirtyBadge.tsx` stays visually small and neutral.

```tsx
export function DirtyBadge({ visible, label = '未保存' }: DirtyBadgeProps) {
  if (!visible) {
    return null;
  }

  return (
    <span
      aria-hidden="true"
      className="ml-2 inline-flex items-center rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-500"
    >
      {label}
    </span>
  );
}
```

- [ ] **Step 2: Make `SettingsCardOption` a compact white option block**

Update `src/components/Settings/SettingsCardOption.tsx` so option cards look like settings options rather than feature cards.

```tsx
<button
  type="button"
  onClick={onClick}
  aria-pressed={selected}
  className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
    selected
      ? 'border-slate-300 bg-white text-slate-900'
      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900'
  }`}
>
  <div className="flex items-center justify-between gap-3">
    <div className="min-w-0">
      <div className="text-sm font-medium text-slate-900">{title}</div>
      <div className="mt-1 text-xs leading-5 text-slate-500">{description}</div>
    </div>
    {indicator}
  </div>
</button>
```

- [ ] **Step 3: Make `SettingsToggle` match system-settings rows**

Keep the accessibility semantics but tighten the visuals in `src/components/Settings/SettingsToggle.tsx`.

```tsx
return (
  <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
    <div className="min-w-0">
      <div id={labelId} className="text-sm font-medium text-slate-900">
        {label}
        <DirtyBadge visible={dirty} />
      </div>
      <div id={descriptionId} className="mt-1 text-xs leading-5 text-slate-500">
        {description}
      </div>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelId}
      aria-describedby={descriptionId}
      onClick={onToggle}
      className={`relative h-6 w-11 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-slate-300'}`}
    >
      <span
        aria-hidden="true"
        className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  </div>
);
```

- [ ] **Step 4: Run build to verify shared primitive updates**

Run: `npm run build`
Expected: `tsc && vite build` completes successfully.

### Task 3: Rebuild the engine settings page into compact setting groups

**Files:**
- Modify: `src/components/Settings/EngineSettingsPanel.tsx`
- Test: `npm run build`

- [ ] **Step 1: Replace any overview-card treatment with compact summary rows**

Update the summary portion in `src/components/Settings/EngineSettingsPanel.tsx` so it is no longer a hero/overview card, but a restrained three-cell summary strip.

```tsx
function EngineOverview({ config }: { config: Config }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white px-4 py-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
          <div className="text-[11px] text-slate-500">默认引擎</div>
          <div className="mt-1.5 text-sm font-semibold text-slate-900">{currentName}</div>
        </div>
        {/* cli path + provider/model cells */}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Standardize `EngineSection` into compact white groups**

Ensure all engine groups share the same system-settings block language.

```tsx
function EngineSection({ icon: Icon, title, description, children }: ...) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white px-4 py-4">
      <div className="mb-3 flex items-start gap-3">
        <div className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {description ? <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}
```

- [ ] **Step 3: Keep the page groups to exactly five logical areas**

Organize `PathEditor` and related engine content into these groups only:
- 默认引擎
- CLI 路径
- 服务商与模型
- 连接测试
- 高级参数

Ensure `EngineParamsEditor` is rendered only once for the provider/model section, and advanced parameters use their own dedicated inputs instead of duplicating provider/model controls.

```tsx
<EngineSection icon={FolderCog} title={meta.title} description="配置当前默认引擎对应的 CLI 命令路径。">
  <ClaudePathSelector ... />
</EngineSection>

<EngineSection icon={Link2} title="服务商与模型" description="绑定该引擎默认使用的服务商与模型。">
  <EngineParamsEditor ... />
</EngineSection>

<EngineSection icon={Wifi} title="连接测试" description="验证当前引擎配置是否可访问。">
  <ConnectionTestButton ... />
</EngineSection>
```

- [ ] **Step 4: Make connection results a compact inline result block**

Ensure success/error feedback uses restrained white/red blocks rather than large cards.

```tsx
{result && (
  <div
    className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
      result.success
        ? 'border-slate-200 bg-white text-slate-900'
        : 'border-red-700 bg-red-700 text-white'
    }`}
  >
    {result.message}
  </div>
)}
```

- [ ] **Step 5: Run build to verify engine page changes**

Run: `npm run build`
Expected: `tsc && vite build` completes successfully.

### Task 4: Rebuild the providers page into editable setting groups

**Files:**
- Modify: `src/components/Settings/ProvidersSettingsPanel.tsx`
- Test: `npm run build`

- [ ] **Step 1: Use a single compact section container for the page**

Keep or refine `ProvidersSection` so it matches the compact white settings-group pattern.

```tsx
function ProvidersSection({ icon: Icon, title, description, action, children }: ...) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white px-4 py-4">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
            {description ? <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p> : null}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
```

- [ ] **Step 2: Make the draft form and provider editors use the same editing block**

Ensure `ProviderEditor` is reused for both draft and existing providers, with white backgrounds, subtle borders, and compact spacing.

```tsx
<div className="rounded-xl border border-slate-200 bg-white px-4 py-4">
  <div className="mb-4 flex items-start justify-between gap-3">
    <div className="min-w-0">
      <div className="truncate text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-1 inline-flex rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-500">
        {providerKindLabel}
      </div>
    </div>
    {action}
  </div>
  {/* form fields */}
</div>
```

- [ ] **Step 3: Make the empty state a brief helper block instead of a decorative card**

Use a restrained empty state with one action button.

```tsx
<div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500">
  <div className="font-medium text-slate-900">还没有服务商</div>
  <p className="mt-1 leading-5">新增后即可在引擎设置中绑定默认模型来源。</p>
  <button ...>新增第一个服务商</button>
</div>
```

- [ ] **Step 4: Keep delete actions compact but clearly dangerous**

Use only the delete button itself as the danger surface.

```tsx
<button
  type="button"
  onClick={() => onRemoveProvider(provider.id)}
  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 transition-colors hover:border-red-700 hover:bg-red-700 hover:text-white"
>
  <Trash2 className="h-4 w-4" />
  删除
</button>
```

- [ ] **Step 5: Run build to verify providers page changes**

Run: `npm run build`
Expected: `tsc && vite build` completes successfully.

### Task 5: Rebuild the floating window and about pages

**Files:**
- Modify: `src/components/Settings/FloatingWindowSettingsPanel.tsx`
- Modify: `src/components/Settings/AboutSettingsPanel.tsx`
- Test: `npm run build`

- [ ] **Step 1: Use compact white groups across the floating window page**

Keep or refine `FloatingSection` so every subsection uses the same compact settings-group layout.

```tsx
function FloatingSection({ icon: Icon, title, description, children }: ...) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white px-4 py-4">
      <div className="mb-3 flex items-start gap-3">
        <div className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {description ? <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}
```

- [ ] **Step 2: Make the mode selector feel like a compact system option grid**

Keep the selector grid but ensure cards remain restrained and consistent with the shared `SettingsCardOption` styles.

```tsx
<div className="grid gap-3 md:grid-cols-2">
  {FLOATING_MODE_OPTIONS.map((option) => (
    <SettingsCardOption
      key={option.id}
      title={option.name}
      description={option.description}
      selected={floatingWindow.mode === option.id}
      onClick={() => onModeChange(option.id)}
      indicator={<DotIndicator selected={floatingWindow.mode === option.id} />}
    />
  ))}
</div>
```

- [ ] **Step 3: Make the About page two minimal compact info groups**

Ensure `AboutSettingsPanel.tsx` stays sparse and consistent.

```tsx
function AboutSection({ icon: Icon, title, children }: ...) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white px-4 py-4">
      <div className="mb-3 flex items-start gap-3">
        <div className="rounded-md border border-slate-200 bg-white p-1.5 text-slate-500">
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      {children}
    </section>
  );
}
```

- [ ] **Step 4: Run build to verify floating/about page changes**

Run: `npm run build`
Expected: `tsc && vite build` completes successfully.

### Task 6: Final verification and cleanup

**Files:**
- Verify: `src/components/Settings/SettingsModal.tsx`
- Verify: `src/components/Settings/SettingsContent.tsx`
- Verify: `src/components/Settings/EngineSettingsPanel.tsx`
- Verify: `src/components/Settings/ProvidersSettingsPanel.tsx`
- Verify: `src/components/Settings/FloatingWindowSettingsPanel.tsx`
- Verify: `src/components/Settings/AboutSettingsPanel.tsx`
- Verify: `src/components/Settings/SettingsCardOption.tsx`
- Verify: `src/components/Settings/SettingsToggle.tsx`
- Verify: `src/components/Settings/DirtyBadge.tsx`
- Test: `npm run build`

- [ ] **Step 1: Re-read the spec and verify every required visual rule is represented in code**

Use this checklist against `docs/superpowers/specs/2026-04-28-settings-compact-system-redesign-design.md`:
- White primary window
- Narrow light-gray sidebar
- Compact header
- Compact footer
- Uniform white settings groups
- No dashboard-like hero cards
- No floating translucent internal surfaces
- Engine/providers/floating/about all follow the same grouping language

- [ ] **Step 2: Run the final build verification**

Run: `npm run build`
Expected: `tsc && vite build` completes successfully.

- [ ] **Step 3: Review the changed files list before any commit**

Run: `git status --short`
Expected: only the intended settings-related files are reviewed before any commit action.
