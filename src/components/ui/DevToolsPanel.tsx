import React, { useState } from 'react';
import { Wrench, RefreshCw, Trash2, Monitor } from 'lucide-react';
import '../../styles/components/dev-tools-panel.css';

declare global {
  interface Window {
    lpForceSync?: () => Promise<{ pull?: { downloaded?: boolean } } | void>;
  }
}

const PRESERVED_STORAGE_KEYS: Record<string, boolean> = {
  'lp-theme': true,
  'lp-navigation-mode': true,
  'lp-user': true,
};

function isPreservedStorageKey(key: string): boolean {
  return PRESERVED_STORAGE_KEYS[key] === true || /^sb-.+-auth-token$/.test(key);
}

function buildStamp(): string {
  const date = new Date(window.__BUILD_TIME__ || new Date().toISOString());
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getScreenInfo() {
  return [
    ['Resolución', `${window.screen.width} × ${window.screen.height}`],
    ['Ventana', `${window.innerWidth} × ${window.innerHeight}`],
    ['Ratio de Píxeles', `${window.devicePixelRatio || 1}x`],
    ['Profundidad de Color', `${window.screen.colorDepth} bits`],
    ['Orientación', window.screen.orientation?.type || 'unknown'],
  ] as const;
}

function clearCookies() {
  // No app-level code sets cookies directly, but gtag (lp-analytics.js) does
  // once consent is granted (_ga, _gid, etc.) — the confirm dialog promises
  // to wipe local data, so those need to go too, not just storage/caches.
  document.cookie.split(';').forEach(cookie => {
    const name = cookie.split('=')[0].trim();
    if (!name) return;
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  });
}

async function clearCache() {
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map(key => caches.delete(key)));
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration => registration.unregister()));
    }
  } catch {
    /* Reload even when a browser does not expose every cache API. */
  }
  try {
    if (window.lpGuestReset) {
      window.lpGuestReset.clearLocalCachePreserveSession();
    } else {
      Object.keys(localStorage).forEach(key => {
        if (!isPreservedStorageKey(key)) localStorage.removeItem(key);
      });
      Object.keys(sessionStorage).forEach(key => sessionStorage.removeItem(key));
    }
  } catch {
    /* Private browsing or storage unavailable — Cache Storage/SW cleanup above still ran. */
  }
  try {
    clearCookies();
  } catch {
    /* Cookie access blocked (e.g. strict privacy mode) — other cleanup above still ran. */
  }
  window.location.reload();
}

export const DevToolsPanel: React.FC = () => {
  const [expanded, setExpanded] = useState(false);
  const [cacheConfirmOpen, setCacheConfirmOpen] = useState(false);
  const [screenInfoOpen, setScreenInfoOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'ok' | 'error'>('idle');
  const [syncing, setSyncing] = useState(false);

  const handleForceSync = async () => {
    if (!window.lpForceSync) return;
    setSyncing(true);
    setSyncState('syncing');
    try {
      const result = await window.lpForceSync();
      const pulled = !!(result && result.pull && result.pull.downloaded);
      setSyncState('ok');
      void pulled;
    } catch {
      setSyncState('error');
    } finally {
      setSyncing(false);
    }
  };

  const syncMessage =
    syncState === 'syncing'
      ? 'Sincronizando…'
      : syncState === 'ok'
        ? '✓ Sincronizado — sin cambios nuevos'
        : syncState === 'error'
          ? '✕ No se pudo sincronizar — revisa tu conexión'
          : '';

  return (
    <>
      <button
        type="button"
        className="header-side-menu__item"
        aria-expanded={expanded}
        aria-controls="devToolsPanel"
        onClick={() => setExpanded(prev => !prev)}
      >
        <span className="header-side-menu__icon" aria-hidden="true">
          <Wrench size={18} />
        </span>
        <span className="header-side-menu__text">Dev</span>
      </button>
      {expanded && (
        <div className="lp-dev-panel" id="devToolsPanel">
          <header className="lp-dev-panel__header">
            <span>
              <Wrench size={16} aria-hidden="true" />
              <strong>Herramientas de desarrollo</strong>
            </span>
            <code>{`B: ${buildStamp()}`}</code>
          </header>
          <div className="lp-dev-panel__actions">
            <button type="button" onClick={() => window.location.reload()}>
              <RefreshCw size={16} aria-hidden="true" />
              Recargar
            </button>
            <button type="button" onClick={handleForceSync} disabled={syncing}>
              <RefreshCw size={16} aria-hidden="true" />
              Forzar sync
            </button>
            <button
              type="button"
              aria-expanded={cacheConfirmOpen}
              onClick={() => {
                setCacheConfirmOpen(prev => !prev);
                setScreenInfoOpen(false);
              }}
            >
              <Trash2 size={16} aria-hidden="true" />
              Limpiar caché
            </button>
            <button
              type="button"
              aria-expanded={screenInfoOpen}
              onClick={() => {
                setScreenInfoOpen(prev => !prev);
                setCacheConfirmOpen(false);
              }}
            >
              <Monitor size={16} aria-hidden="true" />
              Información de Pantalla
            </button>
          </div>
          {syncMessage && (
            <p className="lp-dev-panel__status" data-state={syncState === 'error' ? 'error' : 'ok'}>
              {syncMessage}
            </p>
          )}
          {cacheConfirmOpen && (
            <div className="lp-dev-cache-confirm" role="alert">
              <p>
                Borra caché y datos locales de LearnFlow en este navegador y recarga. Tema, modo y
                sesión se mantienen.
              </p>
              <div>
                <button
                  type="button"
                  onClick={() => setCacheConfirmOpen(false)}
                  disabled={clearing}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={clearing}
                  onClick={() => {
                    setClearing(true);
                    void clearCache();
                  }}
                >
                  {clearing ? '…' : 'Limpiar y recargar'}
                </button>
              </div>
            </div>
          )}
          {screenInfoOpen && (
            <dl className="lp-dev-screen-grid">
              {getScreenInfo().map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </>
  );
};
