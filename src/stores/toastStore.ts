import { useState, useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastData {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  priority?: 'low' | 'normal' | 'high';
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastStore {
  currentToast: ToastData | null;
  isVisible: boolean;
  showToast: (toast: Omit<ToastData, 'id'>) => void;
  clearToast: () => void;
  clearOnNavigation: () => void;
  showWelcomeOnce: (moduleCount: number) => void;
  hasShownWelcome: () => boolean;
}

// Global state for single toast system
const globalState = {
  currentToast: null as ToastData | null,
  isVisible: false,
  listeners: new Set<() => void>(),
};

// Safe localStorage utilities
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null; // Fallback graceful
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Fail silently, no toast persistence
    }
  },
};

// Generate unique ID for toasts
const generateId = (): string => {
  return `toast-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};

// Notify all listeners of state changes
const notifyListeners = (): void => {
  globalState.listeners.forEach(listener => {
    try {
      listener();
    } catch (e) {
      console.warn('Toast listener error:', e);
    }
  });
};

// Store implementation
const toastStore = {
  getState() {
    return globalState;
  },

  setState(newState: Partial<typeof globalState>) {
    Object.assign(globalState, newState);
    notifyListeners();
  },

  subscribe(listener: () => void) {
    globalState.listeners.add(listener);
    return () => {
      globalState.listeners.delete(listener);
    };
  },

  // Show single toast (replaces any existing toast immediately)
  showToast(toast: Omit<ToastData, 'id'>) {
    const newToast: ToastData = {
      id: generateId(),
      duration: 4000,
      priority: 'normal',
      ...toast,
    };

    // Always clear existing toast first (single toast system)
    this.setState({
      currentToast: newToast,
      isVisible: true,
    });

    // Auto-remove toast after duration
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        // Only remove if this is still the current toast
        if (globalState.currentToast?.id === newToast.id) {
          this.clearToast();
        }
      }, newToast.duration);
    }
  },

  // Clear current toast immediately
  clearToast() {
    this.setState({
      currentToast: null,
      isVisible: false,
    });
  },

  // Clear toasts on navigation (immediate, no delays)
  clearOnNavigation() {
    this.setState({
      currentToast: null,
      isVisible: false,
    });
  },

  // Show welcome toast only once using localStorage
  showWelcomeOnce(moduleCount: number) {
    const hasShown = safeLocalStorage.getItem('welcome-toast-shown');

    if (!hasShown) {
      this.showToast({
        type: 'success',
        title: 'Bienvenido',
        message: `${moduleCount} módulos disponibles para aprender`,
        duration: 5000,
        priority: 'high',
      });

      safeLocalStorage.setItem('welcome-toast-shown', 'true');
    }
  },

  // Check if welcome toast has been shown
  hasShownWelcome() {
    return safeLocalStorage.getItem('welcome-toast-shown') === 'true';
  },

  // Debug function to check welcome toast status
  debugWelcomeToast() {
    const value = safeLocalStorage.getItem('welcome-toast-shown');
    return value;
  },

  // Force reset welcome toast (for testing)
  resetWelcomeToast() {
    try {
      localStorage.removeItem('welcome-toast-shown');
    } catch (e) {
      console.warn('Could not reset welcome toast:', e);
    }
  },
};

// React hook for using toast store
export const useToastStore = (): ToastStore => {
  const [state, setState] = useState(() => toastStore.getState());

  useEffect(() => {
    const unsubscribe = toastStore.subscribe(() => {
      const newState = toastStore.getState();
      setState(newState);
    });

    return unsubscribe;
  }, []);

  return {
    ...state,
    showToast: toastStore.showToast.bind(toastStore),
    clearToast: toastStore.clearToast.bind(toastStore),
    clearOnNavigation: toastStore.clearOnNavigation.bind(toastStore),
    showWelcomeOnce: toastStore.showWelcomeOnce.bind(toastStore),
    hasShownWelcome: toastStore.hasShownWelcome.bind(toastStore),
  };
};

// Toast utility functions (NO DELAYS - immediate execution)
export const toast = {
  success(title: string, message?: string, options?: Partial<ToastData>) {
    try {
      toastStore.showToast({ type: 'success', title, message, ...options });
    } catch (e) {
      console.warn('Toast not ready:', e);
    }
  },

  error(title: string, message?: string, options?: Partial<ToastData>) {
    try {
      toastStore.showToast({ type: 'error', title, message, duration: 6000, ...options });
    } catch (e) {
      console.warn('Toast not ready:', e);
    }
  },

  warning(title: string, message?: string, options?: Partial<ToastData>) {
    try {
      toastStore.showToast({ type: 'warning', title, message, ...options });
    } catch (e) {
      console.warn('Toast not ready:', e);
    }
  },

  info(title: string, message?: string, options?: Partial<ToastData>) {
    try {
      toastStore.showToast({ type: 'info', title, message, ...options });
    } catch (e) {
      console.warn('Toast not ready:', e);
    }
  },

  // Clear current toast
  clear() {
    try {
      toastStore.clearToast();
    } catch (e) {
      console.warn('Toast not ready:', e);
    }
  },

  // Clear on navigation
  clearOnNavigation() {
    try {
      toastStore.clearOnNavigation();
    } catch (e) {
      console.warn('Toast not ready:', e);
    }
  },

  // Show welcome toast once
  welcomeOnce(moduleCount: number) {
    try {
      toastStore.showWelcomeOnce(moduleCount);
    } catch (e) {
      console.warn('Toast not ready:', e);
    }
  },

  // Debug functions
  debug() {
    return toastStore.debugWelcomeToast();
  },

  resetWelcome() {
    return toastStore.resetWelcomeToast();
  },

  // Single toast functions (replaces any existing toast)
  single: {
    success(title: string, message?: string, options?: Partial<ToastData>) {
      try {
        toastStore.showToast({ type: 'success', title, message, ...options });
      } catch (e) {
        console.warn('Toast not ready:', e);
      }
    },

    error(title: string, message?: string, options?: Partial<ToastData>) {
      try {
        toastStore.showToast({ type: 'error', title, message, duration: 6000, ...options });
      } catch (e) {
        console.warn('Toast not ready:', e);
      }
    },

    warning(title: string, message?: string, options?: Partial<ToastData>) {
      try {
        toastStore.showToast({ type: 'warning', title, message, ...options });
      } catch (e) {
        console.warn('Toast not ready:', e);
      }
    },

    info(title: string, message?: string, options?: Partial<ToastData>) {
      try {
        toastStore.showToast({ type: 'info', title, message, ...options });
      } catch (e) {
        console.warn('Toast not ready:', e);
      }
    },
  },
};

// Make debug functions available globally for testing
if (typeof window !== 'undefined') {
  (window as any).toastDebug = {
    check: () => toast.debug(),
    reset: () => toast.resetWelcome(),
    status: () => {
      const value = safeLocalStorage.getItem('welcome-toast-shown');
      return {
        stored: value,
        hasShown: value === 'true',
        willShow: !value || value !== 'true',
      };
    },
  };
}
