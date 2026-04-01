import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Heart, Info, Monitor, Trash2 } from 'lucide-react';
import { Github } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../utils/i18n';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { FluentFlowLogo } from './FluentFlowLogo';
import '../../styles/components/compact-about.css';
import '../../styles/components/modal-buttons.css';

interface CompactAboutProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CompactAbout: React.FC<CompactAboutProps> = ({ isOpen, onClose }) => {
  const { language } = useSettingsStore();
  const { t } = useTranslation(language);
  const [showScreenInfo, setShowScreenInfo] = useState(false);
  const [showCacheConfirm, setShowCacheConfirm] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);

  const handleClearCache = async () => {
    setClearingCache(true);
    try {
      // Delete ALL caches, not just named ones
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      // Unregister all service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(r => r.unregister()));
      }
    } catch {
      // Continue to reload even if cache clearing partially fails
    }
    // Always reload to force fresh download
    window.location.reload();
  };

  // Handle closing both modals
  const handleClose = () => {
    setShowScreenInfo(false);
    setShowCacheConfirm(false);
    onClose();
  };

  // Handle escape key to close modal
  useEscapeKey(isOpen, handleClose);

  // Close screen info modal when About modal closes
  React.useEffect(() => {
    if (!isOpen && showScreenInfo) {
      setShowScreenInfo(false);
    }
  }, [isOpen, showScreenInfo]);

  // Get screen information
  const getScreenInfo = () => {
    return {
      resolution: `${window.screen.width} × ${window.screen.height}`,
      viewport: `${window.innerWidth} × ${window.innerHeight}`,
      devicePixelRatio: window.devicePixelRatio || 1,
      colorDepth: window.screen.colorDepth,
      orientation: window.screen.orientation?.type || 'unknown',
    };
  };

  const buildString = (() => {
    const buildTime = (window as any).__BUILD_TIME__ || new Date().toISOString();
    const d = new Date(buildTime);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${mm}/${dd} ${hh}:${min}`;
  })();

  if (!isOpen) return null;

  return (
    <div className="compact-about">
      <div className="compact-about__container">
        <div className="compact-about__header">
          <div className="compact-about__title-section">
            <FluentFlowLogo size="sm" />
            <div className="compact-about__header-text">
              <h2 className="compact-about__title">
                {t('about.title')} <span className="compact-about__version">v2.0</span>
              </h2>
            </div>
          </div>
          <button onClick={handleClose} className="modal__close-btn" aria-label={t('common.close')}>
            <X className="modal__close-icon" />
          </button>
        </div>

        <div className="compact-about__content">
          {/* Features */}
          <div className="compact-about__section">
            <h3 className="compact-about__section-title">
              <Info className="compact-about__section-icon" />
              {t('about.features')}
            </h3>
            <div className="compact-about__features">
              <div className="compact-about__feature">
                <span className="compact-about__feature-icon">🧩</span>
                <span className="compact-about__feature-text">{t('about.feature1')}</span>
              </div>
              <div className="compact-about__feature">
                <span className="compact-about__feature-icon">🎯</span>
                <span className="compact-about__feature-text">{t('about.feature2')}</span>
              </div>
              <div className="compact-about__feature">
                <span className="compact-about__feature-icon">📶</span>
                <span className="compact-about__feature-text">{t('about.feature3')}</span>
              </div>
              <div className="compact-about__feature">
                <span className="compact-about__feature-icon">🌐</span>
                <span className="compact-about__feature-text">{t('about.feature4')}</span>
              </div>
            </div>
          </div>

          {/* Developer */}
          <div className="compact-about__section">
            <h3 className="compact-about__section-title">
              <Heart className="compact-about__section-icon compact-about__section-icon--heart" />
              {t('about.developer')}
            </h3>
            <div className="compact-about__developer">
              <div className="compact-about__developer-info">
                <span className="compact-about__developer-name">👨‍💻 Genil Suárez</span>
                <span className="compact-about__developer-title">{t('about.developerTitle')}</span>
              </div>
              <a
                href="https://github.com/genilsuarez"
                target="_blank"
                rel="noopener noreferrer"
                className="compact-about__developer-link"
                aria-label={t('about.githubProfile')}
              >
                <Github className="compact-about__link-icon" />
                <span>GitHub</span>
              </a>
            </div>
          </div>

          {/* Tech Stack */}
          <div className="compact-about__section">
            <div className="compact-about__tech-stack">
              <button
                className="compact-about__tech-item compact-about__tech-item--clickable"
                onClick={() => setShowScreenInfo(true)}
                title={t('about.clickToViewScreenInfo')}
              >
                React
              </button>
              <button
                className="compact-about__tech-item compact-about__tech-item--clickable"
                onClick={() => setShowCacheConfirm(true)}
                title="Clear cache & reload"
              >
                TypeScript
              </button>
              <span className="compact-about__tech-item">CSS</span>
              <span className="compact-about__tech-item">Zustand</span>
              <span className="compact-about__tech-item">Vite</span>
            </div>
          </div>

          {/* Actions */}
          <div className="modal__actions modal__actions--single">
            <span className="compact-about__build-time">
              {t('about.build')} {buildString}
            </span>
            <button onClick={handleClose} className="modal__btn modal__btn--primary">
              {t('common.close')}
            </button>
          </div>
        </div>
      </div>

      {/* Screen Info Modal */}
      {showScreenInfo &&
        createPortal(
          <div className="screen-info-modal">
            <div className="screen-info-modal__container">
              <div className="screen-info-modal__header">
                <div className="screen-info-modal__title-section">
                  <Monitor className="screen-info-modal__icon" />
                  <h3 className="screen-info-modal__title">{t('about.screenInformation')}</h3>
                </div>
                <button
                  onClick={() => setShowScreenInfo(false)}
                  className="screen-info-modal__close-btn"
                  aria-label={t('about.closeScreenInfo')}
                >
                  <X className="screen-info-modal__close-icon" />
                </button>
              </div>
              <div className="screen-info-modal__content">
                {(() => {
                  const screenInfo = getScreenInfo();
                  return (
                    <div className="screen-info-modal__grid">
                      <div className="screen-info-modal__item">
                        <span className="screen-info-modal__label">
                          {t('about.screenResolution')}
                        </span>
                        <span className="screen-info-modal__value">{screenInfo.resolution}</span>
                      </div>
                      <div className="screen-info-modal__item">
                        <span className="screen-info-modal__label">
                          {t('about.screenViewport')}
                        </span>
                        <span className="screen-info-modal__value">{screenInfo.viewport}</span>
                      </div>
                      <div className="screen-info-modal__item">
                        <span className="screen-info-modal__label">
                          {t('about.screenPixelRatio')}
                        </span>
                        <span className="screen-info-modal__value">
                          {screenInfo.devicePixelRatio}x
                        </span>
                      </div>
                      <div className="screen-info-modal__item">
                        <span className="screen-info-modal__label">
                          {t('about.screenColorDepth')}
                        </span>
                        <span className="screen-info-modal__value">
                          {screenInfo.colorDepth} bits
                        </span>
                      </div>
                      <div className="screen-info-modal__item">
                        <span className="screen-info-modal__label">
                          {t('about.screenOrientation')}
                        </span>
                        <span className="screen-info-modal__value">{screenInfo.orientation}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>,
          document.body
        )}
      {/* Cache Confirm Modal */}
      {showCacheConfirm &&
        createPortal(
          <div className="screen-info-modal">
            <div className="screen-info-modal__container cache-confirm">
              <div className="screen-info-modal__header">
                <div className="screen-info-modal__title-section">
                  <Trash2 className="screen-info-modal__icon" />
                  <h3 className="screen-info-modal__title">
                    {t('about.clearCache', 'Clear cache')}
                  </h3>
                </div>
                <button
                  onClick={() => setShowCacheConfirm(false)}
                  className="screen-info-modal__close-btn"
                  aria-label={t('common.close')}
                >
                  <X className="screen-info-modal__close-icon" />
                </button>
              </div>
              <div className="screen-info-modal__content">
                <p className="cache-confirm__text">
                  {t(
                    'about.clearCacheDescription',
                    'This will delete all cached data and reload the app to download the latest version.'
                  )}
                </p>
                <div className="cache-confirm__actions">
                  <button
                    className="cache-confirm__btn cache-confirm__btn--cancel"
                    onClick={() => setShowCacheConfirm(false)}
                    disabled={clearingCache}
                  >
                    {t('common.cancel', 'Cancel')}
                  </button>
                  <button
                    className="cache-confirm__btn cache-confirm__btn--confirm"
                    onClick={handleClearCache}
                    disabled={clearingCache}
                  >
                    {clearingCache ? '⏳' : t('about.clearCacheConfirm', 'Clear & reload')}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
