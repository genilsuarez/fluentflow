/**
 * Theme Initializer — applies theme before React renders (prevents FOUC).
 */

import {
  THEME_COLORS,
  THEME_CLASSES,
  THEME_CSS_VARS,
  THEME_SELECTORS,
  type ThemeMode,
} from './themeConstants';
import {
  isMobileDevice,
  applyMobileTheme,
  initializeMobileTheme,
  emergencyLightModeFix,
  isSafariMobile,
} from './mobileThemeFix';

interface ThemeState {
  theme: ThemeMode;
  isSystemPreference: boolean;
}

function readThemeFromUrl(): ThemeMode | null {
  if (typeof window === 'undefined') return null;
  const urlTheme = new URLSearchParams(window.location.search).get('theme');
  if (urlTheme === 'dark' || urlTheme === 'light') {
    try {
      localStorage.setItem('lp-theme', urlTheme);
    } catch {
      /* noop */
    }
    return urlTheme;
  }
  return null;
}

/**
 * Gets the stored theme preference or falls back to light mode.
 * Priority: ?theme= → lp-theme → settings-storage → light
 */
function getInitialTheme(): ThemeState {
  if (typeof window === 'undefined') {
    return { theme: 'light', isSystemPreference: false };
  }

  const urlTheme = readThemeFromUrl();
  if (urlTheme) {
    return { theme: urlTheme, isSystemPreference: false };
  }

  try {
    const sharedTheme = localStorage.getItem('lp-theme') as ThemeMode | null;
    const storedSettings = localStorage.getItem('settings-storage');

    if (storedSettings) {
      const parsed = JSON.parse(storedSettings);
      const storeTheme = parsed?.state?.theme as ThemeMode | undefined;

      if (sharedTheme && (sharedTheme === 'dark' || sharedTheme === 'light')) {
        return { theme: sharedTheme, isSystemPreference: false };
      }

      if (storeTheme) {
        try {
          localStorage.setItem('lp-theme', storeTheme);
        } catch {
          /* noop */
        }
        return { theme: storeTheme, isSystemPreference: false };
      }
    }

    if (sharedTheme === 'dark' || sharedTheme === 'light') {
      return { theme: sharedTheme, isSystemPreference: false };
    }
  } catch (error) {
    console.warn('Failed to parse stored theme preference:', error);
  }

  return { theme: 'light', isSystemPreference: false };
}

/** Sync ?theme= query param when present (cross-app local dev). */
export function syncThemeUrlParam(theme: ThemeMode): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has('theme')) return;
  url.searchParams.set('theme', theme);
  window.history.replaceState(null, '', url.toString());
}

function updateMetaThemeColor(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;

  const metaThemeColor = document.querySelector(THEME_SELECTORS.metaThemeColor);
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', THEME_COLORS[theme].metaThemeColor);
  }

  const metaColorScheme = document.querySelector('meta[name="color-scheme"]');
  if (metaColorScheme) {
    metaColorScheme.setAttribute('content', theme);
  }

  document.documentElement.style.colorScheme = theme;
}

function forceThemeRerender(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  root.style.setProperty(THEME_CSS_VARS.themeForceUpdate, theme === 'dark' ? '1' : '0');

  requestAnimationFrame(() => {
    document.querySelectorAll(THEME_SELECTORS.inlineColorElements).forEach(element => {
      const htmlElement = element as HTMLElement;
      const style = htmlElement.getAttribute('style');
      if (!style) return;

      const cleanedStyle = style
        .split(';')
        .filter(rule => {
          const trimmed = rule.trim();
          return (
            !trimmed.startsWith('color:') &&
            !trimmed.startsWith('stroke:') &&
            !trimmed.startsWith('fill:')
          );
        })
        .join(';');

      if (cleanedStyle !== style) {
        if (cleanedStyle.trim()) {
          htmlElement.setAttribute('style', cleanedStyle);
        } else {
          htmlElement.removeAttribute('style');
        }
      }
    });

    document.querySelectorAll(THEME_SELECTORS.themeComponents).forEach(element => {
      element.classList.add(THEME_CLASSES.themeComponent);
    });
  });
}

/**
 * Applies theme to DOM immediately (before or during React lifecycle).
 */
export function applyThemeToDOM(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;

  const htmlElement = document.documentElement;

  if (theme === 'dark') {
    htmlElement.classList.add(THEME_CLASSES.dark);
    htmlElement.classList.remove(THEME_CLASSES.light);
  } else {
    htmlElement.classList.remove(THEME_CLASSES.dark);
    htmlElement.classList.add(THEME_CLASSES.light);
  }

  updateMetaThemeColor(theme);

  if (isMobileDevice()) {
    if (isSafariMobile() && theme === 'light') {
      emergencyLightModeFix();
    } else {
      applyMobileTheme(theme);
    }
  } else {
    forceThemeRerender(theme);
  }
}

export function setupSystemThemeListener(callback: (theme: ThemeMode) => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return () => {};
  }

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const handleChange = (e: MediaQueryListEvent) => {
    callback(e.matches ? 'dark' : 'light');
  };

  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }

  if (mediaQuery.addListener) {
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }

  return () => {};
}

export function initializeTheme(): ThemeState {
  const themeState = getInitialTheme();
  applyThemeToDOM(themeState.theme);

  if (isMobileDevice()) {
    initializeMobileTheme();
  }

  return themeState;
}
