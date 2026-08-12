/**
 * Tipos del contrato window.lp* que exponen los scripts clásicos compartidos
 * (lp-login.js, lp-guest-reset.js, lp-login-nudge.js) para quien los consume
 * como <script src> plano — hoy solo FluentFlow, vía copy-shared.sh.
 *
 * Fuente de verdad de cada shape: la implementación en scripts/*.js (objeto
 * devuelto por el IIFE). Si esos scripts cambian una firma, actualizar acá —
 * ver docs/auditoria-y-plan.md — C.3.2.
 */

interface LpUser {
  id: string;
  name: string;
  email?: string;
  isSupabaseUser?: boolean;
}

interface LpLoginOpenOptions {
  copy?: { eyebrow?: string; title?: string; lede?: string };
}

interface LpLoginBindNavButtonOptions {
  beforeOpen?: () => void;
  labelSelector?: string | Element;
  defaultLabel?: string;
  onSync?: (user: LpUser | null, btn: Element) => void;
}

interface LpLogin {
  getUser(): LpUser | null;
  setUser(user: LpUser | null): void;
  setUserFromSupabase(
    user: { id: string; email?: string | null },
    profile: { name?: string } | null
  ): void;
  logout(): void;
  open(options?: LpLoginOpenOptions): void;
  close(): void;
  onUpdate(fn: (user: LpUser | null) => void): void;
  bindNavButton(
    selector: string | Element,
    options?: LpLoginBindNavButtonOptions
  ): (user: LpUser | null) => void;
  refreshNavLabels(): void;
}

interface LpGuestReset {
  clearGuestLocalProgress(): void;
  clearSharedUserIdentity(): void;
  clearLocalCachePreserveSession(): void;
  hasLocalSupabaseIdentity(): boolean;
  hasLocalProgress(): boolean;
  markExplicitLogout(): void;
  isExplicitLogout(): boolean;
  clearExplicitLogout(): void;
  shouldRejectSession(): boolean;
  shouldForceCloudDownload(): boolean;
}

interface LpLoginNudgeCopy {
  eyebrow: string;
  title: string;
  lede: string;
}

interface LpLoginNudge {
  maybePrompt(options: { hasProgress: boolean; copy: LpLoginNudgeCopy }): boolean;
}

/**
 * window.lpSupabase — no es el módulo ESM scripts/lp-supabase.js (ese no se
 * expone en window; las apps vanilla lo consumen por `import`). Es el bridge
 * que FluentFlow arma en src/main.tsx (única fuente de este objeto) para que
 * lp-login.js (script clásico) pueda disparar OAuth/magic-link/perfil sin
 * depender de un import ESM. Tipado laxo a propósito: a diferencia de
 * lpLogin/lpGuestReset (leídos con formas inline distintas en 9 archivos),
 * este solo lo escribe main.tsx — no hay riesgo de duplicación que tipar.
 */
type LpSupabaseBridge = Record<string, unknown>;

interface Window {
  lpLogin?: LpLogin;
  lpGuestReset?: LpGuestReset;
  lpLoginNudge?: LpLoginNudge;
  lpSupabase?: LpSupabaseBridge;
}
