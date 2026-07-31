import {
  cleanAuthParamsFromUrl,
  fetchProfile,
  isOAuthReturnUrl,
  onAuthStateChange,
  signOut,
} from './supabaseClient';
import { handleAuthenticatedSession, handleSignedOut } from './syncEngine';
import { checkLevelAdvancement, restoreLevelFromProfile } from './levelProgression';
import { markStatsDisplayReady } from '../utils/statsBootstrap';
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
  shouldForceCloudDownload: () => boolean;
  isExplicitLogout: () => boolean;
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
let authHandlerInFlight: Promise<void> | null = null;
let lastHandledUserId: string | null = null;

async function processAuthSession(
  event: string,
  session: { user: { id: string; email?: string | null } }
): Promise<void> {
  const guestReset = getLpGuestReset();
  if (guestReset?.shouldRejectSession?.()) {
    await clearOrphanSupabaseSession();
    guestReset.clearExplicitLogout?.();
    return;
  }

  const forceDownload =
    event === 'SIGNED_IN' ||
    (event === 'INITIAL_SESSION' && isOAuthReturnUrl()) ||
    !!guestReset?.shouldForceCloudDownload?.();

  if (event === 'INITIAL_SESSION' && !forceDownload && lastHandledUserId === session.user.id) {
    cleanAuthParamsFromUrl();
    return;
  }

  while (authHandlerInFlight) {
    await authHandlerInFlight;
  }

  authHandlerInFlight = (async () => {
    const profile = await fetchProfile();
    const hasLocal = !!getLpGuestReset()?.hasLocalSupabaseIdentity?.();
    if (!hasLocal) {
      // First cloud identity on this device.
      syncUserFromSupabase(session.user, profile);
    } else if (profile) {
      // Already logged in — refresh name/email from cloud (other browser edits).
      const current = getLpLogin()?.getUser?.() ?? useUserStore.getState().user;
      if (current?.isSupabaseUser && current.id === session.user.id) {
        const fallbackName = (session.user.email || '').split('@')[0] || 'User';
        const cloudName = profile.name || fallbackName;
        if (current.name !== cloudName || current.email !== (session.user.email || undefined)) {
          syncUserFromSupabase(session.user, profile);
        }
      }
    }
    await restoreLevelFromProfile(profile?.cefr_level);
    await handleAuthenticatedSession(event);
    await checkLevelAdvancement();
    lastHandledUserId = session.user.id;
    cleanAuthParamsFromUrl();
  })();

  try {
    await authHandlerInFlight;
  } finally {
    authHandlerInFlight = null;
  }
}

export function setupSupabaseAuth(): void {
  if (authListenerRegistered) return;
  authListenerRegistered = true;
  setupCrossTabLogoutListener();

  onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT' || !session?.user) {
      lastHandledUserId = null;
      handleSignedOut();
      markStatsDisplayReady();
      // logout() clears lp-user before signOut resolves; honor explicit-logout flag.
      const guestReset = getLpGuestReset();
      const lpLogin = getLpLogin();
      const explicitLogout = !!guestReset?.isExplicitLogout?.();
      const cloudUserStillPresent = !!lpLogin?.getUser?.()?.isSupabaseUser;
      if (explicitLogout || cloudUserStillPresent) {
        guestReset?.clearGuestLocalProgress();
        useUserStore.getState().setUser(null);
        lpLogin?.setUser(null);
      }
      guestReset?.clearExplicitLogout?.();
      return;
    }

    if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
      return;
    }

    await processAuthSession(event, session);
  });
}
