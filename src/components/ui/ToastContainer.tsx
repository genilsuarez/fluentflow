import React from 'react';
import { createPortal } from 'react-dom';
import Toast from './Toast';
import { useToastStore } from '../../stores/toastStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../utils/i18n';
import '../../styles/components/toast-card.css';

export const ToastContainer: React.FC = () => {
  const { currentToast, isVisible, clearToast } = useToastStore();
  const { language } = useSettingsStore();
  const { t } = useTranslation(language);
  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;

  // Only render if there's a toast and it's visible (desktop only)
  if (isMobile || !currentToast || !isVisible) {
    return null;
  }

  return createPortal(
    <div aria-label={t('navigation.notifications')} role="region" className="toast-container">
      <Toast key={currentToast.id} toast={currentToast} onClose={clearToast} />
    </div>,
    document.body
  );
};
