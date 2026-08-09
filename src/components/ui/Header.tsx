import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, WifiOff, Wrench, X } from 'lucide-react';
import '../../styles/components/header.css';
import { useAppStore } from '../../stores/appStore';
import { useLearningHeaderStore } from '../../stores/learningHeaderStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useUserStore } from '../../stores/userStore';
import { useMenuNavigation } from '../../hooks/useMenuNavigation';
import { useTranslation } from '../../utils/i18n';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useOfflineStatus } from '../../hooks/useOfflineStatus';
import { portalHref, isLocalPlatformHost } from '../../utils/platformUrls';
import { formatLessonTitleForHeader } from '../../utils/formatLessonTitleForHeader';
import { canAccessAdvancedSettings } from '../../utils/settingsAccess';
// import { toast } from '../../stores/toastStore';
// Lazy-loaded modals — only loaded when user opens them
const CompactAdvancedSettings = React.lazy(() =>
  import('./CompactAdvancedSettings').then(m => ({ default: m.CompactAdvancedSettings }))
);
const CompactAbout = React.lazy(() =>
  import('./CompactAbout').then(m => ({ default: m.CompactAbout }))
);
const CompactMyProgress = React.lazy(() =>
  import('./CompactMyProgress').then(m => ({ default: m.CompactMyProgress }))
);
// Eagerly loaded — always visible
import { ScoreDisplay } from './ScoreDisplay';
import { NavMenuIcon } from './NavMenuIcon';
import { useProgression } from '../../hooks/useProgression';
interface HeaderProps {
  onMenuToggle?: () => void;
}
const NAVIGATION_MODE_KEY = 'lp-navigation-mode';
type NavigationMode = 'sidebar' | 'floating';

function getLpDrawerCloseDelayMs(): number {
  if (typeof window === 'undefined') return 320;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--lp-drawer-duration')
    .trim();
  const msMatch = raw.match(/^([\d.]+)ms$/);
  if (msMatch) return Number(msMatch[1]);
  const secMatch = raw.match(/^([\d.]+)s$/);
  if (secMatch) return Number(secMatch[1]) * 1000;
  return 320;
}

