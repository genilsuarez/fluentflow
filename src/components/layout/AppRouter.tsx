import React, { Suspense } from 'react';
import { useAppStore } from '../../stores/appStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useModuleData } from '../../hooks/useModuleData';
import { useTranslation } from '../../utils/i18n';
import { ModuleNotAvailableOfflineError } from '../../utils/secureHttp';
import { lazyWithRetry } from '../../utils/lazyWithRetry';
import { LoadingSkeleton } from '../ui/LoadingSkeleton';
import { MainMenu } from '../ui/MainMenu';
import type { LearningModule } from '../../types';
import '../../styles/components/app-router.css';

// Lazy load learning components with auto-retry on chunk load failure
const FlashcardComponent = lazyWithRetry(() => import('../learning/FlashcardComponent'));
const QuizComponent = lazyWithRetry(() => import('../learning/QuizComponent'));
const CompletionComponent = lazyWithRetry(() => import('../learning/CompletionComponent'));
const SortingComponent = lazyWithRetry(() => import('../learning/SortingComponent'));
const MatchingComponent = lazyWithRetry(() => import('../learning/MatchingComponent'));
const ReadingComponent = lazyWithRetry(() => import('../learning/ReadingComponent'));

// Enhanced loading component
const ComponentLoader: React.FC = () => (
  <div className="app-router__loader">
    <LoadingSkeleton />
  </div>
);

// Error component for module loading failures
const ModuleError: React.FC<{ error: Error; moduleId: string; onRetry: () => void }> = ({
  error,
  moduleId,
  onRetry,
}) => {
  const { language } = useSettingsStore();
  const { t } = useTranslation(language);
  const setCurrentView = useAppStore(state => state.setCurrentView);

  // Check if this is an offline error
  const isOfflineError = error instanceof ModuleNotAvailableOfflineError;

  const handleGoToSettings = () => {
    setCurrentView('menu');
    // Navigate to menu and let user access settings from there
    window.location.hash = '#/menu';
  };

  return (
    <div className="app-router__error">
      <div className="app-router__error-container">
        <div className="app-router__error-icon">{isOfflineError ? '📡' : '⚠️'}</div>
        <h3 className="app-router__error-title">
          {isOfflineError
            ? t('errors.moduleNotAvailableOffline')
            : `${t('errors.failedToLoadModule')}: ${moduleId}`}
        </h3>
        <p className="app-router__error-message">
          {isOfflineError ? t('errors.moduleNotAvailableOfflineDescription') : error.message}
        </p>
        <div className="app-router__error-actions">
          {isOfflineError ? (
            <>
              <button
                onClick={handleGoToSettings}
                className="app-router__error-btn app-router__error-btn--primary"
              >
                {t('errors.goToOfflineSettings')}
              </button>
              <button
                onClick={onRetry}
                className="app-router__error-btn app-router__error-btn--secondary"
              >
                {t('errors.tryAgain')}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={onRetry}
                className="app-router__error-btn app-router__error-btn--primary"
              >
                {t('errors.tryAgain')}
              </button>
              <button
                onClick={() => window.location.reload()}
                className="app-router__error-btn app-router__error-btn--secondary"
              >
                {t('errors.goToHome')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

interface LearningComponentWrapperProps {
  moduleId: string;
  children: (module: LearningModule) => React.ReactNode;
}

// Wrapper component to handle module data loading
const LearningComponentWrapper: React.FC<LearningComponentWrapperProps> = ({
  moduleId,
  children,
}) => {
  const { data: moduleData, isLoading, error, refetch } = useModuleData(moduleId);
  const { language } = useSettingsStore();
  const { t } = useTranslation(language);

  if (isLoading) {
    return <ComponentLoader />;
  }

  if (error) {
    return <ModuleError error={error as Error} moduleId={moduleId} onRetry={() => refetch()} />;
  }

  if (!moduleData) {
    return (
      <div className="app-router__no-module">
        <p className="app-router__no-module-text">{t('messages.noDataAvailable')}</p>
      </div>
    );
  }

  return <>{children(moduleData)}</>;
};

export const AppRouter: React.FC = () => {
  const currentView = useAppStore(state => state.currentView);
  const currentModule = useAppStore(state => state.currentModule);
  const { language } = useSettingsStore();
  const { t } = useTranslation(language);

  // Return menu for menu view
  if (currentView === 'menu') {
    return <MainMenu />;
  }

  // For learning modes, we need a module
  // Try to get moduleId from currentModule, or fallback to hash
  let moduleId = currentModule?.id;

  // If no moduleId in Zustand, try to extract from hash (handles race condition)
  if (!moduleId) {
    const hash = window.location.hash;
    if (hash.startsWith('#/learn/')) {
      moduleId = hash.replace('#/learn/', '');
    }
  }

  if (!moduleId) {
    return (
      <div className="app-router__no-module">
        <p className="app-router__no-module-text">{t('messages.noModuleSelected')}</p>
        <button onClick={() => window.location.reload()} className="app-router__no-module-btn">
          {t('messages.returnToMenu')}
        </button>
      </div>
    );
  }

  return (
    <Suspense fallback={<ComponentLoader />}>
      <LearningComponentWrapper moduleId={moduleId}>
        {module => {
          switch (currentView) {
            case 'flashcard':
              return <FlashcardComponent module={module} />;
            case 'quiz':
              return <QuizComponent module={module} />;
            case 'completion':
              return <CompletionComponent module={module} />;
            case 'sorting':
              return <SortingComponent module={module} />;
            case 'matching':
              return <MatchingComponent module={module} />;
            case 'reading':
              return <ReadingComponent module={module} />;
            default:
              return (
                <div className="app-router__unknown-view">
                  <p className="app-router__unknown-view-text">Unknown view: {currentView}</p>
                </div>
              );
          }
        }}
      </LearningComponentWrapper>
    </Suspense>
  );
};
