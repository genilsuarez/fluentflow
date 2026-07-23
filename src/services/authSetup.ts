import { fetchProfile, onAuthStateChange, signOut } from './supabaseClient';
import { handleAuthenticatedSession, handleSignedOut } from './syncEngine';
import { useUserStore } from '../stores/userStore';
import type { User } from '../types';

type LpLoginBridge = {
  setUserFromSupabase: (
    user: { id: string; email?: string | null },
    profile: { name?: string } | null
  ) => void;
  setUser: (user: User | null) => void;
  getUser: () => (User & { isSupabaseUser?: boolean }) | null;
};

type LpGuestResetBridge = {
  clearGuestLocalProgress: () => void;
  hasLocalSupabaseIdentity: () => boolean;
  shouldRejectSession: () => boolean;
  clearExplicitLogout: () => void;
};

function getLpLogin(): LpLoginBridge | undefined {
  return (window as Window & { lpLogin?: LpLoginBridge }).lpLogin;
}

function getLpGuestReset(): LpGuestResetBridge | undefined {
  return (window as Window & { lpGuestReset?: LpGuestResetBridge }).lpGuestReset;
}

function syncUserFromSupabase(
  user: { id: string; email?: string | null },
  profile: { name?: string } | null
) {
  const lpLogin = getLpLogin();
  if (lpLogin?.setUserFromSupabase) {
    lpLogin.setUserFromSupabase(user, profile);
    return;
  }

  const fallbackName = (user.email || '').split('@')[0] || 'User';
  useUserStore.getState().setUser({
    id: user.id,
    name: (profile && profile.name) || fallbackName,
    email: user.email || undefined,
    isSupabaseUser: true,
  });
}

async function clearOrphanSupabaseSession(): Promise<void> {
  try {
    await signOut();
  } catch {
    /* noop */
  }
}

function setupCrossTabLogoutListener(): void {
  window.addEventListener('lp-explicit-logout', () => {
    void clearOrphanSupabaseSession();
  });
}

let authListenerRegistered = false;

export function setupSupabaseAuth(): void {
  if (authListenerRegistered) return;
  authListenerRegistered = true;
  setupCrossTabLogoutListener();

  onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT' || !session?.user) {
      handleSignedOut();
      const lpLogin = getLpLogin();
      if (lpLogin?.getUser?.()?.isSupabaseUser) {
        getLpGuestReset()?.clearGuestLocalProgress();
        useUserStore.getState().setUser(null);
        lpLogin.setUser(null);
      }
      return;
    }

    if (getLpGuestReset()?.shouldRejectSession?.()) {
      await clearOrphanSupabaseSession();
      getLpGuestReset()?.clearExplicitLogout?.();
      return;
    }

    if (!getLpGuestReset()?.hasLocalSupabaseIdentity?.()) {
      const profile = await fetchProfile();
      syncUserFromSupabase(session.user, profile);
    }

    await handleAuthenticatedSession(event);
  });
}
