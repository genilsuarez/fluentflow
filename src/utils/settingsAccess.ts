const ADVANCED_SETTINGS_EMAIL = 'genil.suarez@gmail.com';

/** Advanced settings (Ajustes) — owner account only. */
export function canAccessAdvancedSettings(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === ADVANCED_SETTINGS_EMAIL;
}
