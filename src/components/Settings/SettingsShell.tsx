import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { toast, Toaster } from 'sonner';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SETTINGS_SECTIONS, type SettingsSectionId } from './settingsOptions';
import { EngineSettingsPanel } from './EngineSettingsPanel';
import { ProvidersSettingsPanel } from './ProvidersSettingsPanel';
import { AppearanceSettingsPanel } from './AppearanceSettingsPanel';
import { GeneralSettingsPanel } from './GeneralSettingsPanel';
import { AboutSettingsPanel } from './AboutSettingsPanel';
import type { Config, EngineId, ProviderKind, ModelProviderConfig, ClaudeAdvancedParams, CodexAdvancedParams, GeminiAdvancedParams } from '../../types';

interface SettingsShellProps {
  config: Config;
  savedConfig: Config;
  loading: boolean;
  error: string | null;
  hasUnsavedChanges: boolean;
  saveFeedback: { status: string; message: string | null };
  onClose: () => void;
  onSave: () => void;
  onEngineChange: (engineId: EngineId) => void;
  onClaudePathChange: (path: string) => void;
  onIFlowPathChange: (path: string) => void;
  onCodexPathChange: (path: string) => void;
  onGeminiPathChange: (path: string) => void;
  onEngineParamChange: (engineId: EngineId, key: string, value: string) => void;
  onClaudeAdvancedChange: <K extends keyof ClaudeAdvancedParams>(key: K, value: ClaudeAdvancedParams[K]) => void;
  onCodexAdvancedChange: <K extends keyof CodexAdvancedParams>(key: K, value: CodexAdvancedParams[K]) => void;
  onGeminiAdvancedChange: <K extends keyof GeminiAdvancedParams>(key: K, value: GeminiAdvancedParams[K]) => void;
  providerDraft: { name: string; kind: ProviderKind; baseUrl: string; apiKey: string } | null;
  onStartProviderDraft: () => void;
  onUpdateProviderDraft: <K extends keyof { name: string; kind: ProviderKind; baseUrl: string; apiKey: string }>(key: K, value: any) => void;
  onCancelProviderDraft: () => void;
  onSubmitProviderDraft: () => void;
  onUpdateProvider: <K extends keyof ModelProviderConfig>(providerId: string, key: K, value: ModelProviderConfig[K]) => void;
  onRemoveProvider: (providerId: string) => void;
  onFloatingChange: <K extends keyof Config['floatingWindow']>(key: K, value: Config['floatingWindow'][K]) => void;
  onThemeChange: (theme: 'dark' | 'light') => void;
  theme: 'dark' | 'light';
}

function NavItem({
  section,
  active,
  onClick,
}: {
  section: (typeof SETTINGS_SECTIONS)[number];
  active: boolean;
  onClick: () => void;
}) {
  const Icon = section.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
        active
          ? 'bg-background-hover text-text-primary font-medium'
          : 'text-text-tertiary hover:bg-background-hover hover:text-text-primary'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{section.name}</span>
    </button>
  );
}

