/**
 * Cursor IDE embedded browser detection.
 * `.browser-cursor-embedded` (see `styles/components/game-controls.css`)
 * exists to give fixed-position bottom UI (game controls, filter sheets)
 * extra clearance in Cursor's mobile device preview, in case that preview
 * ever overlays its own chrome over the page. This file only decides
 * WHETHER that environment applies — the clearance amount lives in CSS.
 *
 * History (see the CSS comment in game-controls.css for the full story):
 * 52px (unverified guess) → 0px (verified live, but wrong for a different
 * view where content really was clipped) → 34px (Apple's own iPhone
 * home-indicator height, used as a principled fallback for what
 * `env(safe-area-inset-bottom)` should have reported — Cursor's simulated
 * device draws a home-indicator bar but doesn't feed that env() value).
 * Don't change the CSS value again without a live measurement or an
 * equally principled reason — two of the three values tried here were
 * guesses that turned out wrong.
 *
 * Dynamic measurement (`window.visualViewport.height` vs `innerHeight`)
 * was considered instead of a constant, but per MDN, `visualViewport`
 * does not reflect overlays drawn by a host embedding the page
 * (iframe/webview) — it would report the same value as `innerHeight`
 * regardless of any real toolbar, so it can't replace live verification.
 *
 * Also confirmed this does NOT apply to Claude Code's embedded browser
 * pane (`mcp__Claude_Browser__*`): at 375×812, `innerHeight`,
 * `visualViewport.height`, `outerHeight`, and `screen.height` all match
 * exactly (no overlay). Detection was intentionally NOT extended to match
 * `Claude/` in the UA for this reason.
 */

const CURSOR_UA_PATTERN = /\bCursor\//;

export function isCursorEmbeddedBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return CURSOR_UA_PATTERN.test(navigator.userAgent);
}

function applyCursorBrowserClass(): void {
  if (!isCursorEmbeddedBrowser()) return;
  document.documentElement.classList.add('browser-cursor-embedded');
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyCursorBrowserClass);
  } else {
    applyCursorBrowserClass();
  }
}
