import { useAppStore } from '../stores/appStore';
import { useProgressStore } from '../stores/progressStore';
import { useUserStore } from '../stores/userStore';

function applyGuestResetInMemory(): void {
  useProgressStore.getState().resetProgress();
  useUserStore.setState({ user: null, userScores: {} });
  useAppStore.getState().resetGlobalScore();
}

export function setupGuestResetListener(): void {
  window.addEventListener('lp-guest-reset', applyGuestResetInMemory);

  window.addEventListener('storage', event => {
    if (event.key?.startsWith('learnflow:progress:') && event.newValue === null) {
      applyGuestResetInMemory();
    }
  });
}
