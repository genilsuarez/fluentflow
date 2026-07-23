import type { ThemeMode } from './themeConstants';

const APP_PATH_RE = /^\/(deskflow|fluentflow|hubflow|lyricflow)(\/|$)/;

export function isLocalPlatformHost(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    location.hostname.startsWith('192.168.')
  );
}

function getCurrentTheme(): ThemeMode {
  if (typeof document === 'undefined') return 'light';
  try {
    const saved = localStorage.getItem('lp-theme');
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    /* noop */
  }
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function isCrossAppHref(href: string | null): boolean {
  if (!href || href.startsWith('#')) return false;
  try {
    const url = new URL(href, location.origin);
    const host = url.hostname;
    const isLocalHost =
      host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.');
    if (!isLocalHost) return false;
    if (url.port && url.port !== location.port) return true;
    return APP_PATH_RE.test(url.pathname);
  } catch {
    return false;
  }
}

export function appendThemeToLocalHref(href: string): string {
  if (!isLocalPlatformHost()) return href;
  try {
    const url = new URL(href, location.origin);
    url.searchParams.set('theme', getCurrentTheme());
    return url.toString();
  } catch {
    return href;
  }
}

/** Delegated click handler — propagates ?theme= on cross-app links in local dev. */
export function setupCrossAppThemeLinks(): void {
  if (!isLocalPlatformHost()) return;

  document.addEventListener('click', event => {
    const anchor = (event.target as Element | null)?.closest('a[href]');
    if (!(anchor instanceof HTMLAnchorElement)) return;
    const raw = anchor.getAttribute('href');
    if (!isCrossAppHref(raw)) return;
    try {
      const url = new URL(raw!, location.origin);
      url.searchParams.set('theme', getCurrentTheme());
      anchor.href = url.toString();
    } catch {
      /* noop */
    }
  });
}
