import React from 'react';
import { X, WifiOff } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUserStore } from '../../stores/userStore';
import { useTranslation } from '../../utils/i18n';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { portalHref, isLocalPlatformHost } from '../../utils/platformUrls';
import { NavMenuIcon } from './NavMenuIcon';
import { DevToolsPanel } from './DevToolsPanel';
import '../../styles/components/settings-modal.css';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAbout: () => void;
  onOpenOfflineDownloads?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onOpenAbout,
  onOpenOfflineDownloads,
}) => {
  const { language, theme, setTheme, developmentMode } = useSettingsStore();
  const user = useUserStore(state => state.user);
  const { t } = useTranslation(language);

  useEscapeKey(isOpen, onClose);

  if (!isOpen) return null;

  const preserveTheme = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isLocalPlatformHost()) return;
    const url = new URL(event.currentTarget.href, location.origin);
    url.searchParams.set('theme', theme === 'dark' ? 'dark' : 'light');
    event.currentTarget.href = url.toString();
  };

  return (
    <div
      className="lp-settings-overlay"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="lp-settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
      >
        <header className="lp-settings-header">
          <h2 id="settings-modal-title">{t('navigation.settingsShort')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="lp-settings-close"
            aria-label={t('navigation.closeSettings')}
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="lp-settings-body">
          <section aria-labelledby="settings-section-account" className="lp-settings-section">
            <h3 id="settings-section-account" className="lp-settings-section__title">
              {t('navigation.settingsSectionAccount')}
            </h3>
            <button
              type="button"
              className="header-side-menu__item header-side-menu__item--login"
              aria-label={user ? `${user.name} — perfil` : t('auth.loginToAccount')}
              onClick={() => {
                onClose();
                window.lpLogin?.open();
              }}
            >
              <span className="header-side-menu__icon" aria-hidden="true">
                <NavMenuIcon name="user" />
              </span>
              <span className="header-side-menu__text">{user ? user.name : t('auth.login')}</span>
            </button>
          </section>

          <section aria-labelledby="settings-section-appearance" className="lp-settings-section">
            <h3 id="settings-section-appearance" className="lp-settings-section__title">
              {t('navigation.settingsSectionAppearance')}
            </h3>
            <button
              type="button"
              className="header-side-menu__item header-side-menu__item--theme"
              aria-label={
                theme === 'dark'
                  ? t('navigation.switchToLightMode')
                  : t('navigation.switchToDarkMode')
              }
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              <span className="header-side-menu__icon" aria-hidden="true">
                <NavMenuIcon name={theme === 'dark' ? 'sun' : 'moon'} />
              </span>
              <span className="header-side-menu__text">
                {theme === 'dark' ? t('navigation.lightMode') : t('navigation.darkMode')}
              </span>
            </button>
          </section>

          <section aria-labelledby="settings-section-help" className="lp-settings-section">
            <h3 id="settings-section-help" className="lp-settings-section__title">
              {t('navigation.settingsSectionHelp')}
            </h3>
            <button
              type="button"
              onClick={onOpenAbout}
              className="header-side-menu__item"
              aria-label="About LearnFlow"
            >
              <span className="header-side-menu__icon" aria-hidden="true">
                <NavMenuIcon name="info" />
              </span>
              <span className="header-side-menu__text">About LearnFlow</span>
            </button>
            {onOpenOfflineDownloads && (
              <button
                type="button"
                onClick={onOpenOfflineDownloads}
                className="header-side-menu__item"
                aria-label={t('offline.title')}
              >
                <span className="header-side-menu__icon" aria-hidden="true">
                  <WifiOff size={18} />
                </span>
                <span className="header-side-menu__text">{t('offline.title')}</span>
              </button>
            )}
            <a
              href={portalHref()}
              className="header-side-menu__item header-side-menu__item--portal"
              aria-label="Portal"
              onClick={preserveTheme}
            >
              <span className="header-side-menu__icon" aria-hidden="true">
                <NavMenuIcon name="home" />
              </span>
              <span className="header-side-menu__text">Portal</span>
            </a>
            <a href="privacy.html" className="header-side-menu__item" aria-label="Privacidad">
              <span className="header-side-menu__icon" aria-hidden="true">
                <NavMenuIcon name="info" />
              </span>
              <span className="header-side-menu__text">Privacidad</span>
            </a>
          </section>

          {developmentMode && (
            <section aria-labelledby="settings-section-dev" className="lp-settings-section">
              <h3 id="settings-section-dev" className="lp-settings-section__title">
                Desarrollador
              </h3>
              <DevToolsPanel />
            </section>
          )}
        </div>
      </section>
    </div>
  );
};
