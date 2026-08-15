import { useAppStore } from '../stores/appStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useTranslation } from '../utils/i18n';

/**
 * Custom hook for handling menu navigation with context awareness
 * Returns users to their previous menu context (progression or list view)
 */
export const useMenuNavigation = () => {
  const { setCurrentView, previousMenuContext } = useAppStore();
  const { language } = useSettingsStore();
  const { t } = useTranslation(language);

  const returnToMenu = (options?: { autoScrollToNext?: boolean }) => {
    // Single choke point for every "exit exercise" affordance (header back
    // arrow, side-menu Home/Modules, GameControlsExitButton, Escape key):
    // confirm only when there's scored progress this session hasn't saved.
    // finishExercise() calls resetSession() right after recording the
    // attempt, so sessionScore.total is back to 0 by the time the result
    // screen shows — no false-positive confirm right after finishing.
    const { sessionScore } = useAppStore.getState();
    if (sessionScore.total > 0 && !window.confirm(t('learning.confirmExitScored'))) {
      return;
    }

    // Set flag for auto-scroll to next module if requested
    if (options?.autoScrollToNext) {
      try {
        sessionStorage.setItem('autoScrollToNext', 'true');
      } catch {
        /* */
      }
    }

    // Clear the hash so re-entering the same module works correctly
    window.location.hash = '#/menu';
    setCurrentView('menu');
    // The MainMenu component will automatically use the previousMenuContext
    // to set the correct view mode when it mounts
  };

  return {
    returnToMenu,
    previousMenuContext,
  };
};
