import { useCallback } from 'react';
import { useProgression } from './useProgression';
import { useAppStore } from '../stores/appStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useTranslation } from '../utils/i18n';
import { toast } from '../stores/toastStore';
import type { LearningModule, MenuContext } from '../types';

/**
 * Returns the localized label for a learning mode.
 */
function getModeLabel(learningMode: string, t: (key: string) => string): string {
  const labels: Record<string, string> = {
    flashcard: t('mainMenu.modeFlashcard'),
    quiz: t('mainMenu.modeQuiz'),
    completion: t('mainMenu.modeCompletion'),
    sorting: t('mainMenu.modeSorting'),
    matching: t('mainMenu.modeMatching'),
    reading: t('mainMenu.modeReading'),
  };
  return labels[learningMode] || t('mainMenu.modeDefault');
}

/**
 * Shared hook for navigating to a learning module.
 * Encapsulates access check, toast feedback, context saving, and hash navigation.
 */
export const useModuleNavigation = (menuContext?: MenuContext) => {
  const progression = useProgression();
  const { setPreviousMenuContext } = useAppStore();
  const { language } = useSettingsStore();
  const { t } = useTranslation(language);

  const navigateToModule = useCallback(
    (module: LearningModule) => {
      if (!progression.canAccessModule(module.id)) {
        const missingPrereqs = progression.getMissingPrerequisites(module.id);
        const prereqNames = missingPrereqs.map(p => p.name).join(', ');

        toast.warning(
          t('mainMenu.moduleBlocked'),
          t('mainMenu.moduleBlockedDesc', undefined, { prereqs: prereqNames }),
          { duration: 3000 }
        );
        return;
      }

      toast.info(
        t('mainMenu.startingModule'),
        `${module.name} - ${getModeLabel(module.learningMode, t)}`,
        { duration: 1500 }
      );

      if (menuContext) {
        setPreviousMenuContext(menuContext);
      }

      window.location.hash = `#/learn/${module.id}`;
    },
    [progression, setPreviousMenuContext, menuContext, t]
  );

  return { navigateToModule, getModeLabel: (mode: string) => getModeLabel(mode, t) };
};
