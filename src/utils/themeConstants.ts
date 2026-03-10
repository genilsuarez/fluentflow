/**
 * Theme Constants - Design System Color Tokens
 * Centralized color values that match the CSS custom properties
 * Used for JavaScript operations that need actual color values
 */

export const THEME_COLORS = {
  light: {
    metaThemeColor: '#ffffff',
    bgPrimary: '#f9fafb',
    bgSecondary: '#ffffff',
    textPrimary: '#111827',
    textSecondary: '#374151',
    borderPrimary: '#e5e7eb',
    iconColor: 'currentColor',
  },
  dark: {
    metaThemeColor: '#1f2937',
    bgPrimary: '#111827',
    bgSecondary: '#1f2937',
    textPrimary: '#ffffff',
    textSecondary: '#e5e7eb',
    borderPrimary: '#4b5563',
    iconColor: '#ffffff',
  },
} as const;

/**
 * BEM-like class names for theme-aware components
 */
export const THEME_CLASSES = {
  // Base theme classes
  light: 'light',
  dark: 'dark',

  // Component classes that need theme awareness
  themeComponent: 'theme-component',
  themeIcon: 'theme-icon',
  themeTransition: 'theme-transition',

  // Specific component selectors
  headerRedesigned: 'header-redesigned',
  headerSideMenu: 'header-side-menu',
  moduleCard: 'module-card',
  navBtn: 'nav-btn',
  modal: 'modal',
  toastCard: 'toast-card',
} as const;

/**
 * CSS custom property names used in the theme system
 */
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

/**
 * Selectors for elements that need theme fixes
 */
export const THEME_SELECTORS = {
  // Elements with inline styles that need cleaning
  inlineColorElements: '[style*="color"], [style*="stroke"], [style*="fill"]',

  // SVG elements that need theme awareness
  svgElements:
    '.header-redesigned svg, .header-side-menu svg, .module-card svg, .nav-btn svg, [data-lucide]',

  // Components that need theme-component class
  themeComponents:
    '.header-redesigned, .header-side-menu, .module-card, .nav-btn, .modal, .toast-card',

  // Meta tag for theme color
  metaThemeColor: 'meta[name="theme-color"]',
} as const;

export type ThemeMode = 'light' | 'dark';
