import { fetchProfile, getSession, isAuthenticated, onAuthStateChange } from './supabaseClient';
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

function getLpLogin(): LpLoginBridge | undefined {
  return (window as Window & { lpLogin?: LpLoginBridge }).lpLogin;
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

export function setupSupabaseAuth(): void {
  onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || !session?.user) {
      const lpLogin = getLpLogin();
      if (lpLogin?.getUser?.()?.isSupabaseUser) {
        useUserStore.getState().setUser(null);
        lpLogin.setUser(null);
      }
      return;
    }
    fetchProfile().then(profile => syncUserFromSupabase(session.user, profile));
  });

  isAuthenticated().then(async authed => {
    if (!authed) return;
    const {
      data: { session },
    } = await getSession();
    if (!session?.user) return;

    const lpLogin = getLpLogin();
    const current = lpLogin?.getUser?.() || useUserStore.getState().user;
    if (!current?.isSupabaseUser) {
      const profile = await fetchProfile();
      syncUserFromSupabase(session.user, profile);
    }
  });
}
