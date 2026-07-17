import React from 'react';
import { Play } from 'lucide-react';
import { useProgression } from '../../hooks/useProgression';
import { useSettingsStore } from '../../stores/settingsStore';
import { useTranslation } from '../../utils/i18n';
import { useModuleNavigation } from '../../hooks/useModuleNavigation';
import { MODE_I18N_KEYS, getLevelColor } from '../../utils/progressionDisplay';
import '../../styles/components/progression-dashboard.css';

// Standalone "continue where you left off" banner, shown above the search
// toolbar so it's the first thing the learner sees, independent of whatever
// width the toolbar/grid below happen to use.
export const ContinueLearningHero: React.FC = () => {
  const progression = useProgression();
  const { language, theme } = useSettingsStore();
  const { t } = useTranslation(language);
  const { navigateToModule } = useModuleNavigation('progression');

  const nextRecommended = progression.getNextRecommendedModule();
  if (!nextRecommended) return null;

  const handleContinueLearning = () => navigateToModule(nextRecommended);

  const hero = (
    <div className="progression-dashboard__hero">
      <div className="progression-dashboard__continue">
        <div className="progression-dashboard__next-module">
          <div className="progression-dashboard__next-level-col">
            <span
              className="progression-dashboard__level-badge"
              style={
                {
                  '--level-color': getLevelColor(
                    Array.isArray(nextRecommended.level)
                      ? nextRecommended.level[0]
                      : nextRecommended.level
                  ),
                } as React.CSSProperties
              }
            >
              {Array.isArray(nextRecommended.level)
                ? nextRecommended.level[0].toUpperCase()
                : nextRecommended.level.toUpperCase()}
            </span>
            <span className="progression-dashboard__module-type progression-dashboard__module-type--hero">
              {t(MODE_I18N_KEYS[nextRecommended.learningMode] || 'common.exercise')}
            </span>
          </div>
          <div className="progression-dashboard__next-info">
            <h3 className="progression-dashboard__next-name">{nextRecommended.name}</h3>
            <p className="progression-dashboard__next-desc">{nextRecommended.description}</p>
          </div>
          <button className="progression-dashboard__continue-btn" onClick={handleContinueLearning}>
            <Play className="progression-dashboard__continue-icon" />
            {t('common.continue')}
          </button>
        </div>
      </div>
    </div>
  );

  // Dark-theme overrides in progression-dashboard.css target
  // ".progression-dashboard--dark-theme .progression-dashboard__hero" (and
  // sibling selectors) via a descendant combinator, so this wrapper has to
  // reproduce that same ancestor class rather than putting it on the hero
  // element itself.
  return theme === 'dark' ? <div className="progression-dashboard--dark-theme">{hero}</div> : hero;
};
