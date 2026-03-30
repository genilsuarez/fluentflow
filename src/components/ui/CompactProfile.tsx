import React, { useState } from 'react';
import { X, User, Save, Trophy, BookOpen, Flame, TrendingUp } from 'lucide-react';
import { useUserStore } from '../../stores/userStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../utils/i18n';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { EditableInput } from './EditableInput';
import '../../styles/components/compact-profile.css';
import '../../styles/components/modal-buttons.css';

interface CompactProfileProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CompactProfile: React.FC<CompactProfileProps> = ({ isOpen, onClose }) => {
  const { user, setUser, getGlobalStats } = useUserStore();
  const { language } = useSettingsStore();
  const { t } = useTranslation(language);

  const [name, setName] = useState(user?.name || '');
  const [error, setError] = useState('');

  useEscapeKey(isOpen, onClose);

  const stats = getGlobalStats();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError(t('profile.nameRequired'));
      return;
    }
    setUser({
      id: user?.id || Date.now().toString(),
      name: trimmed,
    });
    onClose();
  };

  if (!isOpen) return null;

  const initial = (user?.name || name || '?')[0].toUpperCase();
  const hasActivity = stats.totalModules > 0;

  return (
    <div className="compact-profile">
      <div className="compact-profile__container">
        <div className="compact-profile__header">
          <div className="compact-profile__title-section">
            <User className="compact-profile__icon" />
            <h2 className="compact-profile__title">{t('modals.userProfile')}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="modal__close-btn"
            aria-label={t('common.close')}
          >
            <X className="modal__close-icon" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="compact-profile__form">
          <div className="compact-profile__content">
            {/* Avatar + Name */}
            <div className="compact-profile__identity">
              <div className="compact-profile__avatar">
                <span className="compact-profile__avatar-letter">{initial}</span>
              </div>
              <div className="compact-profile__name-field">
                <label className="compact-profile__label compact-profile__label--required">
                  {t('profile.name')}
                </label>
                <EditableInput
                  value={name}
                  onChange={v => {
                    setName(v);
                    if (v.trim().length >= 2) setError('');
                  }}
                  className={`compact-profile__input ${error ? 'compact-profile__input--error' : ''}`}
                  placeholder={t('profile.enterName')}
                />
                {error && <span className="compact-profile__error">{error}</span>}
              </div>
            </div>

            {/* Stats Summary */}
            {hasActivity ? (
              <div className="compact-profile__stats">
                <div className="compact-profile__stat">
                  <div className="compact-profile__stat-icon compact-profile__stat-icon--score">
                    <Trophy size={16} />
                  </div>
                  <div className="compact-profile__stat-info">
                    <span className="compact-profile__stat-value">{stats.totalScore}</span>
                    <span className="compact-profile__stat-label">
                      {t('profile.statScore', 'Score')}
                    </span>
                  </div>
                </div>
                <div className="compact-profile__stat">
                  <div className="compact-profile__stat-icon compact-profile__stat-icon--modules">
                    <BookOpen size={16} />
                  </div>
                  <div className="compact-profile__stat-info">
                    <span className="compact-profile__stat-value">{stats.totalModules}</span>
                    <span className="compact-profile__stat-label">
                      {t('profile.statModules', 'Modules')}
                    </span>
                  </div>
                </div>
                <div className="compact-profile__stat">
                  <div className="compact-profile__stat-icon compact-profile__stat-icon--streak">
                    <Flame size={16} />
                  </div>
                  <div className="compact-profile__stat-info">
                    <span className="compact-profile__stat-value">{stats.bestStreak}</span>
                    <span className="compact-profile__stat-label">
                      {t('profile.statStreak', 'Streak')}
                    </span>
                  </div>
                </div>
                <div className="compact-profile__stat">
                  <div className="compact-profile__stat-icon compact-profile__stat-icon--avg">
                    <TrendingUp size={16} />
                  </div>
                  <div className="compact-profile__stat-info">
                    <span className="compact-profile__stat-value">{stats.avgScore}%</span>
                    <span className="compact-profile__stat-label">
                      {t('profile.statAvg', 'Average')}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="compact-profile__empty-stats">
                <span className="compact-profile__empty-stats-emoji">🎯</span>
                <p className="compact-profile__empty-stats-text">
                  {t('profile.noActivityYet', 'Complete modules to see your stats here')}
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="modal__actions modal__actions--single">
            <button type="submit" className="modal__btn modal__btn--primary">
              <Save className="modal__btn-icon" />
              {t('profile.saveProfile')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
