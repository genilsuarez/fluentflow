import React from 'react';
import { RotateCcw } from 'lucide-react';
import { useMobileLandscapeLock } from '../../hooks/useMobileLandscapeLock';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../utils/i18n';
import '../../styles/components/orientation-lock.css';

interface OrientationLockProps {
  message?: string;
  subtitle?: string;
}

/**
 * Landscape blocker for small mobile viewports only — not mounted on desktop
 * so assistive tech does not announce hidden overlay copy.
 */
export const OrientationLock: React.FC<OrientationLockProps> = ({ message, subtitle }) => {
  const active = useMobileLandscapeLock();
  const { language } = useSettingsStore();
  const { t } = useTranslation(language);

  if (!active) return null;

  return (
    <div className="orientation-lock" role="dialog" aria-modal="true" aria-live="polite">
      <div className="orientation-lock__container">
        <div className="orientation-lock__icon-wrapper">
          <RotateCcw className="orientation-lock__icon" size={48} aria-hidden="true" />
        </div>

        <div className="orientation-lock__content">
          <h2 className="orientation-lock__title">{message || t('orientation.title')}</h2>
          <p className="orientation-lock__subtitle">{subtitle || t('orientation.subtitle')}</p>
          <p className="orientation-lock__explanation">{t('orientation.explanation')}</p>
        </div>
      </div>
    </div>
  );
};
