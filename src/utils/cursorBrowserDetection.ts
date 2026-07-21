/**
 * Cursor IDE embedded browser detection.
 * The mobile device preview draws its own bottom toolbar over the page;
 * lift fixed game controls when this environment is detected.
 */

const CURSOR_UA_PATTERN = /\bCursor\//;

export function isCursorEmbeddedBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return CURSOR_UA_PATTERN.test(navigator.userAgent);
}

function applyCursorBrowserClass(): void {
  if (!isCursorEmbeddedBrowser()) return;
  document.documentElement.classList.add('browser-cursor-embedded');
  document.documentElement.style.setProperty('--cursor-preview-chrome-bottom', '52px');
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyCursorBrowserClass);
  } else {
    applyCursorBrowserClass();
  }
}
