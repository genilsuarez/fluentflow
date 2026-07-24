/**
 * Mobile Theme Fix — lightweight Safari/mobile helpers.
 * Uses color-scheme + meta tags + LP tokens. No global inherit overrides.
 */

import { THEME_COLORS, THEME_CLASSES, THEME_SELECTORS, type ThemeMode } from './themeConstants';
import { logDebug } from './logger';

/** Mobile user agent only — not viewport width. */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/** Narrow viewport — layout only, not theme path selection. */
export function isNarrowViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerWidth <= 767;
}

/** Touch-primary device — reliable on iPhone Chrome (CriOS) and Android. */
export function isTouchPrimaryDevice(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}

/**
 * Adds `lp-touch` on <html> so CSS can target touch phones even when
 * width-only breakpoints miss (desktop site mode, odd viewport reporting).
 */
export function initializeMobileLayout(): void {
  if (typeof document === 'undefined') return;

  const apply = () => {
    const touch = isTouchPrimaryDevice() || isMobileDevice();
    document.documentElement.classList.toggle('lp-touch', touch);
  };

  apply();

  if (typeof window !== 'undefined' && window.matchMedia) {
    const mq = window.matchMedia('(hover: none) and (pointer: coarse)');
    const onChange = () => apply();
    try {
      mq.addEventListener('change', onChange);
    } catch {
      mq.addListener(onChange);
    }
  }
}

export function isSafariMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return (
    /Safari/.test(ua) &&
    /Mobile/.test(ua) &&
    !/Chrome/.test(ua) &&
    !/CriOS/.test(ua) &&
    !/FxiOS/.test(ua)
  );
}

function clearThemeInlineColorStyles(): void {
  if (typeof document === 'undefined') return;

  document.querySelectorAll(THEME_SELECTORS.inlineColorElements).forEach(element => {
    const htmlElement = element as HTMLElement;
    const style = htmlElement.getAttribute('style');
    if (!style) return;

    const cleanedStyle = style
      .split(';')
      .filter(rule => {
        const trimmed = rule.trim().toLowerCase();
        return (
          !trimmed.startsWith('color:') &&
          !trimmed.startsWith('background-color:') &&
          !trimmed.startsWith('stroke:') &&
          !trimmed.startsWith('fill:') &&
          !trimmed.startsWith('border-color:')
        );
      })
      .join(';');

    if (cleanedStyle.trim()) {
      htmlElement.setAttribute('style', cleanedStyle);
    } else {
      htmlElement.removeAttribute('style');
    }
  });
}

function updateMetaTags(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;

  const tokens = THEME_COLORS[theme];

  const metaThemeColor = document.querySelector(THEME_SELECTORS.metaThemeColor);
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', tokens.metaThemeColor);
  }

  const metaColorScheme = document.querySelector('meta[name="color-scheme"]');
  if (metaColorScheme) {
    metaColorScheme.setAttribute('content', theme);
  }

  const metaStatusBar = document.querySelector(
    'meta[name="apple-mobile-web-app-status-bar-style"]'
  );
  if (metaStatusBar) {
    metaStatusBar.setAttribute('content', theme === 'dark' ? 'black-translucent' : 'default');
  }
}

function removeLegacySafariOverrides(): void {
  document.getElementById('safari-theme-override')?.remove();
  document.getElementById('safari-light-override')?.remove();
}

/**
 * Safari iOS: keep native UI chrome aligned with app theme when system preference differs.
 * Scoped to html/body only — never cascades color:inherit to descendants.
 */
function injectSafariColorSchemeFix(theme: ThemeMode): void {
  if (!isSafariMobile()) return;

  removeLegacySafariOverrides();

  let styleEl = document.getElementById('safari-color-scheme-fix');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'safari-color-scheme-fix';
    document.head.appendChild(styleEl);
  }

  const tokens = THEME_COLORS[theme];
  const opposite = theme === 'light' ? 'dark' : 'light';

  styleEl.textContent = `
    html.${theme} {
      color-scheme: ${theme} !important;
      -webkit-color-scheme: ${theme} !important;
    }

    @media (prefers-color-scheme: ${opposite}) {
      html.${theme} body {
        background-color: ${tokens.bgPrimary};
        color: ${tokens.textPrimary};
      }
    }
  `;
}

/**
 * Applies theme helpers for mobile user agents.
 */
export function applyMobileTheme(theme: ThemeMode): void {
  if (!isMobileDevice()) return;

  const html = document.documentElement;
  html.classList.remove(THEME_CLASSES.light, THEME_CLASSES.dark);
  html.classList.add(theme === 'dark' ? THEME_CLASSES.dark : THEME_CLASSES.light);
  html.style.colorScheme = theme;

  clearThemeInlineColorStyles();
  updateMetaTags(theme);
  injectSafariColorSchemeFix(theme);

  html.style.setProperty('--mobile-theme-update', Date.now().toString());
}

/** Safari light-mode helper — re-applies mobile theme stack. */
export function emergencyLightModeFix(): void {
  if (!isSafariMobile()) return;
  logDebug('Applying Safari light mode color-scheme fix', undefined, 'mobileThemeFix');
  applyMobileTheme('light');
}

function setupMobileThemeHandlers(): void {
  if (!isMobileDevice()) return;

  const reapply = () => {
    const current = document.documentElement.classList.contains(THEME_CLASSES.dark)
      ? 'dark'
      : 'light';
    applyMobileTheme(current as ThemeMode);
  };

  window.addEventListener('orientationchange', () => setTimeout(reapply, 100));

  let resizeTimer: ReturnType<typeof setTimeout>;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(reapply, 150);
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) setTimeout(reapply, 100);
  });

  if (isSafariMobile() && window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = () => setTimeout(reapply, 50);
    try {
      mq.addEventListener('change', onSystemChange);
    } catch {
      mq.addListener(onSystemChange);
    }
  }
}

export function initializeMobileTheme(): void {
  if (!isMobileDevice()) return;

  setupMobileThemeHandlers();

  const current = document.documentElement.classList.contains(THEME_CLASSES.dark)
    ? 'dark'
    : 'light';
  applyMobileTheme(current as ThemeMode);
}
