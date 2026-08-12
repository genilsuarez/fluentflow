import React, { useState } from 'react';
import { Monitor, RotateCcw, Trash2, Wrench, X } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../utils/i18n';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { appHref, isLocalPlatformHost, type PlatformApp } from '../../utils/platformUrls';
import { aboutText, getAboutContent } from '../../data/lpAboutContent';
import '../../styles/components/compact-about.css';

interface CompactAboutProps {
  isOpen: boolean;
  onClose: () => void;
}

// En producción y en dev local (gateway en localhost:3000), las 4 apps
// comparten el mismo origin y por tanto el mismo localStorage.
const PRESERVED_STORAGE_KEYS = new Set(['lp-theme', 'lp-navigation-mode', 'lp-user']);
const isPreservedStorageKey = (key: string) =>
  PRESERVED_STORAGE_KEYS.has(key) || /^sb-.+-auth-token$/.test(key);

export const CompactAbout: React.FC<CompactAboutProps> = ({ isOpen, onClose }) => {
  const { language, developmentMode } = useSettingsStore();
  const { t } = useTranslation(language);
  const [showScreenInfo, setShowScreenInfo] = useState(false);
  const [showCacheConfirm, setShowCacheConfirm] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);

  const isLocal = isLocalPlatformHost();

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
      const guestReset = window.lpGuestReset;
      if (guestReset?.clearLocalCachePreserveSession) {
        guestReset.clearLocalCachePreserveSession();
      } else {
        for (const key of Object.keys(localStorage)) {
          if (!isPreservedStorageKey(key)) localStorage.removeItem(key);
        }
        for (const key of Object.keys(sessionStorage)) sessionStorage.removeItem(key);
      }
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
  const aboutContent = getAboutContent();
  const aboutLang: 'es' | 'en' = language === 'es' ? 'es' : 'en';

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
            <p className="about-eyebrow">{aboutContent.eyebrow}</p>
            <h2 id="about-title">{aboutText(aboutContent.title, aboutLang)}</h2>
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
            {aboutText(aboutContent.description, aboutLang)}
          </p>

          <nav className="about-modules" aria-label={t('about.learnFlowLinks')}>
            {aboutContent.modules.map(mod => (
              <a key={mod.id} href={appHref(mod.id as PlatformApp)} onClick={preserveTheme}>
                <span
                  className={`about-module__mark about-module__mark--${mod.markClass}`}
                  aria-hidden="true"
                >
                  {mod.mark}
                </span>
                <span className="about-module__text">
                  <strong>{mod.name}</strong>
                  <span>{aboutText(mod.subtitle, aboutLang)}</span>
                </span>
              </a>
            ))}
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
                      'This deletes cached assets and local data for LearnFlow (DeskFlow, FluentFlow, HubFlow, LyricFlow) in this browser, then reloads. Only scoped to this app if the apps are running on separate dev ports (learnctl start individual). Shared theme/navigation preferences and your login session are kept.'
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
              {aboutContent.author.initials}
            </div>
            <div className="about-author__info">
              <strong>{aboutContent.author.name}</strong>
              <span>{aboutText(aboutContent.author.bio, aboutLang)}</span>
            </div>
          </div>
        </footer>
      </section>
    </div>
  );
};
