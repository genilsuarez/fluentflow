/**
 * Safari Detection Utility
 * Precisely detects Safari (mobile or desktop), not Chrome/Edge/Firefox
 */

import { logDebug } from './logger';

const detectSafari = (): boolean => {
  // Check if we're in a browser environment
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const userAgent = navigator.userAgent;

  // Must be Safari
  const isSafari = /Safari/.test(userAgent);

  // Must NOT be Chrome (Chrome includes "Safari" in user agent)
  const isNotChrome = !/Chrome/.test(userAgent) && !/CriOS/.test(userAgent);

  // Additional Safari-specific checks
  const hasWebKit = /WebKit/.test(userAgent);
  const hasVersion = /Version\//.test(userAgent);

  // Note: intentionally NOT gated on iPhone|iPad|iPod — the WebKit rendering
  // quirks these fixes target (button bg colors, native input appearance,
  // flex button overflow) happen on desktop Safari too, not just iOS.
  return isSafari && isNotChrome && hasWebKit && hasVersion;
};

const applySafariClass = (): void => {
  const isSafariBrowser = detectSafari();

  // Debug logging
  logDebug(
    'Safari Detection',
    {
      userAgent: navigator.userAgent,
      isSafariBrowser,
      classList: document.documentElement.classList.toString(),
    },
    'safariDetection'
  );

  if (isSafariBrowser) {
    document.documentElement.classList.add('browser-safari');
    logDebug('Safari class applied', undefined, 'safariDetection');
  } else {
    logDebug('Not Safari, no class applied', undefined, 'safariDetection');
  }
};

// Auto-apply on module load
if (typeof window !== 'undefined') {
  // Apply immediately if DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applySafariClass);
  } else {
    applySafariClass();
  }
}