function getStoredNavigationMode(): NavigationMode {
  return localStorage.getItem(NAVIGATION_MODE_KEY) === 'floating' ? 'floating' : 'sidebar';
}
export const Header: React.FC<HeaderProps> = () => {
  const currentView = useAppStore(state => state.currentView);
  const previousMenuContext = useAppStore(state => state.previousMenuContext);
  const lessonProgress = useLearningHeaderStore(state => state.progress);
  const isInGame = currentView !== 'menu';
  const { developmentMode, language, offlineEnabled, theme, setTheme } = useSettingsStore();
  const user = useUserStore(state => state.user);
  const canOpenSettings = canAccessAdvancedSettings(user?.email);
  const { returnToMenu } = useMenuNavigation();
  const { t } = useTranslation(language);
  const { isOnline } = useOfflineStatus();
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [navigationMode, setNavigationMode] = useState<NavigationMode>(getStoredNavigationMode);
  const [showMyProgress, setShowMyProgress] = useState(false);
  const [showMyProgressTab, setShowMyProgressTab] = useState<'dashboard' | 'path'>('dashboard');
  const [showBadge, setShowBadge] = useState(false);
  const [showLearningScoreInHeader, setShowLearningScoreInHeader] = useState(false);
  useEffect(() => {
    if (!canOpenSettings && showSettings) setShowSettings(false);
  }, [canOpenSettings, showSettings]);
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
  useEffect(() => {
    if (!isInGame) {
      setShowLearningScoreInHeader(false);
      return;
    }
    const mq = window.matchMedia('(min-width: 768px)');
    const sync = () => setShowLearningScoreInHeader(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, [isInGame]);
  useEffect(() => {
    document.documentElement.dataset.navigationMode = navigationMode;
  }, [navigationMode]);
  useEffect(() => {
    const syncNavigationMode = (event: StorageEvent) => {
      if (event.key !== NAVIGATION_MODE_KEY) return;
      setNavigationMode(event.newValue === 'floating' ? 'floating' : 'sidebar');
      setShowSideMenu(false);
    };
    window.addEventListener('storage', syncNavigationMode);
    return () => window.removeEventListener('storage', syncNavigationMode);
  }, []);
  const lessonTitle = lessonProgress?.title ?? '';
  const lessonTitleDisplay = useMemo(() => formatLessonTitleForHeader(lessonTitle), [lessonTitle]);
  const progression = useProgression();
  const menuModuleTotal = progression.stats?.totalModules ?? 0;
  const catalogReady = progression.modulesFetched;
  // Theme is now handled by themeInitializer and settingsStore
  // This effect is kept for consistency but theme should already be applied
  // Handle escape key for hamburger menu
  useEscapeKey(showSideMenu, () => setShowSideMenu(false));
  const [viewportLg, setViewportLg] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setViewportLg(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  const isPinnedSidebar = navigationMode === 'sidebar' && viewportLg;
  const offCanvasDrawer = !isPinnedSidebar;
  useEffect(() => {
    if (isPinnedSidebar) setShowSideMenu(false);
  }, [isPinnedSidebar]);
  useEffect(() => {
    let timer: number | undefined;
    const shouldLock = showSideMenu && offCanvasDrawer;

    if (shouldLock) {
      document.body.classList.add('lp-drawer-open');
    } else if (document.body.classList.contains('lp-drawer-open')) {
      timer = window.setTimeout(() => {
        document.body.classList.remove('lp-drawer-open');
      }, getLpDrawerCloseDelayMs());
    }

    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [showSideMenu, offCanvasDrawer]);
  useEffect(() => () => document.body.classList.remove('lp-drawer-open'), []);
  const menuToggleLabel = showSideMenu ? t('navigation.closeMenu') : t('navigation.openMenu');
  const menuToggleShortLabel = showSideMenu
    ? t('navigation.closeMenu')
    : t('navigation.openMenuShort');

  const renderMenuToggleIcon = () =>
    showSideMenu ? (
      <X size={20} aria-hidden="true" />
    ) : (
      <NavMenuIcon name="menu" className="header-redesigned__menu-icon" />
    );

  const handleMenuToggle = () => {
    const nextOpen = !showSideMenu;
    setShowSideMenu(nextOpen);
    if (nextOpen) {
      const lpLogin = (
        window as Window & {
          lpLogin?: {
            getUser?: () => {
              id: string;
              name: string;
              email?: string;
              isSupabaseUser?: boolean;
            } | null;
            refreshNavLabels?: () => void;
          };
        }
      ).lpLogin;
      lpLogin?.refreshNavLabels?.();
      const shared = lpLogin?.getUser?.();
      if (shared) {
        useUserStore.getState().setUser({
          id: shared.id,
          name: shared.name,
          email: shared.email,
          isSupabaseUser: shared.isSupabaseUser,
        });
      }
    }
  };
  const handleNavigationModeToggle = () => {
    const nextMode: NavigationMode = navigationMode === 'sidebar' ? 'floating' : 'sidebar';
    localStorage.setItem(NAVIGATION_MODE_KEY, nextMode);
    setNavigationMode(nextMode);
    setShowSideMenu(false);
  };
  const handleGoToHome = () => {
    useAppStore.getState().setPreviousMenuContext('progression');
    returnToMenu();
    setShowSideMenu(false);
  };
  const handleGoToModules = () => {
    useAppStore.getState().setPreviousMenuContext('list');
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
      className={`header-redesigned${isInGame ? ' header-redesigned--learning-mode' : ' header-redesigned--menu'}${lessonTitle ? ' header-redesigned--has-lesson-title' : ''}`}
    >
      <div
        className={`header-redesigned__container header-redesigned__container--${isInGame ? 'learning' : 'menu'}`}
      >
        {/* Left Section: Back + Menu + Brand */}
        <div className="header-redesigned__left">
          {isInGame ? (
            <>
              <div
                className="header-redesigned__learning-toolbar"
                role="group"
                aria-label={t('navigation.navigationAndSettings')}
              >
                <button
                  onClick={() => returnToMenu()}
                  className="header-redesigned__toolbar-btn header-redesigned__back-btn"
                  title={t('navigation.backToMenu')}
                  aria-label={t('navigation.backToMenu')}
                >
                  <ArrowLeft size={18} aria-hidden="true" />
                </button>
                {lessonTitle ? (
                  <h2
                    className={`header-redesigned__lesson-title${
                      lessonTitleDisplay.isCompact
                        ? ' header-redesigned__lesson-title--compact'
                        : ''
                    }${
                      lessonTitleDisplay.displayLines.length > 1
                        ? ' header-redesigned__lesson-title--multiline'
                        : ''
                    }`}
                    title={lessonTitle}
                  >
                    {lessonTitleDisplay.displayLines.length > 1
                      ? lessonTitleDisplay.displayLines.map((line, index) => (
                          <span
                            key={`${index}-${line}`}
                            className="header-redesigned__lesson-title-line"
                          >
                            {line}
                          </span>
                        ))
                      : lessonTitle}
                  </h2>
                ) : null}
                <button
                  onClick={handleMenuToggle}
                  className={`header-redesigned__toolbar-btn header-redesigned__menu-btn${showSideMenu ? ' header-redesigned__menu-btn--open' : ''}`}
                  title={menuToggleLabel}
                  aria-label={menuToggleLabel}
                  aria-expanded={showSideMenu}
                  aria-controls="navigation-menu"
                >
                  {renderMenuToggleIcon()}
                  <span className="sr-only">{menuToggleShortLabel}</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                onClick={handleMenuToggle}
                className={`header-redesigned__menu-btn${showSideMenu ? ' header-redesigned__menu-btn--open' : ''}${navigationMode === 'floating' ? ' header-redesigned__menu-btn--primary' : ''}`}
                title={menuToggleLabel}
                aria-label={menuToggleLabel}
                aria-expanded={showSideMenu}
                aria-controls="navigation-menu"
              >
                {renderMenuToggleIcon()}
                <span className="sr-only">{menuToggleShortLabel}</span>
              </button>
              <div className="header-redesigned__greeting">
                {previousMenuContext === 'list' ? (
                  <>
                    <h1 className="header-redesigned__greeting-title">
                      {language === 'es' ? (
                        <>
                          Ejercicios <em>guiados</em>
                        </>
                      ) : (
                        <>
                          Guided <em>exercises</em>
                        </>
                      )}
                    </h1>
                    <p className="header-redesigned__greeting-sub">
                      {catalogReady
                        ? t('navigation.headerModulesSub', undefined, {
                            count: String(menuModuleTotal),
                          })
                        : '\u00a0'}
                    </p>
                  </>
                ) : (
                  <>
                    <h1 className="header-redesigned__greeting-title">
                      Fluent<em>Flow</em>
                    </h1>
                    <p className="header-redesigned__greeting-sub">
                      {catalogReady
                        ? t('navigation.headerHomeSub', undefined, {
                            total: String(menuModuleTotal),
                          })
                        : '\u00a0'}
                    </p>
                  </>
                )}
              </div>
            </>
          )}
        </div>
        {/* Center: menu brand/score, or learning score pill (tablet+ only) */}
        {isInGame ? (
          showLearningScoreInHeader ? (
            <div className="header-redesigned__center">
              <div className="header-redesigned__score-wrap">
                <ScoreDisplay />
              </div>
            </div>
          ) : null
        ) : (
          <div className="header-redesigned__center">
            <h1 className="header-redesigned__mobile-title">
              {previousMenuContext === 'list' ? (
                language === 'es' ? (
                  <>
                    Ejercicios <em>guiados</em>
                  </>
                ) : (
                  <>
                    Guided <em>exercises</em>
                  </>
                )
              ) : (
                <>
                  Fluent<em>Flow</em>
                </>
              )}
            </h1>
            <div className="header-redesigned__score-wrap">
              <ScoreDisplay />
            </div>
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
            {developmentMode && canOpenSettings && (
              <button
                className="header-redesigned__dev-indicator"
                title={t('common.developmentModeActive')}
                onClick={() => setShowSettings(true)}
                aria-label={t('common.developmentModeActive')}
              >
                <Wrench size={11} className="header-redesigned__dev-icon" aria-hidden="true" />
                <span className="header-redesigned__dev-text">DEV</span>
              </button>
            )}
          </div>
        )}
        {/* Right Section: Primary Actions Only */}
        <div className="header-redesigned__right">
          {/* User Profile Section moved to hamburger menu */}
        </div>
      </div>
      {/* Compact Modals - rendered via portal to avoid event bubbling to header */}
      {showSettings &&
        canOpenSettings &&
        createPortal(
          <Suspense fallback={null}>
            <CompactAdvancedSettings isOpen={showSettings} onClose={() => setShowSettings(false)} />
          </Suspense>,
          document.body
        )}
      {showAbout &&
        createPortal(
          <Suspense fallback={null}>
            <CompactAbout isOpen={showAbout} onClose={() => setShowAbout(false)} />
          </Suspense>,
          document.body
        )}
      {showMyProgress &&
        createPortal(
          <Suspense fallback={null}>
            <CompactMyProgress
              isOpen={showMyProgress}
              onClose={() => setShowMyProgress(false)}
              initialTab={showMyProgressTab}
            />
          </Suspense>,
          document.body
        )}
      {createPortal(
        <div
          className={`lp-drawer-scrim${showSideMenu && offCanvasDrawer ? ' is-open' : ''}`}
          onClick={event => {
            if (event.target === event.currentTarget) setShowSideMenu(false);
          }}
          role="presentation"
        >
          <nav
            id="navigation-menu"
            className={`header-side-menu lp-drawer${showSideMenu || isPinnedSidebar ? ' is-open' : ''}${isPinnedSidebar ? ' is-persistent' : ''}`}
            role="navigation"
            aria-label={t('navigation.navigationAndSettings')}
          >
            {/* Header: Avatar + User identity (clickable to edit profile) */}
            <div className="header-side-menu__header">
              <div className="header-side-menu__header-row">
                <div className="header-side-menu__identity">
                  <div className="header-side-menu__avatar" aria-hidden="true">
                    F
                  </div>
                  <div>
                    <h2 className="header-side-menu__title">FluentFlow</h2>
                    <p className="header-side-menu__subtitle">LearnFlow</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleNavigationModeToggle}
                  className="header-side-menu__nav-mode-toggle"
                  aria-pressed={navigationMode === 'floating'}
                  aria-label={
                    navigationMode === 'floating'
                      ? language === 'es'
                        ? 'Usar barra lateral fija'
                        : 'Use fixed sidebar'
                      : language === 'es'
                        ? 'Usar menú flotante'
                        : 'Use floating menu'
                  }
                  title={
                    navigationMode === 'floating'
                      ? language === 'es'
                        ? 'Muestra la barra lateral fija'
                        : 'Shows the fixed sidebar'
                      : language === 'es'
                        ? 'Oculta la barra lateral y usa un menú flotante'
                        : 'Hides the sidebar and uses a floating menu'
                  }
                >
                  <span aria-hidden="true">{navigationMode === 'floating' ? '▣' : '◫'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowSideMenu(false)}
                  className="header-side-menu__close-btn"
                  aria-label={t('common.close')}
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </div>
            </div>
            {/* Flat menu — no section headers */}
            <div className="header-side-menu__content">
              <button
                onClick={handleGoToHome}
                className={`header-side-menu__item${!isInGame && useAppStore.getState().previousMenuContext === 'progression' ? ' header-side-menu__item--active' : ''}`}
                aria-label={t('navigation.goToHome')}
                aria-current={
                  !isInGame && useAppStore.getState().previousMenuContext === 'progression'
                    ? 'page'
                    : undefined
                }
              >
                <span className="header-side-menu__icon" aria-hidden="true">
                  <NavMenuIcon name="home" />
                </span>
                <span className="header-side-menu__text">{t('navigation.home')}</span>
              </button>
              <button
                onClick={handleGoToModules}
                className={`header-side-menu__item${!isInGame && useAppStore.getState().previousMenuContext === 'list' ? ' header-side-menu__item--active' : ''}`}
                aria-label={t('navigation.goToExercises')}
                aria-current={
                  !isInGame && useAppStore.getState().previousMenuContext === 'list'
                    ? 'page'
                    : undefined
                }
              >
                <span className="header-side-menu__icon" aria-hidden="true">
                  <NavMenuIcon name="book" />
                </span>
                <span className="header-side-menu__text">{t('navigation.exercises')}</span>
              </button>
              {canOpenSettings && (
                <button
                  onClick={() => {
                    setShowSettings(true);
                    setShowSideMenu(false);
                  }}
                  className="header-side-menu__item"
                  aria-label={t('navigation.settingsShort')}
                >
                  <span className="header-side-menu__icon" aria-hidden="true">
                    <NavMenuIcon name="settings" />
                  </span>
                  <span className="header-side-menu__text">{t('navigation.settingsShort')}</span>
                </button>
              )}
              {developmentMode && (
                <button
                  onClick={() => {
                    setShowMyProgressTab('dashboard');
                    setShowMyProgress(true);
                    setShowSideMenu(false);
                  }}
                  className="header-side-menu__item"
                  aria-label={t('modals.myProgress')}
                >
                  <span className="header-side-menu__icon" aria-hidden="true">
                    <NavMenuIcon name="progress" />
                  </span>
                  <span className="header-side-menu__text">{t('modals.myProgress')}</span>
                </button>
              )}
              {/* Spacer + bottom actions */}
              <div className="header-side-menu__spacer" />
              <div className="header-side-menu__footer">
                <button
                  onClick={() => {
                    setShowAbout(true);
                    setShowSideMenu(false);
                  }}
                  className="header-side-menu__item"
                  aria-label="About LearnFlow"
                >
                  <span className="header-side-menu__icon" aria-hidden="true">
                    <NavMenuIcon name="info" />
                  </span>
                  <span className="header-side-menu__text">About LearnFlow</span>
                </button>
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
                <button
                  type="button"
                  className="header-side-menu__item header-side-menu__item--login"
                  aria-label={user ? `${user.name} — perfil` : t('auth.loginToAccount')}
                  onClick={() => {
                    setShowSideMenu(false);
                    if (typeof window !== 'undefined' && (window as any).lpLogin) {
                      (window as any).lpLogin.open();
                    }
                  }}
                >
                  <span className="header-side-menu__icon" aria-hidden="true">
                    <NavMenuIcon name="user" />
                  </span>
                  <span className="header-side-menu__text">
                    {user ? user.name : t('auth.login')}
                  </span>
                </button>
                <a
                  href={portalHref()}
                  className="header-side-menu__item header-side-menu__item--portal"
                  aria-label="Portal"
                  onClick={e => {
                    if (!isLocalPlatformHost()) return;
                    const url = new URL(e.currentTarget.href, location.origin);
                    url.searchParams.set(
                      'theme',
                      document.documentElement.classList.contains('dark') ? 'dark' : 'light'
                    );
                    e.currentTarget.href = url.toString();
                  }}
                >
                  <span className="header-side-menu__icon" aria-hidden="true">
                    <NavMenuIcon name="home" />
                  </span>
                  <span className="header-side-menu__text">Portal</span>
                </a>
                <a
                  href="privacy.html"
                  className="header-side-menu__item"
                  aria-label="Privacidad"
                  onClick={() => setShowSideMenu(false)}
                >
                  <span className="header-side-menu__icon" aria-hidden="true">
                    <NavMenuIcon name="info" />
                  </span>
                  <span className="header-side-menu__text">Privacidad</span>
                </a>
              </div>
            </div>
          </nav>
        </div>,
        document.body
      )}
    </header>
  );
};
