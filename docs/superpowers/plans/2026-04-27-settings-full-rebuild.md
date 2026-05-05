# Settings Full Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将设置界面完整重构为无透明主视觉的左右分栏设置中心，统一全部设置子面板为简洁、紧凑、专业的实底风格。

**Architecture:** 保持现有设置数据流与分区逻辑不变，只重写设置模态壳层、内容容器以及各分区面板的视觉结构。通过先重构 SettingsModal 与共用视觉部件，再逐步收敛引擎、服务商、悬浮窗、关于四个面板，确保风险可控且样式一致。

**Tech Stack:** React、TypeScript、Tauri、Tailwind CSS、现有 Settings 组件体系

---

## File Map

- Modify: `src/components/Settings/SettingsModal.tsx`
  - 重构整体左右布局、左侧分类导航、右侧头部、错误横幅、底部操作栏
- Modify: `src/components/Settings/SettingsContent.tsx`
  - 为右侧内容区提供统一页面容器与一致的间距节奏
- Modify: `src/components/Settings/EngineSettingsPanel.tsx`
  - 去掉渐变和透明强调，改为标准分组区块与更稳的引擎选择组件
- Modify: `src/components/Settings/ProvidersSettingsPanel.tsx`
  - 统一新增服务商、空状态、服务商编辑区块为实底样式
- Modify: `src/components/Settings/FloatingWindowSettingsPanel.tsx`
  - 改造模式选择、切换开关和延迟区块的视觉语言
- Modify: `src/components/Settings/AboutSettingsPanel.tsx`
  - 收敛为最简信息分组面板
- Modify: `src/components/Settings/SettingsCardOption.tsx`
  - 去掉透明激活态与过强 hover，作为通用实底选项卡
- Modify: `src/components/Settings/SettingsToggle.tsx`
  - 统一为更紧凑稳定的设置行
- Modify: `src/components/Settings/DirtyBadge.tsx`
  - 将未保存标记改为小型实底标签
- Verify: `src/components/Settings/settingsOptions.ts`
  - 复核分类文案是否仍适合新布局，无需改动则保持原状
- Verify: `src/components/Settings/useSettingsEditor.ts`
  - 仅确认现有状态流满足新界面，不做逻辑变更
- Verify: `package.json`
  - 查找可用的构建或检查命令

## Task 1: 重构设置模态壳层

**Files:**
- Modify: `src/components/Settings/SettingsModal.tsx`
- Verify: `src/components/Settings/settingsOptions.ts`

- [ ] **Step 1: 阅读并确认壳层涉及的现有结构**

Read and inspect:
- `src/components/Settings/SettingsModal.tsx`
- `src/components/Settings/settingsOptions.ts`

Expected findings:
- 左侧导航按钮当前使用 `bg-primary`、`bg-white/15`、`bg-transparent`
- 右侧头部使用较大的 hero 风格标题区
- 成功/错误/未保存状态带有透明浅底视觉
- 可保持 `SETTINGS_SECTIONS` 数据结构不变

- [ ] **Step 2: 将左侧导航重写为实底列表式分类导航**

Update `SectionButton` and `SettingsSidebar` in `src/components/Settings/SettingsModal.tsx` so the active state becomes a solid neutral surface plus an accent rail, for example:

