/**
 * Theme Constants — aligned with tokens.css (--lp-* palette)
 * Used for JS operations that need literal color values (meta tags, Safari fixes).
 */

export const THEME_COLORS = {
  light: {
    metaThemeColor: '#fcfbf9',
    bgPrimary: '#fcfbf9',
    bgSecondary: '#f7f6f3',
    textPrimary: '#2c2418',
    textSecondary: '#574a3c',
    borderPrimary: '#e7e3dc',
    iconColor: 'currentColor',
  },
  dark: {
    metaThemeColor: '#181b20',
    bgPrimary: '#181b20',
    bgSecondary: '#252930',
    textPrimary: '#e8eaed',
    textSecondary: '#a8b0bc',
    borderPrimary: '#353b45',
    iconColor: 'currentColor',
  },
} as const;

export const THEME_CLASSES = {
  light: 'light',
  dark: 'dark',
  themeComponent: 'theme-component',
  themeIcon: 'theme-icon',
  themeTransition: 'theme-transition',
  headerRedesigned: 'header-redesigned',
  headerSideMenu: 'header-side-menu',
  moduleCard: 'module-card',
  navBtn: 'nav-btn',
  modal: 'modal',
  toastCard: 'toast-card',
} as const;

export const THEME_CSS_VARS = {
  themeMode: '--theme-mode',
  themeForceUpdate: '--theme-force-update',
  themeBgPrimary: '--theme-bg-primary',
  themeBgSecondary: '--theme-bg-secondary',
  themeTextPrimary: '--theme-text-primary',
  themeTextSecondary: '--theme-text-secondary',
  themeBorderPrimary: '--theme-border-primary',
  themeIconColor: '--theme-icon-color',
  themeTransitionDuration: '--theme-transition-duration',
  themeTransitionEasing: '--theme-transition-easing',
} as const;

export const THEME_SELECTORS = {
  inlineColorElements: '[style*="color"], [style*="stroke"], [style*="fill"]',
  svgElements:
    '.header-redesigned svg, .header-side-menu svg, .module-card svg, .nav-btn svg, [data-lucide]',
  themeComponents:
    '.header-redesigned, .header-side-menu, .module-card, .nav-btn, .modal, .toast-card',
  metaThemeColor: 'meta[name="theme-color"]',
} as const;

export type ThemeMode = 'light' | 'dark';
