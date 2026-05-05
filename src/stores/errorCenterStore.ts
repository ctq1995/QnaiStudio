import { create } from 'zustand';

export type AppErrorScope = 'chat' | 'workspace' | 'editor' | 'versioning' | 'engine' | 'system';
export type AppErrorLevel = 'error' | 'warning';

export interface AppErrorItem {
  id: string;
  scope: AppErrorScope;
  title: string;
  message: string;
  timestamp: string;
  level: AppErrorLevel;
  source?: string;
}

interface ErrorCenterState {
  errors: AppErrorItem[];
  isOpen: boolean;
  pushError: (error: Omit<AppErrorItem, 'id' | 'timestamp'> & Partial<Pick<AppErrorItem, 'id' | 'timestamp'>>) => string;
  removeError: (id: string) => void;
  clearErrors: () => void;
  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
}

function createErrorId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `error-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const useErrorCenterStore = create<ErrorCenterState>((set) => ({
  errors: [],
  isOpen: false,

  pushError: (error) => {
    const id = error.id ?? createErrorId();
    const nextError: AppErrorItem = {
      id,
      scope: error.scope,
      title: error.title,
      message: error.message,
      level: error.level,
      source: error.source,
      timestamp: error.timestamp ?? new Date().toISOString(),
    };

    set((state) => ({
      errors: [nextError, ...state.errors],
    }));

    return id;
  },

  removeError: (id) => {
    set((state) => ({
      errors: state.errors.filter((error) => error.id !== id),
    }));
  },

  clearErrors: () => {
    set({ errors: [] });
  },

  toggleOpen: () => {
    set((state) => ({ isOpen: !state.isOpen }));
  },

  setOpen: (open) => {
    set({ isOpen: open });
  },
}));