```tsx
function SectionButton({ section, selected, onSelect }: SectionButtonProps) {
  const Icon = SECTION_ICONS[section.id];

  return (
    <button
      type="button"
      onClick={() => onSelect(section.id)}
      className={`group relative w-full rounded-xl border px-3 py-3 text-left transition-colors ${
        selected
          ? 'border-border bg-background-elevated text-text-primary'
          : 'border-transparent bg-transparent text-text-secondary hover:border-border hover:bg-background-surface hover:text-text-primary'
      }`}
    >
      <span
        className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-full ${selected ? 'bg-primary' : 'bg-transparent'}`}
      />
      <div className="flex items-start gap-3 pl-2">
        <div className={`mt-0.5 rounded-lg border px-2 py-2 ${selected ? 'border-border bg-background text-text-primary' : 'border-border bg-background-surface text-text-secondary'}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{section.name}</div>
          <div className="mt-1 truncate text-xs text-text-tertiary">{section.description}</div>
        </div>
      </div>
    </button>
  );
}
```

Also tighten the sidebar shell:

```tsx
<aside className="flex h-full w-[232px] flex-col border-r border-border bg-background px-4 py-4">
```

- [ ] **Step 3: 将右侧头部和底部操作栏改为紧凑设置中心样式**

Replace the hero-like block in `SettingsHero`/`SettingsFooter` with a tighter header/footer. Target structure:

```tsx
function SettingsHero({ title, description, hasUnsavedChanges, saveHint, onClose }: SettingsHeroProps) {
  const statusText = hasUnsavedChanges ? '未保存更改' : saveHint ?? '所有修改已保存';

  return (
    <div className="border-b border-border bg-background-elevated px-6 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
          <p className="mt-1 text-sm text-text-secondary">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`rounded-md border px-2.5 py-1 text-xs font-medium ${hasUnsavedChanges ? 'border-warning text-warning' : 'border-border text-text-secondary'}`}>
            {statusText}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border bg-background px-2.5 py-2 text-text-secondary transition-colors hover:bg-background-surface hover:text-text-primary"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
```

Footer target:

```tsx
<div className="flex items-center justify-between border-t border-border bg-background-elevated px-6 py-4">
```

- [ ] **Step 4: 将错误横幅和主面板容器改为纯色实底**

In `SettingsMain` and `LoadingState`, replace rounded-3xl / gradient / faint-danger styling with solid surfaces, for example:

```tsx
<div className="rounded-xl border border-danger bg-background px-4 py-3 text-sm text-danger">
  {errorBanner.message}
</div>
```

And tighten the main shell:

```tsx
<div className="flex h-[84vh] w-full max-w-[1240px] overflow-hidden rounded-2xl border border-border bg-background shadow-soft">
```

- [ ] **Step 5: 运行局部检查以确认壳层文件无明显语法错误**

Run:

```bash
npm run build
```

Expected: build may still fail on later unfinished panel tasks, but `SettingsModal.tsx` should not introduce syntax/type parse errors specific to this task.

- [ ] **Step 6: 提交壳层重构**

```bash
git add src/components/Settings/SettingsModal.tsx
git commit -m "refactor: rebuild settings modal shell"
```

## Task 2: 统一设置通用视觉部件

**Files:**
- Modify: `src/components/Settings/SettingsContent.tsx`
- Modify: `src/components/Settings/SettingsCardOption.tsx`
- Modify: `src/components/Settings/SettingsToggle.tsx`
- Modify: `src/components/Settings/DirtyBadge.tsx`

- [ ] **Step 1: 将内容区加入统一页面容器**

Wrap each panel returned by `SettingsContent` in the same spacing shell so all sections share the same rhythm:

```tsx
function SettingsPageFrame({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4">{children}</div>;
}
```

Apply it around each returned panel.

- [ ] **Step 2: 重写未保存标签为小型实底标记**

Update `src/components/Settings/DirtyBadge.tsx` to:

```tsx
export function DirtyBadge({ visible }: { visible: boolean }) {
  if (!visible) {
    return null;
  }

  return (
    <span className="ml-2 inline-flex items-center rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] font-medium text-text-secondary">
      未保存
    </span>
  );
}
```

- [ ] **Step 3: 重写通用选项卡为低装饰实底按钮**

Update `src/components/Settings/SettingsCardOption.tsx` to remove primary translucent fills:

```tsx
className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
  selected
    ? 'border-border bg-background text-text-primary'
    : 'border-border bg-background-surface text-text-secondary hover:bg-background hover:text-text-primary'
}`}
```

Keep the indicator slot but ensure description uses `text-xs` or `text-sm` with compact spacing.

- [ ] **Step 4: 重写通用开关行为容器为稳定设置行**

Update `src/components/Settings/SettingsToggle.tsx` so the wrapper becomes a compact row:

```tsx
<div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background px-4 py-3">
```

Keep the switch logic intact, but ensure the text hierarchy becomes:

```tsx
<div className="text-sm font-medium text-text-primary">{label}<DirtyBadge visible={dirty} /></div>
<div className="mt-1 text-xs leading-5 text-text-secondary">{description}</div>
```

- [ ] **Step 5: 运行构建确认通用组件变更通过**

Run:

```bash
npm run build
```

Expected: no new syntax/type errors from the shared settings components.

- [ ] **Step 6: 提交通用视觉部件更新**

```bash
git add src/components/Settings/SettingsContent.tsx src/components/Settings/SettingsCardOption.tsx src/components/Settings/SettingsToggle.tsx src/components/Settings/DirtyBadge.tsx
git commit -m "refactor: unify settings shared components"
```

## Task 3: 重构引擎设置面板

**Files:**
- Modify: `src/components/Settings/EngineSettingsPanel.tsx`

- [ ] **Step 1: 先写出目标分组骨架并保持现有行为**

Inside `src/components/Settings/EngineSettingsPanel.tsx`, reshape the page into these ordered sections:

```tsx
return (
  <div className="space-y-4">
    <EngineOverview config={config} />
    <EngineSection icon={Cpu} title="默认引擎">
      {/* engine cards */}
    </EngineSection>
    <EngineSection icon={FolderCog} title={pathMeta.title}>
      {/* cli path */}
    </EngineSection>
    <EngineSection icon={Link2} title="服务商与模型">
      {/* provider + model */}
    </EngineSection>
    <EngineSection icon={Wifi} title="连接测试">
      {/* connection test button */}
    </EngineSection>
    <EngineSection icon={SlidersHorizontal} title="高级参数">
      {/* advanced params if present */}
    </EngineSection>
  </div>
);
```

Do not delete any existing editable fields while reorganizing.

- [ ] **Step 2: 去掉概览区渐变与大圆角展示感**

Change `EngineOverview` from gradient cards to solid cards:

```tsx
<section className="rounded-xl border border-border bg-background px-5 py-5">
  <div className="grid gap-3 xl:grid-cols-3">
    <div className="rounded-lg border border-border bg-background-elevated px-4 py-3">
