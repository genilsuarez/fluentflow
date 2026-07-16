import React, { useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { useSettingsStore } from '../../stores/settingsStore';
import { useMenuNavigation } from '../../hooks/useMenuNavigation';
import { useTranslation } from '../../utils/i18n';
import '../../styles/components/offline-modal.css';

interface OfflineModalProps {
  isOpen: boolean;
  onRetry: () => void;
}

export const OfflineModal: React.FC<OfflineModalProps> = ({ isOpen, onRetry }) => {
  const { language } = useSettingsStore();
  const { t } = useTranslation(language);
  const { returnToMenu } = useMenuNavigation();

  const handleGoToMenu = () => returnToMenu();

  // Escape key to go home
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleGoToMenu();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="offline-modal" role="alert" aria-labelledby="offline-modal-title">
      <div className="offline-modal__container">
        <div className="offline-modal__header">
          <span className="offline-modal__icon" aria-hidden="true">
            📡
          </span>
        </div>
        <div className="offline-modal__body">
          <h2 id="offline-modal-title" className="offline-modal__title">
            {t('errors.moduleNotAvailableOffline')}
          </h2>
          <p className="offline-modal__message">
            {t('errors.moduleNotAvailableOfflineDescription')}
          </p>
        </div>
        <div className="offline-modal__actions">
          <button
            onClick={handleGoToMenu}
            className="offline-modal__btn offline-modal__btn--primary"
          >
            {t('messages.returnToMenu')}
          </button>
          <button onClick={onRetry} className="offline-modal__btn offline-modal__btn--secondary">
            {t('errors.tryAgain')}
          </button>
        </div>
      </div>

      {/* Game controls bar with home button — matches learning components pattern */}
      <div className="game-controls">
        <button
          onClick={handleGoToMenu}
          className="game-controls__home-btn"
          title={t('learning.returnToMainMenu')}
        >
          <span className="game-controls__home-icon" aria-hidden="true">🏠</span>
        </button>

        <button
          onClick={onRetry}
          className="game-controls__primary-btn game-controls__primary-btn--blue"
        >
          <RotateCcw className="game-controls__primary-icon" />
          <span>{t('errors.tryAgain')}</span>
        </button>
      </div>
    </div>
  );
};
