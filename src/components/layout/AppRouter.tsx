import React, { Suspense, lazy } from 'react';
import { useAppStore } from '../../stores/appStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useModuleData } from '../../hooks/useModuleData';
import { useTranslation } from '../../utils/i18n';
import { LoadingSkeleton } from '../ui/LoadingSkeleton';
import { MainMenu } from '../ui/MainMenu';
import type { LearningModule } from '../../types';
import '../../styles/components/app-router.css';

// Helper to get translated error message outside React context (no hooks)
const getErrorMsg = () => {
  const lang = useSettingsStore.getState().language;
  // Access translation directly without useTranslation hook
  const translations: Record<string, Record<string, string>> = {
    en: { 'errors.failedToLoadComponent': 'Failed to load component' },
    es: { 'errors.failedToLoadComponent': 'Error al cargar componente' },
  };
  return translations[lang]?.['errors.failedToLoadComponent'] || 'Failed to load component';
};

// Lazy load learning components with better error handling
const FlashcardComponent = lazy(() =>
  import('../learning/FlashcardComponent')
    .then(module => ({
      default: module.default,
    }))
    .catch(() => ({
      default: () => <div className="app-router__error-fallback">{getErrorMsg()}</div>,
    }))
);

const QuizComponent = lazy(() =>
  import('../learning/QuizComponent')
    .then(module => ({
      default: module.default,
    }))
    .catch(() => ({
      default: () => <div className="app-router__error-fallback">{getErrorMsg()}</div>,
    }))
);

const CompletionComponent = lazy(() =>
  import('../learning/CompletionComponent')
    .then(module => ({
      default: module.default,
    }))
    .catch(() => ({
      default: () => <div className="app-router__error-fallback">{getErrorMsg()}</div>,
    }))
);

const SortingComponent = lazy(() =>
  import('../learning/SortingComponent')
    .then(module => ({
      default: module.default,
    }))
    .catch(() => ({
      default: () => <div className="app-router__error-fallback">{getErrorMsg()}</div>,
    }))
);

const MatchingComponent = lazy(() =>
  import('../learning/MatchingComponent')
    .then(module => ({
      default: module.default,
    }))
    .catch(() => ({
      default: () => <div className="app-router__error-fallback">{getErrorMsg()}</div>,
    }))
);

const ReadingComponent = lazy(() =>
  import('../learning/ReadingComponent')
    .then(module => ({
      default: module.default,
    }))
    .catch(() => ({
      default: () => <div className="app-router__error-fallback">{getErrorMsg()}</div>,
    }))
);

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

  return (
    <div className="app-router__error">
      <div className="app-router__error-container">
        <div className="app-router__error-icon">⚠️</div>
        <h3 className="app-router__error-title">
          {t('errors.failedToLoadModule')}: {moduleId}
        </h3>
        <p className="app-router__error-message">{error.message}</p>
        <div className="app-router__error-actions">
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
  const { currentView, currentModule } = useAppStore();
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