```

Ensure all three overview items use the same neutral styling and smaller typography.

- [ ] **Step 3: 将引擎选择卡重写为实底选项卡**

Update `EngineCard` class names to remove `bg-primary/5`, `hover:border-primary/30`, and icon translucent fills. Target style:

```tsx
className={`relative rounded-xl border px-4 py-3 text-left transition-colors ${
  selected
    ? 'border-border bg-background text-text-primary'
    : 'border-border bg-background-surface text-text-secondary hover:bg-background hover:text-text-primary'
}`}
```

Use a simple check icon or status text without adding glow/shadow emphasis.

- [ ] **Step 4: 将分组容器统一为中性设置分组**

Update `EngineSection` to:

```tsx
<section className="rounded-xl border border-border bg-background px-5 py-5">
  <div className="mb-4 flex items-center gap-3">
    <div className="rounded-lg border border-border bg-background-elevated p-2 text-text-secondary">
```

This should align with the rest of the redesigned settings surfaces.

- [ ] **Step 5: 收敛连接测试结果样式与输入区节奏**

Within the connection test block and provider/model block:
- Use neutral wrapper surfaces
- Success and failure results should use solid bordered messages instead of faint translucent chips
- Keep `ModelInputWithFetch` integration unchanged

Target result block example:

```tsx
<div className={`mt-3 rounded-lg border px-3 py-2 text-sm ${result.success ? 'border-border text-text-primary' : 'border-danger text-danger'}`}>
  {result.message}
</div>
```

- [ ] **Step 6: 运行构建验证引擎面板**

Run:

```bash
npm run build
```

Expected: build succeeds or only reports pre-existing unrelated issues, with no new `EngineSettingsPanel.tsx` errors.

- [ ] **Step 7: 提交引擎面板重构**

```bash
git add src/components/Settings/EngineSettingsPanel.tsx
git commit -m "refactor: simplify engine settings panel"
```

## Task 4: 重构服务商设置面板

**Files:**
- Modify: `src/components/Settings/ProvidersSettingsPanel.tsx`

- [ ] **Step 1: 将顶部工具条改为中性实底工具栏**

Replace the current highlighted intro bar in `ProvidersSettingsPanel`:

```tsx
<div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3">
  <div>
    <h3 className="text-sm font-semibold text-text-primary">模型服务商</h3>
    <p className="mt-1 text-xs text-text-secondary">管理端点、协议类型与密钥。</p>
  </div>
```

Keep the add button as the only primary action.

- [ ] **Step 2: 将新增服务商草稿区改为标准表单分组**

Replace the highlighted draft block with a neutral form section:

```tsx
<div className="rounded-xl border border-border bg-background px-4 py-4">
```

Use compact spacing and keep the existing fields: `name`, `kind`, `baseUrl`, `apiKey`.

- [ ] **Step 3: 将空状态改为简洁说明块**

Replace dashed translucent empty state with a regular panel:

```tsx
<div className="rounded-xl border border-border bg-background px-4 py-5">
  <div className="text-sm font-medium text-text-primary">还没有服务商</div>
  <p className="mt-1 text-sm text-text-secondary">新增一个服务商后，即可在引擎设置中选择并拉取模型。</p>
