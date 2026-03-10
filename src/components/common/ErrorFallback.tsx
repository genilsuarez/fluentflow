import React from 'react';
import { useTranslation } from '../../utils/i18n';
import { useSettingsStore } from '../../stores/settingsStore';
import '../../styles/components/error-fallback.css';

interface ErrorFallbackProps {
  error: Error | null;
  retry: () => void;
}

export const DefaultErrorFallback: React.FC<ErrorFallbackProps> = ({ error, retry }) => {
  const { language } = useSettingsStore();
  const { t } = useTranslation(language);

  return (
    <div className="error-fallback">
      <div className="error-fallback__card">
        <div className="error-fallback__icon">⚠️</div>
        <h2 className="error-fallback__title">{t('errors.somethingWentWrong')}</h2>
        <p className="error-fallback__message">{t('errors.unexpectedError')}</p>
        {import.meta.env.DEV && error && (
          <details className="error-fallback__details">
            <summary className="error-fallback__details-summary">
              {t('errors.errorDetails')}
            </summary>
            <pre className="error-fallback__details-content">
              {error.message}
              {error.stack}
            </pre>
          </details>
        )}
        <div className="error-fallback__actions">
          <button
            onClick={retry}
            className="error-fallback__button error-fallback__button--primary"
          >
            {t('errors.tryAgain')}
          </button>
          <button
            onClick={() => (window.location.href = './')}
            className="error-fallback__button error-fallback__button--secondary"
          >
            {t('errors.goToHome')}
          </button>
        </div>
      </div>
    </div>
  );
};
