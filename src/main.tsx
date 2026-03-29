import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initializeTheme } from './utils/themeInitializer';
import { clearChunkRetryFlag } from './utils/lazyWithRetry';
import './utils/safariDetection';

// Registrar Service Worker para modo offline
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swPath = import.meta.env.BASE_URL + 'sw.js';
    navigator.serviceWorker
      .register(swPath)
      .then(() => {
        // After SW is ready, trigger asset precaching from client side.
        // This is more reliable than doing it inside the SW fetch handler,
        // especially on WebKit/iOS where SW lifecycle is more aggressive.
        precacheAppAssets();
      })
      .catch(error => {
        console.warn('SW registration failed:', error);
      });
  });
}

/**
 * Fetch asset-manifest.json and tell the SW to precache all chunks.
 * Runs after SW registration, non-blocking, best-effort.
 */
async function precacheAppAssets(): Promise<void> {
  try {
    const sw = navigator.serviceWorker.controller;
    if (!sw) return; // SW not controlling yet — will precache on next load

    const base = import.meta.env.BASE_URL || '/';
    const origin = window.location.origin;

    // Fetch the manifest
    const manifestUrl = `${origin}${base}asset-manifest.json`;
    const res = await fetch(manifestUrl);
    if (!res.ok) return;
    const assets: string[] = await res.json();

    // Build full URLs
    const fullUrls = assets.map(a => `${origin}${base}${a}`);

    // Also include the HTML page and manifest itself
    fullUrls.push(`${origin}${base}`);
    fullUrls.push(manifestUrl);

    // Tell SW to precache
    sw.postMessage({ type: 'PRECACHE_ASSETS', assets: fullUrls, baseUrl: `${origin}${base}` });
  } catch {
    // Non-critical — SW will cache assets on-demand via fetch handler
  }
}

try {
  // Debug: Check if React is properly loaded
  if (!React || !React.createContext) {
    throw new Error('React is not properly loaded - createContext is undefined');
  }

  // Ensure React is available globally (fix for createContext issues)
  if (typeof window !== 'undefined') {
    (window as any).React = React;
  }

  // Initialize theme before React renders to prevent FOUC
  initializeTheme();

  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

  // Mark app as alive for the inline resume-detection script
  (window as any).__REACT_ALIVE = true;

  // App loaded successfully — clear any chunk retry flag
  clearChunkRetryFlag();
  try {
    sessionStorage.removeItem('static-chunk-retry');
  } catch {
    /* */
  }
} catch (error) {
  // Use basic console.error for critical initialization errors
  console.error('Failed to initialize React app:', error);

  // More detailed error information
  if (error instanceof Error) {
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      reactAvailable: !!React,
      createContextAvailable: !!(React && React.createContext),
    });
  }

  document.body.innerHTML =
    '<div style="padding: 20px; color: red;">Failed to load application. Please refresh the page.<br><small>Check console for details.</small></div>';
}
