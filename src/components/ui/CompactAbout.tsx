import React, { useState } from 'react';
import { Monitor, RotateCcw, Trash2, Wrench, X } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../utils/i18n';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import '../../styles/components/compact-about.css';

interface CompactAboutProps {
  isOpen: boolean;
  onClose: () => void;
}

// Claves de localStorage que pertenecen únicamente a FluentFlow (Zustand
// persist stores + vistas derivadas que consume DeskFlow). Deliberadamente
// NO incluye 'lp-theme', 'lp-navigation-mode' ni 'lp-user': esas son
// preferencias compartidas entre las 4 apps (mismo origin en producción) y
// tampoco se toca la sesión de Supabase ('sb-*-auth-token') — un "clear
// cache" no debe funcionar como logout encubierto ni resetear otras apps.
const FLUENTFLOW_LOCAL_STORAGE_KEYS = [
  'app-storage',
  'user-storage',
  'settings-storage',
  'progress-storage',
  'learnflow:progress:fluentflow:v1',
  'learnflow:activity:fluentflow:v1',
];

const FLUENTFLOW_SESSION_STORAGE_KEYS = [
  'prevView',
  'menuGridScrollPosition',
  'autoScrollToNext',
  'static-chunk-retry',
];

export const CompactAbout: React.FC<CompactAboutProps> = ({ isOpen, onClose }) => {
  const { language, developmentMode } = useSettingsStore();
  const { t } = useTranslation(language);
  const [showScreenInfo, setShowScreenInfo] = useState(false);
  const [showCacheConfirm, setShowCacheConfirm] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);

  const isLocal =
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1' ||
    location.hostname.startsWith('192.168.');

  const isUnified =
    isLocal && location.port === '3000' && location.pathname.startsWith('/fluentflow');

  const getAppHref = (path: string, port: number) => {
    if (isUnified) return `/${path}/`;
    if (isLocal) return `http://${location.hostname}:${port}/`;
    return `https://genilsuarez.github.io/${path}/`;
  };

  const preserveTheme = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isLocal) return;
    const url = new URL(event.currentTarget.href);
    url.searchParams.set(
      'theme',
      document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    );
    event.currentTarget.href = url.toString();
  };

  const handleClose = () => {
    setShowScreenInfo(false);
    setShowCacheConfirm(false);
    onClose();
  };

  const handleClearCache = async () => {
    setClearingCache(true);
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(registration => registration.unregister()));
      }
    } catch {
      // Reload even when a browser does not expose every cache API.
    }
    try {
      for (const key of FLUENTFLOW_LOCAL_STORAGE_KEYS) localStorage.removeItem(key);
      for (const key of FLUENTFLOW_SESSION_STORAGE_KEYS) sessionStorage.removeItem(key);
    } catch {
      // Private browsing or storage unavailable — Cache Storage/SW cleanup above still ran.
    }
    window.location.reload();
  };

  const handleRecompile = () => {
    window.location.reload();
  };

  const getScreenInfo = () => ({
    resolution: `${window.screen.width} × ${window.screen.height}`,
    viewport: `${window.innerWidth} × ${window.innerHeight}`,
    pixelRatio: `${window.devicePixelRatio || 1}x`,
    colorDepth: `${window.screen.colorDepth} bits`,
    orientation: window.screen.orientation?.type || 'unknown',
  });

  const buildString = (() => {
    const buildTime = (window as Window & { __BUILD_TIME__?: string }).__BUILD_TIME__;
    const date = new Date(buildTime || new Date().toISOString());
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${month}/${day} ${hour}:${minute}`;
  })();

  const screenInfo = showScreenInfo ? getScreenInfo() : null;

  useEscapeKey(isOpen, handleClose);

  if (!isOpen) return null;

  return (
    <div
      className="about-overlay"
      onMouseDown={event => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <section
        className={`about-modal${developmentMode ? ' about-modal--dev' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        aria-describedby="about-description"
      >
        <header className="about-header">
          <div className="about-identity" aria-hidden="true">
            L
          </div>
          <div className="about-header__text">
            <p className="about-eyebrow">LearnFlow · Plataforma</p>
            <h2 id="about-title">{t('about.title')}</h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="about-close"
            aria-label={t('common.close')}
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="about-body">
          <p id="about-description" className="about-description">
            {language === 'es'
              ? 'Una plataforma para aprender idiomas con estructura, práctica y música.'
              : 'A platform for learning languages with structure, practice, and music.'}
          </p>

          <nav className="about-modules" aria-label={t('about.learnFlowLinks')}>
            <a href={getAppHref('deskflow', 3000)} onClick={preserveTheme}>
              <span className="about-module__mark about-module__mark--portal" aria-hidden="true">
                L
              </span>
              <span className="about-module__text">
                <strong>LearnFlow</strong>
                <span>Portal</span>
              </span>
            </a>
            <a href={getAppHref('fluentflow', 3001)} onClick={preserveTheme}>
              <span className="about-module__mark about-module__mark--fluent" aria-hidden="true">
                F
              </span>
              <span className="about-module__text">
                <strong>FluentFlow</strong>
                <span>
                  {language === 'es'
                    ? 'Ruta de inglés por niveles CEFR'
                    : 'English path by CEFR levels'}
                </span>
              </span>
            </a>
            <a href={getAppHref('hubflow', 3002)} onClick={preserveTheme}>
              <span className="about-module__mark about-module__mark--hub" aria-hidden="true">
                H
              </span>
              <span className="about-module__text">
                <strong>HubFlow</strong>
                <span>
                  {language === 'es'
                    ? 'Práctica flexible de gramática'
                    : 'Flexible grammar practice'}
                </span>
              </span>
            </a>
            <a href={getAppHref('lyricflow', 3003)} onClick={preserveTheme}>
              <span className="about-module__mark about-module__mark--lyric" aria-hidden="true">
                LF
              </span>
              <span className="about-module__text">
                <strong>LyricFlow</strong>
                <span>{language === 'es' ? 'Aprender con música' : 'Learn with music'}</span>
              </span>
            </a>
          </nav>

          {developmentMode && (
            <section className="about-dev-panel" aria-label="Development tools">
              <header className="about-dev-header">
                <span>
                  <Wrench aria-hidden="true" />
                  <strong>
                    {language === 'es' ? 'Herramientas de desarrollo' : 'Development tools'}
                  </strong>
                </span>
                <code>B: {buildString}</code>
              </header>
              <div className="about-dev-actions">
                <button type="button" onClick={handleRecompile}>
                  <RotateCcw aria-hidden="true" />
                  {language === 'es' ? 'Recompilar' : 'Recompile'}
                </button>
                <button
                  type="button"
                  aria-expanded={showCacheConfirm}
                  onClick={() => setShowCacheConfirm(value => !value)}
                >
                  <Trash2 aria-hidden="true" />
                  {t('about.clearCache', 'Clear cache')}
                </button>
                <button
                  type="button"
                  aria-expanded={showScreenInfo}
                  onClick={() => setShowScreenInfo(value => !value)}
                >
                  <Monitor aria-hidden="true" />
                  {t('about.screenInformation')}
                </button>
              </div>
              {showCacheConfirm && (
                <div className="about-cache-confirm" role="alert">
                  <p>
                    {t(
                      'about.clearCacheDescription',
                      'This deletes FluentFlow cached assets, saved progress, and settings, then reloads. Shared cross-app preferences and your login session are kept.'
                    )}
                  </p>
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowCacheConfirm(false)}
                      disabled={clearingCache}
                    >
                      {t('common.cancel', 'Cancel')}
                    </button>
                    <button type="button" onClick={handleClearCache} disabled={clearingCache}>
                      {clearingCache ? '…' : t('about.clearCacheConfirm', 'Clear & reload')}
                    </button>
                  </div>
                </div>
              )}
              {screenInfo && (
                <dl className="about-screen-grid">
                  <div>
                    <dt>{t('about.screenResolution')}</dt>
                    <dd>{screenInfo.resolution}</dd>
                  </div>
                  <div>
                    <dt>{t('about.screenViewport')}</dt>
                    <dd>{screenInfo.viewport}</dd>
                  </div>
                  <div>
                    <dt>{t('about.screenPixelRatio')}</dt>
                    <dd>{screenInfo.pixelRatio}</dd>
                  </div>
                  <div>
                    <dt>{t('about.screenColorDepth')}</dt>
                    <dd>{screenInfo.colorDepth}</dd>
                  </div>
                  <div>
                    <dt>{t('about.screenOrientation')}</dt>
                    <dd>{screenInfo.orientation}</dd>
                  </div>
                </dl>
              )}
            </section>
          )}
        </div>

        <footer className="about-footer">
          <div className="about-author">
            <div className="about-author__avatar" aria-hidden="true">
              GS
            </div>
            <div className="about-author__info">
              <strong>{language === 'es' ? 'Genil Suárez' : 'Genil Suárez'}</strong>
              <span>
                {language === 'es'
                  ? 'Diseñado y desarrollado como proyecto personal'
                  : 'Designed and built as a personal project'}
              </span>
            </div>
          </div>
        </footer>
      </section>
    </div>
  );
};
