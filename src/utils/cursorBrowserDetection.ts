/**
 * Cursor IDE embedded browser detection.
 * `.browser-cursor-embedded` (see `styles/components/game-controls.css`)
 * exists to give fixed-position bottom UI (game controls, filter sheets)
 * extra clearance in Cursor's mobile device preview, in case that preview
 * ever overlays its own chrome over the page. This file only decides
 * WHETHER that environment applies — the clearance amount lives in CSS.
 *
 * History: this used to reserve a hardcoded 52px, on the assumption
 * Cursor draws a bottom toolbar over the page. Verified live in Cursor on
 * 2026-07-23 that this is NOT the case (at least in the version tested) —
 * there is no overlay, and reserving 52px anyway just left a visible empty
 * gap of the app's own background under the controls bar. The clearance
 * is now 0 for that reason (see the CSS comment for the single source of
 * truth). Detection is kept in place rather than deleted outright, in
 * case a real overlay shows up in a different Cursor preview mode/version
 * later — but do not restore a nonzero value without confirming an actual
 * overlay live inside Cursor first.
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
