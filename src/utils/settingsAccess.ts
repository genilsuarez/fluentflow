import { isLocalPlatformHost } from './platformUrls';

const ADVANCED_SETTINGS_EMAIL = 'genil.suarez@gmail.com';

/** Advanced settings (Ajustes) — owner account or local dev. */
export function canAccessAdvancedSettings(email?: string | null): boolean {
  if (isLocalPlatformHost()) return true;
  if (!email) return false;
  return email.trim().toLowerCase() === ADVANCED_SETTINGS_EMAIL;
}