export function SettingsShell(props: SettingsShellProps) {
  const {
    onClose,
    onSave,
    loading,
    hasUnsavedChanges,
    saveFeedback,
    config,
    savedConfig,
    error,
  } = props;

  const [activeSection, setActiveSection] = useState<SettingsSectionId>('engine');
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Toast notifications for save feedback / errors — no layout shift
  useEffect(() => {
    if (saveFeedback.status === 'success' && saveFeedback.message) {
      toast.success(saveFeedback.message);
    }
  }, [saveFeedback.status, saveFeedback.message]);

  useEffect(() => {
    if (saveFeedback.status === 'error' && saveFeedback.message) {
      toast.error(saveFeedback.message);
    }
  }, [saveFeedback.status, saveFeedback.message]);

  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const handleRequestClose = () => {
    if (hasUnsavedChanges) {
      setShowCloseConfirm(true);
      return;
    }
    onClose();
  };

  const handleConfirmClose = () => {
    setShowCloseConfirm(false);
    onClose();
  };

  const activeMeta = SETTINGS_SECTIONS.find((s) => s.id === activeSection);

  const renderPanel = () => {
    switch (activeSection) {
      case 'engine':
        return (
          <EngineSettingsPanel
            config={config}
            savedConfig={savedConfig}
            loading={loading}
            onEngineChange={props.onEngineChange}
            onClaudePathChange={props.onClaudePathChange}
            onIFlowPathChange={props.onIFlowPathChange}
            onCodexPathChange={props.onCodexPathChange}
            onGeminiPathChange={props.onGeminiPathChange}
            onEngineParamChange={props.onEngineParamChange}
            onClaudeAdvancedChange={props.onClaudeAdvancedChange}
            onCodexAdvancedChange={props.onCodexAdvancedChange}
            onGeminiAdvancedChange={props.onGeminiAdvancedChange}
          />
        );
      case 'providers':
        return (
          <ProvidersSettingsPanel
            config={config}
            savedConfig={savedConfig}
            providerDraft={props.providerDraft}
            onStartProviderDraft={props.onStartProviderDraft}
            onUpdateProviderDraft={props.onUpdateProviderDraft}
            onCancelProviderDraft={props.onCancelProviderDraft}
            onSubmitProviderDraft={props.onSubmitProviderDraft}
            onUpdateProvider={props.onUpdateProvider}
            onRemoveProvider={props.onRemoveProvider}
          />
        );
      case 'appearance':
        return (
          <AppearanceSettingsPanel
            theme={props.theme}
            onThemeChange={props.onThemeChange}
          />
        );
      case 'floating':
        return (
          <GeneralSettingsPanel
            config={config}
            savedConfig={savedConfig}
            onEnabledChange={(enabled) => props.onFloatingChange('enabled', enabled)}
            onModeChange={(mode) => props.onFloatingChange('mode', mode)}
            onExpandOnHoverChange={(expand) => props.onFloatingChange('expandOnHover', expand)}
            onCollapseDelayChange={(delay) => props.onFloatingChange('collapseDelay', delay)}
          />
        );
      case 'about':
        return <AboutSettingsPanel />;
      default:
        return null;
    }
  };

  const sidebarContent = (
    <nav className="flex flex-col gap-0.5 px-2">
      {SETTINGS_SECTIONS.map((section) => (
        <NavItem
          key={section.id}
          section={section}
          active={activeSection === section.id}
          onClick={() => {
            setActiveSection(section.id);
            setMobileNavOpen(false);
          }}
        />
      ))}
    </nav>
  );

  return (
    <div className="flex h-screen flex-col bg-background-base">
      <Toaster position="top-center" richColors closeButton duration={3000} />
      {/* Header */}
      <header className="flex items-center justify-between border-b border-border-default px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Mobile nav trigger */}
          <div className="md:hidden">
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm">
                  <span className="text-xs">菜单</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-56 p-4">
                <SheetHeader>
                  <SheetTitle>设置</SheetTitle>
                </SheetHeader>
                <div className="mt-4">{sidebarContent}</div>
              </SheetContent>
            </Sheet>
          </div>
          <Button variant="ghost" size="sm" onClick={handleRequestClose}>
            <ArrowLeft className="h-4 w-4" />
            <span>返回</span>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <Badge variant="warning">未保存</Badge>
          )}
          <Button
            size="sm"
            onClick={onSave}
            disabled={loading || !hasUnsavedChanges}
          >
            {saveFeedback.status === 'saving' ? '保存中...' : '保存设置'}
          </Button>
        </div>
      </header>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden w-56 shrink-0 flex-col border-r border-border-default bg-background-elevated p-3 md:flex">
          <div className="mb-2 px-3 pt-1 text-[11px] font-medium uppercase tracking-widest text-text-muted">
            设置
          </div>
          {sidebarContent}
          <div className="mt-auto rounded-lg border border-border-default bg-background-surface px-3 py-2.5">
            <div className="text-xs font-medium text-text-secondary">提示</div>
            <div className="mt-1 text-[11px] leading-4 text-text-muted">
              修改后点击右上角保存。
            </div>
          </div>
        </aside>

        {/* Content */}
        <main className="min-h-0 flex-1">
          <ScrollArea className="h-full">
            <div className="mx-auto max-w-2xl px-6 py-5">
              {activeMeta && (
                <div className="mb-5">
                  <h1 className="text-lg font-semibold text-text-primary">
                    {activeMeta.name}
                  </h1>
                  <p className="mt-1 text-sm text-text-muted">
                    {activeMeta.description}
                  </p>
                </div>
              )}
              {renderPanel()}
            </div>
          </ScrollArea>
        </main>
      </div>

      {/* Unsaved close confirm */}
      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>放弃未保存的更改？</AlertDialogTitle>
            <AlertDialogDescription>
              当前有已编辑但未保存的配置。关闭后将丢失这些更改。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>继续编辑</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmClose}
              className="bg-danger hover:bg-danger-hover text-white"
            >
              放弃更改并关闭
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