</div>
```

- [ ] **Step 4: 将单个服务商编辑块统一为实底编辑区**

Update each provider card:

```tsx
<div key={provider.id} className="rounded-xl border border-border bg-background px-4 py-4">
```

Update the kind badge to a neutral tag:

```tsx
<span className="rounded-md border border-border bg-background-elevated px-2 py-0.5 text-xs text-text-secondary">
```

Change delete button hover to border/text emphasis only; remove `bg-danger/5` translucent fill.

- [ ] **Step 5: 运行构建验证服务商面板**

Run:

```bash
npm run build
```

Expected: no new syntax/type errors from `ProvidersSettingsPanel.tsx`.

- [ ] **Step 6: 提交服务商面板重构**

```bash
git add src/components/Settings/ProvidersSettingsPanel.tsx
git commit -m "refactor: simplify provider settings panel"
```

## Task 5: 重构悬浮窗与关于面板

**Files:**
- Modify: `src/components/Settings/FloatingWindowSettingsPanel.tsx`
- Modify: `src/components/Settings/AboutSettingsPanel.tsx`

- [ ] **Step 1: 将悬浮窗面板统一到标准分组语言**

In `FloatingWindowSettingsPanel.tsx`, keep the top enable toggle, but restyle the mode group:

```tsx
<section className="space-y-4 rounded-xl border border-border bg-background px-4 py-4">
```

Use the updated `SettingsCardOption` for mode choices and keep the dirty badge inline with the heading.

- [ ] **Step 2: 将自动模式延迟区块改为普通设置分组**

Replace the emphasized delay block with:

```tsx
<div className="rounded-xl border border-border bg-background-elevated px-4 py-4">
```

Keep the range input and ms label logic unchanged.

- [ ] **Step 3: 将关于面板收敛为最简信息块**

Update `AboutSettingsPanel.tsx` so both cards use the same neutral surface:

```tsx
<div className="rounded-xl border border-border bg-background px-5 py-4">
  <h4 className="text-sm font-semibold text-text-primary">应用信息</h4>
```

If desired, add a short description line but do not introduce new business data dependencies.

- [ ] **Step 4: 运行构建验证剩余面板**

Run:

```bash
npm run build
```

Expected: no new syntax/type errors from `FloatingWindowSettingsPanel.tsx` or `AboutSettingsPanel.tsx`.

- [ ] **Step 5: 提交悬浮窗与关于面板重构**

```bash
git add src/components/Settings/FloatingWindowSettingsPanel.tsx src/components/Settings/AboutSettingsPanel.tsx
git commit -m "refactor: align floating and about panels"
```

## Task 6: 最终整体验证

**Files:**
- Verify: `package.json`
- Verify: all modified settings files

- [ ] **Step 1: 检查可用脚本命令**

Read `package.json` and identify available verification commands. Prefer the smallest relevant commands first, but include build at minimum.

- [ ] **Step 2: 运行最终构建**

Run:

```bash
npm run build
```

Expected: successful production build.

- [ ] **Step 3: 若项目存在 lint 或类型检查命令则一并执行**

Run only if available in `package.json`:

```bash
npm run lint
npm run typecheck
```

Expected: pass, or record pre-existing unrelated failures explicitly before merge.

- [ ] **Step 4: 进行人工回归检查**

Manually verify inside the app:
- 设置弹窗能正常打开关闭
- 左侧分类导航切换正常
- 无透明主视觉块
- 引擎设置、服务商、悬浮窗、关于四个分区风格一致
- 新增服务商、删除服务商、保存配置可正常工作
- 未保存状态、保存成功、错误状态展示符合新规范

- [ ] **Step 5: 提交最终整理**

```bash
git add src/components/Settings/SettingsModal.tsx src/components/Settings/SettingsContent.tsx src/components/Settings/EngineSettingsPanel.tsx src/components/Settings/ProvidersSettingsPanel.tsx src/components/Settings/FloatingWindowSettingsPanel.tsx src/components/Settings/AboutSettingsPanel.tsx src/components/Settings/SettingsCardOption.tsx src/components/Settings/SettingsToggle.tsx src/components/Settings/DirtyBadge.tsx
git commit -m "refactor: rebuild settings experience"
```
