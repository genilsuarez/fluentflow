import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { User, Settings, Menu, BarChart3, LogOut, WifiOff } from 'lucide-react';
import '../../styles/components/header.css';
import { useAppStore } from '../../stores/appStore';
import { useUserStore } from '../../stores/userStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useMenuNavigation } from '../../hooks/useMenuNavigation';
import { useTranslation } from '../../utils/i18n';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useOfflineStatus } from '../../hooks/useOfflineStatus';
// import { toast } from '../../stores/toastStore';

// Compact modals - optimized versions
import { CompactProfile } from './CompactProfile';
import { CompactAdvancedSettings } from './CompactAdvancedSettings';
import { CompactAbout } from './CompactAbout';
import { CompactMyProgress } from './CompactMyProgress';
import { ScoreDisplay } from './ScoreDisplay';
import { FluentFlowLogo } from './FluentFlowLogo';
import { ConfirmModal } from './ConfirmModal';

interface HeaderProps {
  onMenuToggle?: () => void;
}

export const Header: React.FC<HeaderProps> = () => {
  const currentView = useAppStore(state => state.currentView);
  const { user } = useUserStore();
  const { developmentMode, language, offlineEnabled } = useSettingsStore();
  const { returnToMenu } = useMenuNavigation();
  const { t } = useTranslation(language);
  const { isOnline } = useOfflineStatus();
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [showMyProgress, setShowMyProgress] = useState(false);
  const [showMyProgressTab, setShowMyProgressTab] = useState<'dashboard' | 'path'>('dashboard');
  const [showBadge, setShowBadge] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Offline badge: show immediately when offline+enabled, hide with 3s delay on reconnect
  useEffect(() => {
    const shouldShow = !isOnline && offlineEnabled;

    if (shouldShow) {
      setShowBadge(true);
      return;
    }

    // When going back online, delay hiding by 3 seconds
    if (showBadge && !shouldShow) {
      const timer = setTimeout(() => setShowBadge(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, offlineEnabled, showBadge]);

  // Determine header layout mode
  const isInGame = currentView !== 'menu';
  const headerMode = isInGame ? 'learning' : 'menu';

  // Theme is now handled by themeInitializer and settingsStore
  // This effect is kept for consistency but theme should already be applied

  // Handle escape key for hamburger menu
  useEscapeKey(showSideMenu, () => setShowSideMenu(false));

  const handleMenuToggle = () => {
    setShowSideMenu(!showSideMenu);
  };

  const handleGoToMenu = () => {
    returnToMenu();
    setShowSideMenu(false);
  };

  // const handleSettings = () => {
  //   setShowSettings(!showSettings);
  //   if (!showSettings) {
  //     toast.info('Configuración', 'Panel de configuración abierto');
  //   }
  // };

  return (
    <header
      className={`header-redesigned header-redesigned--${headerMode}${isInGame ? ' header-redesigned--learning-mode' : ''}`}
    >
      <div className={`header-redesigned__container header-redesigned__container--${headerMode}`}>
        {/* Left Section: Menu + Brand */}
        <div className="header-redesigned__left">
          <button
            onClick={handleMenuToggle}
            className="header-redesigned__menu-btn header-redesigned__menu-btn--primary"
            title={t('navigation.openMenu')}
            aria-label={t('navigation.openMenu')}
            aria-expanded={showSideMenu}
            aria-controls="navigation-menu"
          >
            <Menu className="header-redesigned__menu-icon" />
            <span className="sr-only">
              {showSideMenu ? t('navigation.closeMenu') : t('navigation.openMenuShort')}
            </span>
          </button>
          <div className="header-redesigned__brand">
            <FluentFlowLogo size="md" className="header-redesigned__logo" />
            <h1 className="header-redesigned__title">FluentFlow</h1>
          </div>
        </div>

        {/* Center Section: Score Display */}
        <div className="header-redesigned__center">
          <ScoreDisplay />
          {showBadge && (
            <div
              className={`header__offline-badge${isOnline ? ' header__offline-badge--hidden' : ''}`}
              aria-label={t('offline.indicator')}
              role="status"
            >
              <WifiOff size={12} aria-hidden="true" />
              <span>{t('offline.indicator')}</span>
            </div>
          )}
          {developmentMode && (
            <div
              className="header-redesigned__dev-indicator"
              title={t('common.developmentModeActive')}
            >
              <span className="header-redesigned__dev-icon">🔧</span>
              <span className="header-redesigned__dev-text">DEV</span>
            </div>
          )}
        </div>

        {/* Right Section: Primary Actions Only */}
        <div className="header-redesigned__right">
          {/* User Profile Section - Primary Action */}
          {user ? (
            <div className="header-redesigned__user-section">
              <button
                onClick={() => setShowProfileForm(true)}
                className="header-redesigned__user-btn header-redesigned__user-btn--primary"
                title={`${user.name} - Profile`}
                aria-label={`User profile: ${user.name}. Click to open profile`}
              >
                <User className="header-redesigned__user-icon" />
                <div className="header-redesigned__user-info">
                  <span className="header-redesigned__username">{user.name}</span>
                </div>
              </button>
            </div>
          ) : (
            <div className="header-redesigned__user-section">
              <button
                onClick={() => setShowProfileForm(true)}
                className="header-redesigned__login-btn header-redesigned__login-btn--primary"
                aria-label={t('auth.loginToAccount')}
              >
                <User className="header-redesigned__user-icon" />
                <span className="header-redesigned__login-text">{t('auth.login')}</span>
              </button>
            </div>
          )}

          {/* Quick Actions removed - controls moved to hamburger menu */}
        </div>
      </div>

      {/* Compact Modals - rendered via portal to avoid event bubbling to header */}
      {showProfileForm &&
        createPortal(
          <CompactProfile isOpen={showProfileForm} onClose={() => setShowProfileForm(false)} />,
          document.body
        )}

      {createPortal(
        <CompactAdvancedSettings isOpen={showSettings} onClose={() => setShowSettings(false)} />,
        document.body
      )}

      {createPortal(
        <CompactAbout isOpen={showAbout} onClose={() => setShowAbout(false)} />,
        document.body
      )}

      {createPortal(
        <CompactMyProgress
          isOpen={showMyProgress}
          onClose={() => setShowMyProgress(false)}
          initialTab={showMyProgressTab}
        />,
        document.body
      )}

      {createPortal(
        <ConfirmModal
          isOpen={showLogoutConfirm}
          onClose={() => setShowLogoutConfirm(false)}
          onConfirm={() => {
            try {
              localStorage.clear();
            } catch {
              /* */
            }
            try {
              sessionStorage.clear();
            } catch {
              /* */
            }
            window.location.reload();
          }}
          title={t('auth.logoutConfirmTitle', 'Confirm Logout')}
          message={t(
            'auth.logoutConfirmMessage',
            'This will clear all your local data and reload the application. Your progress will be lost. Are you sure?'
          )}
          confirmLabel={t('auth.logoutConfirmButton', 'Logout')}
          cancelLabel={t('auth.cancelButton', 'Cancel')}
          variant="danger"
        />,
        document.body
      )}

      {showSideMenu && (
        <div
          className="header-side-menu-overlay"
          onClick={() => setShowSideMenu(false)}
          role="presentation"
        >
          <nav
            id="navigation-menu"
            className="header-side-menu"
            onClick={e => e.stopPropagation()}
            role="navigation"
            aria-label={t('navigation.navigationAndSettings')}
          >
            <div className="header-side-menu__header">
              <h2 className="header-side-menu__title">FluentFlow</h2>
              <p className="header-side-menu__subtitle">{t('navigation.navigationAndSettings')}</p>
            </div>

            <div className="header-side-menu__content">
              {/* Navigation Section */}
              <div className="header-side-menu__section">
                <h3 className="header-side-menu__section-title">
                  📱 {t('navigation.mainNavigation')}
                </h3>
                <button
                  onClick={handleGoToMenu}
                  className="header-side-menu__item"
                  aria-label={t('auth.goToMainMenu')}
                >
                  <Menu className="header-side-menu__icon" aria-hidden="true" />
                  <span className="header-side-menu__text">{t('navigation.mainMenu')}</span>
                </button>
                <button
                  onClick={() => {
                    setShowMyProgressTab('dashboard');
                    setShowMyProgress(true);
                    setShowSideMenu(false);
                  }}
                  className="header-side-menu__item"
                  aria-label={t('auth.viewProgressDashboard')}
                >
                  <BarChart3 className="header-side-menu__icon" aria-hidden="true" />
                  <span className="header-side-menu__text">
                    {t('modals.myProgress')}
                  </span>
                </button>
              </div>

              {/* Settings Section */}
              <div className="header-side-menu__section">
                <h3 className="header-side-menu__section-title">
                  ⚙️ {t('navigation.configuration')}
                </h3>
                <button
                  onClick={() => {
                    setShowSettings(true);
                    setShowSideMenu(false);
                  }}
                  className="header-side-menu__item"
                  aria-label={t('modals.advancedSettings', 'Advanced Settings')}
                >
                  <Settings className="header-side-menu__icon" aria-hidden="true" />
                  <span className="header-side-menu__text">{t('modals.advancedSettings')}</span>
                </button>
                <button
                  className="header-side-menu__item"
                  onClick={() => {
                    setShowAbout(true);
                    setShowSideMenu(false);
                  }}
                  aria-label={t('auth.aboutApplication')}
                >
                  <User className="header-side-menu__icon" aria-hidden="true" />
                  <span className="header-side-menu__text">{t('modals.aboutFluentFlow')}</span>
                </button>
              </div>

              {/* User Profile Section - Always visible for consistency */}
              <div className="header-side-menu__section">
                <h3 className="header-side-menu__section-title">
                  👤 {user ? t('modals.userProfile') : t('auth.userAccount', 'User Account')}
                </h3>

                {user ? (
                  // Logged in user options
                  <>
                    <button
                      onClick={() => {
                        setShowProfileForm(true);
                        setShowSideMenu(false);
                      }}
                      className="header-side-menu__item"
                      aria-label={t('auth.editUserProfile')}
                    >
                      <User className="header-side-menu__icon" aria-hidden="true" />
                      <span className="header-side-menu__text">{t('modals.editProfile')}</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowLogoutConfirm(true);
                        setShowSideMenu(false);
                      }}
                      className="header-side-menu__item header-side-menu__item--logout"
                      aria-label={t('auth.logout', 'Logout')}
                    >
                      <LogOut className="header-side-menu__icon" aria-hidden="true" />
                      <span className="header-side-menu__text">{t('auth.logout', 'Logout')}</span>
                    </button>
                  </>
                ) : (
                  // Not logged in - show login option
                  <button
                    onClick={() => {
                      setShowProfileForm(true);
                      setShowSideMenu(false);
                    }}
                    className="header-side-menu__item header-side-menu__item--login"
                    aria-label={t('auth.loginToAccount')}
                  >
                    <User className="header-side-menu__icon" aria-hidden="true" />
                    <span className="header-side-menu__text">{t('auth.login', 'Login')}</span>
                  </button>
                )}
              </div>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};
